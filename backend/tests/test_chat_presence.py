"""Integration tests for Chat and Presence feature modules."""

from pathlib import Path
import pytest
from app.core.config import Settings
from app.core.context import ApplicationContext
from app.transport.connection_manager import ConnectionManager
from app.engine.event_bus import EventRegistry
from app.modules.canvas.module import CanvasFeatureModule
from app.modules.chat.module import ChatFeatureModule
from app.modules.presence.module import PresenceFeatureModule
from app.transport.session import ClientSession, TransportType
from app.transport.envelope import MessageEnvelope


class MockSession(ClientSession):
    def __init__(self, session_id: str, display_name: str = "TestUser"):
        super().__init__(
            session_id=session_id,
            transport=TransportType.WEBSOCKET,
            remote_address="127.0.0.1:9000",
        )
        self.display_name = display_name
        self.inbox = []

    async def send_envelope(self, envelope: MessageEnvelope) -> None:
        self.inbox.append(envelope)

    async def send_raw(self, data: bytes) -> None:
        pass

    async def close(self, code: int = 1000, reason: str = "") -> None:
        self.is_active = False


@pytest.mark.asyncio
async def test_chat_and_presence_flow(tmp_path: Path):
    settings = Settings(DATABASE_PATH=tmp_path / "collab_chat_presence.db")
    context = ApplicationContext(
        settings=settings,
        connection_manager=ConnectionManager(),
        event_bus=EventRegistry(),
    )

    # Initialize modules in order
    canvas_mod = CanvasFeatureModule()
    chat_mod = ChatFeatureModule()
    presence_mod = PresenceFeatureModule()

    await canvas_mod.initialize(context)
    canvas_mod.register_events(context.event_bus)

    await chat_mod.initialize(context)
    chat_mod.register_events(context.event_bus)

    await presence_mod.initialize(context)
    presence_mod.register_events(context.event_bus)

    # 1. Connect two peers in room "chat-room"
    alice = MockSession("sess-alice", "Alice")
    alice.role = "HOST"
    bob = MockSession("sess-bob", "Bob")
    bob.role = "EDITOR"

    await context.connection_manager.register_session(alice)
    await context.connection_manager.join_room(alice.session_id, "chat-room")

    await context.connection_manager.register_session(bob)
    await context.connection_manager.join_room(bob.session_id, "chat-room")

    # 2. Alice sends a chat message
    chat_env = MessageEnvelope(
        room_id="chat-room",
        sender_id="sess-alice",
        type="CHAT_MSG_SEND",
        payload={"content": "Hello Bob from Alice!"},
    )
    await context.event_bus.dispatch(alice, chat_env)

    # Both Alice and Bob should receive CHAT_MSG_BROADCAST
    alice_chat = [m for m in alice.inbox if m.type == "CHAT_MSG_BROADCAST"]
    bob_chat = [m for m in bob.inbox if m.type == "CHAT_MSG_BROADCAST"]
    assert len(alice_chat) == 1
    assert len(bob_chat) == 1
    assert bob_chat[0].payload["content"] == "Hello Bob from Alice!"
    assert bob_chat[0].payload["sender_name"] == "Alice"

    # 3. Test chat history request
    hist_env = MessageEnvelope(
        room_id="chat-room",
        sender_id="sess-bob",
        type="CHAT_HISTORY_REQ",
        payload={"limit": 10},
    )
    await context.event_bus.dispatch(bob, hist_env)
    bob_hist = [m for m in bob.inbox if m.type == "CHAT_HISTORY_RES"]
    assert len(bob_hist) == 1
    messages = bob_hist[0].payload["messages"]
    assert len(messages) >= 1
    assert messages[0]["content"] == "Hello Bob from Alice!"

    # 4. Alice moves her cursor
    cursor_env = MessageEnvelope(
        room_id="chat-room",
        sender_id="sess-alice",
        type="PRESENCE_CURSOR",
        payload={"x": 150.5, "y": 200.0, "color": "#ef4444", "active_tool": "pencil"},
    )
    await context.event_bus.dispatch(alice, cursor_env)

    # Bob must receive PRESENCE_UPDATE, Alice MUST NOT (sender excluded)
    alice_cursor = [m for m in alice.inbox if m.type == "PRESENCE_UPDATE"]
    bob_cursor = [m for m in bob.inbox if m.type == "PRESENCE_UPDATE"]
    assert len(alice_cursor) == 0
    assert len(bob_cursor) == 1
    assert bob_cursor[0].payload["x"] == 150.5
    assert bob_cursor[0].payload["display_name"] == "Alice"

    # 4.5 Bob requests cursor sharing permission
    req_env = MessageEnvelope(
        room_id="chat-room",
        sender_id="sess-bob",
        type="CURSOR_PERMISSION_REQ",
    )
    await context.event_bus.dispatch(bob, req_env)
    alice_notifs = [m for m in alice.inbox if m.type == "CURSOR_PERMISSION_NOTIFICATION"]
    assert len(alice_notifs) == 1
    assert alice_notifs[0].payload["requester_session_id"] == "sess-bob"

    # Alice grants permission to Bob
    decision_env = MessageEnvelope(
        room_id="chat-room",
        sender_id="sess-alice",
        type="CURSOR_PERMISSION_DECISION",
        payload={"target_session_id": "sess-bob", "allowed": True},
    )
    await context.event_bus.dispatch(alice, decision_env)
    assert "sess-bob" in presence_mod.allowed_cursor_sessions["chat-room"]

    # 5. Query active roster
    roster_env = MessageEnvelope(
        room_id="chat-room",
        sender_id="sess-bob",
        type="PRESENCE_ROSTER_REQ",
    )
    await context.event_bus.dispatch(bob, roster_env)
    bob_roster = [m for m in bob.inbox if m.type == "PRESENCE_ROSTER_RES"]
    assert len(bob_roster) == 1
    participants = bob_roster[0].payload["participants"]
    assert len(participants) == 2

    # Cleanup
    await chat_mod.shutdown()
    await presence_mod.shutdown()
    await canvas_mod.shutdown()

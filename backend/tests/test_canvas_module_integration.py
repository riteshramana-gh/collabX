"""End-to-end integration tests for CanvasFeatureModule and EventBus routing."""

import asyncio
from pathlib import Path
import pytest
from app.core.config import Settings
from app.core.context import ApplicationContext
from app.transport.connection_manager import ConnectionManager
from app.engine.event_bus import EventRegistry
from app.modules.canvas.module import CanvasFeatureModule
from app.transport.session import ClientSession, TransportType
from app.transport.envelope import MessageEnvelope
from app.modules.canvas.models import (
    CanvasElement,
    CanvasOperation,
    CanvasOperationType,
    ElementType,
)


class MockSession(ClientSession):
    def __init__(self, session_id: str):
        super().__init__(
            session_id=session_id,
            transport=TransportType.WEBSOCKET,
            remote_address="127.0.0.1:9999",
        )
        self.inbox = []

    async def send_envelope(self, envelope: MessageEnvelope) -> None:
        self.inbox.append(envelope)

    async def send_raw(self, data: bytes) -> None:
        pass

    async def close(self, code: int = 1000, reason: str = "") -> None:
        self.is_active = False


@pytest.mark.asyncio
async def test_canvas_module_join_and_draw(tmp_path: Path):
    settings = Settings(
        DATABASE_PATH=tmp_path / "collab_canvas_mod.db",
        SNAPSHOT_INTERVAL_OPS=5,
    )
    context = ApplicationContext(
        settings=settings,
        connection_manager=ConnectionManager(),
        event_bus=EventRegistry(),
    )

    module = CanvasFeatureModule()
    await module.initialize(context)
    module.register_events(context.event_bus)

    # 1. Client A joins room
    client_a = MockSession("client-A")
    await context.connection_manager.register_session(client_a)

    join_env = MessageEnvelope(
        room_id="art-room-1",
        sender_id="client-A",
        type="ROOM_JOIN_REQ",
        payload={"display_name": "Alice Artist"},
    )
    await context.event_bus.dispatch(client_a, join_env)

    # Alice should receive ROOM_JOIN_ACK and ROOM_SNAPSHOT
    types_a = [m.type for m in client_a.inbox]
    assert "ROOM_JOIN_ACK" in types_a
    assert "ROOM_SNAPSHOT" in types_a

    # 2. Client B joins room
    client_b = MockSession("client-B")
    await context.connection_manager.register_session(client_b)
    join_b = MessageEnvelope(
        room_id="art-room-1",
        sender_id="client-B",
        type="ROOM_JOIN_REQ",
        payload={"display_name": "Bob Builder"},
    )
    await context.event_bus.dispatch(client_b, join_b)

    # Alice should receive PRESENCE_JOINED
    types_a_updated = [m.type for m in client_a.inbox]
    assert "PRESENCE_JOINED" in types_a_updated

    # 3. Alice draws a rectangle
    rect = CanvasElement(
        id="rect-alice-1",
        type=ElementType.RECTANGLE,
        x=20.0,
        y=40.0,
        width=120.0,
        height=80.0,
        stroke_color="#0000ff",
        created_by="client-A",
        last_modified_by="client-A",
        last_modified_at=5000,
    )
    draw_op = CanvasOperation(
        client_op_id="alice-op-001",
        op_type=CanvasOperationType.ADD,
        element=rect,
    )
    draw_env = MessageEnvelope(
        room_id="art-room-1",
        sender_id="client-A",
        type="CANVAS_OP_REQ",
        client_seq=1,
        payload=draw_op.model_dump(),
    )
    await context.event_bus.dispatch(client_a, draw_env)

    # Wait for room actor processing
    room_actor = await context.room_manager.get_room("art-room-1")
    await room_actor._queue.join()

    # Alice must receive CANVAS_OP_ACK
    ack_msgs = [m for m in client_a.inbox if m.type == "CANVAS_OP_ACK"]
    assert len(ack_msgs) == 1
    assert ack_msgs[0].server_seq == 1
    assert ack_msgs[0].payload["status"] == "ACCEPTED"

    # Bob must receive CANVAS_OP_BROADCAST with seq 1
    bcast_msgs = [m for m in client_b.inbox if m.type == "CANVAS_OP_BROADCAST"]
    assert len(bcast_msgs) == 1
    assert bcast_msgs[0].server_seq == 1
    assert bcast_msgs[0].payload["element"]["id"] == "rect-alice-1"

    await module.shutdown()

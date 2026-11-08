"""Tests for HostControlModule: room locking, kicking, and snapshot export/restore."""

from pathlib import Path
import pytest
from app.core.config import Settings
from app.core.context import ApplicationContext
from app.transport.connection_manager import ConnectionManager
from app.engine.event_bus import EventRegistry
from app.modules.canvas.module import CanvasFeatureModule
from app.modules.host_control.module import HostControlModule
from app.transport.session import ClientSession, TransportType
from app.transport.envelope import MessageEnvelope
from app.modules.canvas.models import CanvasElement, CanvasOperation, CanvasOperationType, ElementType


class MockSession(ClientSession):
    def __init__(self, session_id: str, role: str = "PARTICIPANT", display_name: str = "User"):
        super().__init__(
            session_id=session_id,
            transport=TransportType.WEBSOCKET,
            remote_address="127.0.0.1:9070",
        )
        self.role = role
        self.display_name = display_name
        self.inbox = []

    async def send_envelope(self, envelope: MessageEnvelope) -> None:
        self.inbox.append(envelope)

    async def send_raw(self, data: bytes) -> None:
        pass

    async def close(self, code: int = 1000, reason: str = "") -> None:
        self.is_active = False


@pytest.mark.asyncio
async def test_host_controls_and_snapshots(tmp_path: Path):
    settings = Settings(DATABASE_PATH=tmp_path / "collab_host_test.db")
    context = ApplicationContext(
        settings=settings,
        connection_manager=ConnectionManager(),
        event_bus=EventRegistry(),
    )

    canvas_mod = CanvasFeatureModule()
    host_mod = HostControlModule()

    await canvas_mod.initialize(context)
    canvas_mod.register_events(context.event_bus)

    await host_mod.initialize(context)
    host_mod.register_events(context.event_bus)

    # Setup Host and Participant in room "admin-room"
    host_sess = MockSession("sess-host", role="HOST", display_name="HostAlice")
    guest_sess = MockSession("sess-guest", role="PARTICIPANT", display_name="GuestBob")

    await context.connection_manager.register_session(host_sess)
    await context.connection_manager.join_room(host_sess.session_id, "admin-room")

    await context.connection_manager.register_session(guest_sess)
    await context.connection_manager.join_room(guest_sess.session_id, "admin-room")

    room_actor = await context.room_manager.get_or_create_room("admin-room")

    # 1. Test Room Locking
    lock_env = MessageEnvelope(
        room_id="admin-room",
        sender_id="sess-host",
        type="HOST_LOCK_ROOM",
        payload={"is_locked": True},
    )
    await context.event_bus.dispatch(host_sess, lock_env)
    assert "admin-room" in host_mod.locked_rooms

    locked_broadcasts = [m for m in guest_sess.inbox if m.type == "HOST_ROOM_LOCKED"]
    assert len(locked_broadcasts) == 1
    assert locked_broadcasts[0].payload["is_locked"] is True
    assert room_actor.is_board_locked is True

    # 1.5 Verify that board editing is disabled for guest while room is locked
    blocked_elem = CanvasElement(
        id="rect-blocked",
        type=ElementType.RECTANGLE,
        x=10.0,
        y=10.0,
        width=50.0,
        height=50.0,
        created_by="sess-guest",
        last_modified_by="sess-guest",
        last_modified_at=1000,
    )
    await room_actor.enqueue_operation(
        guest_sess,
        MessageEnvelope(
            room_id="admin-room",
            sender_id="sess-guest",
            type="CANVAS_OP_REQ",
            payload=CanvasOperation(client_op_id="op-blocked-1", op_type=CanvasOperationType.ADD, element=blocked_elem).model_dump(),
        ),
    )
    await room_actor._queue.join()
    board_locked_rejects = [m for m in guest_sess.inbox if m.type == "CANVAS_OP_REJECT" and m.payload.get("error") == "BOARD_ACCESS_DISABLED"]
    assert len(board_locked_rejects) == 1

    # 2. Add an element to canvas to prepare for export
    elem = CanvasElement(
        id="rect-export-1",
        type=ElementType.RECTANGLE,
        x=50.0,
        y=50.0,
        width=100.0,
        height=100.0,
        created_by="sess-host",
        last_modified_by="sess-host",
        last_modified_at=1000,
    )
    await room_actor.enqueue_operation(
        host_sess,
        MessageEnvelope(
            room_id="admin-room",
            sender_id="sess-host",
            type="CANVAS_OP_REQ",
            payload=CanvasOperation(client_op_id="op-1", op_type=CanvasOperationType.ADD, element=elem).model_dump(),
        ),
    )
    await room_actor._queue.join()

    # 3. Test Snapshot Export
    export_env = MessageEnvelope(
        room_id="admin-room",
        sender_id="sess-host",
        type="HOST_EXPORT_SNAPSHOT",
    )
    await context.event_bus.dispatch(host_sess, export_env)
    exported = [m for m in host_sess.inbox if m.type == "HOST_SNAPSHOT_EXPORTED"]
    assert len(exported) == 1
    bundle = exported[0].payload["snapshot"]
    assert bundle["room_id"] == "admin-room"
    assert "rect-export-1" in bundle["elements"]

    # 4. Test Snapshot Restore
    # Mutate bundle by adding a second restored element
    bundle["elements"]["circle-restored-2"] = {
        "id": "circle-restored-2",
        "type": "ELLIPSE",
        "x": 200.0,
        "y": 200.0,
        "width": 60.0,
        "height": 60.0,
        "stroke_color": "#00ff00",
        "stroke_width": 2.0,
        "z_index": 2,
        "version": 1,
        "created_by": "sess-host",
        "last_modified_by": "sess-host",
        "last_modified_at": 2000,
    }

    restore_env = MessageEnvelope(
        room_id="admin-room",
        sender_id="sess-host",
        type="HOST_RESTORE_SNAPSHOT",
        payload={"snapshot": bundle},
    )
    await context.event_bus.dispatch(host_sess, restore_env)

    # Check restored state in room actor
    snapshot_after = room_actor.canvas_state.get_snapshot()
    assert "circle-restored-2" in snapshot_after["elements"]

    # 5. Test Role Permissions (Editor vs Viewer)
    set_role_env = MessageEnvelope(
        room_id="admin-room",
        sender_id="sess-host",
        type="HOST_SET_USER_ROLE",
        payload={"target_session_id": "sess-guest", "role": "VIEWER"},
    )
    await context.event_bus.dispatch(host_sess, set_role_env)
    assert guest_sess.role == "VIEWER"

    role_updated_msgs = [m for m in guest_sess.inbox if m.type == "HOST_ROLE_UPDATED"]
    assert len(role_updated_msgs) == 1
    assert role_updated_msgs[0].payload["role"] == "VIEWER"

    # Guest attempts canvas mutation as VIEWER -> Should be rejected
    mutation_op = CanvasOperation(
        client_op_id="op-viewer-attempt",
        op_type=CanvasOperationType.ADD,
        element=CanvasElement(
            id="viewer-elem-1",
            type=ElementType.RECTANGLE,
            x=10,
            y=10,
            created_by="sess-guest",
            last_modified_by="sess-guest",
            last_modified_at=3000,
        ),
    )
    mutate_env = MessageEnvelope(
        room_id="admin-room",
        sender_id="sess-guest",
        type="CANVAS_OP_REQ",
        payload=mutation_op.model_dump(),
    )
    await context.event_bus.dispatch(guest_sess, mutate_env)
    import asyncio
    await asyncio.sleep(0.05)  # Wait for room actor consumer queue

    perm_reject_msgs = [m for m in guest_sess.inbox if m.type == "CANVAS_OP_REJECT" and m.payload.get("error") == "PERMISSION_DENIED"]
    assert len(perm_reject_msgs) == 1
    assert perm_reject_msgs[0].payload["error"] == "PERMISSION_DENIED"

    # 5.5 Test Host Muting User
    mute_env = MessageEnvelope(
        room_id="admin-room",
        sender_id="sess-host",
        type="HOST_MUTE_USER",
        payload={"target_session_id": "sess-guest"},
    )
    await context.event_bus.dispatch(host_sess, mute_env)
    muted_msgs = [m for m in guest_sess.inbox if m.type == "HOST_MUTED_BY_ADMIN"]
    assert len(muted_msgs) == 1
    assert muted_msgs[0].payload["target_session_id"] == "sess-guest"

    # 6. Test User Kicking
    kick_env = MessageEnvelope(
        room_id="admin-room",
        sender_id="sess-host",
        type="HOST_KICK_USER",
        payload={"target_session_id": "sess-guest", "reason": "Disruptive behavior"},
    )
    await context.event_bus.dispatch(host_sess, kick_env)

    assert guest_sess.is_active is False
    kicked_msg = [m for m in guest_sess.inbox if m.type == "HOST_USER_KICKED"]
    assert len(kicked_msg) == 1
    assert kicked_msg[0].payload["reason"] == "Disruptive behavior"

    await host_mod.shutdown()
    await canvas_mod.shutdown()

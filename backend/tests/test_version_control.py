"""Tests for Notebook Version Control: Save, List, Restore, Delete, and 3-notebook limit."""

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
    def __init__(self, session_id: str, role: str = "HOST", display_name: str = "Alice"):
        super().__init__(
            session_id=session_id,
            transport=TransportType.WEBSOCKET,
            remote_address="127.0.0.1:9070",
        )
        self.role = role
        self.display_name = display_name
        self.client_ip = "192.168.1.50"
        self.inbox = []

    async def send_envelope(self, envelope: MessageEnvelope) -> None:
        self.inbox.append(envelope)

    async def send_raw(self, data: bytes) -> None:
        pass

    async def close(self, code: int = 1000, reason: str = "") -> None:
        self.is_active = False


@pytest.mark.asyncio
async def test_version_control_save_list_restore_delete_and_limit(tmp_path: Path):
    settings = Settings(DATABASE_PATH=tmp_path / "collab_ver_test.db")
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

    host_sess = MockSession("sess-host", role="HOST", display_name="Alice")
    await context.connection_manager.register_session(host_sess)
    await context.connection_manager.join_room(host_sess.session_id, "ver-room")

    room_actor = await context.room_manager.get_or_create_room("ver-room")

    # Add an element to the room state
    elem = CanvasElement(
        id="elem-1",
        page_id="page-1",
        type=ElementType.PENCIL,
        x=10,
        y=20,
        points=[[10, 20], [30, 40]],
        stroke_color="#ff0000",
        created_by="sess-host",
        last_modified_by="sess-host",
        last_modified_at=1000,
    )
    room_actor.canvas_state.apply_operation(
        CanvasOperation(client_op_id="op-1", op_type=CanvasOperationType.ADD, element=elem),
        "sess-host",
        1000,
    )

    # 1. Save Version 1
    save_env1 = MessageEnvelope(
        room_id="ver-room",
        sender_id="sess-host",
        type="NOTEBOOK_VERSION_SAVE_REQ",
        client_seq=1,
        payload={"version_name": "Sprint 1 Draft"},
    )
    await context.event_bus.dispatch(host_sess, save_env1)
    res1 = host_sess.inbox[-1]
    assert res1.type == "NOTEBOOK_VERSION_SAVE_RES"
    assert res1.payload["success"] is True
    assert res1.payload["current_count"] == 1
    assert res1.payload["max_allowed"] == 3
    v1_id = res1.payload["version"]["id"]

    # 2. Save Version 2
    save_env2 = MessageEnvelope(
        room_id="ver-room",
        sender_id="sess-host",
        type="NOTEBOOK_VERSION_SAVE_REQ",
        client_seq=2,
        payload={"version_name": "Sprint 2 Review"},
    )
    await context.event_bus.dispatch(host_sess, save_env2)
    res2 = host_sess.inbox[-1]
    assert res2.payload["success"] is True
    assert res2.payload["current_count"] == 2

    # 3. Save Version 3
    save_env3 = MessageEnvelope(
        room_id="ver-room",
        sender_id="sess-host",
        type="NOTEBOOK_VERSION_SAVE_REQ",
        client_seq=3,
        payload={"version_name": "Sprint 3 Final"},
    )
    await context.event_bus.dispatch(host_sess, save_env3)
    res3 = host_sess.inbox[-1]
    assert res3.payload["success"] is True
    assert res3.payload["current_count"] == 3

    # 4. Attempt to save Version 4 without replace -> MUST BE REJECTED (Limit of 3)
    save_env4 = MessageEnvelope(
        room_id="ver-room",
        sender_id="sess-host",
        type="NOTEBOOK_VERSION_SAVE_REQ",
        client_seq=4,
        payload={"version_name": "Sprint 4 Overflow"},
    )
    await context.event_bus.dispatch(host_sess, save_env4)
    res4 = host_sess.inbox[-1]
    assert res4.payload["success"] is False
    assert res4.payload["error"] == "LIMIT_REACHED"
    assert res4.payload["current_count"] == 3
    assert len(res4.payload["versions"]) == 3

    # 5. Overwrite Version 1 using replace_version_id -> SUCCEEDS and stays at 3
    replace_env = MessageEnvelope(
        room_id="ver-room",
        sender_id="sess-host",
        type="NOTEBOOK_VERSION_SAVE_REQ",
        client_seq=5,
        payload={"version_name": "Sprint 1 Overwritten", "replace_version_id": v1_id},
    )
    await context.event_bus.dispatch(host_sess, replace_env)
    res_replace = host_sess.inbox[-1]
    assert res_replace.payload["success"] is True
    assert res_replace.payload["current_count"] == 3

    # 6. List versions
    list_env = MessageEnvelope(
        room_id="ver-room",
        sender_id="sess-host",
        type="NOTEBOOK_VERSION_LIST_REQ",
        client_seq=6,
        payload={},
    )
    await context.event_bus.dispatch(host_sess, list_env)
    res_list = host_sess.inbox[-1]
    assert res_list.type == "NOTEBOOK_VERSION_LIST_RES"
    assert len(res_list.payload["versions"]) == 3

    # 7. Mutate state, then Restore Version 1
    room_actor.canvas_state.apply_operation(
        CanvasOperation(client_op_id="op-clear", op_type=CanvasOperationType.CLEAR),
        "sess-host",
        2000,
    )
    assert len(room_actor.canvas_state._elements) == 0

    restore_env = MessageEnvelope(
        room_id="ver-room",
        sender_id="sess-host",
        type="NOTEBOOK_VERSION_RESTORE_REQ",
        client_seq=7,
        payload={"version_id": v1_id},
    )
    await context.event_bus.dispatch(host_sess, restore_env)
    res_restore = host_sess.inbox[-1]
    assert res_restore.type == "NOTEBOOK_VERSION_RESTORE_RES"
    assert res_restore.payload["success"] is True
    # Verify state was restored!
    assert len(room_actor.canvas_state._elements) == 1
    assert "elem-1" in room_actor.canvas_state._elements

    # 8. Delete Version 2 -> Count decrements to 2
    del_env = MessageEnvelope(
        room_id="ver-room",
        sender_id="sess-host",
        type="NOTEBOOK_VERSION_DELETE_REQ",
        client_seq=8,
        payload={"version_id": res2.payload["version"]["id"]},
    )
    await context.event_bus.dispatch(host_sess, del_env)
    res_del = host_sess.inbox[-1]
    assert res_del.type == "NOTEBOOK_VERSION_DELETE_RES"
    assert res_del.payload["success"] is True
    assert res_del.payload["current_count"] == 2

    # Clean up
    await canvas_mod.shutdown()
    await host_mod.shutdown()

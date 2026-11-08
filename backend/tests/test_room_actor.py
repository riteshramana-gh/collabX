"""Tests for RoomActor serialized ingestion, deduplication, and replay."""

import asyncio
from pathlib import Path
import pytest
from app.storage.database import DatabaseManager
from app.storage.repositories.canvas_repo import SQLiteCanvasRepository
from app.transport.connection_manager import ConnectionManager
from app.engine.room_actor import RoomActor
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
            remote_address="127.0.0.1:8888",
        )
        self.received = []

    async def send_envelope(self, envelope: MessageEnvelope) -> None:
        self.received.append(envelope)

    async def send_raw(self, data: bytes) -> None:
        pass

    async def close(self, code: int = 1000, reason: str = "") -> None:
        self.is_active = False


@pytest.mark.asyncio
async def test_room_actor_serialized_concurrency(tmp_path: Path):
    db_file = tmp_path / "test_room.db"
    db_mgr = DatabaseManager(db_file)
    await db_mgr.initialize()

    repo = SQLiteCanvasRepository(db_mgr.connection)
    cm = ConnectionManager()
    actor = RoomActor("room-actor-test", repo, cm, snapshot_interval_ops=10)
    await actor.start()

    session = MockSession("sess-author")
    await cm.register_session(session)
    await cm.join_room(session.session_id, "room-actor-test")

    # Enqueue 30 operations concurrently
    tasks = []
    for i in range(30):
        elem = CanvasElement(
            id=f"elem-{i}",
            type=ElementType.RECTANGLE,
            x=float(i * 10),
            y=float(i * 10),
            created_by="sess-author",
            last_modified_by="sess-author",
            last_modified_at=1000 + i,
        )
        op = CanvasOperation(
            client_op_id=f"client-op-{i}",
            op_type=CanvasOperationType.ADD,
            element=elem,
        )
        env = MessageEnvelope(
            room_id="room-actor-test",
            sender_id="sess-author",
            type="CANVAS_OP_REQ",
            client_seq=i + 1,
            payload=op.model_dump(),
        )
        tasks.append(actor.enqueue_operation(session, env))

    await asyncio.gather(*tasks)
    # Wait for queue to drain
    await actor._queue.join()

    assert actor.current_seq == 30
    assert actor.canvas_state.get_snapshot()["elements_count"] == 30

    # Test deduplication: resend client-op-5
    dup_elem = CanvasElement(
        id="elem-dup",
        type=ElementType.RECTANGLE,
        created_by="sess-author",
        last_modified_by="sess-author",
        last_modified_at=2000,
    )
    dup_op = CanvasOperation(
        client_op_id="client-op-5",
        op_type=CanvasOperationType.ADD,
        element=dup_elem,
    )
    dup_env = MessageEnvelope(
        room_id="room-actor-test",
        sender_id="sess-author",
        type="CANVAS_OP_REQ",
        payload=dup_op.model_dump(),
    )
    await actor.enqueue_operation(session, dup_env)
    await actor._queue.join()

    # Sequence MUST NOT increment on duplicate
    assert actor.current_seq == 30

    # Verify gap replay request
    await actor.handle_replay_request(session, from_seq=5, to_seq=10)
    replay_msg = [m for m in session.received if m.type == "ROOM_REPLAY_RES"]
    assert len(replay_msg) == 1
    assert len(replay_msg[0].payload["operations"]) == 6

    await actor.stop()
    await db_mgr.close()

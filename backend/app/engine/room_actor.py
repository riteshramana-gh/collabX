"""Per-room Actor that serializes all mutating operations in strict chronological order."""

import asyncio
from collections import deque
import logging
import time
from typing import Any, Deque, Dict, Optional, Set
from app.modules.canvas.models import CanvasOperation
from app.modules.canvas.authoritative_state import AuthoritativeCanvasState
from app.storage.repositories.base import ICanvasRepository
from app.transport.connection_manager import ConnectionManager
from app.transport.envelope import MessageEnvelope
from app.transport.session import ClientSession

logger = logging.getLogger("collabboard.engine.room_actor")


class RoomActor:
    """Per-room isolated actor ensuring sequential state mutations, deduplication, and gap recovery."""

    def __init__(
        self,
        room_id: str,
        canvas_repo: ICanvasRepository,
        connection_manager: ConnectionManager,
        snapshot_interval_ops: int = 50,
        dedup_window_size: int = 1000,
    ):
        self.room_id = room_id
        self.canvas_repo = canvas_repo
        self.connection_manager = connection_manager
        self.snapshot_interval_ops = snapshot_interval_ops

        self.canvas_state = AuthoritativeCanvasState(room_id)
        self.current_seq: int = 0
        self.ops_since_last_snapshot: int = 0

        # In-memory deduplication sliding window
        self.dedup_window_size = dedup_window_size
        self._processed_op_ids: Set[str] = set()
        self._op_id_fifo: Deque[str] = deque()

        # Ingestion queue and actor background loop
        self._queue: asyncio.Queue = asyncio.Queue()
        self._worker_task: Optional[asyncio.Task] = None
        self._is_running = False

    async def start(self) -> None:
        """Starts the room actor and loads latest snapshot from storage."""
        if self._is_running:
            return
        self._is_running = True

        # Initialize or restore room record and state from database
        room_record = await self.canvas_repo.get_or_create_room(self.room_id)
        self.current_seq = room_record.get("current_seq", 0)

        snapshot = await self.canvas_repo.get_latest_snapshot(self.room_id)
        if snapshot:
            self.canvas_state.restore_snapshot(snapshot["state"])
            logger.info(
                f"[RoomActor {self.room_id}] Restored state from snapshot at seq {snapshot['sequence_number']}"
            )
            # Replay any operations between snapshot sequence and current_seq
            if self.current_seq > snapshot["sequence_number"]:
                trailing_ops = await self.canvas_repo.get_operations_range(
                    self.room_id, snapshot["sequence_number"] + 1, self.current_seq
                )
                for op_record in trailing_ops:
                    op = CanvasOperation.model_validate(op_record["payload"])
                    self.canvas_state.apply_operation(
                        op, op_record["sender_id"], op_record["created_at"]
                    )
                logger.info(
                    f"[RoomActor {self.room_id}] Replayed {len(trailing_ops)} trailing operations"
                )

        self._worker_task = asyncio.create_task(self._process_queue_loop())
        logger.info(f"[RoomActor {self.room_id}] Started (Initial seq: {self.current_seq})")

    async def enqueue_operation(
        self,
        session: ClientSession,
        envelope: MessageEnvelope,
    ) -> None:
        """Enqueues an incoming canvas mutation for serialized processing."""
        await self._queue.put((session, envelope))

    async def _process_queue_loop(self) -> None:
        """Dedicated sequential consumer loop."""
        while self._is_running:
            try:
                item = await self._queue.get()
                if item is None:
                    break
                session, envelope = item
                await self._process_single_operation(session, envelope)
                self._queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(
                    f"[RoomActor {self.room_id}] Error in sequential processing loop: {e}",
                    exc_info=True,
                )

    async def _process_single_operation(
        self,
        session: ClientSession,
        envelope: MessageEnvelope,
    ) -> None:
        """Processes a single mutation with strict deduplication, sequencing, and broadcast."""
        try:
            op = CanvasOperation.model_validate(envelope.payload)
        except Exception as e:
            logger.warning(f"[RoomActor {self.room_id}] Invalid operation payload: {e}")
            await session.send_envelope(
                MessageEnvelope(
                    room_id=self.room_id,
                    sender_id="server",
                    type="CANVAS_OP_REJECT",
                    client_seq=envelope.client_seq,
                    payload={"error": "INVALID_PAYLOAD", "reason": str(e)},
                )
            )
            return

        client_op_id = op.client_op_id

        # 1. Deduplication check
        if client_op_id in self._processed_op_ids:
            logger.info(f"[RoomActor {self.room_id}] Duplicate op {client_op_id} ignored")
            await session.send_envelope(
                MessageEnvelope(
                    room_id=self.room_id,
                    sender_id="server",
                    type="CANVAS_OP_ACK",
                    client_seq=envelope.client_seq,
                    server_seq=self.current_seq,
                    payload={"client_op_id": client_op_id, "status": "DUPLICATE"},
                )
            )
            return

        # 2. Assign monotonically increasing server sequence number
        self.current_seq += 1
        seq = self.current_seq
        timestamp = envelope.timestamp or int(time.time() * 1000)

        # 3. Apply to authoritative in-memory state
        success, mutated_elem = self.canvas_state.apply_operation(op, envelope.sender_id, timestamp)
        if not success:
            logger.warning(f"[RoomActor {self.room_id}] Operation {op.op_type} failed validation")
            self.current_seq -= 1  # Rollback sequence counter
            await session.send_envelope(
                MessageEnvelope(
                    room_id=self.room_id,
                    sender_id="server",
                    type="CANVAS_OP_REJECT",
                    client_seq=envelope.client_seq,
                    payload={"error": "OPERATION_FAILED", "op_type": op.op_type.value},
                )
            )
            return

        # 4. Record deduplication ID in sliding window
        self._processed_op_ids.add(client_op_id)
        self._op_id_fifo.append(client_op_id)
        if len(self._op_id_fifo) > self.dedup_window_size:
            evicted = self._op_id_fifo.popleft()
            self._processed_op_ids.discard(evicted)

        # 5. Persist to storage repository
        elem_id = op.element_id
        if not elem_id and hasattr(mutated_elem, "id"):
            elem_id = mutated_elem.id

        await self.canvas_repo.append_operation(
            room_id=self.room_id,
            seq=seq,
            client_op_id=client_op_id,
            sender_id=envelope.sender_id,
            op_type=op.op_type.value,
            element_id=elem_id,
            payload=op.model_dump(),
        )
        await self.canvas_repo.update_room_seq(self.room_id, seq)

        # 6. Periodic snapshot capture
        self.ops_since_last_snapshot += 1
        if self.ops_since_last_snapshot >= self.snapshot_interval_ops:
            await self._take_snapshot()

        # 7. Acknowledge to author
        await session.send_envelope(
            MessageEnvelope(
                room_id=self.room_id,
                sender_id="server",
                type="CANVAS_OP_ACK",
                client_seq=envelope.client_seq,
                server_seq=seq,
                payload={"client_op_id": client_op_id, "status": "ACCEPTED"},
            )
        )

        # 8. Broadcast authoritative mutation delta to ALL room members (including author for final reconciliation)
        broadcast_envelope = MessageEnvelope(
            room_id=self.room_id,
            sender_id=envelope.sender_id,
            type="CANVAS_OP_BROADCAST",
            server_seq=seq,
            payload={
                "client_op_id": client_op_id,
                "op_type": op.op_type.value,
                "element_id": elem_id,
                "element": mutated_elem.model_dump() if hasattr(mutated_elem, "model_dump") and not hasattr(mutated_elem, "template") else None,
                "page": mutated_elem.model_dump() if hasattr(mutated_elem, "template") else (op.page.model_dump() if op.page else None),
                "patch": op.patch,
            },
        )
        await self.connection_manager.broadcast_to_room(self.room_id, broadcast_envelope)

    async def _take_snapshot(self) -> None:
        """Captures in-memory state and saves to SQLite."""
        snapshot_data = self.canvas_state.get_snapshot()
        await self.canvas_repo.save_snapshot(self.room_id, self.current_seq, snapshot_data)
        self.ops_since_last_snapshot = 0
        logger.info(
            f"[RoomActor {self.room_id}] Saved snapshot at sequence {self.current_seq} "
            f"({snapshot_data['elements_count']} elements)"
        )

    async def get_initial_snapshot_envelope(self) -> MessageEnvelope:
        """Generates the initial full snapshot envelope for a joining client."""
        snapshot = self.canvas_state.get_snapshot()
        return MessageEnvelope(
            room_id=self.room_id,
            sender_id="server",
            type="ROOM_SNAPSHOT",
            server_seq=self.current_seq,
            payload=snapshot,
        )

    async def handle_replay_request(
        self,
        session: ClientSession,
        from_seq: int,
        to_seq: int,
    ) -> None:
        """Handles gap detection recovery by replaying requested sequence ranges."""
        logger.info(
            f"[RoomActor {self.room_id}] Client {session.session_id} requested replay from seq {from_seq} to {to_seq}"
        )
        ops = await self.canvas_repo.get_operations_range(self.room_id, from_seq, to_seq)
        await session.send_envelope(
            MessageEnvelope(
                room_id=self.room_id,
                sender_id="server",
                type="ROOM_REPLAY_RES",
                server_seq=self.current_seq,
                payload={
                    "from_seq": from_seq,
                    "to_seq": to_seq,
                    "operations": ops,
                },
            )
        )

    async def stop(self) -> None:
        """Gracefully shuts down actor worker loop and takes a final snapshot."""
        if not self._is_running:
            return
        self._is_running = False
        await self._take_snapshot()
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        logger.info(f"[RoomActor {self.room_id}] Stopped cleanly")

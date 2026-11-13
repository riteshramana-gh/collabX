"""SQLite repository implementation for rooms and canvas operations."""

import json
import time
from typing import Any, Dict, List, Optional
import aiosqlite
from app.storage.repositories.base import ICanvasRepository


def current_time_ms() -> int:
    return int(time.time() * 1000)


class SQLiteCanvasRepository(ICanvasRepository):
    """Concrete SQLite implementation of ICanvasRepository."""

    def __init__(self, db: aiosqlite.Connection):
        self.db = db

    async def get_or_create_room(
        self,
        room_id: str,
        name: str = "New Board",
        host_user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        cursor = await self.db.execute("SELECT * FROM rooms WHERE id = ?", (room_id,))
        row = await cursor.fetchone()
        if row:
            return dict(row)

        now = current_time_ms()
        await self.db.execute(
            """
            INSERT INTO rooms (id, name, host_user_id, is_locked, current_seq, max_participants, created_at, updated_at)
            VALUES (?, ?, ?, 0, 0, 50, ?, ?)
            """,
            (room_id, name, host_user_id, now, now),
        )
        await self.db.commit()

        cursor = await self.db.execute("SELECT * FROM rooms WHERE id = ?", (room_id,))
        new_row = await cursor.fetchone()
        return dict(new_row)

    async def update_room_seq(self, room_id: str, new_seq: int) -> None:
        now = current_time_ms()
        await self.db.execute(
            "UPDATE rooms SET current_seq = ?, updated_at = ? WHERE id = ?",
            (new_seq, now, room_id),
        )
        await self.db.commit()

    async def is_client_op_processed(self, room_id: str, client_op_id: str) -> bool:
        cursor = await self.db.execute(
            "SELECT 1 FROM canvas_operations WHERE room_id = ? AND client_op_id = ? LIMIT 1",
            (room_id, client_op_id),
        )
        row = await cursor.fetchone()
        return row is not None

    async def append_operation(
        self,
        room_id: str,
        seq: int,
        client_op_id: str,
        sender_id: str,
        op_type: str,
        element_id: Optional[str],
        payload: Dict[str, Any],
    ) -> None:
        now = current_time_ms()
        payload_str = json.dumps(payload)
        await self.db.execute(
            """
            INSERT INTO canvas_operations (room_id, server_seq, client_op_id, sender_id, op_type, element_id, payload_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (room_id, seq, client_op_id, sender_id, op_type, element_id, payload_str, now),
        )
        await self.db.commit()

    async def get_operations_range(
        self,
        room_id: str,
        from_seq: int,
        to_seq: int,
    ) -> List[Dict[str, Any]]:
        cursor = await self.db.execute(
            """
            SELECT server_seq, client_op_id, sender_id, op_type, element_id, payload_json, created_at
            FROM canvas_operations
            WHERE room_id = ? AND server_seq BETWEEN ? AND ?
            ORDER BY server_seq ASC
            """,
            (room_id, from_seq, to_seq),
        )
        rows = await cursor.fetchall()
        result = []
        for r in rows:
            result.append({
                "server_seq": r["server_seq"],
                "client_op_id": r["client_op_id"],
                "sender_id": r["sender_id"],
                "op_type": r["op_type"],
                "element_id": r["element_id"],
                "payload": json.loads(r["payload_json"]),
                "created_at": r["created_at"],
            })
        return result

    async def save_snapshot(
        self,
        room_id: str,
        sequence_number: int,
        state: Dict[str, Any],
    ) -> None:
        now = current_time_ms()
        state_str = json.dumps(state)
        await self.db.execute(
            """
            INSERT INTO canvas_snapshots (room_id, sequence_number, state_json, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (room_id, sequence_number, state_str, now),
        )
        await self.db.commit()

    async def get_latest_snapshot(self, room_id: str) -> Optional[Dict[str, Any]]:
        cursor = await self.db.execute(
            """
            SELECT sequence_number, state_json, created_at
            FROM canvas_snapshots
            WHERE room_id = ?
            ORDER BY sequence_number DESC
            LIMIT 1
            """,
            (room_id,),
        )
        row = await cursor.fetchone()
        if not row:
            return None
        return {
            "sequence_number": row["sequence_number"],
            "state": json.loads(row["state_json"]),
            "created_at": row["created_at"],
        }

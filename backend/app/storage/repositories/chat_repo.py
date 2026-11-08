"""Chat repository for storing and querying room chat messages in SQLite."""

import time
from typing import Any, Dict, List
import aiosqlite


class SQLiteChatRepository:
    """Manages chat message persistence in SQLite."""

    def __init__(self, db: aiosqlite.Connection):
        self.db = db

    async def append_message(
        self,
        room_id: str,
        seq: int,
        sender_id: str,
        sender_name: str,
        content: str,
    ) -> Dict[str, Any]:
        now = int(time.time() * 1000)
        cursor = await self.db.execute(
            """
            INSERT INTO chat_messages (room_id, server_seq, sender_id, sender_name, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (room_id, seq, sender_id, sender_name, content, now),
        )
        await self.db.commit()
        msg_id = cursor.lastrowid
        return {
            "id": f"msg-{msg_id}",
            "room_id": room_id,
            "server_seq": seq,
            "sender_id": sender_id,
            "sender_name": sender_name,
            "content": content,
            "timestamp": now,
        }

    async def get_recent_messages(self, room_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        cursor = await self.db.execute(
            """
            SELECT id, room_id, server_seq, sender_id, sender_name, content, created_at
            FROM chat_messages
            WHERE room_id = ?
            ORDER BY server_seq ASC
            LIMIT ?
            """,
            (room_id, limit),
        )
        rows = await cursor.fetchall()
        return [
            {
                "id": f"msg-{r['id']}",
                "room_id": r["room_id"],
                "server_seq": r["server_seq"],
                "sender_id": r["sender_id"],
                "sender_name": r["sender_name"],
                "content": r["content"],
                "timestamp": r["created_at"],
            }
            for r in rows
        ]

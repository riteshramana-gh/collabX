"""Async SQLite database manager with WAL mode and automated schema creation."""

import aiosqlite
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger("collabboard.storage.db")

SCHEMA_SQL = """
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host_user_id TEXT,
    is_locked INTEGER NOT NULL DEFAULT 0,
    current_seq INTEGER NOT NULL DEFAULT 0,
    max_participants INTEGER NOT NULL DEFAULT 50,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS canvas_operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    server_seq INTEGER NOT NULL,
    client_op_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    op_type TEXT NOT NULL,
    element_id TEXT,
    payload_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_canvas_ops_room_seq 
ON canvas_operations(room_id, server_seq);

CREATE INDEX IF NOT EXISTS idx_canvas_ops_dedup 
ON canvas_operations(room_id, client_op_id);

CREATE TABLE IF NOT EXISTS canvas_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    state_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_canvas_snapshots_room_seq 
ON canvas_snapshots(room_id, sequence_number);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    server_seq INTEGER NOT NULL,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_room_seq 
ON chat_messages(room_id, server_seq);
<<<<<<< HEAD

CREATE TABLE IF NOT EXISTS saved_notebook_versions (
    id TEXT PRIMARY KEY,
    owner_key TEXT NOT NULL,
    owner_username TEXT NOT NULL,
    owner_ip TEXT NOT NULL,
    room_id TEXT NOT NULL,
    version_name TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    elements_count INTEGER NOT NULL,
    pages_count INTEGER NOT NULL,
    state_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saved_notebooks_owner 
ON saved_notebook_versions(owner_key, created_at DESC);
<<<<<<< HEAD

CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_sessions (
    token TEXT PRIMARY KEY,
    username TEXT NOT NULL COLLATE NOCASE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(username) REFERENCES users(username) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token 
ON user_sessions(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user 
ON user_sessions(username);
=======
>>>>>>> parent of bdcdf02 (UNDO/REDO VERSION HISTORY ADDED)
=======
>>>>>>> parent of a56dc48 (login flow change)
"""


class DatabaseManager:
    """Manages SQLite async connection lifecycle and transaction execution."""

    def __init__(self, db_path: Path):
        self.db_path = Path(db_path)
        self._db: Optional[aiosqlite.Connection] = None

    async def initialize(self) -> None:
        """Connects to SQLite, sets WAL mode, and executes schema migration."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._db = await aiosqlite.connect(str(self.db_path))
        self._db.row_factory = aiosqlite.Row

        # Execute migration
        await self._db.executescript(SCHEMA_SQL)
        await self._db.commit()
        logger.info(f"SQLite database initialized in WAL mode at {self.db_path.resolve()}")

    @property
    def connection(self) -> aiosqlite.Connection:
        if self._db is None:
            raise RuntimeError("Database connection has not been initialized")
        return self._db

    async def close(self) -> None:
        """Closes the active database connection."""
        if self._db is not None:
            await self._db.close()
            self._db = None
            logger.info("Database connection closed")

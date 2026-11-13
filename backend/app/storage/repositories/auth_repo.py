"""SQLite repository for user registration, authentication, and session management."""

import hashlib
import hmac
import logging
import secrets
import time
from typing import Any, Dict, Optional
import aiosqlite

logger = logging.getLogger("collabboard.storage.auth")

SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000  # 30 days


def current_time_ms() -> int:
    return int(time.time() * 1000)


def hash_password(password: str, salt: str) -> str:
    """Computes PBKDF2-HMAC-SHA256 password hash."""
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100000,
    ).hex()


class SQLiteAuthRepository:
    """Handles persistent user accounts and session tokens."""

    def __init__(self, db: aiosqlite.Connection):
        self.db = db

    async def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Retrieves user record by case-insensitive username."""
        clean_user = username.strip()
        cursor = await self.db.execute(
            "SELECT * FROM users WHERE username = ? COLLATE NOCASE",
            (clean_user,),
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

    async def register_user(
        self,
        username: str,
        password: str,
        display_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Registers a new user. Returns error if username is taken."""
        clean_user = username.strip()
        if len(clean_user) < 2:
            return {
                "success": False,
                "error": "INVALID_USERNAME",
                "message": "Username must be at least 2 characters long.",
            }
        if not password or len(password) < 3:
            return {
                "success": False,
                "error": "INVALID_PASSWORD",
                "message": "Password must be at least 3 characters long.",
            }

        clean_display = (display_name or "").strip() or clean_user

        # Check if username is already taken
        existing = await self.get_user_by_username(clean_user)
        if existing:
            return {
                "success": False,
                "error": "USERNAME_TAKEN",
                "message": f"Username '{clean_user}' is already taken. Please choose another username.",
            }

        salt = secrets.token_hex(16)
        pw_hash = hash_password(password, salt)
        now = current_time_ms()

        try:
            await self.db.execute(
                """
                INSERT INTO users (username, password_hash, salt, display_name, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (clean_user, pw_hash, salt, clean_display, now),
            )
            await self.db.commit()
        except Exception as e:
            logger.error(f"Failed to insert user {clean_user}: {e}")
            return {
                "success": False,
                "error": "USERNAME_TAKEN",
                "message": f"Username '{clean_user}' is already taken. Please choose another username.",
            }

        # Automatically create session token
        token = secrets.token_urlsafe(32)
        expires_at = now + SESSION_DURATION_MS
        await self.db.execute(
            """
            INSERT INTO user_sessions (token, username, created_at, expires_at)
            VALUES (?, ?, ?, ?)
            """,
            (token, clean_user, now, expires_at),
        )
        await self.db.commit()

        logger.info(f"Registered new user '{clean_user}' ({clean_display})")
        return {
            "success": True,
            "token": token,
            "username": clean_user,
            "display_name": clean_display,
        }

    async def login_user(self, username: str, password: str) -> Dict[str, Any]:
        """Validates credentials and generates a new session token."""
        clean_user = username.strip()
        user = await self.get_user_by_username(clean_user)
        if not user:
            return {
                "success": False,
                "error": "INVALID_CREDENTIALS",
                "message": "Invalid username or password.",
            }

        expected_hash = user["password_hash"]
        salt = user["salt"]
        actual_hash = hash_password(password, salt)

        if not hmac.compare_digest(expected_hash, actual_hash):
            return {
                "success": False,
                "error": "INVALID_CREDENTIALS",
                "message": "Invalid username or password.",
            }

        # Create session token
        now = current_time_ms()
        token = secrets.token_urlsafe(32)
        expires_at = now + SESSION_DURATION_MS

        await self.db.execute(
            """
            INSERT INTO user_sessions (token, username, created_at, expires_at)
            VALUES (?, ?, ?, ?)
            """,
            (token, user["username"], now, expires_at),
        )
        await self.db.commit()

        logger.info(f"User '{user['username']}' logged in successfully")
        return {
            "success": True,
            "token": token,
            "username": user["username"],
            "display_name": user["display_name"],
        }

    async def get_user_by_token(self, token: Optional[str]) -> Optional[Dict[str, Any]]:
        """Retrieves user profile associated with an active session token."""
        if not token or not token.strip():
            return None

        clean_token = token.strip()
        now = current_time_ms()
        cursor = await self.db.execute(
            """
            SELECT s.token, s.expires_at, u.username, u.display_name, u.created_at
            FROM user_sessions s
            JOIN users u ON s.username = u.username
            WHERE s.token = ? AND s.expires_at > ?
            """,
            (clean_token, now),
        )
        row = await cursor.fetchone()
        return dict(row) if row else None

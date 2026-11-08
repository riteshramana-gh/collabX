"""Connection manager for tracking sessions and cross-transport room broadcasting."""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional, Set
from app.transport.session import ClientSession
from app.transport.envelope import MessageEnvelope

logger = logging.getLogger("collabboard.transport.manager")


class ConnectionManager:
    """Thread-safe and async-safe registry for active client sessions across all transports."""

    def __init__(self):
        self._sessions: Dict[str, ClientSession] = {}
        self._room_members: Dict[str, Set[str]] = {}
        self._lock = asyncio.Lock()

    async def register_session(self, session: ClientSession) -> None:
        """Registers a new active session."""
        async with self._lock:
            self._sessions[session.session_id] = session
            logger.info(
                f"Registered session {session.session_id} via {session.transport.value} "
                f"from {session.remote_address} (Total active: {len(self._sessions)})"
            )

    async def unregister_session(self, session_id: str) -> Optional[ClientSession]:
        """Unregisters a session and removes it from any joined rooms."""
        async with self._lock:
            session = self._sessions.pop(session_id, None)
            if session and session.room_id:
                room_set = self._room_members.get(session.room_id)
                if room_set:
                    room_set.discard(session_id)
                    if not room_set:
                        self._room_members.pop(session.room_id, None)
            if session:
                logger.info(
                    f"Unregistered session {session_id} (Total remaining: {len(self._sessions)})"
                )
            return session

    async def join_room(self, session_id: str, room_id: str) -> None:
        """Associates a session with a target room."""
        async with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return
            # Remove from previous room if any
            if session.room_id and session.room_id != room_id:
                prev_set = self._room_members.get(session.room_id)
                if prev_set:
                    prev_set.discard(session_id)
                    if not prev_set:
                        self._room_members.pop(session.room_id, None)

            session.room_id = room_id
            if room_id not in self._room_members:
                self._room_members[room_id] = set()
            self._room_members[room_id].add(session_id)

    async def leave_room(self, session_id: str, room_id: str) -> None:
        """Removes a session from a room."""
        async with self._lock:
            session = self._sessions.get(session_id)
            if session and session.room_id == room_id:
                session.room_id = None
            room_set = self._room_members.get(room_id)
            if room_set:
                room_set.discard(session_id)
                if not room_set:
                    self._room_members.pop(room_id, None)

    async def get_session(self, session_id: str) -> Optional[ClientSession]:
        """Retrieves a session by its unique ID."""
        async with self._lock:
            return self._sessions.get(session_id)

    async def get_room_sessions(self, room_id: str) -> List[ClientSession]:
        """Returns all active sessions currently joined to a room."""
        async with self._lock:
            member_ids = self._room_members.get(room_id, set())
            return [self._sessions[sid] for sid in member_ids if sid in self._sessions]

    async def broadcast_to_room(
        self,
        room_id: str,
        envelope: MessageEnvelope,
        exclude_session_id: Optional[str] = None,
    ) -> int:
        """Broadcasts an envelope to all members of a room across transports (WebSocket and TCP).
        
        Returns the number of recipients the broadcast was dispatched to.
        """
        sessions = await self.get_room_sessions(room_id)
        tasks = []
        for s in sessions:
            if exclude_session_id and s.session_id == exclude_session_id:
                continue
            if s.is_active:
                tasks.append(s.send_envelope(envelope))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        return len(tasks)

    async def broadcast_all(self, envelope: MessageEnvelope) -> int:
        """Broadcasts an envelope to all connected sessions globally."""
        async with self._lock:
            sessions = list(self._sessions.values())

        tasks = [s.send_envelope(envelope) for s in sessions if s.is_active]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        return len(tasks)

    async def check_heartbeat_timeouts(self, timeout_seconds: float) -> List[ClientSession]:
        """Finds sessions that have exceeded the heartbeat timeout threshold."""
        now = time.time()
        stale: List[ClientSession] = []
        async with self._lock:
            for session in list(self._sessions.values()):
                if now - session.last_heartbeat_at > timeout_seconds:
                    stale.append(session)
        return stale

    async def get_stats(self) -> Dict[str, Any]:
        """Returns diagnostic statistics for monitoring."""
        async with self._lock:
            ws_count = sum(1 for s in self._sessions.values() if s.transport.value == "WEBSOCKET")
            tcp_count = sum(1 for s in self._sessions.values() if s.transport.value == "RAW_TCP")
            return {
                "total_connections": len(self._sessions),
                "websocket_connections": ws_count,
                "tcp_connections": tcp_count,
                "active_rooms": len(self._room_members),
                "room_occupancy": {rid: len(members) for rid, members in self._room_members.items()},
            }

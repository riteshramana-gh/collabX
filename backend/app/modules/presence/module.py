"""Presence module handling ephemeral cursor broadcasts and participant rosters."""

import logging
from typing import List
from app.modules.base import FeatureModule
from app.core.context import ApplicationContext
from app.engine.event_bus import EventRegistry
from app.transport.envelope import MessageEnvelope
from app.transport.session import ClientSession

logger = logging.getLogger("collabboard.modules.presence")


class PresenceFeatureModule(FeatureModule):
    """Handles ephemeral high-frequency cursor coordinates and live participant rosters."""

    @property
    def name(self) -> str:
        return "presence"

    @property
    def dependencies(self) -> List[str]:
        return []

    async def initialize(self, context: ApplicationContext) -> None:
        self.context = context
        self.allowed_cursor_sessions: dict[str, set[str]] = {}
        logger.info("PresenceFeatureModule initialized")

    def register_events(self, registry: EventRegistry) -> None:
        registry.register("PRESENCE_CURSOR", self.handle_cursor_broadcast)
        registry.register("PRESENCE_ROSTER_REQ", self.handle_roster_req)
        registry.register("CURSOR_PERMISSION_REQ", self.handle_cursor_share_req)
        registry.register("CURSOR_PERMISSION_DECISION", self.handle_cursor_share_decision)

    async def handle_cursor_broadcast(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Broadcasts cursor coordinates to peers without saving to persistent storage."""
        room_id = envelope.room_id

        # 1. Never broadcast cursor for VIEWER sessions
        if getattr(session, "role", "EDITOR") == "VIEWER":
            return

        # 2. Only allow broadcast if user is HOST or has been explicitly granted cursor sharing
        allowed_set = self.allowed_cursor_sessions.get(room_id, set())
        if getattr(session, "role", "EDITOR") != "HOST" and session.session_id not in allowed_set:
            return

        cursor_data = {
            "session_id": session.session_id,
            "display_name": session.display_name or "Anonymous",
            "is_host": getattr(session, "role", "EDITOR") == "HOST",
            "x": envelope.payload.get("x", 0),
            "y": envelope.payload.get("y", 0),
            "color": envelope.payload.get("color", "#3b82f6"),
            "active_tool": envelope.payload.get("active_tool", "pencil"),
            "timestamp": envelope.timestamp,
        }

        broadcast_envelope = MessageEnvelope(
            room_id=room_id,
            sender_id=session.session_id,
            type="PRESENCE_UPDATE",
            payload=cursor_data,
        )

        # Exclude sender to avoid echo
        await self.context.connection_manager.broadcast_to_room(
            room_id, broadcast_envelope, exclude_session_id=session.session_id
        )

    async def handle_cursor_share_req(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """A participant requests permission from the room host to show their cursor."""
        room_id = envelope.room_id
        if getattr(session, "role", "EDITOR") == "VIEWER":
            return

        sessions = await self.context.connection_manager.get_room_sessions(room_id)
        host_session = next((s for s in sessions if getattr(s, "role", "EDITOR") == "HOST"), None)
        if host_session:
            await host_session.send_envelope(
                MessageEnvelope(
                    room_id=room_id,
                    sender_id="server",
                    type="CURSOR_PERMISSION_NOTIFICATION",
                    payload={
                        "requester_session_id": session.session_id,
                        "display_name": session.display_name,
                    },
                )
            )

    async def handle_cursor_share_decision(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Room Host approves or denies cursor sharing for a participant."""
        room_id = envelope.room_id
        if getattr(session, "role", "EDITOR") != "HOST":
            return

        target_session_id = envelope.payload.get("target_session_id")
        allowed = bool(envelope.payload.get("allowed", False))
        if not target_session_id:
            return

        if room_id not in self.allowed_cursor_sessions:
            self.allowed_cursor_sessions[room_id] = set()

        if allowed:
            self.allowed_cursor_sessions[room_id].add(target_session_id)
        else:
            self.allowed_cursor_sessions[room_id].discard(target_session_id)
            # Remove cursor from all peers
            await self.context.connection_manager.broadcast_to_room(
                room_id,
                MessageEnvelope(
                    room_id=room_id,
                    sender_id="server",
                    type="PRESENCE_CURSOR_REMOVE",
                    payload={"session_id": target_session_id},
                ),
            )

        # Send decision notification to requester
        target_session = await self.context.connection_manager.get_session(target_session_id)
        if target_session and target_session.room_id == room_id:
            await target_session.send_envelope(
                MessageEnvelope(
                    room_id=room_id,
                    sender_id="server",
                    type="CURSOR_PERMISSION_RESULT",
                    payload={"allowed": allowed},
                )
            )

        # Broadcast active allowed list to room
        await self.context.connection_manager.broadcast_to_room(
            room_id,
            MessageEnvelope(
                room_id=room_id,
                sender_id="server",
                type="CURSOR_PERMISSIONS_UPDATE",
                payload={"allowed_session_ids": list(self.allowed_cursor_sessions[room_id])},
            ),
        )

    async def handle_roster_req(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Returns the active participant roster for the room."""
        room_id = envelope.room_id
        sessions = await self.context.connection_manager.get_room_sessions(room_id)
        roster = [
            {
                "session_id": s.session_id,
                "display_name": s.display_name or "Anonymous",
                "role": s.role,
                "transport": s.transport.value,
            }
            for s in sessions
        ]

        await session.send_envelope(
            MessageEnvelope(
                room_id=room_id,
                sender_id="server",
                type="PRESENCE_ROSTER_RES",
                client_seq=envelope.client_seq,
                payload={"participants": roster},
            )
        )

    async def shutdown(self) -> None:
        logger.info("PresenceFeatureModule shutdown cleanly")

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
        logger.info("PresenceFeatureModule initialized")

    def register_events(self, registry: EventRegistry) -> None:
        registry.register("PRESENCE_CURSOR", self.handle_cursor_broadcast)
        registry.register("PRESENCE_ROSTER_REQ", self.handle_roster_req)

    async def handle_cursor_broadcast(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Broadcasts cursor coordinates to peers without saving to persistent storage."""
        room_id = envelope.room_id
        cursor_data = {
            "session_id": session.session_id,
            "display_name": session.display_name or "Anonymous",
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

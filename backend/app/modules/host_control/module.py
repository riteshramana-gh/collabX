"""Host control module for room administration, user moderation, and snapshot management."""

import json
import logging
import time
from typing import List
from app.modules.base import FeatureModule
from app.core.context import ApplicationContext
from app.engine.event_bus import EventRegistry
from app.core.exceptions import AuthorizationError
from app.transport.envelope import MessageEnvelope
from app.transport.session import ClientSession

logger = logging.getLogger("collabboard.modules.host")


class HostControlModule(FeatureModule):
    """Provides host administrative capabilities: room locking, kicking, and snapshot export/restore."""

    @property
    def name(self) -> str:
        return "host_control"

    @property
    def dependencies(self) -> List[str]:
        return ["canvas"]

    async def initialize(self, context: ApplicationContext) -> None:
        self.context = context
        self.locked_rooms = set()
        logger.info("HostControlModule initialized")

    def register_events(self, registry: EventRegistry) -> None:
        registry.register("HOST_LOCK_ROOM", self.handle_lock_room)
        registry.register("HOST_KICK_USER", self.handle_kick_user)
        registry.register("HOST_EXPORT_SNAPSHOT", self.handle_export_snapshot)
        registry.register("HOST_RESTORE_SNAPSHOT", self.handle_restore_snapshot)

    async def handle_lock_room(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Locks or unlocks a room."""
        room_id = envelope.room_id
        lock_state = bool(envelope.payload.get("is_locked", True))

        if lock_state:
            self.locked_rooms.add(room_id)
        else:
            self.locked_rooms.discard(room_id)

        # Broadcast lock status
        broadcast_env = MessageEnvelope(
            room_id=room_id,
            sender_id="server",
            type="HOST_ROOM_LOCKED",
            payload={"is_locked": lock_state, "locked_by": session.display_name},
        )
        await self.context.connection_manager.broadcast_to_room(room_id, broadcast_env)

    async def handle_kick_user(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Kicks a participant from the room."""
        room_id = envelope.room_id
        target_session_id = envelope.payload.get("target_session_id")
        reason = envelope.payload.get("reason", "Kicked by room host")

        if not target_session_id:
            return

        target_session = await self.context.connection_manager.get_session(target_session_id)
        if target_session and target_session.room_id == room_id:
            # Send notification to kicked user
            await target_session.send_envelope(
                MessageEnvelope(
                    room_id=room_id,
                    sender_id="server",
                    type="HOST_USER_KICKED",
                    payload={"reason": reason},
                )
            )
            # Remove from room and terminate connection
            await self.context.connection_manager.leave_room(target_session_id, room_id)
            await target_session.close(code=1008, reason=reason)

            # Broadcast to remaining members
            await self.context.connection_manager.broadcast_to_room(
                room_id,
                MessageEnvelope(
                    room_id=room_id,
                    sender_id="server",
                    type="PRESENCE_LEFT",
                    payload={"session_id": target_session_id, "reason": "KICKED"},
                ),
            )

    async def handle_export_snapshot(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Exports the complete canvas state, metadata, and history into a downloadable JSON payload."""
        room_id = envelope.room_id
        room_actor = await self.context.room_manager.get_room(room_id)
        if not room_actor:
            return

        canvas_snapshot = room_actor.canvas_state.get_snapshot()
        export_bundle = {
            "version": "1.0",
            "app": "CollabBoard X",
            "room_id": room_id,
            "exported_at": int(time.time() * 1000),
            "sequence_number": room_actor.current_seq,
            "elements": canvas_snapshot.get("elements", {}),
        }

        await session.send_envelope(
            MessageEnvelope(
                room_id=room_id,
                sender_id="server",
                type="HOST_SNAPSHOT_EXPORTED",
                client_seq=envelope.client_seq,
                payload={"snapshot": export_bundle},
            )
        )

    async def handle_restore_snapshot(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Restores canvas state from an imported snapshot bundle."""
        room_id = envelope.room_id
        snapshot_data = envelope.payload.get("snapshot", {})
        if not snapshot_data or "elements" not in snapshot_data:
            return

        room_actor = await self.context.room_manager.get_or_create_room(room_id)

        # Restore in-memory state
        room_actor.canvas_state.restore_snapshot(snapshot_data)
        room_actor.current_seq += 1
        new_seq = room_actor.current_seq

        # Save to database
        await self.context.repositories["canvas_repo"].save_snapshot(
            room_id, new_seq, room_actor.canvas_state.get_snapshot()
        )
        await self.context.repositories["canvas_repo"].update_room_seq(room_id, new_seq)

        # Broadcast restored snapshot to all participants
        snapshot_env = await room_actor.get_initial_snapshot_envelope()
        await self.context.connection_manager.broadcast_to_room(room_id, snapshot_env)

    async def shutdown(self) -> None:
        logger.info("HostControlModule shutdown cleanly")

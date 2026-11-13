"""WebRTC Voice Signaling Feature Module."""

import logging
from typing import Dict, List
from app.modules.base import FeatureModule
from app.core.context import ApplicationContext
from app.engine.event_bus import EventRegistry
from app.transport.envelope import MessageEnvelope
from app.transport.session import ClientSession

logger = logging.getLogger("collabboard.modules.voice")


class VoiceSignalingModule(FeatureModule):
    """Enables browser-based WebRTC Opus group voice communication over LAN."""

    @property
    def name(self) -> str:
        return "voice"

    @property
    def dependencies(self) -> List[str]:
        return []

    async def initialize(self, context: ApplicationContext) -> None:
        self.context = context
        # room_id -> { session_id -> state_data }
        self.room_voice_peers: Dict[str, Dict[str, dict]] = {}
        logger.info("VoiceSignalingModule initialized")

    def register_events(self, registry: EventRegistry) -> None:
        registry.register("VOICE_SIGNAL_OFFER", self.handle_offer)
        registry.register("VOICE_SIGNAL_ANSWER", self.handle_answer)
        registry.register("VOICE_SIGNAL_ICE", self.handle_ice)
        registry.register("VOICE_STATE_UPDATE", self.handle_voice_state)
        registry.register("VOICE_ROSTER_REQ", self.handle_voice_roster_req)

    async def handle_offer(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Forwards WebRTC SDP Offer to the target peer."""
        target_id = envelope.payload.get("target_session_id")
        if not target_id:
            return

        target_session = await self.context.connection_manager.get_session(target_id)
        if target_session and target_session.is_active:
            forward_env = MessageEnvelope(
                room_id=envelope.room_id,
                sender_id=session.session_id,
                type="VOICE_SIGNAL_OFFER",
                payload={
                    "source_session_id": session.session_id,
                    "source_name": session.display_name or "Anonymous",
                    "sdp": envelope.payload.get("sdp"),
                },
            )
            await target_session.send_envelope(forward_env)

    async def handle_answer(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Forwards WebRTC SDP Answer to the originating peer."""
        target_id = envelope.payload.get("target_session_id")
        if not target_id:
            return

        target_session = await self.context.connection_manager.get_session(target_id)
        if target_session and target_session.is_active:
            forward_env = MessageEnvelope(
                room_id=envelope.room_id,
                sender_id=session.session_id,
                type="VOICE_SIGNAL_ANSWER",
                payload={
                    "source_session_id": session.session_id,
                    "sdp": envelope.payload.get("sdp"),
                },
            )
            await target_session.send_envelope(forward_env)

    async def handle_ice(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Forwards local host ICE candidate to the target peer."""
        target_id = envelope.payload.get("target_session_id")
        if not target_id:
            return

        target_session = await self.context.connection_manager.get_session(target_id)
        if target_session and target_session.is_active:
            forward_env = MessageEnvelope(
                room_id=envelope.room_id,
                sender_id=session.session_id,
                type="VOICE_SIGNAL_ICE",
                payload={
                    "source_session_id": session.session_id,
                    "candidate": envelope.payload.get("candidate"),
                },
            )
            await target_session.send_envelope(forward_env)

    async def handle_voice_state(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Broadcasts mute, deafen, or speaking state changes to the room and tracks active peers."""
        room_id = envelope.room_id
        is_active = envelope.payload.get("is_active", True)
        state_data = {
            "session_id": session.session_id,
            "display_name": session.display_name or "Anonymous",
            "is_active": is_active,
            "is_muted": envelope.payload.get("is_muted", False),
            "is_deafened": envelope.payload.get("is_deafened", False),
            "is_speaking": envelope.payload.get("is_speaking", False),
        }

        if room_id not in self.room_voice_peers:
            self.room_voice_peers[room_id] = {}

        if is_active:
            self.room_voice_peers[room_id][session.session_id] = state_data
        else:
            self.room_voice_peers[room_id].pop(session.session_id, None)

        broadcast_env = MessageEnvelope(
            room_id=room_id,
            sender_id=session.session_id,
            type="VOICE_STATE_BROADCAST",
            payload=state_data,
        )
        await self.context.connection_manager.broadcast_to_room(room_id, broadcast_env)

    async def handle_voice_roster_req(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Returns the active voice participants for the room."""
        room_id = envelope.room_id
        active_peers = list(self.room_voice_peers.get(room_id, {}).values())
        await session.send_envelope(
            MessageEnvelope(
                room_id=room_id,
                sender_id="server",
                type="VOICE_ROSTER_RES",
                client_seq=envelope.client_seq,
                payload={"peers": active_peers},
            )
        )

    async def shutdown(self) -> None:
        self.room_voice_peers.clear()
        logger.info("VoiceSignalingModule shutdown cleanly")

"""Chat feature module handling message persistence and real-time room broadcast."""

import logging
from typing import List
from app.modules.base import FeatureModule
from app.core.context import ApplicationContext
from app.engine.event_bus import EventRegistry
from app.storage.repositories.chat_repo import SQLiteChatRepository
from app.transport.envelope import MessageEnvelope
from app.transport.session import ClientSession

logger = logging.getLogger("collabboard.modules.chat")


class ChatFeatureModule(FeatureModule):
    """Provides real-time room chat with persistent history."""

    @property
    def name(self) -> str:
        return "chat"

    @property
    def dependencies(self) -> List[str]:
        return ["canvas"]

    async def initialize(self, context: ApplicationContext) -> None:
        self.context = context
        db_manager = context.repositories.get("db_manager")
        if not db_manager:
            raise RuntimeError("DatabaseManager required before ChatFeatureModule initialization")
        self.chat_repo = SQLiteChatRepository(db_manager.connection)
        context.repositories["chat_repo"] = self.chat_repo
        logger.info("ChatFeatureModule initialized")

    def register_events(self, registry: EventRegistry) -> None:
        registry.register("CHAT_MSG_SEND", self.handle_chat_send)
        registry.register("CHAT_HISTORY_REQ", self.handle_chat_history)

    async def handle_chat_send(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        room_id = envelope.room_id
        content = envelope.payload.get("content", "").strip()
        if not content:
            return

        sender_name = envelope.payload.get("sender_name") or session.display_name or "Anonymous"
        target_type = envelope.payload.get("target_type", "EVERYONE")
        target_session_id = envelope.payload.get("target_session_id")
        target_name = envelope.payload.get("target_name")

        # Ensure room exists and obtain current room sequence
        room_actor = await self.context.room_manager.get_or_create_room(room_id)
        current_seq = room_actor.current_seq if room_actor else 0

        # Persist message
        msg_record = await self.chat_repo.append_message(
            room_id=room_id,
            seq=current_seq,
            sender_id=session.session_id,
            sender_name=sender_name,
            content=content,
        )
        msg_record["target_type"] = target_type
        msg_record["target_session_id"] = target_session_id
        msg_record["target_name"] = target_name

        chat_envelope = MessageEnvelope(
            room_id=room_id,
            sender_id=session.session_id,
            type="CHAT_MSG_BROADCAST",
            server_seq=current_seq,
            payload=msg_record,
        )

        room_sessions = await self.context.connection_manager.get_room_sessions(room_id)

        if target_type == "HOST_ONLY":
            # Direct private message to Room Host
            host_sessions = [s for s in room_sessions if getattr(s, "role", "EDITOR") == "HOST"]
            for h in host_sessions:
                await h.send_envelope(chat_envelope)
            if session not in host_sessions:
                await session.send_envelope(chat_envelope)
        elif target_type == "DIRECT" and target_session_id:
            # Direct 1-on-1 private message to specified participant
            target_sess = next((s for s in room_sessions if s.session_id == target_session_id), None)
            if target_sess:
                await target_sess.send_envelope(chat_envelope)
            if session != target_sess:
                await session.send_envelope(chat_envelope)
        else:
            # Public message broadcast to all room members
            await self.context.connection_manager.broadcast_to_room(room_id, chat_envelope)

    async def handle_chat_history(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        room_id = envelope.room_id
        limit = min(100, int(envelope.payload.get("limit", 50)))
        history = await self.chat_repo.get_recent_messages(room_id, limit=limit)

        await session.send_envelope(
            MessageEnvelope(
                room_id=room_id,
                sender_id="server",
                type="CHAT_HISTORY_RES",
                client_seq=envelope.client_seq,
                payload={"messages": history},
            )
        )

    async def shutdown(self) -> None:
        logger.info("ChatFeatureModule shutdown cleanly")

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
        self.room_chat_policies: Dict[str, str] = {}
        logger.info("ChatFeatureModule initialized")

    def register_events(self, registry: EventRegistry) -> None:
        registry.register("CHAT_MSG_SEND", self.handle_chat_send)
        registry.register("CHAT_HISTORY_REQ", self.handle_chat_history)
        registry.register("HOST_SET_CHAT_POLICY", self.handle_set_chat_policy)

    async def handle_set_chat_policy(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Sets the active chat restriction level for the room (Host only)."""
        room_id = envelope.room_id
        if getattr(session, "role", "EDITOR") != "HOST":
            logger.warning(f"User {session.session_id} attempted to change chat policy without HOST permissions")
            return

        policy = envelope.payload.get("policy") or envelope.payload.get("chat_policy", "EVERYONE")
        if policy not in ("EVERYONE", "HOST_ONLY", "NO_DIRECT", "DISABLED"):
            policy = "EVERYONE"

        self.room_chat_policies[room_id] = policy
        logger.info(f"Room {room_id} chat restriction updated to '{policy}' by {session.display_name}")

        await self.context.connection_manager.broadcast_to_room(
            room_id,
            MessageEnvelope(
                room_id=room_id,
                sender_id="server",
                type="ROOM_CHAT_POLICY_CHANGED",
                payload={"chat_policy": policy, "updated_by": session.display_name or "Host"},
            ),
        )

    async def handle_chat_send(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        room_id = envelope.room_id
        content = envelope.payload.get("content", "").strip()
        if not content:
            return

        sender_name = envelope.payload.get("sender_name") or session.display_name or "Anonymous"
        target_type = envelope.payload.get("target_type", "EVERYONE")
        target_session_id = envelope.payload.get("target_session_id")
        target_name = envelope.payload.get("target_name")

        # Authoritative enforcement of host chat policy
        chat_policy = self.room_chat_policies.get(room_id, "EVERYONE")
        is_host = getattr(session, "role", "EDITOR") == "HOST"

        # Spectators (VIEWER role without authentication) cannot send chat messages
        is_spectator = getattr(session, "role", "EDITOR") == "VIEWER" and not getattr(session, "is_authenticated", False)
        if is_spectator and not is_host:
            await session.send_envelope(
                MessageEnvelope(
                    room_id=room_id,
                    sender_id="server",
                    type="CHAT_ERROR",
                    client_seq=envelope.client_seq,
                    payload={"error": "AUTH_REQUIRED", "message": "Only logged-in users can send chat messages. Spectators have read-only access."},
                )
            )
            return

        if not is_host:
            if chat_policy == "DISABLED":
                await session.send_envelope(
                    MessageEnvelope(
                        room_id=room_id,
                        sender_id="server",
                        type="CHAT_ERROR",
                        client_seq=envelope.client_seq,
                        payload={"error": "CHAT_DISABLED", "message": "Room chat is currently disabled by the Host."},
                    )
                )
                return
            if chat_policy == "HOST_ONLY" and target_type != "HOST_ONLY":
                await session.send_envelope(
                    MessageEnvelope(
                        room_id=room_id,
                        sender_id="server",
                        type="CHAT_ERROR",
                        client_seq=envelope.client_seq,
                        payload={"error": "CHAT_HOST_ONLY", "message": "Host has restricted chat to Host-only messages."},
                    )
                )
                return
            if chat_policy == "NO_DIRECT" and target_type == "DIRECT":
                await session.send_envelope(
                    MessageEnvelope(
                        room_id=room_id,
                        sender_id="server",
                        type="CHAT_ERROR",
                        client_seq=envelope.client_seq,
                        payload={"error": "CHAT_NO_DIRECT", "message": "Direct participant messages are disabled by the Host."},
                    )
                )
                return

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
                payload={
                    "messages": history,
                    "chat_policy": self.room_chat_policies.get(room_id, "EVERYONE"),
                },
            )
        )

    async def shutdown(self) -> None:
        logger.info("ChatFeatureModule shutdown cleanly")

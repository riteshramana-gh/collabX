"""Canvas feature module implementing FeatureModule interface."""

import logging
from typing import List
from app.modules.base import FeatureModule
from app.core.context import ApplicationContext
from app.engine.event_bus import EventRegistry
from app.engine.room_manager import RoomManager
from app.storage.database import DatabaseManager
from app.storage.repositories.canvas_repo import SQLiteCanvasRepository
from app.storage.repositories.auth_repo import SQLiteAuthRepository
from app.transport.envelope import MessageEnvelope
from app.transport.session import ClientSession

logger = logging.getLogger("collabboard.modules.canvas")


class CanvasFeatureModule(FeatureModule):
    """Server-authoritative collaborative canvas feature module."""

    @property
    def name(self) -> str:
        return "canvas"

    @property
    def dependencies(self) -> List[str]:
        return []

    async def initialize(self, context: ApplicationContext) -> None:
        self.context = context

        # 1. Initialize SQLite Database
        db_manager = DatabaseManager(context.settings.DATABASE_PATH)
        await db_manager.initialize()
        context.repositories["db_manager"] = db_manager

        # 2. Create Canvas & Auth Repositories
        canvas_repo = SQLiteCanvasRepository(db_manager.connection)
        context.repositories["canvas_repo"] = canvas_repo
        auth_repo = SQLiteAuthRepository(db_manager.connection)
        context.repositories["auth_repo"] = auth_repo

        # 3. Create Room Manager
        room_manager = RoomManager(
            canvas_repo=canvas_repo,
            connection_manager=context.connection_manager,
            snapshot_interval_ops=context.settings.SNAPSHOT_INTERVAL_OPS,
        )
        context.room_manager = room_manager
        logger.info("CanvasFeatureModule initialized with RoomManager and SQLiteCanvasRepository")

    def register_events(self, registry: EventRegistry) -> None:
        registry.register("ROOM_JOIN_REQ", self.handle_room_join)
        registry.register("CANVAS_OP_REQ", self.handle_canvas_op)
        registry.register("ROOM_REPLAY_REQ", self.handle_replay_req)
        registry.register("ROOM_SNAPSHOT_REQ", self.handle_snapshot_req)

    async def handle_room_join(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Handles a participant joining a room with authentication & spectator roles."""
        room_id = envelope.room_id
        display_name = envelope.payload.get("display_name", "Anonymous")
        is_creator = envelope.payload.get("is_creator", False)
        auth_token = envelope.payload.get("auth_token")

        # 1. Resolve user authentication
        auth_repo = self.context.repositories.get("auth_repo")
        user = None
        if auth_repo and auth_token:
            user = await auth_repo.get_user_by_token(auth_token)

        if user:
            session.is_authenticated = True
            session.authenticated_username = user["username"]
            session.display_name = display_name if display_name and display_name != "Student" else user["display_name"]
        else:
            session.is_authenticated = False
            session.authenticated_username = None
            session.display_name = display_name or "Guest Spectator"

        room_actor = await self.context.room_manager.get_or_create_room(room_id)
        existing_sessions = await self.context.connection_manager.get_room_sessions(room_id)
        other_sessions = [s for s in existing_sessions if s.session_id != session.session_id]

        # 2. Host Designation & Role Logic
        if not room_actor.host_username:
            if session.is_authenticated:
                room_actor.host_username = session.authenticated_username
                room_actor.host_session_id = session.session_id
                session.role = "HOST"
                canvas_repo = self.context.repositories.get("canvas_repo")
                if canvas_repo:
                    await canvas_repo.db.execute(
                        "UPDATE rooms SET host_user_id = ? WHERE id = ?",
                        (session.authenticated_username, room_id),
                    )
                    await canvas_repo.db.commit()
                logger.info(f"Designated logged-in HOST for room {room_id}: @{session.authenticated_username} ({session.session_id})")
            elif is_creator or len(other_sessions) == 0:
                session.role = "HOST"
                room_actor.host_session_id = session.session_id
                logger.info(f"Designated creator HOST for room {room_id}: {session.session_id} ({session.display_name})")
            else:
                session.role = "VIEWER"
                logger.info(f"Guest spectator joined room {room_id}: {session.session_id} ({session.display_name})")
        else:
            if session.is_authenticated and session.authenticated_username.lower() == room_actor.host_username.lower():
                session.role = "HOST"
                room_actor.host_session_id = session.session_id
                logger.info(f"Host @{session.authenticated_username} joined room {room_id} as HOST ({session.session_id})")
            elif session.is_authenticated:
                session.role = "VIEWER" if room_actor.is_board_locked else "EDITOR"
                logger.info(f"Logged-in user @{session.authenticated_username} joined room {room_id} as {session.role}")
            else:
                session.role = "VIEWER"
                logger.info(f"Guest spectator {session.display_name} joined room {room_id} as VIEWER")

        await self.context.connection_manager.join_room(session.session_id, room_id)

        # 3. Send Join Acknowledgement
        await session.send_envelope(
            MessageEnvelope(
                room_id=room_id,
                sender_id="server",
                type="ROOM_JOIN_ACK",
                client_seq=envelope.client_seq,
                server_seq=room_actor.current_seq,
                payload={
                    "session_id": session.session_id,
                    "room_id": room_id,
                    "display_name": session.display_name,
                    "role": session.role,
                    "is_authenticated": session.is_authenticated,
                    "authenticated_username": getattr(session, "authenticated_username", None),
                    "host_username": room_actor.host_username,
                    "is_board_locked": room_actor.is_board_locked,
                    "host_session_id": room_actor.host_session_id,
                },
            )
        )

        # 4. Send authoritative snapshot
        snapshot_envelope = await room_actor.get_initial_snapshot_envelope()
        await session.send_envelope(snapshot_envelope)

        # 5. Broadcast participant joined to room
        await self.context.connection_manager.broadcast_to_room(
            room_id,
            MessageEnvelope(
                room_id=room_id,
                sender_id="server",
                type="PRESENCE_JOINED",
                server_seq=room_actor.current_seq,
                payload={
                    "session_id": session.session_id,
                    "display_name": session.display_name,
                    "role": session.role,
                    "is_authenticated": session.is_authenticated,
                    "authenticated_username": getattr(session, "authenticated_username", None),
                },
            ),
            exclude_session_id=session.session_id,
        )

    async def handle_canvas_op(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Enqueues canvas mutation into room actor for serialized processing."""
        room_actor = await self.context.room_manager.get_or_create_room(envelope.room_id)
        await room_actor.enqueue_operation(session, envelope)

    async def handle_replay_req(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Handles gap detection recovery request."""
        from_seq = envelope.payload.get("from_seq", 1)
        to_seq = envelope.payload.get("to_seq", from_seq)
        room_actor = await self.context.room_manager.get_room(envelope.room_id)
        if room_actor:
            await room_actor.handle_replay_request(session, from_seq, to_seq)

    async def handle_snapshot_req(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Sends on-demand snapshot."""
        room_actor = await self.context.room_manager.get_room(envelope.room_id)
        if room_actor:
            snapshot_envelope = await room_actor.get_initial_snapshot_envelope()
            await session.send_envelope(snapshot_envelope)

    async def shutdown(self) -> None:
        if self.context.room_manager:
            await self.context.room_manager.shutdown_all()
        db_manager = self.context.repositories.get("db_manager")
        if db_manager:
            await db_manager.close()
        logger.info("CanvasFeatureModule shutdown cleanly")

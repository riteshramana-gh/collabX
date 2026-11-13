"""Canvas feature module implementing FeatureModule interface."""

import logging
from typing import List
from app.modules.base import FeatureModule
from app.core.context import ApplicationContext
from app.engine.event_bus import EventRegistry
from app.engine.room_manager import RoomManager
from app.storage.database import DatabaseManager
from app.storage.repositories.canvas_repo import SQLiteCanvasRepository
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

        # 2. Create Canvas Repository
        canvas_repo = SQLiteCanvasRepository(db_manager.connection)
        context.repositories["canvas_repo"] = canvas_repo

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
        """Handles a participant joining a room."""
        room_id = envelope.room_id
        display_name = envelope.payload.get("display_name", "Anonymous")
        is_creator = envelope.payload.get("is_creator", False)
        session.display_name = display_name

        room_actor = await self.context.room_manager.get_or_create_room(room_id)
        existing_sessions = await self.context.connection_manager.get_room_sessions(room_id)
        other_sessions = [s for s in existing_sessions if s.session_id != session.session_id]

        # First participant or explicit room creator becomes HOST; subsequent users join as EDITOR (or VIEWER if board is locked)
        if room_actor.host_session_id is None or is_creator or len(other_sessions) == 0:
            session.role = "HOST"
            room_actor.host_session_id = session.session_id
            logger.info(f"Designated HOST for room {room_id}: {session.session_id} ({display_name})")
        else:
            if room_actor.is_board_locked:
                session.role = "VIEWER"
            else:
                session.role = "EDITOR"
            logger.info(f"Participant joined room {room_id}: {session.session_id} ({display_name}) as {session.role}")

        await self.context.connection_manager.join_room(session.session_id, room_id)

        # 1. Send Join Acknowledgement
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
                    "display_name": display_name,
                    "role": session.role,
                    "is_board_locked": room_actor.is_board_locked,
                    "host_session_id": room_actor.host_session_id,
                },
            )
        )

        # 2. Send authoritative snapshot
        snapshot_envelope = await room_actor.get_initial_snapshot_envelope()
        await session.send_envelope(snapshot_envelope)

        # 3. Broadcast participant joined to room
        await self.context.connection_manager.broadcast_to_room(
            room_id,
            MessageEnvelope(
                room_id=room_id,
                sender_id="server",
                type="PRESENCE_JOINED",
                server_seq=room_actor.current_seq,
                payload={
                    "session_id": session.session_id,
                    "display_name": display_name,
                    "role": session.role,
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

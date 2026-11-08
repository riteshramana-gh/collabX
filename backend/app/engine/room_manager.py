"""Room manager managing lifecycle and lookup of per-room actors."""

import asyncio
import logging
from typing import Dict, List, Optional
from app.engine.room_actor import RoomActor
from app.storage.repositories.base import ICanvasRepository
from app.transport.connection_manager import ConnectionManager

logger = logging.getLogger("collabboard.engine.room_manager")


class RoomManager:
    """Registry and factory for isolated RoomActor instances."""

    def __init__(
        self,
        canvas_repo: ICanvasRepository,
        connection_manager: ConnectionManager,
        snapshot_interval_ops: int = 50,
    ):
        self.canvas_repo = canvas_repo
        self.connection_manager = connection_manager
        self.snapshot_interval_ops = snapshot_interval_ops
        self._rooms: Dict[str, RoomActor] = {}
        self._lock = asyncio.Lock()

    async def get_or_create_room(self, room_id: str) -> RoomActor:
        """Retrieves an existing RoomActor or spawns and starts a new one."""
        async with self._lock:
            if room_id in self._rooms:
                return self._rooms[room_id]

            actor = RoomActor(
                room_id=room_id,
                canvas_repo=self.canvas_repo,
                connection_manager=self.connection_manager,
                snapshot_interval_ops=self.snapshot_interval_ops,
            )
            await actor.start()
            self._rooms[room_id] = actor
            logger.info(f"Spawned new RoomActor for '{room_id}'")
            return actor

    async def get_room(self, room_id: str) -> Optional[RoomActor]:
        """Looks up an active room without spawning."""
        async with self._lock:
            return self._rooms.get(room_id)

    async def list_active_rooms(self) -> List[str]:
        """Returns list of active room IDs."""
        async with self._lock:
            return list(self._rooms.keys())

    async def shutdown_all(self) -> None:
        """Shuts down all active room actors."""
        async with self._lock:
            actors = list(self._rooms.values())
            self._rooms.clear()

        for actor in actors:
            try:
                await actor.stop()
            except Exception as e:
                logger.error(f"Error shutting down RoomActor {actor.room_id}: {e}", exc_info=True)
        logger.info(f"Shut down {len(actors)} room actors")

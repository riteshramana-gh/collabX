"""Abstract repository interfaces."""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class ICanvasRepository(ABC):
    """Abstract repository for persisting rooms, canvas mutations, and snapshots."""

    @abstractmethod
    async def get_or_create_room(
        self,
        room_id: str,
        name: str = "New Board",
        host_user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        pass

    @abstractmethod
    async def update_room_seq(self, room_id: str, new_seq: int) -> None:
        pass

    @abstractmethod
    async def is_client_op_processed(self, room_id: str, client_op_id: str) -> bool:
        pass

    @abstractmethod
    async def append_operation(
        self,
        room_id: str,
        seq: int,
        client_op_id: str,
        sender_id: str,
        op_type: str,
        element_id: Optional[str],
        payload: Dict[str, Any],
    ) -> None:
        pass

    @abstractmethod
    async def get_operations_range(
        self,
        room_id: str,
        from_seq: int,
        to_seq: int,
    ) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    async def save_snapshot(
        self,
        room_id: str,
        sequence_number: int,
        state: Dict[str, Any],
    ) -> None:
        pass

    @abstractmethod
    async def get_latest_snapshot(self, room_id: str) -> Optional[Dict[str, Any]]:
        pass

"""Authoritative server-side canvas state engine."""

from typing import Any, Dict, Optional, Tuple
from app.modules.canvas.models import CanvasElement, CanvasOperation, CanvasOperationType


class AuthoritativeCanvasState:
    """Maintains the single source of truth for all canvas elements in a room."""

    def __init__(self, room_id: str):
        self.room_id = room_id
        self._elements: Dict[str, CanvasElement] = {}

    def apply_operation(
        self,
        op: CanvasOperation,
        sender_id: str,
        timestamp: int,
    ) -> Tuple[bool, Optional[CanvasElement]]:
        """Applies an operation to the authoritative state with element-level Last-Write-Wins semantics.
        
        Returns: (success: bool, resulting_element: Optional[CanvasElement])
        """
        if op.op_type == CanvasOperationType.ADD:
            if not op.element:
                return False, None
            elem = op.element.model_copy(deep=True)
            elem.created_by = sender_id
            elem.last_modified_by = sender_id
            elem.last_modified_at = timestamp
            elem.version = 1
            self._elements[elem.id] = elem
            return True, elem

        elif op.op_type in (CanvasOperationType.UPDATE, CanvasOperationType.TRANSFORM):
            if not op.element_id or op.element_id not in self._elements:
                return False, None
            current = self._elements[op.element_id]
            data = current.model_dump()
            if op.patch:
                for k, v in op.patch.items():
                    if k not in ("id", "type", "created_by"):  # Immutable properties
                        data[k] = v
            data["last_modified_by"] = sender_id
            data["last_modified_at"] = timestamp
            data["version"] = current.version + 1
            updated = CanvasElement.model_validate(data)
            self._elements[op.element_id] = updated
            return True, updated

        elif op.op_type == CanvasOperationType.DELETE:
            if not op.element_id:
                return False, None
            removed = self._elements.pop(op.element_id, None)
            return True, removed

        elif op.op_type == CanvasOperationType.CLEAR:
            self._elements.clear()
            return True, None

        return False, None

    def get_element(self, element_id: str) -> Optional[CanvasElement]:
        return self._elements.get(element_id)

    def get_snapshot(self) -> Dict[str, Any]:
        """Returns a serialized snapshot of all active elements."""
        return {
            "room_id": self.room_id,
            "elements_count": len(self._elements),
            "elements": {eid: elem.model_dump() for eid, elem in self._elements.items()},
        }

    def restore_snapshot(self, snapshot_data: Dict[str, Any]) -> None:
        """Restores authoritative state from a snapshot dictionary."""
        self._elements.clear()
        raw_elements = snapshot_data.get("elements", {})
        for eid, edata in raw_elements.items():
            self._elements[eid] = CanvasElement.model_validate(edata)

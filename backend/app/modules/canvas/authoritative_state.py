"""Authoritative server-side canvas & notebook state engine."""

from typing import Any, Dict, List, Optional, Tuple
from app.modules.canvas.models import (
    CanvasElement,
    CanvasOperation,
    CanvasOperationType,
    NotebookPage,
    PageTemplate,
)


class AuthoritativeCanvasState:
    """Maintains the single source of truth for all canvas elements and notebook pages in a room."""

    def __init__(self, room_id: str):
        self.room_id = room_id
        self._elements: Dict[str, CanvasElement] = {}
        self._pages: Dict[str, NotebookPage] = {
            "page-1": NotebookPage(
                id="page-1",
                index=0,
                title="Page 1",
                template=PageTemplate.RULED,
                background_color="#ffffff",
            )
        }

    def apply_operation(
        self,
        op: CanvasOperation,
        sender_id: str,
        timestamp: int,
    ) -> Tuple[bool, Optional[Any]]:
        """Applies an operation to the authoritative state with element-level Last-Write-Wins semantics.
        
        Returns: (success: bool, resulting_object: Optional[Any])
        """
        # --- Canvas Element Operations ---
        if op.op_type == CanvasOperationType.ADD:
            if not op.element:
                return False, None
            elem = op.element.model_copy(deep=True)
            elem.created_by = sender_id
            elem.last_modified_by = sender_id
            elem.last_modified_at = timestamp
            elem.version = 1
            if not elem.page_id or elem.page_id not in self._pages:
                elem.page_id = "page-1"
            self._elements[elem.id] = elem
            return True, elem

        elif op.op_type in (CanvasOperationType.UPDATE, CanvasOperationType.TRANSFORM):
            if not op.element_id or op.element_id not in self._elements:
                return False, None
            current = self._elements[op.element_id]

            # Enforce object locking (cannot modify locked element unless patch toggles is_locked)
            if current.is_locked and op.patch and "is_locked" not in op.patch:
                return False, None

            data = current.model_dump()
            if op.patch:
                for k, v in op.patch.items():
                    if k not in ("id", "type", "created_by"):  # Immutable core properties
                        data[k] = v
            data["last_modified_by"] = sender_id
            data["last_modified_at"] = timestamp
            data["version"] = current.version + 1
            updated = CanvasElement.model_validate(data)
            self._elements[op.element_id] = updated
            return True, updated

        elif op.op_type == CanvasOperationType.DELETE:
            if not op.element_id or op.element_id not in self._elements:
                return False, None
            current = self._elements[op.element_id]
            if current.is_locked and (not op.patch or not op.patch.get("force")):
                return False, None
            removed = self._elements.pop(op.element_id, None)
            return True, removed

        elif op.op_type == CanvasOperationType.CLEAR:
            # Clear all unlocked elements
            to_delete = [eid for eid, el in self._elements.items() if not el.is_locked]
            for eid in to_delete:
                self._elements.pop(eid, None)
            return True, None

        # --- Multi-Page Notebook Operations ---
        elif op.op_type == CanvasOperationType.PAGE_CREATE:
            if not op.page:
                return False, None
            page = op.page.model_copy(deep=True)
            if not page.id:
                page.id = f"page-{len(self._pages) + 1}"
            self._pages[page.id] = page
            return True, page

        elif op.op_type == CanvasOperationType.PAGE_UPDATE:
            if not op.page or op.page.id not in self._pages:
                return False, None
            self._pages[op.page.id] = op.page
            return True, op.page

        elif op.op_type == CanvasOperationType.PAGE_DELETE:
            page_id = op.element_id or (op.page.id if op.page else None)
            if not page_id or page_id not in self._pages:
                return False, None
            if len(self._pages) <= 1:
                return False, None  # Cannot delete the only remaining page

            removed_page = self._pages.pop(page_id, None)
            # Delete all elements belonging to this page
            elements_to_remove = [eid for eid, el in self._elements.items() if el.page_id == page_id]
            for eid in elements_to_remove:
                self._elements.pop(eid, None)
            return True, removed_page

        return False, None

    def get_element(self, element_id: str) -> Optional[CanvasElement]:
        return self._elements.get(element_id)

    def get_pages(self) -> List[NotebookPage]:
        return sorted(self._pages.values(), key=lambda p: p.index)

    def get_snapshot(self) -> Dict[str, Any]:
        """Returns a serialized snapshot of all active elements and notebook pages."""
        return {
            "room_id": self.room_id,
            "elements_count": len(self._elements),
            "elements": {eid: elem.model_dump() for eid, elem in self._elements.items()},
            "pages": {pid: page.model_dump() for pid, page in self._pages.items()},
        }

    def restore_snapshot(self, snapshot_data: Dict[str, Any]) -> None:
        """Restores authoritative state from a snapshot dictionary."""
        self._elements.clear()
        raw_elements = snapshot_data.get("elements", {})
        for eid, edata in raw_elements.items():
            self._elements[eid] = CanvasElement.model_validate(edata)

        raw_pages = snapshot_data.get("pages", {})
        if raw_pages:
            self._pages.clear()
            for pid, pdata in raw_pages.items():
                self._pages[pid] = NotebookPage.model_validate(pdata)
        elif not self._pages:
            self._pages["page-1"] = NotebookPage(id="page-1", index=0, title="Page 1")

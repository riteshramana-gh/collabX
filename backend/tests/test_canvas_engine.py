"""Unit tests for AuthoritativeCanvasState element-level mutations."""

import pytest
from app.modules.canvas.models import (
    CanvasElement,
    CanvasOperation,
    CanvasOperationType,
    ElementType,
)
from app.modules.canvas.authoritative_state import AuthoritativeCanvasState


def test_canvas_add_and_get():
    state = AuthoritativeCanvasState("room-test")
    elem = CanvasElement(
        id="elem-1",
        type=ElementType.RECTANGLE,
        x=10.0,
        y=20.0,
        width=100.0,
        height=50.0,
        stroke_color="#ff0000",
        created_by="user-1",
        last_modified_by="user-1",
        last_modified_at=1000,
    )

    op = CanvasOperation(
        client_op_id="op-1",
        op_type=CanvasOperationType.ADD,
        element=elem,
    )

    success, result = state.apply_operation(op, "user-1", 1000)
    assert success is True
    assert result is not None
    assert result.id == "elem-1"
    assert state.get_element("elem-1") is not None


def test_canvas_update_and_transform():
    state = AuthoritativeCanvasState("room-test")
    elem = CanvasElement(
        id="elem-2",
        type=ElementType.ELLIPSE,
        x=50.0,
        y=50.0,
        width=80.0,
        height=80.0,
        created_by="user-1",
        last_modified_by="user-1",
        last_modified_at=1000,
    )
    state.apply_operation(
        CanvasOperation(client_op_id="op-add", op_type=CanvasOperationType.ADD, element=elem),
        "user-1",
        1000,
    )

    # Apply UPDATE patch
    update_op = CanvasOperation(
        client_op_id="op-up",
        op_type=CanvasOperationType.UPDATE,
        element_id="elem-2",
        patch={"stroke_color": "#00ff00", "x": 75.0},
    )
    success, updated = state.apply_operation(update_op, "user-2", 2000)
    assert success is True
    assert updated.stroke_color == "#00ff00"
    assert updated.x == 75.0
    assert updated.version == 2
    assert updated.last_modified_by == "user-2"


def test_canvas_delete_and_clear():
    state = AuthoritativeCanvasState("room-test")
    elem = CanvasElement(
        id="elem-3",
        type=ElementType.TEXT,
        x=0.0,
        y=0.0,
        text="Hello",
        created_by="user-1",
        last_modified_by="user-1",
        last_modified_at=1000,
    )
    state.apply_operation(
        CanvasOperation(client_op_id="op-add", op_type=CanvasOperationType.ADD, element=elem),
        "user-1",
        1000,
    )

    # Delete
    del_op = CanvasOperation(
        client_op_id="op-del",
        op_type=CanvasOperationType.DELETE,
        element_id="elem-3",
    )
    success, removed = state.apply_operation(del_op, "user-1", 2000)
    assert success is True
    assert state.get_element("elem-3") is None


def test_notebook_pages_and_locking():
    from app.modules.canvas.models import NotebookPage, PageTemplate

    state = AuthoritativeCanvasState("room-notebook-test")
    # Verify default page exists
    assert len(state.get_pages()) == 1
    assert state.get_pages()[0].id == "page-1"

    # 1. Create a second page
    page2 = NotebookPage(id="page-2", index=1, title="Lecture Notes", template=PageTemplate.GRID)
    create_op = CanvasOperation(
        client_op_id="op-p2",
        op_type=CanvasOperationType.PAGE_CREATE,
        page=page2,
    )
    ok, res = state.apply_operation(create_op, "user-1", 1000)
    assert ok is True
    assert len(state.get_pages()) == 2

    # 2. Add locked element on page 2
    locked_elem = CanvasElement(
        id="locked-1",
        page_id="page-2",
        type=ElementType.RECTANGLE,
        x=10,
        y=10,
        is_locked=True,
        created_by="user-1",
        last_modified_by="user-1",
        last_modified_at=1000,
    )
    ok, _ = state.apply_operation(
        CanvasOperation(client_op_id="op-lock-elem", op_type=CanvasOperationType.ADD, element=locked_elem),
        "user-1",
        1000,
    )
    assert ok is True

    # 3. Attempt to mutate locked element should be rejected
    move_op = CanvasOperation(
        client_op_id="op-move-locked",
        op_type=CanvasOperationType.UPDATE,
        element_id="locked-1",
        patch={"x": 50},
    )
    ok, _ = state.apply_operation(move_op, "user-2", 2000)
    assert ok is False
    assert state.get_element("locked-1").x == 10  # Unchanged!

    # 4. Delete page 2 cascades elements
    del_page_op = CanvasOperation(
        client_op_id="op-del-p2",
        op_type=CanvasOperationType.PAGE_DELETE,
        element_id="page-2",
    )
    ok, _ = state.apply_operation(del_page_op, "user-1", 3000)
    assert ok is True
    assert len(state.get_pages()) == 1
    assert state.get_element("locked-1") is None  # Cascaded removal


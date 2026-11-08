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

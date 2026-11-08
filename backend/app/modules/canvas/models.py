"""Domain models for canvas elements and operations."""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ElementType(str, Enum):
    PENCIL = "PENCIL"
    RECTANGLE = "RECTANGLE"
    ELLIPSE = "ELLIPSE"
    LINE = "LINE"
    ARROW = "ARROW"
    TEXT = "TEXT"


class CanvasElement(BaseModel):
    """Authoritative representation of a single 2D element on the whiteboard canvas."""

    id: str = Field(description="Unique element identifier (UUID)")
    type: ElementType = Field(description="Visual primitive type")
    x: float = Field(default=0.0, description="Top-left or origin X coordinate")
    y: float = Field(default=0.0, description="Top-left or origin Y coordinate")
    width: Optional[float] = Field(default=None, description="Bounding width")
    height: Optional[float] = Field(default=None, description="Bounding height")
    stroke_color: str = Field(default="#000000", description="Hex or CSS stroke color")
    fill_color: Optional[str] = Field(default=None, description="Hex or CSS fill color")
    stroke_width: float = Field(default=2.0, description="Stroke thickness in pixels")
    points: Optional[List[List[float]]] = Field(
        default=None, description="Polyline points for freehand pencil strokes [[x,y], ...]"
    )
    text: Optional[str] = Field(default=None, description="Text string for text elements")
    font_size: Optional[float] = Field(default=16.0, description="Font size in pixels")
    z_index: int = Field(default=0, description="Layer ordering index")
    version: int = Field(default=1, description="Per-element mutation counter")
    created_by: str = Field(description="Session or user ID of original author")
    last_modified_by: str = Field(description="Session or user ID of last editor")
    last_modified_at: int = Field(description="Unix timestamp (ms) of last modification")


class CanvasOperationType(str, Enum):
    ADD = "ADD"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    TRANSFORM = "TRANSFORM"
    CLEAR = "CLEAR"


class CanvasOperation(BaseModel):
    """Payload representing a client mutation request or server broadcast delta."""

    client_op_id: str = Field(description="Client-generated unique ID for deduplication")
    op_type: CanvasOperationType = Field(description="Operation action type")
    element_id: Optional[str] = Field(default=None, description="Target element ID")
    element: Optional[CanvasElement] = Field(default=None, description="Full element data (for ADD/RESTORE)")
    patch: Optional[Dict[str, Any]] = Field(default=None, description="Partial delta (for UPDATE/TRANSFORM)")

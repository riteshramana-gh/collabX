"""Domain models for canvas elements, notebook pages, and operations."""

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ElementType(str, Enum):
    PENCIL = "PENCIL"
    HIGHLIGHTER = "HIGHLIGHTER"
    RECTANGLE = "RECTANGLE"
    ELLIPSE = "ELLIPSE"
    LINE = "LINE"
    ARROW = "ARROW"
    DOUBLE_ARROW = "DOUBLE_ARROW"
    TRIANGLE = "TRIANGLE"
    POLYGON = "POLYGON"
    STAR = "STAR"
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    STICKER = "STICKER"


class PageTemplate(str, Enum):
    BLANK = "BLANK"
    RULED = "RULED"
    GRID = "GRID"
    DOTTED = "DOTTED"
    PDF = "PDF"


class NotebookPage(BaseModel):
    """Metadata representing an individual page in a notebook."""

    id: str = Field(default="page-1", description="Unique page ID")
    index: int = Field(default=0, description="Page sequence index")
    title: str = Field(default="Page 1", description="Page title")
    template: PageTemplate = Field(default=PageTemplate.RULED, description="Background paper pattern")
    background_color: str = Field(default="#ffffff", description="Paper background color")
    pdf_background_url: Optional[str] = Field(default=None, description="Rendered PDF page data URL")
    is_bookmarked: bool = Field(default=False, description="Whether page is bookmarked")


class CanvasElement(BaseModel):
    """Authoritative representation of a single 2D element on the whiteboard canvas."""

    id: str = Field(description="Unique element identifier (UUID)")
    page_id: str = Field(default="page-1", description="Associated notebook page ID")
    type: ElementType = Field(description="Visual primitive type")
    x: float = Field(default=0.0, description="Top-left or origin X coordinate")
    y: float = Field(default=0.0, description="Top-left or origin Y coordinate")
    width: Optional[float] = Field(default=None, description="Bounding width")
    height: Optional[float] = Field(default=None, description="Bounding height")
    rotation: Optional[float] = Field(default=0.0, description="Rotation angle in radians")
    stroke_color: str = Field(default="#000000", description="Hex or CSS stroke color")
    fill_color: Optional[str] = Field(default=None, description="Hex or CSS fill color")
    stroke_width: float = Field(default=2.0, description="Stroke thickness in pixels")
    opacity: Optional[float] = Field(default=1.0, description="Layer opacity (0.0 to 1.0)")
    pen_style: Optional[str] = Field(default="ballpoint", description="ballpoint | fountain | brush")
    points: Optional[List[List[float]]] = Field(
        default=None, description="Polyline points for freehand strokes [[x,y], ...]"
    )
    points_pressure: Optional[List[float]] = Field(
        default=None, description="Pressure or velocity points matching polyline"
    )
    text: Optional[str] = Field(default=None, description="Text string for text elements")
    font_family: Optional[str] = Field(default="sans-serif", description="Font family")
    font_size: Optional[float] = Field(default=16.0, description="Font size in pixels")
    font_weight: Optional[str] = Field(default="normal", description="normal | bold")
    font_style: Optional[str] = Field(default="normal", description="normal | italic")
    text_decoration: Optional[str] = Field(default="none", description="none | underline | line-through")
    text_align: Optional[str] = Field(default="left", description="left | center | right")
    image_src: Optional[str] = Field(default=None, description="Base64 data URL for images and stickers")
    polygon_sides: Optional[int] = Field(default=3, description="Number of vertices for polygons/stars")
    is_locked: Optional[bool] = Field(default=False, description="Whether element is locked from movement")
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
    PAGE_CREATE = "PAGE_CREATE"
    PAGE_UPDATE = "PAGE_UPDATE"
    PAGE_DELETE = "PAGE_DELETE"


class CanvasOperation(BaseModel):
    """Payload representing a client mutation request or server broadcast delta."""

    client_op_id: str = Field(description="Client-generated unique ID for deduplication")
    op_type: CanvasOperationType = Field(description="Operation action type")
    element_id: Optional[str] = Field(default=None, description="Target element ID")
    element: Optional[CanvasElement] = Field(default=None, description="Full element data (for ADD/RESTORE)")
    patch: Optional[Dict[str, Any]] = Field(default=None, description="Partial delta (for UPDATE/TRANSFORM)")
    page: Optional[NotebookPage] = Field(default=None, description="Page data for page operations")

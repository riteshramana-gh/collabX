"""Application Context container for dependency injection across modules."""

from dataclasses import dataclass, field
from typing import Any, Dict, Optional
import logging
from app.core.config import Settings, get_settings
from app.transport.connection_manager import ConnectionManager
from app.engine.event_bus import EventRegistry

logger = logging.getLogger("collabboard.core.context")


@dataclass
class ApplicationContext:
    """Dependency injection container provided to all feature modules and transports."""

    settings: Settings = field(default_factory=get_settings)
    connection_manager: ConnectionManager = field(default_factory=ConnectionManager)
    event_bus: EventRegistry = field(default_factory=EventRegistry)
    repositories: Dict[str, Any] = field(default_factory=dict)
    modules: Dict[str, Any] = field(default_factory=dict)
    room_manager: Optional[Any] = None
    logger: logging.Logger = field(default_factory=lambda: logging.getLogger("collabboard"))


_global_context: Optional[ApplicationContext] = None


def get_app_context() -> ApplicationContext:
    """Returns the singleton ApplicationContext instance."""
    global _global_context
    if _global_context is None:
        _global_context = ApplicationContext()
    return _global_context

"""Base interface for all CollabBoard X modular features."""

from abc import ABC, abstractmethod
from typing import List
from app.core.context import ApplicationContext
from app.engine.event_bus import EventRegistry


class FeatureModule(ABC):
    """Abstract base class that all plug-in features must implement."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique feature identifier (e.g., 'canvas', 'chat', 'presence')."""
        pass

    @property
    def dependencies(self) -> List[str]:
        """List of module names that must be initialized before this module."""
        return []

    @abstractmethod
    async def initialize(self, context: ApplicationContext) -> None:
        """Lifecycle hook called during server startup to configure state & tables."""
        pass

    @abstractmethod
    def register_events(self, registry: EventRegistry) -> None:
        """Binds feature-specific event handlers to the application EventRegistry."""
        pass

    @abstractmethod
    async def shutdown(self) -> None:
        """Lifecycle hook called during server shutdown to release resources."""
        pass

"""Module registry that manages feature lifecycle and dependency ordering."""

import logging
from typing import Dict, List, Set
from app.modules.base import FeatureModule
from app.core.context import ApplicationContext

logger = logging.getLogger("collabboard.modules.registry")


class ModuleRegistry:
    """Manages feature module registration, dependency resolution, and lifecycle."""

    def __init__(self):
        self._modules: Dict[str, FeatureModule] = {}
        self._initialized_order: List[FeatureModule] = []

    def register(self, module: FeatureModule) -> None:
        """Adds a module to the registry."""
        if module.name in self._modules:
            raise ValueError(f"Module '{module.name}' is already registered")
        self._modules[module.name] = module
        logger.info(f"Registered module '{module.name}' (Dependencies: {module.dependencies})")

    async def initialize_all(self, context: ApplicationContext) -> None:
        """Topologically sorts modules and initializes them in dependency order."""
        visited: Set[str] = set()
        visiting: Set[str] = set()
        ordered: List[FeatureModule] = []

        def dfs(name: str):
            if name in visiting:
                raise RuntimeError(f"Circular dependency detected involving module '{name}'")
            if name not in visited:
                visiting.add(name)
                mod = self._modules.get(name)
                if not mod:
                    raise KeyError(f"Module '{name}' requested as dependency but not registered")
                for dep in mod.dependencies:
                    dfs(dep)
                visiting.remove(name)
                visited.add(name)
                ordered.append(mod)

        for mod_name in self._modules:
            dfs(mod_name)

        # Initialize and register events in topological order
        for mod in ordered:
            logger.info(f"Initializing feature module '{mod.name}'...")
            await mod.initialize(context)
            mod.register_events(context.event_bus)
            self._initialized_order.append(mod)

        logger.info(f"All {len(self._initialized_order)} feature modules initialized successfully.")

    async def shutdown_all(self) -> None:
        """Shuts down modules in reverse dependency order."""
        for mod in reversed(self._initialized_order):
            try:
                logger.info(f"Shutting down module '{mod.name}'...")
                await mod.shutdown()
            except Exception as e:
                logger.error(f"Error shutting down module '{mod.name}': {e}", exc_info=True)
        self._initialized_order.clear()

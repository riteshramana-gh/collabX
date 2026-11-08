"""Lifecycle management for coordinating FastAPI, TCP server, modules, and background tasks."""

import asyncio
import logging
from typing import Optional
from app.core.context import ApplicationContext
from app.transport.raw_tcp_server import RawTCPServer
from app.modules.registry import ModuleRegistry
from app.modules.canvas.module import CanvasFeatureModule
from app.modules.chat.module import ChatFeatureModule
from app.modules.presence.module import PresenceFeatureModule
from app.modules.voice.module import VoiceSignalingModule
from app.modules.host_control.module import HostControlModule

logger = logging.getLogger("collabboard.core.lifecycle")


class LifecycleManager:
    """Manages application startup, background monitoring workers, and shutdown."""

    def __init__(self, context: ApplicationContext):
        self.context = context
        self.raw_tcp_server: Optional[RawTCPServer] = None
        self.module_registry = ModuleRegistry()
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._is_running = False

        # Register core feature modules
        self.module_registry.register(CanvasFeatureModule())
        self.module_registry.register(ChatFeatureModule())
        self.module_registry.register(PresenceFeatureModule())
        self.module_registry.register(VoiceSignalingModule())
        self.module_registry.register(HostControlModule())

    async def startup(self) -> None:
        """Executes all system startup tasks."""
        if self._is_running:
            return
        self._is_running = True

        logger.info("Initializing CollabBoard X server lifecycle...")

        # 1. Initialize all feature modules in dependency order
        await self.module_registry.initialize_all(self.context)

        # 2. Start explicit TCP Socket Server (satisfying CN Lab requirements)
        try:
            self.raw_tcp_server = RawTCPServer(self.context)
            await self.raw_tcp_server.start()
        except Exception as e:
            logger.error(f"Failed to start Raw TCP Socket Server: {e}", exc_info=True)
            raise

        # 3. Start background heartbeat and cleanup monitor
        self._heartbeat_task = asyncio.create_task(self._heartbeat_monitor_loop())

        logger.info("CollabBoard X server lifecycle startup complete.")

    async def shutdown(self) -> None:
        """Executes graceful shutdown and connection drain."""
        if not self._is_running:
            return
        self._is_running = False

        logger.info("Initiating CollabBoard X shutdown sequence...")

        # 1. Stop heartbeat task
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass

        # 2. Stop Raw TCP server
        if self.raw_tcp_server:
            await self.raw_tcp_server.stop()

        # 3. Shutdown feature modules in reverse dependency order
        await self.module_registry.shutdown_all()

        logger.info("Shutdown sequence complete.")

    async def _heartbeat_monitor_loop(self) -> None:
        """Periodic background task that detects and terminates stale sessions."""
        interval = self.context.settings.HEARTBEAT_INTERVAL_SEC
        timeout = self.context.settings.HEARTBEAT_TIMEOUT_SEC

        while self._is_running:
            try:
                await asyncio.sleep(interval)
                stale_sessions = await self.context.connection_manager.check_heartbeat_timeouts(timeout)
                for session in stale_sessions:
                    logger.warning(
                        f"Session {session.session_id} timed out (no activity for > {timeout}s). Closing."
                    )
                    await self.context.connection_manager.unregister_session(session.session_id)
                    await session.close(code=1001, reason="Heartbeat timeout")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in heartbeat monitor loop: {e}", exc_info=True)

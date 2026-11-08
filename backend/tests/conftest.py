"""Pytest fixtures and test environment configuration."""

import pytest
import asyncio
from typing import AsyncIterator
from app.core.config import Settings
from app.core.context import ApplicationContext
from app.transport.connection_manager import ConnectionManager
from app.engine.event_bus import EventRegistry


@pytest.fixture
def test_settings() -> Settings:
    """Provides isolated test settings with ephemeral ports."""
    return Settings(
        APP_NAME="CollabBoard X Test",
        DEBUG=True,
        LOG_LEVEL="DEBUG",
        HOST="127.0.0.1",
        HTTP_PORT=8001,
        TCP_SOCKET_PORT=9099,
        MAX_FRAME_SIZE=1024 * 1024,
        HEARTBEAT_INTERVAL_SEC=5.0,
        HEARTBEAT_TIMEOUT_SEC=10.0,
    )


@pytest.fixture
def test_context(test_settings: Settings) -> ApplicationContext:
    """Provides an isolated test ApplicationContext."""
    return ApplicationContext(
        settings=test_settings,
        connection_manager=ConnectionManager(),
        event_bus=EventRegistry(),
    )

"""Application configuration using Pydantic Settings."""

from pathlib import Path
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Core settings for CollabBoard X server."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Metadata
    APP_NAME: str = "CollabBoard X"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # Networking & Bindings
    HOST: str = "0.0.0.0"
    HTTP_PORT: int = 8000
    TCP_SOCKET_PORT: int = 9001
    LAN_ADVERTISE_IP: Optional[str] = None

    # Protocol & Framing Limits
    MAX_FRAME_SIZE: int = 10 * 1024 * 1024  # 10 MB maximum frame size
    HEARTBEAT_INTERVAL_SEC: float = 15.0
    HEARTBEAT_TIMEOUT_SEC: float = 45.0

    # Persistence
    DATABASE_PATH: Path = Path("collabboard.db")
    SNAPSHOT_DIR: Path = Path("snapshots")

    # Authoritative Canvas & History Limits
    MAX_ELEMENTS_PER_ROOM: int = 10000
    SNAPSHOT_INTERVAL_OPS: int = 50  # Take snapshot every 50 ops


_settings_instance: Optional[Settings] = None


def get_settings() -> Settings:
    """Singleton getter for application settings."""
    global _settings_instance
    if _settings_instance is None:
        try:
            # If pydantic-settings is available
            _settings_instance = Settings()
        except Exception:
            # Fallback if pydantic_settings is not installed directly
            from pydantic import BaseModel
            class FallbackSettings(BaseModel):
                APP_NAME: str = "CollabBoard X"
                APP_VERSION: str = "1.0.0"
                DEBUG: bool = False
                LOG_LEVEL: str = "INFO"
                HOST: str = "0.0.0.0"
                HTTP_PORT: int = 8000
                TCP_SOCKET_PORT: int = 9001
                LAN_ADVERTISE_IP: Optional[str] = None
                MAX_FRAME_SIZE: int = 10 * 1024 * 1024
                HEARTBEAT_INTERVAL_SEC: float = 15.0
                HEARTBEAT_TIMEOUT_SEC: float = 45.0
                DATABASE_PATH: Path = Path("collabboard.db")
                SNAPSHOT_DIR: Path = Path("snapshots")
                MAX_ELEMENTS_PER_ROOM: int = 10000
                SNAPSHOT_INTERVAL_OPS: int = 50
            _settings_instance = FallbackSettings()  # type: ignore
    return _settings_instance

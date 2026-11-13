"""Main FastAPI application entrypoint for CollabBoard X."""

from contextlib import asynccontextmanager
from typing import AsyncIterator, Dict, Any
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.core.context import get_app_context
from app.core.lifecycle import LifecycleManager
from app.transport.websocket_gateway import router as websocket_router
from app.transport.envelope import MessageEnvelope
from app.transport.session import ClientSession

settings = get_settings()
logger = setup_logging(level=settings.LOG_LEVEL)
context = get_app_context()
lifecycle_manager = LifecycleManager(context)


# Register basic protocol handlers for transport verification (PING/ECHO)
async def handle_ping(session: ClientSession, envelope: MessageEnvelope) -> None:
    """Responds to client ping with an authoritative pong."""
    await session.send_envelope(
        MessageEnvelope(
            room_id=envelope.room_id,
            sender_id="server",
            type="PONG_RES",
            client_seq=envelope.client_seq,
            payload={
                "client_timestamp": envelope.timestamp,
                "session_id": session.session_id,
                "transport": session.transport.value,
            },
        )
    )

context.event_bus.register("PING_REQ", handle_ping)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manages application startup and shutdown lifecycle."""
    await lifecycle_manager.startup()
    try:
        yield
    finally:
        await lifecycle_manager.shutdown()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

# Enable CORS for local LAN browser clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from pathlib import Path
from fastapi.staticfiles import StaticFiles

# Mount transports
app.include_router(websocket_router)


@app.get("/api/health")
async def health_check() -> Dict[str, Any]:
    """Health check endpoint for LAN monitoring."""
    stats = await context.connection_manager.get_stats()
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "tcp_port": settings.TCP_SOCKET_PORT,
        "http_port": settings.HTTP_PORT,
        "stats": stats,
    }


@app.get("/api/transport-info")
async def transport_info() -> Dict[str, Any]:
    """Provides connection information for both browser and CN lab socket clients."""
    return {
        "transports": {
            "websocket": {
                "url": f"ws://{settings.HOST}:{settings.HTTP_PORT}/ws/connect",
                "room_url_template": f"ws://{settings.HOST}:{settings.HTTP_PORT}/ws/rooms/{{room_id}}",
                "description": "Standard WebSocket interface for React frontend",
            },
            "raw_tcp": {
                "host": settings.HOST,
                "port": settings.TCP_SOCKET_PORT,
                "framing": "4-byte big-endian length prefix followed by UTF-8 JSON envelope",
                "description": "Explicit socket interface for Computer Networks Laboratory requirements",
            },
        },
        "registered_events": context.event_bus.get_registered_event_types(),
    }


# Mount pre-built React frontend assets if present (must be mounted last to avoid shadowing /api and /ws)
import sys

frontend_dist = None
if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    meipass_dist = Path(sys._MEIPASS) / "frontend" / "dist"
    if meipass_dist.is_dir():
        frontend_dist = meipass_dist

if frontend_dist is None:
    source_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
    if source_dist.is_dir():
        frontend_dist = source_dist

if frontend_dist is None:
    exe_dist = Path(sys.executable).parent / "frontend" / "dist"
    if exe_dist.is_dir():
        frontend_dist = exe_dist

if frontend_dist and frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="static")

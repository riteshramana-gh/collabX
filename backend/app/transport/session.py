"""Unified client session abstraction across WebSocket and Raw TCP transports."""

import asyncio
import time
from abc import ABC, abstractmethod
from enum import Enum
from typing import Optional
from starlette.websockets import WebSocket, WebSocketState
from app.transport.envelope import MessageEnvelope, EnvelopeCodec
from app.transport.framing import encode_frame


class TransportType(str, Enum):
    WEBSOCKET = "WEBSOCKET"
    RAW_TCP = "RAW_TCP"


class ClientSession(ABC):
    """Abstract client session representing an active connected peer."""

    def __init__(
        self,
        session_id: str,
        transport: TransportType,
        remote_address: str,
    ):
        self.session_id: str = session_id
        self.transport: TransportType = transport
        self.remote_address: str = remote_address
        self.room_id: Optional[str] = None
        self.user_id: Optional[str] = None
        self.display_name: Optional[str] = None
        self.role: str = "PARTICIPANT"  # "HOST" or "PARTICIPANT"
        self.is_authenticated: bool = False
        self.connected_at: float = time.time()
        self.last_heartbeat_at: float = time.time()
        self.is_active: bool = True

    def update_heartbeat(self) -> None:
        """Records the timestamp of the latest client activity."""
        self.last_heartbeat_at = time.time()

    @abstractmethod
    async def send_envelope(self, envelope: MessageEnvelope) -> None:
        """Serializes and transmits a MessageEnvelope to the peer."""
        pass

    @abstractmethod
    async def send_raw(self, data: bytes) -> None:
        """Sends raw bytes directly to the underlying socket."""
        pass

    @abstractmethod
    async def close(self, code: int = 1000, reason: str = "") -> None:
        """Terminates the session and cleans up connection resources."""
        pass


class WebSocketSession(ClientSession):
    """Concrete session wrapping a FastAPI/Starlette WebSocket connection."""

    def __init__(self, session_id: str, websocket: WebSocket, remote_address: str):
        super().__init__(
            session_id=session_id,
            transport=TransportType.WEBSOCKET,
            remote_address=remote_address,
        )
        self.websocket = websocket
        self._lock = asyncio.Lock()

    async def send_envelope(self, envelope: MessageEnvelope) -> None:
        if not self.is_active or self.websocket.client_state != WebSocketState.CONNECTED:
            return
        text = EnvelopeCodec.encode_str(envelope)
        async with self._lock:
            try:
                await self.websocket.send_text(text)
            except Exception:
                self.is_active = False

    async def send_raw(self, data: bytes) -> None:
        if not self.is_active or self.websocket.client_state != WebSocketState.CONNECTED:
            return
        async with self._lock:
            try:
                await self.websocket.send_bytes(data)
            except Exception:
                self.is_active = False

    async def close(self, code: int = 1000, reason: str = "") -> None:
        self.is_active = False
        try:
            if self.websocket.client_state == WebSocketState.CONNECTED:
                await self.websocket.close(code=code, reason=reason)
        except Exception:
            pass


class RawTCPSession(ClientSession):
    """Concrete session wrapping an asyncio.StreamWriter TCP stream."""

    def __init__(
        self,
        session_id: str,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
        remote_address: str,
    ):
        super().__init__(
            session_id=session_id,
            transport=TransportType.RAW_TCP,
            remote_address=remote_address,
        )
        self.reader = reader
        self.writer = writer
        self._lock = asyncio.Lock()

    async def send_envelope(self, envelope: MessageEnvelope) -> None:
        if not self.is_active or self.writer.is_closing():
            return
        payload_bytes = EnvelopeCodec.encode(envelope)
        framed = encode_frame(payload_bytes)
        await self.send_raw(framed)

    async def send_raw(self, data: bytes) -> None:
        if not self.is_active or self.writer.is_closing():
            return
        async with self._lock:
            try:
                self.writer.write(data)
                await self.writer.drain()
            except Exception:
                self.is_active = False

    async def close(self, code: int = 1000, reason: str = "") -> None:
        self.is_active = False
        try:
            if not self.writer.is_closing():
                self.writer.close()
                await self.writer.wait_closed()
        except Exception:
            pass

"""Explicit TCP Socket Server satisfying Computer Networks laboratory requirements.

Uses length-prefixed streaming over raw TCP sockets.
"""

import asyncio
import logging
import uuid
from typing import Optional
from app.transport.session import RawTCPSession
from app.transport.framing import StreamFramer
from app.transport.envelope import EnvelopeCodec
from app.core.exceptions import FramingError, ProtocolError
from app.core.context import ApplicationContext

logger = logging.getLogger("collabboard.transport.raw_tcp")


class RawTCPServer:
    """Explicit socket server operating on raw TCP with length-prefixed framing."""

    def __init__(self, context: ApplicationContext):
        self.context = context
        self.host = context.settings.HOST
        self.port = context.settings.TCP_SOCKET_PORT
        self.server: Optional[asyncio.Server] = None
        self._is_running = False
        self._serve_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Starts the low-level TCP socket listener."""
        if self._is_running:
            return

        self.server = await asyncio.start_server(
            self._handle_client,
            host=self.host,
            port=self.port,
            reuse_address=True,
        )
        self._is_running = True
        addrs = ", ".join(str(sock.getsockname()) for sock in self.server.sockets)
        logger.info(f"Raw TCP Socket Server listening on {addrs} (CN Lab Interface)")

    async def _handle_client(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> None:
        """Handles an individual raw TCP client socket lifecycle."""
        peername = writer.get_extra_info("peername")
        remote_address = f"{peername[0]}:{peername[1]}" if peername else "unknown"
        session_id = f"tcp-{uuid.uuid4().hex[:12]}"

        session = RawTCPSession(
            session_id=session_id,
            reader=reader,
            writer=writer,
            remote_address=remote_address,
        )

        framer = StreamFramer(max_frame_size=self.context.settings.MAX_FRAME_SIZE)
        await self.context.connection_manager.register_session(session)

        logger.info(f"[TCP Socket] Client connected from {remote_address} (Session: {session_id})")

        try:
            while self._is_running and session.is_active:
                chunk = await reader.read(4096)
                if not chunk:
                    # Client closed socket (EOF)
                    logger.info(f"[TCP Socket] Client {remote_address} closed connection (EOF)")
                    break

                try:
                    frames = framer.feed(chunk)
                except FramingError as e:
                    logger.error(f"[TCP Socket] Framing error from {remote_address}: {e.message}")
                    break

                for frame_bytes in frames:
                    try:
                        envelope = EnvelopeCodec.decode(frame_bytes)
                        session.update_heartbeat()
                        # Asynchronously dispatch envelope through EventRegistry
                        asyncio.create_task(self.context.event_bus.dispatch(session, envelope))
                    except ProtocolError as e:
                        logger.warning(f"[TCP Socket] Protocol decode error from {remote_address}: {e.message}")
                    except Exception as e:
                        logger.error(f"[TCP Socket] Error processing frame from {remote_address}: {e}", exc_info=True)

        except asyncio.CancelledError:
            pass
        except ConnectionResetError:
            logger.info(f"[TCP Socket] Connection reset by peer {remote_address}")
        except Exception as e:
            logger.error(f"[TCP Socket] Socket exception for {remote_address}: {e}", exc_info=True)
        finally:
            await self.context.connection_manager.unregister_session(session_id)
            await session.close()
            logger.info(f"[TCP Socket] Client {remote_address} disconnected and cleaned up")

    async def stop(self) -> None:
        """Shuts down the TCP socket listener and terminates active streams."""
        if not self._is_running:
            return

        self._is_running = False
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            logger.info("Raw TCP Socket Server stopped")

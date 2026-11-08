"""Integration tests validating explicit TCP socket programming for CN Lab requirements."""

import asyncio
import struct
import pytest
from app.core.context import ApplicationContext
from app.transport.raw_tcp_server import RawTCPServer
from app.transport.envelope import MessageEnvelope, EnvelopeCodec
from app.transport.framing import encode_frame, HEADER_STRUCT
from app.transport.session import ClientSession


@pytest.mark.asyncio
async def test_raw_tcp_socket_roundtrip(test_context: ApplicationContext):
    """Demonstrates explicit TCP socket connection, framing, and bidirectional event exchange."""
    server = RawTCPServer(test_context)
    await server.start()

    # Register PING handler in test context
    async def ping_handler(sess: ClientSession, env: MessageEnvelope) -> None:
        await sess.send_envelope(
            MessageEnvelope(
                room_id=env.room_id,
                sender_id="server",
                type="PONG_RES",
                client_seq=env.client_seq,
                payload={"received_by": sess.session_id, "status": "ok"},
            )
        )

    test_context.event_bus.register("PING_REQ", ping_handler)

    try:
        # Connect using explicit asyncio low-level TCP socket client
        reader, writer = await asyncio.open_connection(
            test_context.settings.HOST,
            test_context.settings.TCP_SOCKET_PORT,
        )

        # 1. Prepare raw payload
        ping_envelope = MessageEnvelope(
            room_id="lab-room-101",
            sender_id="lab-student-client",
            type="PING_REQ",
            client_seq=1,
            payload={"test": "cn_lab_socket_verification"},
        )
        json_bytes = EnvelopeCodec.encode(ping_envelope)
        framed_bytes = encode_frame(json_bytes)

        # 2. Transmit framed bytes across the TCP stream
        writer.write(framed_bytes)
        await writer.drain()

        # 3. Read exact 4-byte big-endian length prefix header
        header = await reader.readexactly(4)
        resp_length = HEADER_STRUCT.unpack(header)[0]
        assert resp_length > 0

        # 4. Read the exact response payload
        resp_payload = await reader.readexactly(resp_length)
        resp_envelope = EnvelopeCodec.decode(resp_payload)

        # 5. Verify response attributes
        assert resp_envelope.type == "PONG_RES"
        assert resp_envelope.room_id == "lab-room-101"
        assert resp_envelope.client_seq == 1
        assert resp_envelope.payload["status"] == "ok"
        assert "tcp-" in resp_envelope.payload["received_by"]

        # Close client stream
        writer.close()
        await writer.wait_closed()

    finally:
        await server.stop()

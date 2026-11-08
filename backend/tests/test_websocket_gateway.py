"""Integration tests for the FastAPI WebSocket Gateway."""

import pytest
from starlette.testclient import TestClient
from app.main import app
from app.transport.envelope import MessageEnvelope, EnvelopeCodec


def test_websocket_ping_pong():
    """Validates WebSocket handshake and message exchange."""
    client = TestClient(app)

    with client.websocket_connect("/ws/rooms/test-room-42") as ws:
        # Transmit PING_REQ
        ping_env = MessageEnvelope(
            room_id="test-room-42",
            sender_id="browser-client-1",
            type="PING_REQ",
            client_seq=1,
            payload={"source": "browser"},
        )
        ws.send_text(EnvelopeCodec.encode_str(ping_env))

        # Receive PONG_RES
        data = ws.receive_text()
        pong_env = EnvelopeCodec.decode_str(data)

        assert pong_env.type == "PONG_RES"
        assert pong_env.room_id == "test-room-42"
        assert pong_env.client_seq == 1
        assert pong_env.payload["transport"] == "WEBSOCKET"
        assert "ws-" in pong_env.payload["session_id"]

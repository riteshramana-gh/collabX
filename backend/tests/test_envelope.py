"""Tests for application-level protocol envelope serialization and validation."""

import pytest
from app.transport.envelope import MessageEnvelope, EnvelopeCodec
from app.core.exceptions import ProtocolError


def test_envelope_creation_defaults():
    env = MessageEnvelope(
        room_id="room-alpha",
        sender_id="user-123",
        type="CANVAS_OP_REQ",
        payload={"color": "#ff0000"},
    )

    assert env.protocol_version == "1.0"
    assert env.message_id is not None
    assert len(env.message_id) > 10
    assert env.timestamp > 0
    assert env.client_seq is None
    assert env.server_seq is None
    assert env.payload["color"] == "#ff0000"


def test_codec_encode_decode_bytes():
    original = MessageEnvelope(
        room_id="room-beta",
        sender_id="user-456",
        type="CHAT_MSG_SEND",
        client_seq=1,
        server_seq=5,
        payload={"text": "Hello LAN peers!"},
    )

    encoded = EnvelopeCodec.encode(original)
    assert isinstance(encoded, bytes)

    decoded = EnvelopeCodec.decode(encoded)
    assert decoded.room_id == original.room_id
    assert decoded.sender_id == original.sender_id
    assert decoded.type == original.type
    assert decoded.client_seq == 1
    assert decoded.server_seq == 5
    assert decoded.payload == {"text": "Hello LAN peers!"}


def test_codec_decode_malformed_json():
    with pytest.raises(ProtocolError) as exc_info:
        EnvelopeCodec.decode(b"NOT_A_JSON_STRING")
    assert "Malformed JSON payload" in exc_info.value.message


def test_codec_decode_invalid_utf8():
    with pytest.raises(ProtocolError) as exc_info:
        EnvelopeCodec.decode(b"\xff\xfe\x00\x00")
    assert "Invalid UTF-8" in exc_info.value.message

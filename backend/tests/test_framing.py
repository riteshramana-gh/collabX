"""Tests for length-prefixed raw TCP framing and stream buffering."""

import pytest
from app.transport.framing import encode_frame, StreamFramer, HEADER_SIZE
from app.core.exceptions import FramingError


def test_encode_frame():
    payload = b'{"hello": "world"}'
    framed = encode_frame(payload)

    # 4-byte header + payload
    assert len(framed) == HEADER_SIZE + len(payload)
    # Check big-endian length prefix
    length_prefix = int.from_bytes(framed[:4], byteorder="big")
    assert length_prefix == len(payload)
    assert framed[4:] == payload


def test_stream_framer_single_complete_frame():
    framer = StreamFramer()
    payload = b"collabboard_frame_data"
    framed = encode_frame(payload)

    frames = framer.feed(framed)
    assert len(frames) == 1
    assert frames[0] == payload
    assert framer.buffered_bytes_count == 0


def test_stream_framer_fragmented_delivery():
    """Simulates real-world TCP packet fragmentation where chunks arrive byte by byte."""
    framer = StreamFramer()
    payload = b"fragmented_tcp_transmission"
    framed = encode_frame(payload)

    accumulated = []
    # Feed 1 byte at a time
    for byte in framed:
        frames = framer.feed(bytes([byte]))
        accumulated.extend(frames)

    assert len(accumulated) == 1
    assert accumulated[0] == payload
    assert framer.buffered_bytes_count == 0


def test_stream_framer_multiple_concatenated_frames():
    """Simulates multiple TCP frames bundled together in a single socket read buffer."""
    framer = StreamFramer()
    payloads = [b"frame_1", b"frame_2_much_longer_content", b"frame_3"]
    stream_chunk = b"".join(encode_frame(p) for p in payloads)

    frames = framer.feed(stream_chunk)
    assert len(frames) == 3
    assert frames == payloads
    assert framer.buffered_bytes_count == 0


def test_stream_framer_exceeding_max_size():
    """Validates defense against oversized or malicious length headers."""
    framer = StreamFramer(max_frame_size=100)
    # Header declaring 500 bytes (exceeds max 100)
    fake_header = (500).to_bytes(4, byteorder="big")

    with pytest.raises(FramingError) as exc_info:
        framer.feed(fake_header + b"data")

    assert "exceeds max allowed size" in exc_info.value.message
    assert framer.buffered_bytes_count == 0

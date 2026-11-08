"""Length-prefixed binary framing for raw TCP socket communication.

Format:
  [4-byte big-endian unsigned integer (payload length N)] + [N bytes UTF-8 payload]
"""

import struct
from typing import List
from app.core.exceptions import FramingError

HEADER_STRUCT = struct.Struct(">I")
HEADER_SIZE = HEADER_STRUCT.size  # 4 bytes


def encode_frame(payload: bytes) -> bytes:
    """Encodes raw payload bytes into a length-prefixed TCP frame."""
    length = len(payload)
    header = HEADER_STRUCT.pack(length)
    return header + payload


class StreamFramer:
    """Stream-based buffer that accumulates incoming TCP byte chunks and yields complete frames.
    
    Handles:
    - Packet fragmentation (partial header or partial payload)
    - Multiple concatenated frames in a single socket read
    - Maximum frame size validation to prevent memory exhaustion attacks
    """

    def __init__(self, max_frame_size: int = 10 * 1024 * 1024):
        self.max_frame_size = max_frame_size
        self._buffer = bytearray()

    def feed(self, chunk: bytes) -> List[bytes]:
        """Appends incoming socket bytes and returns any completed frame payloads."""
        if not chunk:
            return []

        self._buffer.extend(chunk)
        frames: List[bytes] = []

        while len(self._buffer) >= HEADER_SIZE:
            # Peek at the 4-byte header
            payload_len = HEADER_STRUCT.unpack_from(self._buffer, 0)[0]

            if payload_len > self.max_frame_size:
                # Malicious or corrupt frame length
                self._buffer.clear()
                raise FramingError(
                    f"Frame length {payload_len} exceeds max allowed size of {self.max_frame_size} bytes"
                )

            total_frame_size = HEADER_SIZE + payload_len

            if len(self._buffer) < total_frame_size:
                # Frame is incomplete; wait for more socket data
                break

            # Complete frame ready: extract payload and slice buffer
            payload = bytes(self._buffer[HEADER_SIZE:total_frame_size])
            del self._buffer[:total_frame_size]
            frames.append(payload)

        return frames

    def reset(self) -> None:
        """Clears the internal accumulation buffer."""
        self._buffer.clear()

    @property
    def buffered_bytes_count(self) -> int:
        return len(self._buffer)

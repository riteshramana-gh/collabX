"""Application-level protocol message envelope and codec."""

import json
import time
import uuid
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field
from app.core.exceptions import ProtocolError


def current_time_ms() -> int:
    """Returns current Unix timestamp in milliseconds."""
    return int(time.time() * 1000)


def generate_id() -> str:
    """Generates a UUID4 string."""
    return uuid.uuid4().hex


class MessageEnvelope(BaseModel):
    """Unified application-level message envelope."""

    protocol_version: str = Field(default="1.0", description="Protocol version string")
    message_id: str = Field(default_factory=generate_id, description="Unique message UUID")
    room_id: str = Field(description="Target room identifier")
    sender_id: str = Field(description="Sender session or user identifier")
    type: str = Field(description="Event or command type constant")
    client_seq: Optional[int] = Field(default=None, description="Client-side sequence counter")
    server_seq: Optional[int] = Field(default=None, description="Authoritative server sequence number")
    timestamp: int = Field(default_factory=current_time_ms, description="Epoch timestamp in milliseconds")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Feature-specific payload")

    def model_dump_json_bytes(self) -> bytes:
        """Serializes the envelope to UTF-8 JSON bytes."""
        return self.model_dump_json().encode("utf-8")


class EnvelopeCodec:
    """Encoder and decoder for MessageEnvelope."""

    @staticmethod
    def encode(envelope: MessageEnvelope) -> bytes:
        """Encodes envelope to UTF-8 JSON bytes."""
        return envelope.model_dump_json_bytes()

    @staticmethod
    def decode(data: bytes) -> MessageEnvelope:
        """Decodes UTF-8 JSON bytes into a MessageEnvelope."""
        try:
            raw_str = data.decode("utf-8")
            raw_dict = json.loads(raw_str)
            return MessageEnvelope.model_validate(raw_dict)
        except UnicodeDecodeError as e:
            raise ProtocolError(f"Invalid UTF-8 byte sequence: {e}") from e
        except json.JSONDecodeError as e:
            raise ProtocolError(f"Malformed JSON payload: {e}") from e
        except Exception as e:
            raise ProtocolError(f"Envelope validation error: {e}") from e

    @staticmethod
    def encode_str(envelope: MessageEnvelope) -> str:
        """Encodes envelope to JSON string (useful for WebSockets)."""
        return envelope.model_dump_json()

    @staticmethod
    def decode_str(text: str) -> MessageEnvelope:
        """Decodes JSON string into a MessageEnvelope."""
        try:
            raw_dict = json.loads(text)
            return MessageEnvelope.model_validate(raw_dict)
        except json.JSONDecodeError as e:
            raise ProtocolError(f"Malformed JSON text: {e}") from e
        except Exception as e:
            raise ProtocolError(f"Envelope validation error: {e}") from e

"""Tests verifying cross-protocol communication between Raw TCP and WebSocket sessions."""

import asyncio
import pytest
from app.transport.session import ClientSession, TransportType
from app.transport.connection_manager import ConnectionManager
from app.transport.envelope import MessageEnvelope


class RecordingSession(ClientSession):
    def __init__(self, session_id: str, transport: TransportType):
        super().__init__(
            session_id=session_id,
            transport=transport,
            remote_address="127.0.0.1:0",
        )
        self.received_envelopes = []

    async def send_envelope(self, envelope: MessageEnvelope) -> None:
        self.received_envelopes.append(envelope)

    async def send_raw(self, data: bytes) -> None:
        pass

    async def close(self, code: int = 1000, reason: str = "") -> None:
        self.is_active = False


@pytest.mark.asyncio
async def test_cross_protocol_broadcast():
    cm = ConnectionManager()

    # 1. Register a WebSocket session in room "physics-room"
    ws_sess = RecordingSession("ws-client-1", TransportType.WEBSOCKET)
    await cm.register_session(ws_sess)
    await cm.join_room(ws_sess.session_id, "physics-room")

    # 2. Register a Raw TCP session in the same room
    tcp_sess = RecordingSession("tcp-client-1", TransportType.RAW_TCP)
    await cm.register_session(tcp_sess)
    await cm.join_room(tcp_sess.session_id, "physics-room")

    # 3. Register a third session in a DIFFERENT room
    other_sess = RecordingSession("ws-client-2", TransportType.WEBSOCKET)
    await cm.register_session(other_sess)
    await cm.join_room(other_sess.session_id, "math-room")

    # 4. Broadcast an event to "physics-room"
    broadcast_envelope = MessageEnvelope(
        room_id="physics-room",
        sender_id="ws-client-1",
        type="CANVAS_OP_BROADCAST",
        server_seq=1,
        payload={"action": "draw_circle", "radius": 50},
    )

    recipients_count = await cm.broadcast_to_room("physics-room", broadcast_envelope)

    # 5. Verify both WS and TCP sessions in physics-room received the broadcast
    assert recipients_count == 2
    assert len(ws_sess.received_envelopes) == 1
    assert len(tcp_sess.received_envelopes) == 1

    assert ws_sess.received_envelopes[0].server_seq == 1
    assert tcp_sess.received_envelopes[0].server_seq == 1

    # Verify session in other room received nothing
    assert len(other_sess.received_envelopes) == 0

"""Tests for WebRTC Voice Signaling feature module."""

import pytest
from app.core.config import Settings
from app.core.context import ApplicationContext
from app.transport.connection_manager import ConnectionManager
from app.engine.event_bus import EventRegistry
from app.modules.voice.module import VoiceSignalingModule
from app.transport.session import ClientSession, TransportType
from app.transport.envelope import MessageEnvelope


class MockSession(ClientSession):
    def __init__(self, session_id: str, display_name: str = "VoiceUser"):
        super().__init__(
            session_id=session_id,
            transport=TransportType.WEBSOCKET,
            remote_address="127.0.0.1:9050",
        )
        self.display_name = display_name
        self.inbox = []

    async def send_envelope(self, envelope: MessageEnvelope) -> None:
        self.inbox.append(envelope)

    async def send_raw(self, data: bytes) -> None:
        pass

    async def close(self, code: int = 1000, reason: str = "") -> None:
        self.is_active = False


@pytest.mark.asyncio
async def test_webrtc_signaling_mesh_routing():
    context = ApplicationContext(
        settings=Settings(),
        connection_manager=ConnectionManager(),
        event_bus=EventRegistry(),
    )

    voice_mod = VoiceSignalingModule()
    await voice_mod.initialize(context)
    voice_mod.register_events(context.event_bus)

    # Register Peer A and Peer B in room "voice-room"
    peer_a = MockSession("peer-A", "Alice")
    peer_b = MockSession("peer-B", "Bob")
    peer_c = MockSession("peer-C", "Charlie")  # Innocent bystander

    for p in (peer_a, peer_b, peer_c):
        await context.connection_manager.register_session(p)
        await context.connection_manager.join_room(p.session_id, "voice-room")

    # 1. Peer A sends WebRTC Offer to Peer B
    offer_env = MessageEnvelope(
        room_id="voice-room",
        sender_id="peer-A",
        type="VOICE_SIGNAL_OFFER",
        payload={
            "target_session_id": "peer-B",
            "sdp": {"type": "offer", "sdp": "v=0\r\no=Alice 1234 2 IN IP4 192.168.1.50..."},
        },
    )
    await context.event_bus.dispatch(peer_a, offer_env)

    # Peer B must receive offer, Peer C must receive NOTHING
    b_offers = [m for m in peer_b.inbox if m.type == "VOICE_SIGNAL_OFFER"]
    c_offers = [m for m in peer_c.inbox if m.type == "VOICE_SIGNAL_OFFER"]
    assert len(b_offers) == 1
    assert len(c_offers) == 0
    assert b_offers[0].payload["source_session_id"] == "peer-A"
    assert "Alice" in b_offers[0].payload["source_name"]

    # 2. Peer B sends WebRTC Answer to Peer A
    answer_env = MessageEnvelope(
        room_id="voice-room",
        sender_id="peer-B",
        type="VOICE_SIGNAL_ANSWER",
        payload={
            "target_session_id": "peer-A",
            "sdp": {"type": "answer", "sdp": "v=0\r\no=Bob 5678 2 IN IP4 192.168.1.84..."},
        },
    )
    await context.event_bus.dispatch(peer_b, answer_env)

    a_answers = [m for m in peer_a.inbox if m.type == "VOICE_SIGNAL_ANSWER"]
    assert len(a_answers) == 1
    assert a_answers[0].payload["source_session_id"] == "peer-B"

    # 3. Peer A sends ICE Candidate to Peer B
    ice_env = MessageEnvelope(
        room_id="voice-room",
        sender_id="peer-A",
        type="VOICE_SIGNAL_ICE",
        payload={
            "target_session_id": "peer-B",
            "candidate": {"candidate": "candidate:1 1 UDP 2130706431 192.168.1.50 50000 typ host", "sdpMLineIndex": 0},
        },
    )
    await context.event_bus.dispatch(peer_a, ice_env)

    b_ice = [m for m in peer_b.inbox if m.type == "VOICE_SIGNAL_ICE"]
    assert len(b_ice) == 1
    assert "typ host" in b_ice[0].payload["candidate"]["candidate"]

    # 4. Voice State Broadcast (Mute/Unmute)
    state_env = MessageEnvelope(
        room_id="voice-room",
        sender_id="peer-A",
        type="VOICE_STATE_UPDATE",
        payload={"is_muted": True, "is_speaking": False},
    )
    await context.event_bus.dispatch(peer_a, state_env)

    # Both B and C receive voice state broadcast
    b_states = [m for m in peer_b.inbox if m.type == "VOICE_STATE_BROADCAST"]
    c_states = [m for m in peer_c.inbox if m.type == "VOICE_STATE_BROADCAST"]
    assert len(b_states) == 1
    assert len(c_states) == 1
    assert b_states[0].payload["is_muted"] is True
    assert b_states[0].payload["session_id"] == "peer-A"

    await voice_mod.shutdown()

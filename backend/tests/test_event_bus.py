"""Tests for the asynchronous Event Registry and Dispatcher."""

import pytest
from app.engine.event_bus import EventRegistry
from app.transport.envelope import MessageEnvelope
from app.transport.session import ClientSession, TransportType


class MockSession(ClientSession):
    def __init__(self, session_id: str):
        super().__init__(
            session_id=session_id,
            transport=TransportType.WEBSOCKET,
            remote_address="127.0.0.1:5555",
        )
        self.sent_envelopes = []

    async def send_envelope(self, envelope: MessageEnvelope) -> None:
        self.sent_envelopes.append(envelope)

    async def send_raw(self, data: bytes) -> None:
        pass

    async def close(self, code: int = 1000, reason: str = "") -> None:
        self.is_active = False


@pytest.mark.asyncio
async def test_event_bus_register_and_dispatch():
    bus = EventRegistry()
    session = MockSession("s1")
    received_envelopes = []

    async def sample_handler(sess: ClientSession, env: MessageEnvelope) -> None:
        received_envelopes.append((sess.session_id, env))

    bus.register("TEST_EVENT", sample_handler)

    test_env = MessageEnvelope(
        room_id="room-1",
        sender_id="s1",
        type="TEST_EVENT",
        payload={"action": "run"},
    )

    dispatched = await bus.dispatch(session, test_env)
    assert dispatched is True
    assert len(received_envelopes) == 1
    assert received_envelopes[0][0] == "s1"
    assert received_envelopes[0][1].type == "TEST_EVENT"


@pytest.mark.asyncio
async def test_event_bus_unregistered_event_error():
    bus = EventRegistry()
    session = MockSession("s2")

    unknown_env = MessageEnvelope(
        room_id="room-1",
        sender_id="s2",
        type="NON_EXISTENT_EVENT",
    )

    dispatched = await bus.dispatch(session, unknown_env)
    assert dispatched is False
    assert len(session.sent_envelopes) == 1
    error_env = session.sent_envelopes[0]
    assert error_env.type == "ERROR_RESPONSE"
    assert error_env.payload["error"] == "UNKNOWN_EVENT_TYPE"


@pytest.mark.asyncio
async def test_event_bus_filter_pipeline_rejection():
    bus = EventRegistry()
    session = MockSession("s3")

    # Filter that rejects any event with room_id starting with 'blocked-'
    async def block_filter(sess: ClientSession, env: MessageEnvelope) -> bool:
        return not env.room_id.startswith("blocked-")

    bus.add_filter(block_filter)

    executed = []
    async def dummy_handler(sess: ClientSession, env: MessageEnvelope) -> None:
        executed.append(env)

    bus.register("SOME_EVENT", dummy_handler)

    blocked_env = MessageEnvelope(
        room_id="blocked-room",
        sender_id="s3",
        type="SOME_EVENT",
    )

    allowed_env = MessageEnvelope(
        room_id="allowed-room",
        sender_id="s3",
        type="SOME_EVENT",
    )

    # Dispatched to blocked room should be filtered out
    assert await bus.dispatch(session, blocked_env) is False
    assert len(executed) == 0

    # Dispatched to allowed room should execute
    assert await bus.dispatch(session, allowed_env) is True
    assert len(executed) == 1

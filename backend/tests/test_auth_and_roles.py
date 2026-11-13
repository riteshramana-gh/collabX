"""Tests for User Authentication, Duplicate Username Rejection, and Role Designation."""

import uuid
from pathlib import Path
import pytest
from starlette.testclient import TestClient
from app.core.config import Settings
from app.core.context import ApplicationContext
from app.transport.connection_manager import ConnectionManager
from app.engine.event_bus import EventRegistry
from app.modules.canvas.module import CanvasFeatureModule
from app.modules.host_control.module import HostControlModule
from app.transport.session import ClientSession, TransportType
from app.transport.envelope import MessageEnvelope
from app.main import app
from app.core.context import get_app_context


class MockSession(ClientSession):
    def __init__(self, session_id: str, role: str = "PARTICIPANT", display_name: str = "Alice"):
        super().__init__(
            session_id=session_id,
            transport=TransportType.WEBSOCKET,
            remote_address="127.0.0.1:9099",
        )
        self.role = role
        self.display_name = display_name
        self.inbox = []

    async def send_envelope(self, envelope: MessageEnvelope) -> None:
        self.inbox.append(envelope)

    async def send_raw(self, data: bytes) -> None:
        pass

    async def close(self, code: int = 1000, reason: str = "") -> None:
        self.is_active = False


def test_auth_registration_login_and_duplicate():
    """Verifies user registration, duplicate username rejection, login, and /me endpoint."""
    unique_user = f"user_{uuid.uuid4().hex[:6]}"
    with TestClient(app) as client:
        # 1. Register user
        res = client.post(
            "/api/auth/register",
            json={"username": unique_user, "password": "password123", "display_name": "Test User"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["username"] == unique_user
        assert "token" in data
        token = data["token"]

        # 2. Register same username (case-insensitive) -> 409 USERNAME_TAKEN
        res_dup = client.post(
            "/api/auth/register",
            json={"username": unique_user.upper(), "password": "differentpass", "display_name": "Duplicate User"},
        )
        assert res_dup.status_code == 409
        dup_data = res_dup.json()
        assert dup_data["success"] is False
        assert dup_data["error"] == "USERNAME_TAKEN"
        assert "already taken" in dup_data["message"].lower()

        # 3. Login with correct password
        res_login = client.post(
            "/api/auth/login",
            json={"username": unique_user, "password": "password123"},
        )
        assert res_login.status_code == 200
        login_data = res_login.json()
        assert login_data["success"] is True
        assert "token" in login_data

        # 4. Login with wrong password -> 401
        res_bad = client.post(
            "/api/auth/login",
            json={"username": unique_user, "password": "wrongpassword"},
        )
        assert res_bad.status_code == 401

        # 5. Check /api/auth/me with valid Bearer token
        res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert res_me.status_code == 200
        me_data = res_me.json()
        assert me_data["authenticated"] is True
        assert me_data["username"] == unique_user


@pytest.mark.asyncio
async def test_room_join_host_editor_and_spectator_roles(tmp_path: Path):
    """Verifies that room creator becomes HOST, logged in joiner becomes EDITOR, and guest becomes VIEWER."""
    settings = Settings(DATABASE_PATH=tmp_path / "collab_roles_test.db")
    context = ApplicationContext(
        settings=settings,
        connection_manager=ConnectionManager(),
        event_bus=EventRegistry(),
    )

    canvas_mod = CanvasFeatureModule()
    host_mod = HostControlModule()

    await canvas_mod.initialize(context)
    canvas_mod.register_events(context.event_bus)

    await host_mod.initialize(context)
    host_mod.register_events(context.event_bus)

    auth_repo = context.repositories["auth_repo"]
    # Register Alice and Bob
    alice_reg = await auth_repo.register_user("alice", "pass123", "Alice Host")
    bob_reg = await auth_repo.register_user("bob", "pass123", "Bob Editor")

    # 1. Alice joins first with token -> becomes HOST
    alice_sess = MockSession("sess-alice", display_name="Alice Host")
    await context.connection_manager.register_session(alice_sess)

    join_alice = MessageEnvelope(
        room_id="roles-room",
        sender_id="sess-alice",
        type="ROOM_JOIN_REQ",
        payload={"auth_token": alice_reg["token"], "display_name": "Alice Host"},
    )
    await context.event_bus.dispatch(alice_sess, join_alice)

    ack_alice = [m for m in alice_sess.inbox if m.type == "ROOM_JOIN_ACK"][0]
    assert ack_alice.payload["role"] == "HOST"
    assert ack_alice.payload["is_authenticated"] is True
    assert ack_alice.payload["authenticated_username"] == "alice"

    # 2. Bob joins with token -> becomes EDITOR
    bob_sess = MockSession("sess-bob", display_name="Bob Editor")
    await context.connection_manager.register_session(bob_sess)

    join_bob = MessageEnvelope(
        room_id="roles-room",
        sender_id="sess-bob",
        type="ROOM_JOIN_REQ",
        payload={"auth_token": bob_reg["token"], "display_name": "Bob Editor"},
    )
    await context.event_bus.dispatch(bob_sess, join_bob)

    ack_bob = [m for m in bob_sess.inbox if m.type == "ROOM_JOIN_ACK"][0]
    assert ack_bob.payload["role"] == "EDITOR"
    assert ack_bob.payload["is_authenticated"] is True
    assert ack_bob.payload["authenticated_username"] == "bob"

    # 3. Guest joins WITHOUT token -> becomes VIEWER (spectator)
    guest_sess = MockSession("sess-guest", display_name="Guest 123")
    await context.connection_manager.register_session(guest_sess)

    join_guest = MessageEnvelope(
        room_id="roles-room",
        sender_id="sess-guest",
        type="ROOM_JOIN_REQ",
        payload={"display_name": "Guest 123"},
    )
    await context.event_bus.dispatch(guest_sess, join_guest)

    ack_guest = [m for m in guest_sess.inbox if m.type == "ROOM_JOIN_ACK"][0]
    assert ack_guest.payload["role"] == "VIEWER"
    assert ack_guest.payload["is_authenticated"] is False

    # 4. Bob (EDITOR) tries to save notebook version -> Denied (Host only)
    save_bob = MessageEnvelope(
        room_id="roles-room",
        sender_id="sess-bob",
        type="NOTEBOOK_VERSION_SAVE_REQ",
        payload={"version_name": "Bob Version"},
    )
    await context.event_bus.dispatch(bob_sess, save_bob)
    save_res = bob_sess.inbox[-1]
    assert save_res.type == "NOTEBOOK_VERSION_SAVE_RES"
    assert save_res.payload["success"] is False
    assert save_res.payload["error"] == "PERMISSION_DENIED"

    # 5. Alice (HOST) saves notebook version -> Success!
    save_alice = MessageEnvelope(
        room_id="roles-room",
        sender_id="sess-alice",
        type="NOTEBOOK_VERSION_SAVE_REQ",
        payload={"version_name": "Alice Version 1"},
    )
    await context.event_bus.dispatch(alice_sess, save_alice)
    alice_save_res = alice_sess.inbox[-1]
    assert alice_save_res.type == "NOTEBOOK_VERSION_SAVE_RES"
    assert alice_save_res.payload["success"] is True

    await canvas_mod.shutdown()
    await host_mod.shutdown()

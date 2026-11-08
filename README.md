# CollabBoard X

A high-performance, server-authoritative, LAN-based multi-user collaborative whiteboard and communication platform.

Built with **React 18 + TypeScript + Vite** on the frontend, **Python + FastAPI + SQLite (WAL)** on the backend, and an **explicit BSD TCP socket engine** satisfying Computer Networks laboratory requirements.

---

## Architectural Decisions & Invariants

1. **React 18 + TypeScript + Vite** for the frontend client.
2. **Python 3.11+ + FastAPI** for the core backend.
3. **Primary Deployment Model:** Central dedicated LAN server.
4. **Fallback Deployment Model:** Individually hosted ad-hoc LAN server with zero-internet LAN IP discovery and terminal ASCII QR code generation.
5. **Unified Implementation:** Both deployment models run on the **exact same backend and frontend codebase**.
6. **WebSockets over TCP** for real-time application events in web browsers.
7. **Explicit Socket Programming** via a dedicated raw TCP socket server (port 9001) using a 4-byte big-endian length prefix.
8. **WebRTC / Opus Group Voice** operating strictly peer-to-peer over LAN (`iceServers: []`) without internet STUN/TURN dependencies.
9. **SQLite (WAL Mode)** with repository abstractions for monotonic operation logging and snapshots.
10. **Authoritative Server State:** Per-room `asyncio.Queue` Actor worker ensuring strict serialization, deduplication, conflict resolution, and gap replay.

---

## Directory Structure

```
collabboard-x/
|-- backend/
|   |-- app/
|   |   |-- core/            # Config, structured logging, DI context, lifecycle
|   |   |-- transport/       # Framing, envelope codec, WebSocket gateway, Raw TCP server
|   |   |-- engine/          # EventRegistry, RoomActor (serializer), RoomManager
|   |   |-- modules/         # Feature modules: canvas, chat, presence, voice, host_control
|   |   |-- storage/         # SQLite WAL database, repositories, snapshot manager
|   |   |-- launcher/        # LAN IP detector, terminal ASCII QR generator, host CLI
|   |   |-- main.py          # FastAPI application & static asset server
|   |-- tests/               # 23 automated unit and integration tests
|-- frontend/
|   |-- src/
|   |   |-- core/network/    # ConnectionManager, EnvelopeCodec
|   |   |-- features/
|   |   |   |-- canvas/      # Double-buffered 60FPS canvas, ToolRegistry, RendererRegistry
|   |   |   |-- presence/    # Remote cursor overlay, participant roster
|   |   |   |-- chat/        # Real-time text chat drawer
|   |   |   |-- voice/       # WebRTC voice mesh, Web Audio VAD, voice controls
|   |   |   |-- host/        # Room locking, snapshot export/restore modal
|   |   |-- pages/           # DashboardPage, WhiteboardRoomPage
|   |-- dist/                # Pre-built static assets (served by FastAPI)
|-- tools/
|   |-- lab_tcp_client.py              # Raw TCP socket client for CN Lab demonstration
|   |-- network_impairment_tester.py   # Fault injection & sequence gap recovery tester
|-- docs/
|   |-- PROTOCOL_SPEC.md               # Application protocol specification
|   |-- LAB_EXPERIMENT_GUIDE.md        # Computer Networks lab evaluation guide & Wireshark steps
|   |-- M1_NETWORKING_CORE.md          # Milestone 1 report
|   |-- M2_CANVAS_ENGINE.md            # Milestone 2 report
|   |-- M3_FRONTEND_WHITEBOARD.md      # Milestone 3 report
|   |-- M4_PRESENCE_AND_CHAT.md        # Milestone 4 report
|   |-- M5_WEBRTC_VOICE.md             # Milestone 5 report
|   |-- M6_HOST_CONTROLS_AND_DEPLOYMENT.md # Milestone 6 report
|-- standalone_host.py                 # Root launcher for Standalone Host mode
```

---

## Quick Start Guide

### 1. Requirements
- Python 3.11+
- Node.js 18+ (for frontend development; production build is already pre-compiled in `frontend/dist/`)

### 2. Launching in Standalone Host Fallback Mode (Ad-Hoc Peer)
Run the root launcher:
```powershell
py standalone_host.py --port 8000 --tcp-port 9001 --room my-board
```
The server will:
- Detect your LAN IP (e.g. `192.168.1.37`) without internet access.
- Render a scannable **ASCII QR code** directly in your terminal.
- Provide a direct link: `http://192.168.1.37:8000/?room=my-board`.
- Listen for WebSockets on port 8000 and raw TCP socket clients on port 9001.

### 3. Launching in Central Dedicated Server Mode
Run via uvicorn:
```powershell
cd backend
py -3.13 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Access the application dashboard at `http://<SERVER-LAN-IP>:8000`.

### 4. Running the Frontend Development Server (Optional)
If modifying React code:
```powershell
cd frontend
npm run dev
```

---

## Automated Test Suites

Run the complete test suite (23 automated unit and integration tests):
```powershell
py -3.13 -m pytest -v backend/tests
```

Test coverage includes:
- **`test_framing.py`**: Length-prefixed 4-byte header encoding, streaming buffer fragmentation, and boundary recovery.
- **`test_envelope.py`**: Message envelope serialization and validation.
- **`test_event_bus.py`**: Event registration, dispatching, and filter pipeline.
- **`test_raw_tcp_socket.py`**: Explicit socket programming roundtrip test.
- **`test_websocket_gateway.py`**: FastAPI WebSocket handshake and ping-pong.
- **`test_cross_protocol_broadcast.py`**: Mixed-mode broadcasting across WebSocket and Raw TCP sessions.
- **`test_canvas_engine.py`**: ADD, UPDATE, TRANSFORM, DELETE, and CLEAR mutations.
- **`test_room_actor.py`**: Concurrent queue serialization (30 concurrent ops), deduplication, and gap replay.
- **`test_canvas_module_integration.py`**: End-to-end multi-client room join, snapshot, and draw broadcast.
- **`test_chat_presence.py`**: Real-time chat message persistence, history query, and ephemeral cursor broadcasting.
- **`test_voice_signaling.py`**: WebRTC SDP Offer, Answer, and ICE candidate mesh routing.
- **`test_host_controls.py`**: Room locking, user kicking, snapshot JSON export, and state restoration.

---

## Computer Networks Laboratory Demonstration

### 1. Explicit Raw TCP Socket Client
```powershell
py tools/lab_tcp_client.py --host 127.0.0.1 --port 9001 --room lab-demo
```

### 2. Network Impairment & Sequence Gap Recovery Verification
```powershell
py tools/network_impairment_tester.py --host 127.0.0.1 --port 9001 --room fault-demo
```
Simulates packet drop and proves the client detects missing sequence numbers and re-syncs state using `ROOM_REPLAY_REQ` from server SQLite storage.

### 3. Wireshark Capture Instructions
Refer to [docs/LAB_EXPERIMENT_GUIDE.md](file:///c:/Users/raman/Downloads/COLLAB/docs/LAB_EXPERIMENT_GUIDE.md) for full packet inspection steps.

# CollabBoard X

A high-performance, server-authoritative, LAN-based multi-user collaborative whiteboard and digital notebook platform.

Built with **React 18 + TypeScript + Vite** on the frontend, **Python + FastAPI + SQLite (WAL)** on the backend, an **explicit BSD TCP socket engine** satisfying Computer Networks laboratory requirements, and a comprehensive **GoodNotes 5 Digital Notebook Suite**.

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
11. **GoodNotes 5 Complete Feature Alignment:** Multi-page notebook, advanced pen styles (Ballpoint, Fountain, Brush), whole/partial/highlighter-only eraser, shape recognition, lasso selection, precision ruler, laser pointer, PDF import/export, stickers drawer, and note-synchronized audio recording.

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
|   |-- tests/               # 24 automated unit and integration tests
|-- frontend/
|   |-- src/
|   |   |-- core/network/    # ConnectionManager, EnvelopeCodec
|   |   |-- features/
|   |   |   |-- canvas/      # Double-buffered 60FPS canvas, ToolRegistry, RendererRegistry
|   |   |   |   |-- recognition/ # ShapeRecognizer (Ramer-Douglas-Peucker geometric inference)
|   |   |   |   |-- renderers/   # Pen styles, Highlighter, Shapes, Text, Image, Stickers
|   |   |   |   |-- tools/       # Select, Pen, Highlighter, Eraser, Lasso, Shapes, Text, Laser
|   |   |   |   |-- state/       # CanvasStore reactive multi-page state
|   |   |   |-- notebook/    # Multi-page system: PageNavigationBar, ThumbnailsDrawer, PdfHandler
|   |   |   |-- elements/    # Reusable StickerDrawer (Math, Chemistry, Flowcharts, Sticky notes)
|   |   |   |-- audio/       # Note-synchronized AudioRecorderBar with playback timeline
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
|   |-- PROTOCOL_SPEC.md               # Application protocol specification (v2.0)
|   |-- GOODNOTES_FEATURE_GUIDE.md     # Complete GoodNotes 5 user & developer manual
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

## GoodNotes 5 Feature Suite Highlights

### 1. Advanced Inking & Pen Styles
- **Ballpoint Pen:** Crisp uniform line weight with Catmull-Rom spline curve smoothing.
- **Fountain Pen:** Velocity and pointer-pressure responsive stroke tapering.
- **Brush Pen:** Expressive calligraphic variable-width stroke simulation.
- **Highlighter:** Translucent multiply blending (`opacity: 0.38`), straight-line lock, and independent layer stacking.

### 2. Intelligent Eraser System
- **Whole-Stroke Erasing:** Removes entire vector element upon intersection.
- **Partial-Stroke Erasing:** Vector polyline trimming and splitting within the eraser radius.
- **Erase Highlighter Only:** Toggle to erase only highlighter marks while preserving ink handwriting and notes.

### 3. Geometric Shapes & Shape Recognition
- **Shapes:** Rectangle, Square, Circle, Ellipse, Straight Line, Directional Arrow, Double-Arrow, Triangle, and Polygons.
- **Shape Recognition:** Automatic conversion of rough hand-drawn strokes into clean geometric vectors using the Ramer-Douglas-Peucker algorithm.

### 4. Lasso Selection & Object Transform
- **Freeform Lasso:** Ray-casting polygon containment selection for handwriting, shapes, text, and images.
- **Transformations:** Move, resize, duplicate (`Ctrl+D`), bring to front, send to back, and **object locking** to prevent accidental modifications.

### 5. Multi-Page Notebook & Paper Templates
- **Page Management:** Bottom navigation bar (`< Page 1 / 4 >`), add page, duplicate page, delete page (with cascading element cleanup), and visual thumbnail drawer.
- **Paper Templates:** Ruled (lined paper with red margin), Math Grid, Dotted, Blank, and PDF Document Background.

### 6. PDF Document Import & Export
- **PDF Import:** Render multi-page PDFs directly onto notebook page backgrounds via `pdfjs-dist`.
- **Vector PDF Export:** Export entire multi-page notebook (paper templates + ink annotations) into a high-resolution PDF document using `jspdf`.

### 7. Presentation & Precision Tools
- **Laser Pointer:** Glowing red/cyan tip with an ephemeral fading particle trail synchronized across peers.
- **Precision Drafting Ruler:** On-screen movable and rotatable ruler with degree angle readout and stroke snap-to-edge drawing.

### 8. Reusable Elements & Sticker Drawer
- Categorized sticker drawer with 5 palettes:
  - **Sticky Notes:** Pastel yellow, blue, green, pink, purple, and orange notes.
  - **Math & Equations:** $\sum_{i=1}^n$, $\int f(x)dx$, $\sqrt{a^2+b^2}$, $x=\frac{-b\pm\sqrt{\Delta}}{2a}$, $e^{i\pi}+1=0$.
  - **Science & Chemistry:** Benzene ring ($\text{C}_6\text{H}_6$), Bohr atom, DNA double helix, resistor, capacitor, $\text{H}_2\text{O}$.
  - **Flowcharts & Diagrams:** Start/End terminal, Process step, Decision fork, Database, Cloud.
  - **Badges & Stamps:** APPROVED, URGENT, DRAFT, VERIFIED, QUESTION + custom sticky note creator.

### 9. Note-Synchronized Audio Recording
- Record lectures or group discussions using the browser's Web Audio MediaRecorder.
- Real-time elapsed recording timer, audio playback bar, waveform scrubber, and **note timestamp synchronization** (scrubbing audio spotlights notes created during that time slice).
- Audio export in `.webm` format.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Z` / `Cmd+Z` | Undo last operation |
| `Ctrl+Y` / `Cmd+Y` or `Ctrl+Shift+Z` | Redo operation |
| `Ctrl+D` / `Cmd+D` | Duplicate selected element |
| `Delete` / `Backspace` | Delete selected element(s) |
| `Ctrl+A` / `Cmd+A` | Select all elements on current page |
| `Escape` | Deselect / Clear selection |
| `V` | Switch to Select tool |
| `P` | Switch to Pen tool |
| `H` | Switch to Highlighter tool |
| `E` | Switch to Eraser tool |
| `L` | Switch to Lasso tool |
| `T` | Switch to Text tool |

---

## Quick Start Guide

### 1. Requirements
- Python 3.11+ (Python 3.13 recommended)
- Node.js 18+ (for frontend development; production build is already pre-compiled in `frontend/dist/`)

### 2. Launching in Standalone Host Fallback Mode (Ad-Hoc Peer)
Run the root launcher:
```powershell
py -3.13 standalone_host.py --port 8000 --tcp-port 9001 --room my-board
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
To compile the production build:
```powershell
npm --prefix frontend run build
```

---

## Automated Test Suites

Run the complete test suite (**24 automated unit and integration tests**):
```powershell
py -3.13 -m pytest -v backend/tests
```

Test coverage includes:
- **`test_canvas_engine.py`**: ADD, UPDATE, TRANSFORM, DELETE, CLEAR mutations, multi-page page creation, locked element mutation rejection, and cascading page deletion.
- **`test_framing.py`**: Length-prefixed 4-byte header encoding, streaming buffer fragmentation, and boundary recovery.
- **`test_envelope.py`**: Message envelope serialization and Pydantic v2 validation.
- **`test_event_bus.py`**: Event registration, dispatching, and filter pipeline.
- **`test_raw_tcp_socket.py`**: Explicit socket programming roundtrip test on port 9001.
- **`test_websocket_gateway.py`**: FastAPI WebSocket handshake and ping-pong.
- **`test_cross_protocol_broadcast.py`**: Mixed-mode broadcasting across WebSocket and Raw TCP sessions.
- **`test_room_actor.py`**: Concurrent queue serialization (30 concurrent ops), deduplication, and gap replay.
- **`test_canvas_module_integration.py`**: End-to-end multi-client room join, snapshot, and draw broadcast.
- **`test_chat_presence.py`**: Real-time chat message persistence, history query, and ephemeral cursor broadcasting.
- **`test_voice_signaling.py`**: WebRTC SDP Offer, Answer, and ICE candidate mesh routing.
- **`test_host_controls.py`**: Room locking, user kicking, snapshot JSON export, and state restoration.

---

## Computer Networks Laboratory Demonstration

### 1. Explicit Raw TCP Socket Client
```powershell
py -3.13 tools/lab_tcp_client.py --host 127.0.0.1 --port 9001 --room lab-demo
```

### 2. Network Impairment & Sequence Gap Recovery Verification
```powershell
py -3.13 tools/network_impairment_tester.py --host 127.0.0.1 --port 9001 --room fault-demo
```
Simulates packet drop and proves the client detects missing sequence numbers and re-syncs state using `ROOM_REPLAY_REQ` from server SQLite storage.

### 3. Wireshark Capture Instructions
Refer to [docs/LAB_EXPERIMENT_GUIDE.md](file:///c:/Users/raman/Downloads/COLLAB/docs/LAB_EXPERIMENT_GUIDE.md) for full packet inspection steps.

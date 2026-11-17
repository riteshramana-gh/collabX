# CollabBoard X

A high-performance, server-authoritative, LAN-based collaborative digital whiteboard and multi-page notebook platform.

Built with React 18, TypeScript, and Vite on the client, and Python, FastAPI, and SQLite (WAL mode) on the backend. CollabBoard X combines an RFC 6455 WebSocket gateway with an explicit BSD TCP socket engine, peer-to-peer WebRTC voice communication, and an advanced vector inking engine.

---

## Architectural Decisions and Invariants

1. **Frontend Architecture:** React 18 with TypeScript and Vite, utilizing a 60 FPS double-buffered HTML5 canvas renderer.
2. **Backend Architecture:** Python 3.11+ with FastAPI, structured around a clean modular domain architecture.
3. **Primary Deployment Model:** Central dedicated LAN server binding to local network interfaces with zero external internet dependencies.
4. **Fallback Deployment Model:** Ad-hoc host mode with automatic local IP detection and terminal QR code generation.
5. **Unified Implementation:** Both dedicated and ad-hoc modes execute on the exact same backend and frontend codebase.
6. **WebSockets over TCP:** Standard RFC 6455 WebSockets for web browser clients, carrying JSON-serialized canonical envelopes.
7. **Explicit BSD TCP Sockets:** Dedicated raw TCP server on port 9001 using a 4-byte big-endian length prefix framing protocol.
8. **WebRTC Group Voice:** Peer-to-peer audio mesh over LAN without external STUN/TURN server requirements.
9. **Storage and Journaling:** SQLite operating in Write-Ahead Logging (WAL) mode for monotonic operation sequencing and room snapshots.
10. **Authoritative State Engine:** Per-room actor worker (`asyncio.Queue`) enforcing total ordering, deduplication, conflict resolution, and gap replay.
11. **Vector Notebook Capabilities:** Multi-page notebooks, velocity-sensitive pen styles, segment-splitting eraser, smart geometric shape detection, lasso selection with auto-move handoff, paper templates, PDF import and export, categorized diagram components, docked audience-scoped chat, and note-synchronized audio recording.

---

## Core System Architecture and Subsystems

The CollabBoard X platform is organized into five decoupled core engineering subsystems:

### 1. Transport Layer and Wire Protocol
- **Dual-Transport Gateway:** Supports simultaneous connections from web browser clients via WebSockets and native desktop/CLI clients via raw BSD TCP sockets.
- **Message Framing Protocol:** Raw TCP stream uses a 4-byte big-endian unsigned integer prefix (`struct.pack("!I", length)`) followed by a UTF-8 JSON payload. The framing engine handles stream fragmentation, MTU boundaries, and message reassembly.
- **Canonical Envelope Codec:** Standardized message structure across all transports featuring `room_id`, `sender_id`, `type`, `seq`, `client_seq`, `timestamp`, and `payload`.
- **Session Lifecycle and Heartbeats:** Real-time connection tracking with bidirectional ping-pong health monitoring and connection pooling.

### 2. Server-Authoritative State Engine and Concurrency Control
- **Actor Model Pattern:** Each room is managed by an independent `RoomActor` worker task driven by an unbounded `asyncio.Queue`.
- **Monotonic Sequence Ordering:** Operations are assigned strictly increasing sequence numbers ($seq_{k+1} = seq_k + 1$), providing total order broadcast across all participants.
- **Deduplication and Idempotency:** Tracks `client_seq` per session to discard duplicate frames resulting from client retransmissions.
- **Gap Detection and Resync Replay:** Clients detect sequence gaps and issue `ROOM_REPLAY_REQ` frames; the server retrieves missing transactions from SQLite and streams targeted catch-up packets.
- **Optimistic UI Reconciliation:** Client renders strokes immediately in an optimistic layer, reconciling with the authoritative state upon receiving server sequence confirmations.

### 3. Decentralized WebRTC Peer-to-Peer Voice Mesh
- **Full Mesh Topology:** Audio streams directly between client nodes ($O(N^2)$ mesh) over RTP/UDP using the Opus codec, completely bypassing server CPU and bandwidth bottlenecks.
- **Signaling Control Plane:** SDP offers, answers, and ICE candidates are exchanged over the existing WebSocket transport.
- **Deterministic Glare Resolution:** Resolves simultaneous call collision race conditions by enforcing peer ID precedence (`myPeerId < remotePeerId` initiates connection).
- **Asynchronous Candidate Queuing:** Buffers early ICE candidates in memory until `setRemoteDescription` resolves, preventing dropped media connections.
- **Local Network Audio Context:** Includes fallback mechanisms for Chromium insecure origin restrictions on local IP addresses.

### 4. Ephemeral Traffic Optimization and Governance
- **Rate Throttling:** High-frequency mouse cursor movements are throttled to a 30Hz adaptive window to conserve local network bandwidth.
- **Linear Interpolation:** Client-side remote cursor rendering employs linear interpolation (Lerp) for smooth 60 FPS motion without jitter.
- **Memory-Only Queues:** Transient cursor and laser pointer events bypass the disk database and are processed purely in-memory.
- **Audience-Scoped Multicast:** Socket-level message filtering for chat messages supporting three distinct routing scopes: Public (`EVERYONE`), Host-Private (`HOST_ONLY`), and 1-on-1 Direct (`DIRECT`).
- **Host Administration:** Real-time host controls for room locking, individual/global muting, remote participant eviction, and cursor broadcast permissions.

### 5. Persistence, Inking Engine, and Version Control
- **SQLite WAL Storage:** High-throughput transactional persistence using SQLite with `PRAGMA journal_mode=WAL` and `PRAGMA synchronous=NORMAL`.
- **Server-Side Notebook Versioning:** 3-slot server-side notebook snapshot quota per room with atomic one-click state restoration (`SNAPSHOT_RESTORE`).
- **60 FPS Double-Buffered Canvas:** Independent offscreen buffer for static page elements and an active buffer for interactive strokes.
- **Segment-Splitting Vector Eraser:** Splits continuous polyline vectors into separate sub-strokes upon eraser intersection without generating artifact lines.
- **Geometric Shape Recognition:** Stroke analysis utilizing Ramer-Douglas-Peucker polygon approximation and least-squares regression.

---

## Directory Structure

```
collabboard-x/
|-- backend/
|   |-- app/
|   |   |-- core/            # Configuration, logging, dependency injection, lifecycle
|   |   |-- transport/       # Message framing, envelope codec, WebSocket gateway, Raw TCP server
|   |   |-- engine/          # Event bus, RoomActor (serializer), RoomManager
|   |   |-- modules/         # Feature modules: canvas, chat, presence, voice, host_control
|   |   |-- storage/         # SQLite WAL engine, repositories, snapshot manager
|   |   |-- launcher/        # Network IP discovery, terminal QR generator, host CLI
|   |   |-- main.py          # FastAPI application and static asset server
|   |-- tests/               # 25 automated unit and integration tests
|-- frontend/
|   |-- src/
|   |   |-- core/network/    # ConnectionManager, EnvelopeCodec
|   |   |-- features/
|   |   |   |-- canvas/      # Double-buffered canvas, ToolRegistry, RendererRegistry
|   |   |   |   |-- recognition/ # Geometric ShapeRecognizer (RDP algorithm)
|   |   |   |   |-- renderers/   # Pen styles, Highlighter, Shapes, Text, Image, Stickers
|   |   |   |   |-- tools/       # Select, Pen, Highlighter, Eraser, Lasso, Shapes, Text, Laser
|   |   |   |   |-- state/       # CanvasStore reactive multi-page state
|   |   |   |-- notebook/    # Multi-page system: PageNavigationBar, ThumbnailsDrawer, PdfHandler
|   |   |   |-- elements/    # Diagram components drawer (Flowcharts, Science, Sticky notes)
|   |   |   |-- audio/       # Note-synchronized AudioRecorderBar with playback timeline
|   |   |   |-- presence/    # Remote cursor overlay, participant roster
|   |   |   |-- chat/        # Real-time text chat drawer
|   |   |   |-- voice/       # WebRTC voice mesh, Web Audio VAD, voice controls
|   |   |   |-- host/        # Room locking, snapshot export/restore modal
|   |   |-- pages/           # DashboardPage, WhiteboardRoomPage
|   |-- dist/                # Compiled production static assets
|-- tools/
|   |-- lab_tcp_client.py              # CLI BSD raw TCP socket client
|   |-- network_impairment_tester.py   # Packet drop, latency jitter, and resync tester
|-- docs/
|   |-- PROTOCOL_SPEC.md               # Application protocol specification (v2.0)
|   |-- STANDALONE_EXECUTABLES_AND_GUI_GUIDE.md # Executables deployment and desktop GUI guide
|   |-- GOODNOTES_FEATURE_GUIDE.md     # Feature manual and tool architecture
|   |-- M1_NETWORKING_CORE.md          # Transport and framing implementation report
|   |-- M2_CANVAS_ENGINE.md            # Canvas and rendering engine report
|   |-- M3_FRONTEND_WHITEBOARD.md      # Client UI and state management report
|   |-- M4_PRESENCE_AND_CHAT.md        # Real-time chat and presence architecture
|   |-- M5_WEBRTC_VOICE.md             # Peer-to-peer voice mesh report
|   |-- M6_HOST_CONTROLS_AND_DEPLOYMENT.md # Host governance and deployment report
|-- package_executable.py              # Universal PyInstaller packaging script (Windows and Linux)
|-- build_windows_exe.bat              # Windows packaging batch script
|-- server_host.py                     # Root entrypoint for Central Dedicated Server
|-- client_gui.py                      # Root entrypoint for Desktop GUI Client
|-- standalone_host.py                 # Root launcher for Standalone Host mode
```

---

## Digital Notebook and Canvas Capabilities

### 1. Vector Inking and Stylus Support
- **Ballpoint Pen:** Uniform line weight with Catmull-Rom spline curve smoothing.
- **Fountain Pen:** Velocity and pointer-pressure responsive stroke tapering.
- **Brush Pen:** Expressive calligraphic variable-width stroke simulation.
- **Highlighter:** Translucent multiply blending (`opacity: 0.38`), straight-line lock, and independent layer stacking.
- **Touch and Stylus Compatibility:** Accidental touch rejection, pressure sensitivity support, and touch pan/zoom gestures.

### 2. Intelligent Eraser and Transactional History
- **Whole-Stroke Erasing:** Removes entire vector element upon intersection with eraser path.
- **Partial-Stroke Erasing:** Segment-based vector polyline trimming that isolates points within the eraser radius and cleanly splits remaining points into independent sub-strokes with identical styling, completely eliminating phantom connector lines.
- **Erase Highlighter Only:** Toggle to erase only highlighter strokes while leaving handwriting, shapes, and notes intact.
- **Transactional Compound Undo/Redo:** Continuous eraser swipes, partial splitting passes, and multi-selection deletions are grouped into atomic transaction blocks (`beginTransaction()` / `endTransaction()`). Pressing `Ctrl+Z` or clicking the Undo and Redo buttons executes atomic undos without intermediate broken states.

### 3. Server-Side Notebook Version Control
- **Persistent Server Slots:** Each room supports a dedicated 3-slot notebook snapshot store saved directly in the server SQLite WAL database.
- **Named Version Snapshots:** Users can snapshot their active whiteboard with custom or timestamped version names. Each snapshot encapsulates all canvas elements, multi-page hierarchies, paper templates, and background colors.
- **Instant Whiteboard Restoration:** Restore any saved version with a single click (`[Restore]`). The server atomically replaces room state, updates SQLite, and broadcasts the restored snapshot to all connected clients in real time.
- **Quota Management:** Visual slot usage indicator (`X / 3 Slots Used`) alerting users when capacity is reached, with options to overwrite or prune versions.
- **Offline File Backups:** Secondary JSON Export and Import buttons allow archiving and restoring board states from local disk files.

### 4. Geometric Shapes and Smart Detection
- **Geometric Primitives:** Rectangle, Square, Circle, Ellipse, Straight Line, Directional Arrow, Double-Arrow, Triangle, Star, and Polygons.
- **Smart Shape Detection:** Inactive by default; toggleable via toolbar button (`[Shapes: ON/OFF]`). Analyzes freehand strokes using Ramer-Douglas-Peucker polygon approximation and least-squares regression to snap strokes into crisp geometric forms.

### 5. Lasso Selection with Auto-Move Handoff
- **Freeform Lasso:** Ray-casting polygon containment selection for handwriting, shapes, text, images, and diagram elements.
- **Instant Move Tool Switch:** Automatically switches to the Select / Move tool immediately upon releasing the lasso, allowing instant drag, transform, and rotation.
- **Transformations:** Move, resize, duplicate (`Ctrl+D`), bring to front, send to back, and object locking to prevent accidental modifications.

### 6. Multi-Page System, Paper Templates, and Color Palettes
- **Page Management:** Bottom navigation bar (`< Page 1 / 4 >`), add page, duplicate page, delete page (with cascading element cleanup), and visual thumbnail drawer.
- **Paper Background Patterns:** Blank, Ruled (lined paper with margin), Math Grid, and Dotted.
- **Paper Color Palettes:** Clean White, Ivory Warm, Slate Dark, Blackboard/Chalkboard, and Soft Gray, with adaptive contrast that automatically renders bright grid/ruled lines on dark paper templates.
- **Real-Time Network Sync:** Paper template and background color changes broadcast authoritatively across all connected participants.

### 7. PDF Document Import and Export
- **PDF Import:** Render multi-page PDFs directly onto notebook page backgrounds via `pdfjs-dist`.
- **Vector PDF Export:** Export entire multi-page notebook (paper templates + ink annotations) into a high-resolution PDF document using `jspdf`.

### 8. Viewport Navigation (Zoom and Pan)
- **Cursor-Centered Wheel Zoom:** Smooth exponential zoom centered at mouse pointer position with native scroll blocking.
- **Touchpad and Pinch Gestures:** Smooth two-finger pan and pinch-to-zoom (`ctrlKey`).
- **Floating Zoom Widget:** Floating controls featuring `[ - ]`, `[ 100% ]` reset, `[ + ]`, and `[ Fit to Page ]` centering.
- **Laser Pointer:** Glowing tip with an ephemeral fading particle trail synchronized across peers.

### 9. Sticky Notes and Diagramming Components
- **Sticky Notes:** Multi-line text input with adhesive styling across six pastel color swatches (Canary Yellow `#fef08a`, Mint `#bbf7d0`, Sky `#bae6fd`, Bubblegum `#fbcfe8`, Lavender `#e9d5ff`, Peach `#fed7aa`).
- **In-Place Editing:** Double-click any note or text element on canvas to launch the inline editing overlay.
- **Rubber Stamps:** Badges for APPROVED, CONFIDENTIAL, REVIEWED, DRAFT, and URGENT.
- **Flowcharts and Diagrams:** Start/End terminals, Process steps, Decision forks, Database cylinders, and Cloud services.
- **Math and Science:** LaTeX formulas ($\sum_{i=1}^n$, $\int f(x)dx$, $\sqrt{a^2+b^2}$), Benzene ring ($\text{C}_6\text{H}_6$), Bohr atom, DNA helix, and Circuit components.

### 10. Docked Whiteboard Chat with Granular Scopes
- **Side Panel Integration:** Docked directly onto the whiteboard (`ChatSidePanel`) instead of a modal, keeping drawings visible while communicating.
- **Audience Targeting:**
  - `Everyone (Public)`: Broadcasts messages to all participants in the room.
  - `Room Host (Private)`: Sends private messages directly to room hosts.
  - `Particular Participant (Direct)`: 1-on-1 private messaging routed exclusively to the selected participant and sender.
- **Visual Status:** Badges for Host-Only and Direct messages with unread counter badges on the header chat toggle.

### 11. Note-Synchronized Audio Recording
- Record lectures or group discussions using browser Web Audio MediaRecorder.
- Real-time elapsed recording timer, audio playback bar, waveform scrubber, and note timestamp synchronization (scrubbing audio spotlights notes created during that time slice).
- Audio export in standard `.webm` format.

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
| `Home` | Return to Home (Reset Pan to 0, 0 and Zoom to 100%) |

---

## Architecture Topology

```
+-------------------------------------------------------------+
|              CollabBoardX-Server (Central Server)           |
|  - Runs on server PC or host machine                        |
|  - FastAPI WebSocket Gateway + Raw TCP Server (Port 9001)   |
|  - SQLite WAL Authoritative State & Sequential Processing   |
|  - Serves LAN clients at http://<LAN_IP>:8000               |
+------------------------------+------------------------------+
                               |
        +----------------------+-----------------------+
        | LAN WebSocket & TCP  | LAN WebSocket & TCP   |
        v                      v                       v
+-----------------------+ +-----------------------+ +-----------------------+
| CollabBoardX-Client   | | CollabBoardX-Client   | | Browser / Tablet / iPad|
| (PC 1: Room Host)     | | (PC 2: Peer Client)   | | (Mobile QR Join)      |
| - Connect GUI & Ping  | | - Connect GUI & Ping  | | - Point camera at QR  |
| - Sets Editor/Viewer  | | - Real-time sync      | | - Draw & Voice chat   |
| - WebRTC Voice Mesh   | | - WebRTC Voice Mesh   | | - Touch & Stylus      |
+-----------------------+ +-----------------------+ +-----------------------+
```

---

## Standalone Executable Releases

CollabBoard X provides standalone, zero-dependency release binaries for Windows (`.exe`) and Linux (ELF), allowing immediate deployment on air-gapped LAN environments without requiring pre-installed Python, Node.js, or external package managers.

| Executable | Approximate Size | Target Machine | Description |
|---|---|---|---|
| **`dist/CollabBoardX-Server.exe`** | ~32 MB | Central Dedicated Server | Bundles Python runtime, Uvicorn, FastAPI, SQLite WAL state engine, explicit BSD TCP socket engine (port 9001), and the compiled React production build. |
| **`dist/CollabBoardX-Client.exe`** | ~10 MB | User Collaborator Machines | Native graphical launcher with real-time server latency ping (`[Ping Server]`), local LAN IP auto-detection, and one-click whiteboard room launch. |

*Note: For mobile phones, iPads, and Android tablets, no binary or application install is needed. Collaborators join by navigating to the host server address or scanning the on-screen QR code.*

---

## Building from Source and Reproducibility

This section provides complete, deterministic instructions to reproduce and build both the frontend and backend from a clean Git repository clone (where `.gitignore` artifacts like `node_modules/`, `frontend/dist/`, `dist/`, and runtime databases are excluded).

### 1. Prerequisites and Toolchain Verification

Ensure the following tools are installed and accessible in your system PATH:

- **Python:** Version 3.11 or higher (Python 3.11, 3.12, and 3.13 tested).
- **Node.js:** Version 18.0.0 or higher with `npm` (Node 18, 20, or 22 LTS recommended).
- **Git:** Version 2.30 or higher.
- **PyInstaller:** Optional, required only for building standalone executable release binaries (`pip install pyinstaller`).

Verify toolchain versions:
```bash
python --version   # or py -3.13 --version on Windows
node --version
npm --version
```

---

### 2. Step-by-Step Build Reproduction

#### Step 1: Clone the Repository
```bash
git clone <REPOSITORY_URL>
cd collabboard-x
```

#### Step 2: Build the Frontend Web Application
The frontend is built with React 18, TypeScript, and Vite. Dependencies are pinned in `frontend/package-lock.json` to guarantee exact, reproducible builds across environments.

```bash
# Navigate to frontend directory
cd frontend

# Install exact dependencies from package-lock.json
npm install

# Compile TypeScript and bundle production static assets
npm run build

# Return to project root directory
cd ..
```

**Verification:** Confirm that the production bundle is generated in `frontend/dist/`:
- `frontend/dist/index.html`
- `frontend/dist/assets/*.js`
- `frontend/dist/assets/*.css`

*Development Mode Alternative:* If you wish to run the frontend in Vite live-development mode with hot module replacement:
```bash
cd frontend
npm run dev
# Vite dev server runs at http://localhost:5173 with proxy configured to backend port 8000
```

#### Step 3: Set Up the Backend Environment
The backend is built with Python 3.11+, FastAPI, and SQLite WAL mode.

```bash
# Optional but recommended: Create and activate a Python virtual environment
# Linux / macOS:
python3 -m venv venv
source venv/bin/activate

# Windows (PowerShell):
py -3.13 -m venv venv
.\venv\Scripts\Activate.ps1

# Install exact backend dependencies
pip install -r backend/requirements.txt
```

#### Step 4: Verify Backend Integrity with Automated Tests
Execute the full test suite to verify transport framing, event dispatching, room concurrency, and database persistence:

```bash
# Run pytest across all test suites
pytest -v backend/tests
```
**Expected Output:** All 25 test suites pass (100% pass rate).

#### Step 5: Run the Full-Stack Application
Start the central server from the repository root:

```bash
# Linux / macOS:
python3 server_host.py --port 8000 --tcp-port 9001

# Windows:
py -3.13 server_host.py --port 8000 --tcp-port 9001
```

**Startup Behavior:**
1. Automatically identifies the active local area network IP address (e.g., `192.168.1.37`).
2. Initializes SQLite in Write-Ahead Logging mode (`collabboard_state.db`).
3. Starts the HTTP and WebSocket gateway on port 8000.
4. Starts the raw BSD TCP socket server on port 9001.
5. Automatically locates and mounts `frontend/dist/` at the root URL `/`.
6. Generates a scannable ASCII QR code in the terminal for mobile and tablet LAN participants.

**Accessing the Application:**
- **Web Clients (Laptops, Desktops, iPads, Tablets):** Open any modern browser and navigate to `http://<LAN_IP>:8000` (or `http://localhost:8000` locally).
- **Desktop Graphical Client (Optional):** Run the native Python Tkinter GUI launcher:
  ```bash
  python client_gui.py
  ```

---

### 3. Reproducing Standalone Release Executables

CollabBoard X includes an automated packaging pipeline (`package_executable.py`) that bundles the Python runtime, Uvicorn, FastAPI, SQLite WAL engine, raw TCP socket engine, and the compiled `frontend/dist/` into self-contained, zero-dependency release binaries.

#### Building on Windows (.exe)
```powershell
# Ensure PyInstaller is installed
pip install pyinstaller

# Run universal automated packaging script
py -3.13 package_executable.py all

# Alternatively, run the Windows batch builder
.\build_windows_exe.bat
```
**Generated Artifacts in `dist/`:**
- `dist/CollabBoardX-Server.exe` (~32 MB): Standalone central server executable.
- `dist/CollabBoardX-Client.exe` (~10 MB): Standalone desktop graphical launcher.

#### Building on Linux (ELF Executables)
```bash
# Install Tkinter system headers and PyInstaller
sudo apt-get update && sudo apt-get install -y python3-tk
pip3 install pyinstaller

# Compile Linux release binaries
python3 package_executable.py all
```
**Generated Artifacts in `dist/`:**
- `dist/CollabBoardX-Server`: Standalone Linux ELF server binary.
- `dist/CollabBoardX-Client`: Standalone Linux ELF client GUI binary.

---

### 4. Clean Rebuild and Troubleshooting Checklist

#### Performing a Clean Rebuild
To completely purge all build artifacts, dependencies, and runtime databases before rebuilding:

```bash
# Windows (PowerShell):
Remove-Item -Recurse -Force frontend/dist, frontend/node_modules, dist, build, *.db, *.db-wal, *.db-shm -ErrorAction SilentlyContinue

# Linux / macOS:
rm -rf frontend/dist frontend/node_modules dist build *.db *.db-wal *.db-shm
```
Then repeat Step 2 and Step 3 above.

#### Common Troubleshooting Steps
- **Port Conflicts:** If port 8000 or 9001 is already bound by another service, specify alternate ports:
  ```bash
  python server_host.py --port 8080 --tcp-port 9002
  ```
- **Local Firewall Rules:** Ensure your OS firewall permits inbound connections on ports 8000 (TCP) and 9001 (TCP) so that other LAN devices can connect.
- **Microphone / WebRTC Voice on HTTP Origins:** Chromium browsers restrict `getUserMedia` on non-localhost HTTP addresses. Either access via the desktop client (`client_gui.py`), or enable the Chromium developer flag: navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://<LAN_IP>:8000`, and click Relaunch.

---

## User Interface and Controls Overview

### Top Header Navigation
- **Brand Logo Popover:** Clicking the CollabBoard X logo on the far left reveals live connection health, active transport protocol (`WebSocket` or `Raw TCP`), current room ID with one-click copy link, server LAN address, role badge (`HOST`, `EDITOR`, `VIEWER`), and room master lock controls.
- **Two-Tab Workspace Switcher:**
  - **Whiteboard Tab:** Distraction-free canvas with floating inking toolbar, audio recording bar, page navigation, thumbnail drawer, and smooth zoom controls.
  - **Controls Tab:** Participant roster, role assignment matrix (Host / Editor / Viewer), moderation controls (mute individual, mute all, kick), WebRTC voice mesh controls, and notebook version snapshots.
- **Right Action Bar:**
  - Real-time chat drawer toggle with unread message counter badge.
  - Quick microphone mute/unmute toggle.
  - User profile pill and disconnect action.

### Host Governance and Access Control
- **Master Board Access Switch:** Host can toggle room drawing access (`[Board: Open]` / `[Board: Locked]`). When locked, non-host participants have drawing tools disabled and are restricted to read-only viewing and panning.
- **Cursor Sharing Moderation:** By default, only the Host cursor is broadcast to prevent visual clutter in large rooms. Non-host participants can request cursor visibility via the `[Share Pointer]` button, which prompts the Host with interactive approval pills (`[Allow]` / `[Deny]`).
- **Role Permissions:** Host can elevate participants from Viewer (read-only) to Editor (can draw and modify unlocked elements), or revoke permissions at any time.

---

## Automated Test Suites

The backend includes a comprehensive test suite of 25 automated unit and integration tests.

Run the test suite from the repository root:
```bash
pytest -v backend/tests
```

### Test Coverage Highlights
- **`test_canvas_engine.py`**: ADD, UPDATE, TRANSFORM, DELETE, CLEAR mutations, multi-page page creation, locked element mutation rejection, and cascading page deletion.
- **`test_framing.py`**: 4-byte big-endian framing, streaming buffer fragmentation, and boundary recovery.
- **`test_envelope.py`**: Message envelope serialization and Pydantic v2 validation.
- **`test_event_bus.py`**: Event registration, dispatching, and pipeline filtering.
- **`test_raw_tcp_socket.py`**: Explicit socket programming roundtrip test on port 9001.
- **`test_websocket_gateway.py`**: FastAPI WebSocket handshake, envelope routing, and ping-pong.
- **`test_cross_protocol_broadcast.py`**: Unified broadcasting across WebSocket and Raw TCP sessions.
- **`test_room_actor.py`**: Concurrent queue serialization (30 concurrent ops), deduplication, and gap replay.
- **`test_canvas_module_integration.py`**: End-to-end multi-client room join, snapshot, and draw broadcast.
- **`test_chat_presence.py`**: Real-time chat message persistence, history query, and ephemeral cursor broadcasting.
- **`test_voice_signaling.py`**: WebRTC SDP Offer, Answer, and ICE candidate mesh routing.
- **`test_host_controls.py`**: Room locking, user kicking, snapshot JSON export, and state restoration.
- **`test_version_control.py`**: Server-side notebook version control with 3-slot quota enforcement, conflict replacement, version listing, room-wide snapshot restoration, and version deletion.

---

## Diagnostic and Protocol Verification Tools

CollabBoard X includes dedicated CLI diagnostic tools to test and verify network protocol compliance:

### 1. Raw BSD TCP Socket Client
A standalone CLI client communicating directly with the raw TCP engine on port 9001:
```bash
python tools/lab_tcp_client.py --host 127.0.0.1 --port 9001 --room test-room
```

### 2. Network Impairment and Sequence Gap Recovery Tester
Simulates hostile network conditions (random packet drops, latency jitter) to verify client gap detection and server resynchronization via `ROOM_REPLAY_REQ`:
```bash
python tools/network_impairment_tester.py --host 127.0.0.1 --port 9001 --room fault-test
```

### 3. Protocol Specification
For wire protocol packet structures, message types, and schema definitions, refer to [docs/PROTOCOL_SPEC.md](file:///c:/Users/raman/Downloads/COLLAB/docs/PROTOCOL_SPEC.md).

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.

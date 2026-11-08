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
|-- dist/
|   |-- CollabBoardX-Server.exe        # Standalone Central Dedicated Server binary
|   |-- CollabBoardX-Client.exe        # Standalone Desktop GUI Client binary
|-- tools/
|   |-- lab_tcp_client.py              # Raw TCP socket client for CN Lab demonstration
|   |-- network_impairment_tester.py   # Fault injection & sequence gap recovery tester
|-- docs/
|   |-- PROTOCOL_SPEC.md               # Application protocol specification (v2.0)
|   |-- STANDALONE_EXECUTABLES_AND_GUI_GUIDE.md # Executables deployment & desktop GUI guide
|   |-- GOODNOTES_FEATURE_GUIDE.md     # Complete GoodNotes 5 user & developer manual
|   |-- LAB_EXPERIMENT_GUIDE.md        # Computer Networks lab evaluation guide & Wireshark steps
|   |-- M1_NETWORKING_CORE.md          # Milestone 1 report
|   |-- M2_CANVAS_ENGINE.md            # Milestone 2 report
|   |-- M3_FRONTEND_WHITEBOARD.md      # Milestone 3 report
|   |-- M4_PRESENCE_AND_CHAT.md        # Milestone 4 report
|   |-- M5_WEBRTC_VOICE.md             # Milestone 5 report
|   |-- M6_HOST_CONTROLS_AND_DEPLOYMENT.md # Milestone 6 report
|-- package_executable.py              # Universal PyInstaller packaging script (Windows & Linux)
|-- build_windows_exe.bat              # One-click Windows build batch script
|-- server_host.py                     # Root entrypoint for Central Dedicated Server
|-- client_gui.py                      # Root entrypoint for Desktop GUI Client
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

## Central Server & GUI Client Architecture

CollabBoard X provides **two dedicated standalone executables**:

```
+-------------------------------------------------------------+
|              CollabBoardX-Server.exe (Central Server)       |
|  - Runs on server PC or host machine                        |
|  - FastAPI WebSocket Gateway + Raw TCP Server (Port 9001)   |
|  - SQLite WAL Authoritative State & Sequential Processing   |
|  - Serves LAN clients at http://<LAN_IP>:8000               |
+------------------------------+------------------------------+
                               |
       +-----------------------+-----------------------+
       | LAN WebSocket & TCP   | LAN WebSocket & TCP   |
       v                       v                       v
+-----------------------+ +-----------------------+ +-----------------------+
| CollabBoardX-Client   | | CollabBoardX-Client   | | Browser / Tablet / iPad|
| (PC 1: Room Host)     | | (PC 2: Peer Client)   | | (Mobile QR Join)      |
| - Connect GUI & Ping  | | - Connect GUI & Ping  | | - Point camera at QR  |
| - Sets Editor/Viewer  | | - Real-time sync      | | - Draw & Voice chat   |
| - WebRTC Voice Mesh   | | - WebRTC Voice Mesh   | | - Touch & Stylus      |
+-----------------------+ +-----------------------+ +-----------------------+
```

---

## Standalone Executable Releases & Local Reproduction

CollabBoard X provides standalone, zero-dependency release binaries for both Windows (`.exe`) and Linux (ELF), allowing immediate deployment on air-gapped LAN environments without requiring pre-installed Python, Node.js, or external package managers.

### 1. Release Binaries Overview
| Executable | Size | Target Machine | Description |
|---|---|---|---|
| **`dist/CollabBoardX-Server.exe`** | ~32 MB | Central Dedicated Server Machine | Bundles Python 3 runtime, Uvicorn, FastAPI, SQLite WAL state engine, explicit BSD TCP socket engine (port 9001), and the compiled React 18 production build. |
| **`dist/CollabBoardX-Client.exe`** | ~10 MB | User Collaborator Laptops / PCs | Native dark-themed graphical launcher with real-time server latency ping (`[Ping Server]`), local LAN IP auto-detection, and one-click whiteboard room launch. |

> [!NOTE]
> For mobile phones, iPads, and Android tablets, no binary or app install is needed. Simply scan the real-time **Share & QR Code** displayed by the host or client.

---

### 2. How to Reproduce the Standalone Executables Locally

#### Prerequisites
- **Python 3.11+** (Python 3.13 tested) with `pip`
- **Node.js 18+** and `npm`
- **PyInstaller**: `pip install pyinstaller`

#### Option A: Universal Automated Build (Recommended)
Run the automated packaging script from the repository root:
```powershell
# Windows PowerShell:
py -3.13 package_executable.py all

# Or run the Windows batch script:
.\build_windows_exe.bat
```
This script automatically:
1. Installs frontend dependencies and executes `npm run build` in `frontend/`.
2. Packages `server_host.py` into `dist/CollabBoardX-Server.exe` with bundled frontend static assets.
3. Packages `client_gui.py` into `dist/CollabBoardX-Client.exe` with all Tkinter GUI dependencies.

#### Option B: Step-by-Step Manual Reproduction
If you wish to compile each component independently:
```powershell
# Step 1: Compile the React frontend
npm --prefix frontend install
npm --prefix frontend run build

# Step 2: Install Python dependencies
pip install -r backend/requirements.txt pyinstaller

# Step 3: Package the Central Server executable
pyinstaller --noconfirm CollabBoardX-Server.spec

# Step 4: Package the Desktop GUI Client executable
pyinstaller --noconfirm CollabBoardX-Client.spec
```
Both generated binaries will be placed in the `dist/` directory.

---

### 3. Cross-OS Compatibility & Linux Reproduction
CollabBoard X is 100% cross-platform compatible across Windows, Linux, and macOS. To build standalone release binaries on Linux (e.g. Ubuntu / Debian / Fedora / Arch):

```bash
# 1. Install system build prerequisites
sudo apt-get update && sudo apt-get install -y python3 python3-pip python3-tk nodejs npm

# 2. Build the production React frontend
npm --prefix frontend install
npm --prefix frontend run build

# 3. Install Python dependencies
pip3 install -r backend/requirements.txt pyinstaller

# 4. Compile Linux standalone executables
python3 package_executable.py all
```
This generates standalone Linux executable binaries in `dist/`:
- `dist/CollabBoardX-Server`
- `dist/CollabBoardX-Client`

---

## Quick Start Guide

### 1. Launching the Central Dedicated Server
Run on the server machine:
```powershell
# Using the pre-compiled standalone executable:
.\dist\CollabBoardX-Server.exe --port 8000 --tcp-port 9001

# Or running directly from Python source:
py -3.13 server_host.py --port 8000 --tcp-port 9001
```
The server will:
- Detect your LAN IP (e.g. `192.168.1.37`).
- Start WebSockets on port 8000 and raw TCP sockets on port 9001.
- Display connection info for all client PCs and tablets.

### 2. Launching the Desktop GUI Client
Run on any user PC across the LAN:
```powershell
# Using the pre-compiled standalone executable:
.\dist\CollabBoardX-Client.exe

# Or running directly from Python source:
py -3.13 client_gui.py
```
The desktop GUI window will pop up immediately:
1. **Server Address Input:** Enter the Central Server LAN IP (e.g. `192.168.1.37:8000`).
2. **Ping Button:** Live latency indicator verifies server status in real time.
3. **Display Name:** Enter your name.
4. **Create or Join Board:** Click "Create New Whiteboard" or enter a Room Code.
5. **Share & Graphical QR Code:** Click the **Share & QR** button in the top bar to pop up a visual QR code for mobile/tablet users to scan!

### 3. Decluttered Workstation: Dedicated Workspace Tabs & Host Access Governance
The user interface is organized into a clean 52px top navigation header with dedicated, specialized tabs:

1. **`🎨 Whiteboard & Notebook` Tab:**
   - Pure, uncompromised drawing and digital note-taking experience with **zero floating clutter**.
   - Floating GoodNotes toolbar centered at top (`PenTool`, `Highlighter`, `Eraser`, `Lasso`, `Shapes`, `Text`, `Stickers`, `Ruler`, `Laser`).
   - Note-synchronized `AudioRecorderBar` in top right.
   - Page navigation and thumbnails drawer at bottom.
   - Canvas state is preserved continuously in memory when switching tabs (no redraws or lost context).
   - **Board Access Enforcement:** When the Host disables board access, all non-host participants have their drawing toolbar hidden and see a prominent **"🔒 BOARD ACCESS DISABLED BY HOST"** banner. Canvas drawing is locked to read-only panning.

2. **`👥 Meeting & Controls` Tab:**
   - **Master Board Access Governance Card:**
     - `[ 🔓 Board Access: Open ]` <--> `[ 🔒 Board Access: Disabled (Frozen) ]`
     - One-click master toggle for the Room Host to immediately disable or enable board editing for all participants across the room.
     - Server authoritatively rejects any non-host mutation while access is disabled (`BOARD_ACCESS_DISABLED`).
   - **Participants & Permissions Matrix:**
     - Clear distinction between `👑 Host (Admin)`, `✏️ Editor (Active Draw)`, and `👁️ Viewer (Access Disabled)`.
     - Host can click **"Disable Access" / "Grant Access"** next to any participant row to change their individual permissions in real time.
   - **Host Moderation & Muting:** Host can mute individual noisy participants, click **"Mute All"** to mute all microphones across the room, or kick disruptive participants.
   - **Air-Gapped WebRTC Voice Mesh:** LAN group audio controls (Join Voice, Mute, Deafen, Leave) with live Voice Activity Detection (VAD).
   - **Instant Share & QR Code Card:** Real-time graphical QR code rendered on canvas, instant LAN share link copy button, and room code copy button.
   - **Room Governance & Snapshots:** Room lock toggle, state export to `.json`, and state restoration.

3. **`💬 Chat` Tab:**
   - Dedicated spacious room conversation stream with message timestamps, color-coded sender bubbles, and auto-scroll.
   - Shows an unread notification counter badge (e.g. `💬 Chat (3)`) on the top header when new messages arrive while in other tabs.

### 4. Pixel-Exact Coordinates & Host-Moderated Cursor Governance

- **Zero Cursor Drift / Lag Fix:**
  - Canvas coordinates use `clientX - rect.left` and `clientY - rect.top` relative to `<canvas>` bounding rectangle, completely eliminating the vertical row offset previously caused by top navigation bars or viewport scaling.
- **Clutter-Free Canvas Policy (10+ Participants):**
  - Only the **Room Host's cursor** (`👑 Host`) is displayed by default to maintain a clean, uncluttered whiteboard.
  - **Viewers (`VIEWER`)** never broadcast pointer coordinates, and their cursors are automatically removed if their role changes.
  - **Participant Cursor Request:** Non-host participants have a **`[Share Pointer]`** button in the header. Clicking it sends a request to the Host.
  - **Host Real-time Moderation:** The Host receives an interactive header notification pill (`"User wants to show cursor: [Allow] [Deny]"`).
  - **Granular Toggles:** The Host can also toggle pointer visibility (`[ 🖱️ Pointer: On / Off ]`) for any participant at any time within the **Meeting & Controls** tab.

### 5. Quick Header Controls
- **Master Board Access Switch:** Prominent toggle button in the top header (`[ 🔓 Board: Open ]` / `[ 🔒 Board: Disabled ]`) allowing the Host to freeze/unfreeze drawing access instantly from any screen.
- **Participant Pointer Request Button:** Non-host participants can request or stop cursor sharing (`[Share Pointer]`).
- **Host Cursor Request Notification:** Interactive pill allowing the Host to accept or reject incoming cursor broadcast requests on the fly.
- **Quick Voice Mic Toggle:** Mute/unmute microphone directly from the top header without leaving the Whiteboard tab.
- **Quick Share & QR Modal:** One-click modal popup displaying the shareable LAN link and QR code from any screen.
- **User Profile & Role Pill:** Real-time badge indicating current role (`👑 HOST`, `✏️ EDITOR`, or `👁️ VIEWER`).

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

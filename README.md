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
11. **GoodNotes 5 Complete Feature Alignment:** Multi-page notebook, advanced pen styles (Ballpoint, Fountain, Brush), whole/partial (segment-splitting) eraser, toggleable smart shape recognition, lasso selection with auto-move switch, paper background patterns & color palettes, laser pointer, PDF import/export, categorized stickers drawer, docked whiteboard chat side panel with granular audience scope, and note-synchronized audio recording.

---

## 5-Person Team Architecture & Project Division (Computer Networks Course)

This project is tailored for a comprehensive Computer Networks laboratory/term course, explicitly dividing responsibilities across 5 student engineers. Each module implements critical networking, distributed systems, and real-time streaming concepts:

| Student | Architectural Focus | Key Networking Concepts | Key Code Modules |
|---|---|---|---|
| **Person 1** | **Transport Layer & Wire Protocol Engineering** | Dual-Transport (WebSocket RFC 6455 vs Raw BSD TCP Sockets), Big-Endian 4-byte framing (`!I`), TCP stream segmentation / MTU fragmentation, Canonical Envelope codec, Session lifecycle & heartbeats. | `backend/app/transport/framing.py`<br>`backend/app/transport/websocket_gateway.py`<br>`backend/app/transport/raw_tcp_server.py`<br>`tools/lab_tcp_client.py` |
| **Person 2** | **Server-Authoritative State Engine & Concurrency** | Actor model pattern (`asyncio.Queue`), Monotonic sequence ordering ($seq_{k+1} = seq_k + 1$), Total order broadcast, Gap detection & targeted replay (`RESYNC_REQ`), Optimistic UI reconciliation. | `backend/app/engine/room_actor.py`<br>`backend/app/engine/room_manager.py`<br>`backend/app/modules/canvas/module.py`<br>`frontend/src/features/canvas/state/CanvasStore.ts` |
| **Person 3** | **WebRTC P2P Voice Mesh & Real-Time Signaling** | Decentralized full mesh topology ($O(N^2)$), SDP Offer/Answer signaling over WebSocket control plane, Deterministic glare avoidance, Asynchronous ICE candidate buffering, Web Audio VAD, Insecure context boundary mitigation. | `backend/app/modules/voice/module.py`<br>`frontend/src/features/voice/rtc/WebRTCVoiceMesh.ts`<br>`frontend/src/features/voice/components/` |
| **Person 4** | **Ephemeral Traffic Optimization & Network Governance** | Spatial coordinate rate throttling (30Hz adaptive window), Linear interpolation (Lerp), Zero-disk memory queues, Granular audience multicast (socket-boundary privacy: `EVERYONE`, `HOST_ONLY`, `DIRECT`), Room locking, Remote eviction. | `backend/app/modules/chat/module.py`<br>`backend/app/modules/host_control/module.py`<br>`frontend/src/features/presence/RemoteCursorOverlay.tsx`<br>`frontend/src/features/chat/components/ChatPanel.tsx` |
| **Person 5** | **Storage Persistence, Fault Injection & Full-Stack Client** | SQLite Write-Ahead Logging (WAL mode), Monotonic transaction journaling, 3-slot server notebook version snapshots & 1-click restore (`SNAPSHOT_RESTORE`), Network impairment testing (packet loss & jitter), 60 FPS double-buffered GoodNotes canvas engine. | `backend/app/storage/database.py`<br>`backend/app/storage/repositories/canvas_repo.py`<br>`tools/network_impairment_tester.py`<br>`frontend/src/features/canvas/components/CanvasView.tsx` |

> [!NOTE]
> **Academic Artifacts Included:**
> - [presentation.tex](file:///c:/Users/raman/Downloads/COLLAB/presentation.tex): A complete 18-slide LaTeX Beamer presentation dividing the work into 5 people with `% PERSON X` comments, focused on networking theory and architecture.
> - [video_script.txt](file:///c:/Users/raman/Downloads/COLLAB/video_script.txt): A comprehensive 16-18 minute presentation and live demonstration video script detailing exact speaker lines, slide cues, Wireshark packet captures, terminal commands, and live whiteboard tests.

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

### 2. Intelligent Eraser System & Transactional Compound History Engine
- **Whole-Stroke Erasing:** Removes entire vector element upon intersection with eraser path.
- **Partial-Stroke Erasing:** Segment-based vector polyline trimming that isolates points within the eraser radius and cleanly splits remaining points into independent sub-strokes with identical styling, completely eliminating phantom connector lines.
- **Erase Highlighter Only:** Toggle to erase only highlighter strokes while leaving pencil handwriting, shapes, and notes intact.
- **Transactional Compound Undo/Redo Engine:** Continuous eraser swipes, partial splitting passes, and multi-selection deletions are grouped into atomic transaction blocks (`beginTransaction()` / `endTransaction()`). Pressing `Ctrl+Z` or clicking the prominent **Undo & Redo buttons** in the primary toolbar or header bar undoes operations seamlessly. Automatic window-level pointerup listeners guarantee transactions are never trapped in open states. All snapshots are deeply cloned to prevent state mutation.

### 2.1 Server-Side Notebook Version Control & Snapshot Restores (3-Notebook Quota)
- **Persistent Server Slots:** Each participant/host is allocated **3 dedicated notebook version slots** saved directly in the server's SQLite WAL database.
- **Named Version Snapshots:** Users can snapshot their active whiteboard with custom or timestamped version names (e.g. `Physics Lecture Part 1`). Every snapshot encapsulates all canvas elements, multi-page hierarchies, paper templates, and background colors.
- **Instant Whiteboard Restoration:** Restore any saved version with a single click (`[ 🔄 Restore ]`). The server atomically replaces room state, updates SQLite, and broadcasts the restored snapshot and announcement to all connected clients in real time.
- **Quota Management & Slot Recycling:** A visual 3-slot progress indicator (`X / 3 Slots Used`) alerts users when capacity is reached, offering a dropdown to overwrite existing versions or delete unused slots.
- **Offline File Backups:** Secondary JSON Export/Import buttons allow saving and restoring state from local disk files.

### 3. Geometric Shapes & Smart Shape Detection Toggle
- **Built-in Geometric Primitives:** Rectangle, Square, Circle, Ellipse, Straight Line, Directional Arrow, Double-Arrow, Triangle, Star, and Polygons.
- **Smart Shape Detection:** Inactive by default. Toggleable on demand via the toolbar button (`[ ✨ Shapes: ON/OFF ]`). Analyzes freehand strokes using the Ramer-Douglas-Peucker polygon approximation and least-squares regression to snap strokes into crisp geometric forms.

### 4. Lasso Selection with Instant Move Handoff
- **Freeform Lasso:** Ray-casting polygon containment selection for handwriting, shapes, text, images, and stickers.
- **Instant Move Tool Switch:** Automatically switches to the Select / Move tool immediately upon releasing the lasso, allowing instant drag, transform, and rotation without an extra click.
- **Transformations:** Move, resize, duplicate (`Ctrl+D`), bring to front, send to back, and **object locking** to prevent accidental modifications.

### 5. Multi-Page Notebook, Paper Templates & Color Palettes
- **Page Management:** Bottom navigation bar (`< Page 1 / 4 >`), add page, duplicate page, delete page (with cascading element cleanup), and visual thumbnail drawer.
- **Paper Background Patterns:** Blank, Ruled (lined paper with margin), Math Grid, and Dotted.
- **Paper Color Palettes:** Clean White, Ivory Warm, Slate Dark, Blackboard/Chalkboard, and Soft Gray, with adaptive contrast that automatically renders bright grid/ruled lines on dark paper templates.
- **Real-Time Network Sync:** Paper template and background color changes broadcast authoritatively across all connected participants.

### 6. PDF Document Import & Export
- **PDF Import:** Render multi-page PDFs directly onto notebook page backgrounds via `pdfjs-dist`.
- **Vector PDF Export:** Export entire multi-page notebook (paper templates + ink annotations) into a high-resolution PDF document using `jspdf`.

### 7. Professional Viewport Navigation (Zoom & Pan)
- **Cursor-Centered Wheel Zoom:** Exponential smooth zoom centered exactly at mouse pointer position with native scroll blocking.
- **Touchpad & Pinch Gestures:** Smooth two-finger pan and pinch-to-zoom (`ctrlKey`).
- **Floating Zoom Widget:** Bottom-left floating controls featuring `[ - ]`, `[ 100% ]` reset, `[ + ]`, and `[ ⛶ Fit to Page ]` centering.
- **Laser Pointer:** Glowing red/cyan tip with an ephemeral fading particle trail synchronized across peers.
- **Decluttered Canvas:** Removed drafting ruler to maintain a focused, modern digital notebook experience.

### 8. Categorized Elements & Editable Sticky Notes
- Intuitive, tabbed sticker drawer with 1-click center placement:
  - **Sticky Notes:** Pastel yellow, blue, green, pink, purple, and orange with multi-line text input and adhesive strip styling.
  - **In-Place Note Editing:** Double-click or double-tap any sticky note or text element on canvas to launch the inline editing overlay.
  - **Floating Canvas Badge:** Selected sticky notes display a floating `[ ✏️ Edit Note Text ]` badge directly on canvas.
  - **Toolbar Action & Pastel Swatches:** Active sticky notes provide an **`[ ✏️ Edit Text ]`** button and 6 pastel color pickers (Canary Lemon `#fef08a`, Mint `#bbf7d0`, Sky `#bae6fd`, Bubblegum `#fbcfe8`, Lavender `#e9d5ff`, Peach `#fed7aa`).
  - **Word Wrapping & Empty State Guidance:** Multi-line text wraps with automatic padding, and empty notes display an italic placeholder `(Double-click to write note...)`.
  - **Reactions & Emojis:** Quick emoji grid (👍, ❤️, 🚀, 🔥, 💡, 🎯, 👏, 🎉, 💯, ⚠️, ❓, 🏆, etc.).
  - **Rubber Stamps & Badges:** Official circular and rectangular stamps (APPROVED, CONFIDENTIAL, REVIEWED, DRAFT, URGENT).
  - **Flowcharts & Diagrams:** Start/End terminal, Process step, Decision fork, Database cylinder, Cloud service.
  - **Math & Science:** $\sum_{i=1}^n$, $\int f(x)dx$, $\sqrt{a^2+b^2}$, Benzene ring ($\text{C}_6\text{H}_6$), Bohr atom, DNA helix, Resistor.
- **Auto-Select & Move:** Elements automatically select and switch to the Move tool upon insertion for immediate drag repositioning.

### 9. Docked Whiteboard Chat with Granular Audience Scope
- **Side Panel Integration:** Docked directly onto the whiteboard (`ChatSidePanel`) instead of a separate tab, keeping your drawings continuously in view while chatting.
- **Audience Targeting:**
  - `👥 Everyone (Public)`: Broadcasts messages to all participants in the room.
  - `👑 Room Host (Private)`: Sends private messages directly to room hosts only.
  - `🔒 Particular Participant (Direct)`: Encrypted 1-on-1 private messaging routed exclusively to the selected participant and the sender.
- **Color-Coded Badges:** Clear visual indicators for Host-Only and Direct messages with unread counter badges on the header chat toggle button.

### 10. Note-Synchronized Audio Recording
- Record lectures or group discussions using the browser's Web Audio MediaRecorder.
- Real-time elapsed recording timer, audio playback bar, waveform scrubber, and **note timestamp synchronization** (scrubbing audio spotlights notes created during that time slice).
- Audio export in `.webm` format.

### 11. Modernized Dashboard & Mobile-Friendly GUI
- **Fun Avatar Picker:** Choose from 12 distinct avatar characters (🦊, 🦉, 🚀, 🎨, 💡, ⚡, 🐱, 🐼, 👾, 🌟, 🎯, 🔮) saved in local storage.
- **Segmented Mode Switch:** Clean cards for `[ Create Room ]` vs `[ Join Room ]`.
- **Recent Rooms History:** Quick-join chips for the last 5 visited rooms with 1-click entry.
- **Mobile Responsive Design:** 
  - Header compacts gracefully on screens $< 768\text{px}$ without button overflow.
  - Top floating drawing toolbar auto-scrolls horizontally with tight padding.
  - Audio recording bar docks safely at `top: 58px, right: 8px`, completely clearing the top toolbar.
  - Bottom Page Navigation bar docks at bottom-right, cleanly separating from the bottom-left zoom controls.
  - First-class touch and Apple Pencil / stylus support with accidental scroll suppression.

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
| `Home` | Return to Home (Reset Pan to 0, 0 & Zoom to 100%) |

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

### 3. Redesigned Minimal Navigation UI: Logo Popover & Dedicated Workspace Tabs
The user interface features a clean, minimal 52px top navigation header divided into three focused sections:

1. **Left: Interactive Brand Logo Popover:**
   - Clicking the **CollabBoard X** brand logo on the far left opens a rich meeting & connection details popover:
     - **Live Connection Status:** Real-time indicator dot (🟢 Connected / 🟡 Reconnecting / 🔴 Disconnected) and transport type (`WebSocket` or `Raw TCP`).
     - **Room Code & 1-Click Copy Link:** Displays the current Room ID with an instant copy button (`📋 Copy Link`) providing visual copied feedback.
     - **Share & QR Code Modal Trigger:** Instant access to mobile scanning QR code modal.
     - **Server LAN Address:** Shows server endpoint (e.g. `192.168.1.37:8000`).
     - **User Role Badge:** Clear indication of current role (`👑 HOST`, `✏️ EDITOR`, or `👁️ VIEWER`).
     - **Host Master Board Access Switch:** Host can toggle room edit lock directly from the logo popover (`[ 🔓 Board: Open ]` / `[ 🔒 Board: Locked ]`).
     - **Pending Cursor Requests:** Approvals for participant cursor sharing displayed directly inside the popover.
     - **Leave Meeting:** Clean leave button to safely disconnect.

2. **Center: Clean Two-Tab Workspace Switcher:**
   - **`🎨 Whiteboard` Tab:**
     - Pure, distraction-free canvas and digital note-taking experience with **zero floating clutter**.
     - Floating GoodNotes toolbar centered at top (`PenTool` [Ballpoint, Fountain, Brush], `Highlighter`, `Eraser` [Whole / Partial segment-splitting], `Lasso`, `Shapes`, `Text`, `Stickers`, `Laser`, `✨ Shapes Toggle`, `📄 Paper Background`).
     - Note-synchronized `AudioRecorderBar` in top right.
     - Page navigation and thumbnails drawer at bottom.
     - Smooth exponential zoom widget at bottom left (`[ - ]`, `[ 100% ]`, `[ + ]`, `[ ⛶ Fit ]`, and `[ 🏠 Home ]`).
     - Canvas state is preserved continuously in memory when switching tabs (no redraws or lost context).
     - **Board Access Enforcement:** When the Host disables board access, all non-host participants have their drawing toolbar hidden and see a prominent **"🔒 BOARD ACCESS DISABLED BY HOST"** banner. Canvas drawing is locked to read-only panning.
   - **`👥 Controls` Tab (with Participant Count Badge):**
     - Live participant counter badge (e.g. `Controls (3)`).
     - **Participants & Permissions Matrix:** Grant or revoke individual editing access in real time.
     - **Host Moderation & Muting:** Mute individual participants, click **"Mute All"**, or kick disruptive participants.
     - **Air-Gapped WebRTC Voice Mesh Controls:** Join Voice, Mute, Deafen, and live Voice Activity Detection (VAD).
     - **Notebook Version Control & Snapshots:** 3-slot notebook quota, named snapshots, 1-click restore (`[ 🔄 Restore ]`), and deletion.

3. **Right: Parallel Chat Drawer & Quick Actions:**
   - **`💬 Chat` Button (with Unread Counter):** Opens the real-time chat panel side-by-side alongside the whiteboard without obscuring the canvas or navigating away.
   - **Audience-Scoped Chatting:** Select message scope: `👥 Everyone (Public)`, `👑 Room Host (Private)`, or `🔒 Particular Participant (Direct 1-on-1)`. Socket-boundary filtering ensures non-permitted clients never receive private frames.
   - **Quick Voice Mic Toggle:** Mute/unmute microphone directly from the header.
   - **User Profile Pill & Leave Button.**

---

### 3.1 WebRTC Voice over LAN Engine & Security Invariants

CollabBoard X implements a high-performance, decentralized WebRTC voice mesh designed specifically for local area networks:

- **Full Peer-to-Peer Mesh ($O(N^2)$):**
  - Audio packets (Opus codec over RTP/UDP) stream directly peer-to-peer across LAN nodes without routing through the server CPU.
  - Operates strictly offline without external STUN/TURN dependencies (`iceServers: []` with fallback).
- **Asynchronous ICE Candidate Queuing:**
  - Solves the classic WebRTC race condition where network ICE candidates arrive before `setRemoteDescription` completes. Early candidates are buffered in an internal `pendingCandidates` map and flushed immediately once the remote description is active, preventing `InvalidStateError` drops.
- **Deterministic Glare Avoidance:**
  - Prevents dual-offer collisions when peers join simultaneously by enforcing strict ID precedence (`myPeerId < remotePeerId` initiates `createOffer`).
- **Active Voice Session Tracking:**
  - Server maintains an active voice roster (`room_voice_peers`) and responds to `VOICE_ROSTER_REQ` with `VOICE_ROSTER_RES`. Peers only initiate WebRTC connections to users who have actually joined voice, eliminating call attempts to dormant participants.
- **Handling Chromium Insecure Context Boundary on LAN (`http://<LAN_IP>:8000`):**
  - Modern Chromium browsers (Chrome, Edge, Brave) disable `navigator.mediaDevices.getUserMedia` on non-localhost HTTP origins (`window.isSecureContext === false`).
  - CollabBoard X detects this automatically and provides two seamless solutions:
    1. **Browser Flag (One-Time Setup):** Navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://<LAN_IP>:8000`, and click Relaunch.
    2. **Native Desktop GUI Client (`CollabBoardX-Client.exe`):** Connect using the standalone desktop client, which runs locally on `127.0.0.1` and inherently satisfies the browser secure context requirement.

---

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

Run the complete test suite (**25 automated unit and integration tests**):
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
- **	est_version_control.py**: Server-side notebook version control with 3-slot quota enforcement, conflict replacement, version listing, room-wide snapshot restoration, and version deletion.

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

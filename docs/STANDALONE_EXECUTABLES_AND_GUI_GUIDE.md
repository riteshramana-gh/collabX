# CollabBoard X — Standalone Executables & Desktop GUI Deployment Guide

**Guide Version:** 2.0  
**Target Platform:** Windows 10/11 (x64) & Linux (x86_64)  
**Binary Location:** `dist/CollabBoardX-Server.exe` and `dist/CollabBoardX-Client.exe`

---

## 1. Executive Summary

CollabBoard X provides a zero-dependency, dual-binary distribution designed for isolated local-area networks (LANs), university computer networks laboratories, and corporate meeting rooms without internet access:

1. **`CollabBoardX-Server.exe` (Central LAN Dedicated Server):**
   - High-throughput asynchronous server bundling **FastAPI + Uvicorn**, an **authoritative sequential state engine**, an **explicit BSD TCP socket engine** (port 9001), **SQLite WAL storage**, and the compiled **React 18 production bundle**.
   - Serves hundreds of simultaneous rooms and clients across the LAN at `http://<SERVER_IP>:8000`.

2. **`CollabBoardX-Client.exe` (Desktop GUI Client):**
   - Modern dark-themed graphical launcher (Tkinter/Native GUI) that auto-discovers local network parameters, tests real-time latency to the Central Server with an interactive Ping button, and connects users into whiteboard rooms with a single click.

---

## 2. Architecture & Flow of Controls

```
                               +-------------------------------------------------------+
                               |                 Central Server Machine                |
                               |                                                       |
                               |        .\dist\CollabBoardX-Server.exe --port 8000     |
                               |   - FastAPI WebSockets (Port 8000)                    |
                               |   - Raw BSD TCP Server (Port 9001, CN Lab Req)        |
                               |   - Authoritative Serialized SQLite WAL Database      |
                               |   - Auto-Discovered LAN IP (e.g. 192.168.1.37)        |
                               +-------------------------------------------------------+
                                                          |
                                      +-------------------+-------------------+
                                      | LAN (TCP / WS)    | LAN (TCP / WS)    |
                                      v                   v                   v
+-----------------------------------+ +-----------------------------------+ +-----------------------------------+
|     Client PC 1 (Room Host)       | |      Client PC 2 (Participant)     | |    Mobile Tablet / iPad / Phone   |
|                                   | |                                   | |                                   |
|   .\dist\CollabBoardX-Client.exe  | |   .\dist\CollabBoardX-Client.exe  | |   Any Modern Mobile Web Browser   |
|   - Native Desktop GUI Launcher   | |   - Native Desktop GUI Launcher   | |   - Point Camera at QR Code       |
|   - Real-time Server Ping (4ms)   | |   - Real-time Server Ping (5ms)   | |   - Touch & Stylus drawing        |
|   - Role: HOST (Admin)            | |   - Role: EDITOR / VIEWER         | |   - WebRTC Voice Mesh             |
|   - Master Board Access Lock      | |   - "Share Pointer" Request       | |   - No App Store download needed  |
|   - Mute Participants / Mute All  | |   - Air-Gapped Voice Audio        | |                                   |
|   - Approved Pointer Sharing      | |   - Note-Synchronized Recording   | |                                   |
+-----------------------------------+ +-----------------------------------+ +-----------------------------------+
```

---

## 3. End-to-End User Flow

### Step 1: Starting the Central LAN Server
On the machine designated as the central host, launch the server binary:
```powershell
.\dist\CollabBoardX-Server.exe --port 8000 --tcp-port 9001
```
The server will:
- Discover the local machine's LAN IP (e.g., `192.168.1.37`).
- Initialize SQLite WAL persistence.
- Bind WebSockets to `0.0.0.0:8000` and raw TCP sockets to `0.0.0.0:9001`.
- Display a colored ASCII banner with join links.

### Step 2: Connecting with Desktop GUI Clients
On any collaborator laptop or workstation across the same LAN, launch the client binary:
```powershell
.\dist\CollabBoardX-Client.exe
```
The native dark-mode GUI window will open:
1. **Server IP Input:** Enter the Central Server LAN address (e.g., `192.168.1.37:8000`).
2. **Ping Latency Check:** Click **Ping Server** to test connection health and measure round-trip milliseconds (e.g., `🟢 Connected (3ms)`).
3. **Display Name:** Enter your name or alias.
4. **Create or Join:** Click **"Create New Whiteboard"** (makes you the Room Host) or enter a Room Code to join an ongoing session.

### Step 3: Mobile & Tablet QR Code Access
To bring an iPad, Android tablet, or mobile phone into the session:
1. On the PC client, click the **`Share & QR`** button in the top navigation bar.
2. An on-screen modal renders a live vector QR code embedding `http://<SERVER_IP>:8000/?room=<ROOM_ID>`.
3. Scan with any phone/tablet camera—no native app installation or app store required.

---

## 4. Host Permissions & Moderation Controls

CollabBoard X enforces server-authoritative administrative controls through a dedicated **Meeting & Controls** workstation tab:

### 1. Master Board Access Locking (Freeze Mode)
- **Host Action:** The Host clicks **`[ 🔒 Board Access: Disabled ]`** in the header or in the Meeting tab.
- **Enforcement:** Non-host participants immediately enter Read-Only mode. Non-host toolbars vanish, an access banner appears, and dragging switches to viewport panning. The server's `RoomActor` rejects any non-host mutation requests with `BOARD_ACCESS_DISABLED`.

### 2. Participant Role Matrix (`HOST`, `EDITOR`, `VIEWER`)
- **`HOST`**: Full administrative powers (lock room, mute users, kick participants, export/restore state snapshots, approve pointer sharing).
- **`EDITOR`**: Active whiteboard contributor (can draw, write notes, use stickers, add pages, and chat).
- **`VIEWER`**: Read-only spectator. Cannot modify board elements.

### 3. Clutter-Free Presentation & Host-Moderated Pointer Sharing
- In sessions with 10+ participants, drawing areas quickly become chaotic if all pointers are shown.
- **Host Cursor (`👑 Host`):** Always broadcast and identified by a golden crown badge.
- **Viewer Suppression:** Users in `VIEWER` mode never broadcast pointers; existing cursors are instantly purged.
- **Participant Pointer Request:** Non-host editors have a **`[Share Pointer]`** button in the top bar. Clicking it dispatches a request to the Host.
- **Interactive Approval Pill:** The Host sees a pill in the top header:
  $$\text{“User wants to show cursor: [Allow] [Deny]”}$$
  Approving the request enables cursor broadcasting for that user.

### 4. Remote Voice Muting
- Host can click the microphone icon next to any participant in the Meeting tab to mute them individually (`HOST_MUTE_USER`).
- Host can click **`[ Mute All ]`** to silence all participants in the voice room simultaneously.

---

## 5. Air-Gapped WebRTC Voice Mesh

The voice subsystem delivers low-latency group voice communication over isolated local networks:
- **No External STUN/TURN Dependencies:** Uses empty `iceServers: []` configuration, forcing the browser WebRTC stack to gather local LAN host candidates (`typ host`).
- **Full Mesh Topology:** Suitable for classroom and seminar groups up to 15 concurrent speakers.
- **Opus Codec:** 48 kHz wideband audio with Web Audio Voice Activity Detection (VAD).

---

## 6. Packaging & Cross-Platform Compilation

### Building Windows Standalone Executables
Ensure Python 3.11+ and Node.js 18+ are installed on the build machine:
```powershell
# 1. Automated one-step build:
py -3.13 package_executable.py all

# Or run the batch script:
.\build_windows_exe.bat
```
This script:
1. Compiles the React + TypeScript frontend into `frontend/dist/`.
2. Packages `server_host.py` with all backend modules, SQLite, and static assets into `dist/CollabBoardX-Server.exe`.
3. Packages `client_gui.py` with Tkinter assets into `dist/CollabBoardX-Client.exe`.

### Building Linux Standalone Executables
CollabBoard X is 100% cross-platform compatible. On any Linux distribution (Ubuntu, Debian, Fedora, Arch):
```bash
# 1. Install system prerequisites
sudo apt-get update && sudo apt-get install -y python3-pip python3-tk nodejs npm

# 2. Build frontend
npm --prefix frontend install
npm --prefix frontend run build

# 3. Install Python dependencies
pip3 install -r backend/requirements.txt pyinstaller

# 4. Compile Linux standalone binaries
python3 package_executable.py all
```
The resulting ELF executables `dist/CollabBoardX-Server` and `dist/CollabBoardX-Client` run natively on any standard Linux environment.

---

## 7. Troubleshooting & LAN Firewall Configuration

| Problem | Cause | Solution |
|---|---|---|
| Client GUI says "Connection Refused" | Windows Firewall blocking inbound port 8000 | Run on Server machine: `netsh advfirewall firewall add rule name="CollabBoardX" dir=in action=allow protocol=TCP localport=8000,9001` |
| Ping latency shows `Timeout` | Wrong LAN IP entered in GUI client | Check server console output for the detected LAN IP address (e.g. `192.168.1.37`) |
| WebRTC Voice does not connect | Browser blocking mic permissions over plain HTTP | Access via `localhost` on host PC or enable "Insecure origins treated as secure" in `chrome://flags` for `http://<SERVER_IP>:8000` |
| Cursor not visible to others | User is in `VIEWER` mode or cursor share is unapproved | Host must approve cursor share via header pill or set participant role to `EDITOR` |

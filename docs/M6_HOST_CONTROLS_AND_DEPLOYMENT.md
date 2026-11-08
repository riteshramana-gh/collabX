# Milestone 6: Host Controls, Access Governance, Dedicated GUI & Standalone Binaries

## Architecture Overview

Milestone 6 delivers authoritative room governance, master board access locking, participant role matrix controls, dedicated workstation tabs, and dual-mode standalone executable packaging.

```
+-----------------------------------------------------------------------------------------+
|                                Dual Deployment Architecture                             |
|                                                                                         |
|       Mode A: Central Dedicated LAN Server         Mode B: Desktop GUI Client           |
|       ------------------------------------         --------------------------           |
|       • CollabBoardX-Server.exe                    • CollabBoardX-Client.exe            |
|       • FastAPI + Raw BSD TCP 9001 + SQLite WAL    • Native Dark-Themed Launcher        |
|       • Embedded React 18 production build         • Real-time server latency ping      |
|       • Serves hundreds of simultaneous rooms      • Automatic local LAN IP detection   |
|       • Zero-internet UDP IP discovery             • One-click browser session launch   |
|                                                                                         |
|                   ================================================                      |
|                   |  Identical Python Backend & React Frontend   |                      |
|                   ================================================                      |
|                                                                                         |
|       Host Administration & Access Governance:                                          |
|       - Master Board Access Lock (one-click freeze for all non-hosts)                   |
|       - Role Matrix: HOST (Admin), EDITOR (Can Draw), VIEWER (Read Only)                |
|       - Remote Muting: Mute individual participants or 1-click "Mute All"               |
|       - Pointer Sharing Moderation: Approve/deny participant cursor broadcasts          |
|       - Participant Kicking (force-disconnect with policy violation code)               |
|       - Full Snapshot Export (.json file download)                                      |
|       - Full Snapshot Restoration (state replacement & authoritative broadcast)         |
|       - Graphical QR Code Modal & Instant LAN Share Link Copy                           |
+-----------------------------------------------------------------------------------------+
```

## Key Files Implemented & Enhanced

| File Path | Description |
|---|---|
| `backend/app/engine/room_actor.py` | Authoritative operation worker enforcing `is_board_locked` and `role == "VIEWER"` rejection |
| `backend/app/modules/host_control/module.py` | `HostControlModule` implementing board locking, role switching, muting, kicking, export and restore |
| `frontend/src/features/meeting/components/MeetingControlsTab.tsx` | Dedicated full-page meeting governance workstation tab with participant matrix and master board lock banner |
| `frontend/src/features/canvas/components/ShareRoomModal.tsx` | Graphical QR code popup modal with instant clipboard copy buttons |
| `server_host.py` / `CollabBoardX-Server.spec` | Central LAN Server runner and PyInstaller spec bundling FastAPI + TCP + SQLite + frontend assets |
| `client_gui.py` / `CollabBoardX-Client.spec` | Standalone native Tkinter GUI client launcher with real-time ping and dark mode styling |
| `package_executable.py` / `build_windows_exe.bat` | Automated one-step build script producing standalone Windows binaries in `dist/` |

---

## Technical Implementations

### 1. Master Board Access Governance
- **Global Freeze (`HOST_LOCK_ROOM`):** The Room Host can lock the entire room canvas from the top header or the Meeting & Controls tab.
- **Server Enforcement:** The server-authoritative `RoomActor` intercepts mutation requests and immediately rejects non-host operations with `BOARD_ACCESS_DISABLED`.
- **Client Read-Only Transition:** When locked, non-host clients see a prominent banner (`"🔒 BOARD ACCESS DISABLED BY HOST"`), the floating toolbar is hidden, and pointer dragging transitions safely into viewport panning.

### 2. Participant Role Matrix
- **`HOST`**: Full administrative privileges: master board lock, role changes, muting participants, snapshot export/restore, and pointer approval.
- **`EDITOR`**: Standard collaborator with drawing, note-taking, and chat privileges.
- **`VIEWER`**: Read-only collaborator. Cannot draw, and cursor coordinates are never broadcast to the room.

### 3. Remote Muting & Moderation
- **Targeted Mute:** Host can mute any individual noisy participant with a single click (`HOST_MUTE_USER`).
- **Mute All:** Host can mute all participants simultaneously.
- **Air-Gapped WebRTC Voice Mesh:** Operates strictly peer-to-peer over LAN (`iceServers: []`) without external STUN/TURN servers.

### 4. Standalone Binaries & Native GUI Launcher
- **`dist/CollabBoardX-Server.exe` (32.2 MB):** Standalone zero-dependency executable running the Central Server.
- **`dist/CollabBoardX-Client.exe` (9.9 MB):** Native graphical desktop launcher:
  - Input field for Central Server IP address.
  - Live latency ping indicator (`[ Ping Server ]` $\to$ `🟢 Connected (4ms)`).
  - Quick buttons to "Create New Whiteboard" or "Join Existing Whiteboard".
  - One-click launch into the default browser or embedded window.

---

## Verification & Tests

- `backend/tests/test_host_controls.py`: Automated tests validating room lock broadcasting, client kicking and disconnect handling, role switching to `VIEWER`, mutation rejection during board lock, snapshot JSON export formatting, and snapshot restoration into authoritative state.
- Standalone executables verified via CLI `--help` flags.
- Full backend suite (24 tests) passing.
- Frontend build passing.

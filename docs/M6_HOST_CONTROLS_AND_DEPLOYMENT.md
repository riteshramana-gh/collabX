# Milestone 6: Host Controls, Snapshots & Standalone Launcher

## Architecture Overview

Milestone 6 delivers room administration, state portability, and dual-mode deployment packaging.

```
+-----------------------------------------------------------------------------------------+
|                                Dual Deployment Architecture                             |
|                                                                                         |
|       Mode A: Central Dedicated LAN Server         Mode B: Standalone Host Fallback     |
|       ------------------------------------         --------------------------------     |
|       • Dedicated machine / Docker / systemd       • Individual peer hosts on ad-hoc PC |
|       • Serves hundreds of simultaneous rooms      • standalone_host.py launcher        |
|       • Central SQLite database                    • Zero-internet UDP LAN IP detection |
|                                                    • Colored ASCII terminal QR code     |
|                                                    • Shareable board links              |
|                                                                                         |
|                   ================================================                      |
|                   |  Identical Python Backend & React Frontend   |                      |
|                   ================================================                      |
|                                                                                         |
|       Host Administration & State Portability:                                          |
|       - Room Locking (prevent new participant joins)                                    |
|       - Participant Kicking (force-disconnect with policy violation code)               |
|       - Full Snapshot Export (.json file download)                                      |
|       - Full Snapshot Restoration (state replacement & authoritative broadcast)         |
+-----------------------------------------------------------------------------------------+
```

## Key Files Implemented

| File Path | Description |
|---|---|
| `backend/app/launcher/lan_detector.py` | Zero-internet LAN IP discovery using local UDP routing probe |
| `backend/app/launcher/qr_generator.py` | Terminal ASCII QR code generator for instant mobile/tablet connection |
| `backend/app/launcher/host_cli.py` | Standalone CLI host runner with colored ASCII connection banner |
| `standalone_host.py` | Root one-click entrypoint for host fallback deployment |
| `backend/app/modules/host_control/module.py` | `HostControlModule` implementing lock, kick, snapshot export and restore |
| `frontend/src/features/host/components/HostPanel.tsx` | Host control modal with room locking, JSON snapshot download, and upload |

## Verification & Tests

- `backend/tests/test_host_controls.py`: Automated tests validating room lock broadcasting, client kicking and disconnect handling, snapshot JSON export formatting, and snapshot restoration into authoritative state.
- Standalone host tested via `py standalone_host.py`.
- Full backend suite (23 tests) passing.
- Frontend build passing.

# Milestone 5: WebRTC Opus LAN Voice Communication

## Architecture Overview

Milestone 5 implements peer-to-peer browser-based voice communication engineered for strict local area networks.

```
+-----------------------------------------------------------------------------------------+
|                                    WebRTC LAN Audio Mesh                                |
|                                                                                         |
|       [ Browser Peer A ]                                    [ Browser Peer B ]          |
|       - RTCPeerConnection                                   - RTCPeerConnection         |
|         (iceServers: [])                                      (iceServers: [])          |
|       - Web Audio VAD                                       - Web Audio VAD             |
|              |                                                     |                    |
|              |  (1. SDP Offer & Host ICE Candidates)               |                    |
|              v                                                     v                    |
|       +-------------------------------------------------------------------+             |
|       |                 FastAPI VoiceSignalingModule Gateway              |             |
|       |                     (Routes signaling envelopes)                  |             |
|       +-------------------------------------------------------------------+             |
|              |                                                     |                    |
|              +--------------------------+--------------------------+                    |
|                                         |                                               |
|                      (2. Direct LAN Peer-to-Peer UDP Stream)                            |
|                 =================================================                       |
|                 |          Direct Opus Audio Stream (48 kHz)    |                       |
|                 =================================================                       |
+-----------------------------------------------------------------------------------------+
```

## Key Files Implemented

| File Path | Description |
|---|---|
| `backend/app/modules/voice/module.py` | `VoiceSignalingModule` handling targeted offer, answer, and ICE forwarding |
| `frontend/src/features/voice/rtc/WebRTCVoiceMesh.ts` | P2P audio mesh manager with air-gapped `iceServers: []`, VAD, mute, and deafen |
| `frontend/src/features/voice/components/VoiceControls.tsx` | Glassmorphic voice control pill with mute toggle, deafen toggle, and speaking glow |
| `frontend/src/pages/WhiteboardRoomPage.tsx` | Voice mesh integration and lifecycle hook |

## Key Technical Decisions
1. **Zero External Internet Reliance**: Operates with `iceServers: []`. Browsers gather local host candidates directly (`typ host` with LAN IPs `192.168.x.x` or `10.x.x.x`).
2. **Deterministic Offer-Glare Prevention**: Offer initiation ordered by session ID comparison avoids simultaneous offer collisions.
3. **Web Audio VAD**: Built-in `AudioContext` and `AnalyserNode` measure energy levels in real-time, sending `VOICE_STATE_UPDATE` to show speaking glow without sending silent audio packets.

## Verification & Tests

- `backend/tests/test_voice_signaling.py`: Automated routing tests validating that SDP Offers, Answers, and ICE candidates are forwarded strictly to the targeted session, while state broadcasts reach all room members.
- Full backend suite (22 tests) passing.
- Frontend build passing.

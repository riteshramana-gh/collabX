# CollabBoard X — Application Protocol Specification

**Specification Version:** 1.0  
**Transports:** WebSocket (RFC 6455) & Length-Prefixed Raw TCP (Port 9001)

---

## 1. Frame Envelope Structure

All messages conform to the `MessageEnvelope` structure:

```json
{
  "protocol_version": "1.0",
  "message_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "room_id": "math-101",
  "sender_id": "user-48a2",
  "type": "CANVAS_OP_REQ",
  "client_seq": 14,
  "server_seq": null,
  "timestamp": 1794025000000,
  "payload": {}
}
```

### Fields
| Field | Type | Description |
|---|---|---|
| `protocol_version` | String | Fixed `"1.0"` |
| `message_id` | String | Unique UUIDv4 generated per transmission |
| `room_id` | String | Target room identifier |
| `sender_id` | String | Active session identifier |
| `type` | String | Protocol event type |
| `client_seq` | Integer / Null | Monotonically increasing client-side request counter |
| `server_seq` | Integer / Null | Authoritative monotonic per-room sequence number assigned by server |
| `timestamp` | Integer | Epoch millisecond timestamp |
| `payload` | Object | Event-specific data dictionary |

---

## 2. Event Catalog

### Room & Session Lifecycle
- `ROOM_JOIN_REQ`: `{ display_name: string, room_id: string }`
- `ROOM_JOIN_ACK`: `{ session_id: string, room_id: string, display_name: string, role: string }`
- `ROOM_SNAPSHOT`: `{ room_id: string, elements_count: number, elements: Record<string, CanvasElement> }`
- `PRESENCE_JOINED`: `{ session_id: string, display_name: string, role: string }`
- `PRESENCE_LEFT`: `{ session_id: string, reason: string }`
- `PING_REQ` / `PONG_RES`: Latency and keepalive telemetry

### Canvas Operations
- `CANVAS_OP_REQ`: Client mutation request containing `CanvasOperation`
- `CANVAS_OP_ACK`: `{ client_op_id: string, status: "ACCEPTED" | "DUPLICATE", server_seq: number }`
- `CANVAS_OP_BROADCAST`: Authoritative server broadcast dispatched to all room participants
- `CANVAS_OP_REJECT`: `{ error: string, reason: string }`

### Sequence Gap Recovery
- `ROOM_REPLAY_REQ`: `{ from_seq: number, to_seq: number }`
- `ROOM_REPLAY_RES`: `{ from_seq: number, to_seq: number, operations: CanvasOperationRecord[] }`

### Ephemeral Presence & Chat
- `PRESENCE_CURSOR`: `{ x: number, y: number, color: string, active_tool: string }`
- `PRESENCE_UPDATE`: Peer cursor update broadcast (sender excluded)
- `CHAT_MSG_SEND`: `{ content: string, sender_name: string }`
- `CHAT_MSG_BROADCAST`: `{ id: string, room_id: string, server_seq: number, sender_id: string, sender_name: string, content: string, timestamp: number }`
- `CHAT_HISTORY_REQ` / `CHAT_HISTORY_RES`: Request recent room chat history

### WebRTC Voice Mesh Signaling
- `VOICE_SIGNAL_OFFER`: `{ target_session_id: string, sdp: RTCSessionDescriptionInit }`
- `VOICE_SIGNAL_ANSWER`: `{ target_session_id: string, sdp: RTCSessionDescriptionInit }`
- `VOICE_SIGNAL_ICE`: `{ target_session_id: string, candidate: RTCIceCandidateInit }`
- `VOICE_STATE_UPDATE` / `VOICE_STATE_BROADCAST`: `{ is_muted: boolean, is_deafened: boolean, is_speaking: boolean }`

### Host Administration
- `HOST_LOCK_ROOM`: `{ is_locked: boolean }`
- `HOST_ROOM_LOCKED`: Broadcast of lock status
- `HOST_KICK_USER`: `{ target_session_id: string, reason: string }`
- `HOST_USER_KICKED`: Disconnect notice to target user
- `HOST_EXPORT_SNAPSHOT`: Request full room state JSON
- `HOST_SNAPSHOT_EXPORTED`: Downloadable JSON bundle
- `HOST_RESTORE_SNAPSHOT`: `{ snapshot: Object }`

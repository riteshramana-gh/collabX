# CollabBoard X — Application Protocol Specification

**Specification Version:** 2.0  
**Transports:** WebSocket (RFC 6455) & Length-Prefixed Raw TCP (Port 9001)  
**Encoding:** JSON with 4-byte big-endian length prefix (`>I`) over Raw TCP; UTF-8 Text Frames over WebSockets.

---

## 1. Frame Envelope Structure

All messages conform to the authoritative `MessageEnvelope` structure:

```json
{
  "protocol_version": "2.0",
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

### Envelope Fields
| Field | Type | Description |
|---|---|---|
| `protocol_version` | String | Fixed `"2.0"` (backward compatible with `"1.0"`) |
| `message_id` | String | Unique UUIDv4 generated per transmission |
| `room_id` | String | Target room identifier |
| `sender_id` | String | Active session identifier |
| `type` | String | Protocol event type |
| `client_seq` | Integer / Null | Monotonically increasing client-side request counter |
| `server_seq` | Integer / Null | Authoritative monotonic per-room sequence number assigned by server |
| `timestamp` | Integer | Epoch millisecond timestamp |
| `payload` | Object | Event-specific data dictionary |

---

## 2. Data Models

### 2.1 `CanvasElement` Schema
Represents any persistent visual or semantic object drawn on a whiteboard notebook page.

```typescript
type ElementType =
  | 'PENCIL'
  | 'HIGHLIGHTER'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'LINE'
  | 'ARROW'
  | 'DOUBLE_ARROW'
  | 'TRIANGLE'
  | 'POLYGON'
  | 'STAR'
  | 'TEXT'
  | 'IMAGE'
  | 'STICKER';

type PenStyle = 'ballpoint' | 'fountain' | 'brush';

interface CanvasElement {
  id: string;
  page_id: string;                    // Associated notebook page ID (default: "page-1")
  type: ElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  stroke_color?: string;
  fill_color?: string;
  stroke_width?: number;
  opacity?: number;                   // Highlighters default to 0.38
  pen_style?: PenStyle;               // For PENCIL: "ballpoint", "fountain", or "brush"
  points?: [number, number][];        // Trajectory points for pens, lines, polylines
  text?: string;                      // Content for TEXT and STICKER elements
  font_size?: number;
  font_family?: string;
  font_weight?: string;
  font_style?: string;
  text_align?: 'left' | 'center' | 'right';
  rotation?: number;                  // Rotation angle in degrees
  is_locked?: boolean;                // Prevent moving, resizing, or erasing
  image_src?: string;                 // Base64 or URL data for IMAGE elements
  sticker_type?: string;              // Semantic category for STICKER elements
  polygon_sides?: number;             // For regular polygons
  z_index: number;                    // Layering order
  version: number;                    // Monotonic element mutation version
  created_by: string;                 // User ID of author
  last_modified_by: string;           // User ID of last modifier
  last_modified_at: number;           // Epoch millisecond timestamp
}
```

### 2.2 `NotebookPage` Schema
Represents a page within a room's multi-page notebook.

```typescript
type PageTemplate = 'BLANK' | 'RULED' | 'GRID' | 'DOTTED' | 'PDF';

interface NotebookPage {
  id: string;                         // e.g. "page-1", "page-2"
  index: number;                      // 0-indexed page position
  title: string;                      // Display title (e.g. "Lecture Notes")
  template: PageTemplate;             // Paper background pattern
  background_color: string;           // Hex color (default: "#ffffff")
  pdf_background_url?: string;        // Rendered PDF page background image
  is_bookmarked?: boolean;            // Fast navigation bookmark
}
```

### 2.3 `CanvasOperation` Schema
The atomic unit of state mutation processed by the authoritative `RoomActor`.

```typescript
type CanvasOperationType =
  | 'ADD'
  | 'UPDATE'
  | 'TRANSFORM'
  | 'DELETE'
  | 'CLEAR'
  | 'PAGE_CREATE'
  | 'PAGE_DELETE'
  | 'PAGE_UPDATE'
  | 'LOCK_ELEMENT'
  | 'UNLOCK_ELEMENT';

interface CanvasOperation {
  client_op_id: string;               // Client UUID used for deduplication
  op_type: CanvasOperationType;
  element?: CanvasElement;            // Required for ADD
  element_id?: string;               // Required for UPDATE, TRANSFORM, DELETE, LOCK
  patch?: Partial<CanvasElement>;     // Required for UPDATE, TRANSFORM
  page?: NotebookPage;                // Required for PAGE_CREATE, PAGE_UPDATE
}
```

---

## 3. Event Catalog

### Room & Session Lifecycle
- **`ROOM_JOIN_REQ`**: Request to join a room.
  - Payload: `{ display_name: string, room_id: string }`
- **`ROOM_JOIN_ACK`**: Join approval.
  - Payload: `{ session_id: string, room_id: string, display_name: string, role: string }`
- **`ROOM_SNAPSHOT`**: Authoritative initial room state sent upon joining.
  - Payload: `{ room_id: string, elements_count: number, elements: Record<string, CanvasElement>, pages: Record<string, NotebookPage>, current_seq: number }`
- **`PRESENCE_JOINED`**: Broadcast when a new participant connects.
  - Payload: `{ session_id: string, display_name: string, role: string }`
- **`PRESENCE_LEFT`**: Broadcast when a participant leaves.
  - Payload: `{ session_id: string, reason: string }`
- **`PING_REQ` / `PONG_RES`**: Keepalive and round-trip latency telemetry.

### Canvas & Notebook Operations
- **`CANVAS_OP_REQ`**: Client-originated mutation request.
  - Payload: `CanvasOperation`
- **`CANVAS_OP_ACK`**: Direct server acknowledgement to originating client.
  - Payload: `{ client_op_id: string, status: "ACCEPTED" | "DUPLICATE", server_seq: number }`
- **`CANVAS_OP_BROADCAST`**: Authoritative state broadcast dispatched to all room participants.
  - Payload: `{ op_type: string, client_op_id: string, server_seq: number, element?: CanvasElement, element_id?: string, patch?: object, page?: NotebookPage }`
- **`CANVAS_OP_REJECT`**: Sent when an operation fails validation or touches a locked element.
  - Payload: `{ error: string, reason: string }`

### Sequence Gap Recovery
- **`ROOM_REPLAY_REQ`**: Sent by client when an incoming `server_seq` has a gap from the expected sequence number.
  - Payload: `{ from_seq: number, to_seq: number }`
- **`ROOM_REPLAY_RES`**: Server returns missing operations retrieved from SQLite WAL logs.
  - Payload: `{ from_seq: number, to_seq: number, operations: CanvasOperationRecord[] }`

### Ephemeral Presence & Presentation
- **`PRESENCE_CURSOR`**: Client mouse/pointer telemetry (throttled at ~40ms).
  - Payload: `{ x: number, y: number, color: string, active_tool: string, laser_active?: boolean }`
- **`PRESENCE_UPDATE`**: Broadcast of peer cursor positions to other participants.
  - Payload: `{ session_id: string, display_name: string, x: number, y: number, color: string, active_tool: string }`

### Real-Time Text Chat
- **`CHAT_MSG_SEND`**: Client sends chat message.
  - Payload: `{ content: string, sender_name: string }`
- **`CHAT_MSG_BROADCAST`**: Server broadcasts message to all participants.
  - Payload: `{ id: string, room_id: string, server_seq: number, sender_id: string, sender_name: string, content: string, timestamp: number }`
- **`CHAT_HISTORY_REQ` / `CHAT_HISTORY_RES`**: Request recent chat message history from room database.

### WebRTC LAN Voice Mesh Signaling
- **`VOICE_SIGNAL_OFFER`**: P2P SDP Offer routing.
  - Payload: `{ target_session_id: string, sdp: RTCSessionDescriptionInit }`
- **`VOICE_SIGNAL_ANSWER`**: P2P SDP Answer routing.
  - Payload: `{ target_session_id: string, sdp: RTCSessionDescriptionInit }`
- **`VOICE_SIGNAL_ICE`**: P2P ICE candidate routing over LAN.
  - Payload: `{ target_session_id: string, candidate: RTCIceCandidateInit }`
- **`VOICE_STATE_UPDATE` / `VOICE_STATE_BROADCAST`**: Speaking / Mute / Deafen telemetry.
  - Payload: `{ is_muted: boolean, is_deafened: boolean, is_speaking: boolean }`

### Host Administration Controls
- **`HOST_LOCK_ROOM` / `HOST_ROOM_LOCKED`**: Restricts editing permissions.
  - Payload: `{ is_locked: boolean }`
- **`HOST_KICK_USER` / `HOST_USER_KICKED`**: Ejects specified session from room.
  - Payload: `{ target_session_id: string, reason: string }`
- **`HOST_EXPORT_SNAPSHOT` / `HOST_SNAPSHOT_EXPORTED`**: Export room snapshot JSON bundle.
- **`HOST_RESTORE_SNAPSHOT`**: Restore room state from uploaded JSON bundle.

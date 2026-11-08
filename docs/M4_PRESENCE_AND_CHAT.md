# Milestone 4: Ephemeral Presence, Host-Moderated Cursors & Real-Time Chat

## Architecture Overview

Milestone 4 implements live participant presence, high-frequency cursor tracking with server-authoritative moderation, pixel-exact canvas coordinate translation, and real-time room chat.

```
                    [ Client A (Editor) ]                     [ Host Client ]
                              |                                      |
       (CURSOR_PERMISSION_REQ)|                                      |
                              v                                      |
                      +---------------+                              |
                      |  FastAPI / WS |                              |
                      +-------+-------+                              |
                              | (CURSOR_PERMISSION_NOTIFICATION)     |
                              +------------------------------------->|
                                                                     | (CURSOR_PERMISSION_DECISION)
                              +--------------------------------------+
                              |
       (CURSOR_PERMISSIONS_UPD)v
                      +---------------+                      +---------------+
                      |   Client A    |                      |   Client B    |
                      +-------+-------+                      +-------+-------+
                              | (PRESENCE_CURSOR)                    ^
                              v                                      | (PRESENCE_UPDATE)
                      +---------------+                              |
                      |  PresenceMod  | -----------------------------+
                      | (Moderated &  | (Only Host + Approved Cursors;
                      |  throttled)   |  Viewers never broadcast)
                      +---------------+
```

## Key Files Implemented & Enhanced

| File Path | Description |
|---|---|
| `backend/app/storage/repositories/chat_repo.py` | `SQLiteChatRepository` for appending and retrieving room chat history |
| `backend/app/modules/chat/module.py` | `ChatFeatureModule` handling `CHAT_MSG_SEND` and `CHAT_HISTORY_REQ` |
| `backend/app/modules/presence/module.py` | `PresenceFeatureModule` handling `PRESENCE_CURSOR`, `CURSOR_PERMISSION_REQ`, and `CURSOR_PERMISSION_DECISION` |
| `frontend/src/features/presence/components/CursorOverlay.tsx` | Viewport overlay rendering animated remote cursors with user name tags and Host crown (`👑 Host`) |
| `frontend/src/features/chat/components/ChatTab.tsx` | Dedicated full-page chat workstation tab with timestamps, sender bubbles, and unread badges |
| `frontend/src/features/canvas/components/CanvasView.tsx` | Double-buffered 60FPS canvas with pixel-exact coordinate mapping (`clientX - rect.left`) |

---

## Technical Implementations

### 1. Pixel-Exact Coordinate Alignment (Zero Drift / Lag Fix)
Previously, drawing on the 10th row resulted in markings appearing at the 20th row because `screenToWorld(e.clientX, e.clientY)` used raw browser viewport coordinates. The 52px top navigation header offset the canvas on the screen, causing a constant downward displacement that worsened during zooming.

**Resolution in `CanvasView.tsx`:**
```typescript
const rect = canvas.getBoundingClientRect();
const canvasX = (e.clientX - rect.left) * (canvas.width / rect.width);
const canvasY = (e.clientY - rect.top) * (canvas.height / rect.height);
return {
  x: (canvasX - panX) / zoom,
  y: (canvasY - panY) / zoom,
};
```
Now, cursor-to-ink alignment is pixel-exact regardless of window size, toolbar layout, or canvas magnification.

### 2. Clutter-Free Multi-User Canvas Policy (10+ Participants)
In large collaborative sessions, broadcasting all 10+ participants' cursors simultaneously creates severe visual clutter.
- **Host Pointer by Default:** The Room Host's cursor (`👑 Host`) is always broadcast and visible to all participants.
- **Viewer Cursor Suppression:** Participants in `VIEWER` mode never broadcast cursor packets. If demoted to `VIEWER`, the server dispatches `PRESENCE_CURSOR_REMOVE` and all peer clients immediately purge their cursor.
- **Participant Pointer Request:** Non-host editors have a `[Share Pointer]` button in the top header. Clicking it sends `CURSOR_PERMISSION_REQ` to the Host.
- **Host Real-Time Moderation Pill:** The Host receives an interactive header pill:
  $$\text{“User wants to show cursor: [Allow] [Deny]”}$$
  Host approvals dispatch `CURSOR_PERMISSION_DECISION` and broadcast `CURSOR_PERMISSIONS_UPDATE`.

### 3. Dedicated Chat Workstation Tab
Rather than an obstructive overlay, Chat is housed in its own dedicated workstation tab (`💬 Chat`) with:
- Message timestamps and auto-scrolling to newest entries.
- Color-coded sender bubbles and participant avatars.
- Unread notification badges on the top header bar (e.g. `💬 Chat (3)`).

---

## Verification & Tests

- `backend/tests/test_chat_presence.py`: Automated multi-client test verifying message broadcast, SQLite persistence, history recovery, cursor broadcast with sender exclusion, viewer suppression, and host-moderated pointer permissions.
- Full backend suite (24 tests) passing.
- Frontend build passing with zero errors.

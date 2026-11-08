# Milestone 4: Ephemeral Presence & Real-Time Chat

## Architecture Overview

Milestone 4 implements live participant presence, high-frequency cursor tracking, and real-time room chat.

```
                    [ Client A ]                          [ Client B ]
                         |                                     |
       (PRESENCE_CURSOR) |                   (PRESENCE_UPDATE) |
                         v                                     v
                 +---------------+                     +---------------+
                 |  FastAPI / WS |                     |  FastAPI / WS |
                 +-------+-------+                     +-------+-------+
                         |                                     ^
                         +------------+   +--------------------+
                                      |   |
                                      v   |
                           +------------------------+
                           | PresenceFeatureModule  |
                           | (Ephemeral coordinates |
                           |  sender-excluded bcast)|
                           +------------------------+

                                      ---

                         |                                     ^
                         | (CHAT_MSG_SEND)                     | (CHAT_MSG_BROADCAST)
                         v                                     |
                           +------------------------+          |
                           |   ChatFeatureModule    | ---------+
                           | - Sequential SQLite    |
                           | - Chat history replay  |
                           +------------------------+
```

## Key Files Implemented

| File Path | Description |
|---|---|
| `backend/app/storage/repositories/chat_repo.py` | `SQLiteChatRepository` for appending and retrieving room chat history |
| `backend/app/modules/chat/module.py` | `ChatFeatureModule` handling `CHAT_MSG_SEND` and `CHAT_HISTORY_REQ` |
| `backend/app/modules/presence/module.py` | `PresenceFeatureModule` handling `PRESENCE_CURSOR` and `PRESENCE_ROSTER_REQ` |
| `frontend/src/features/presence/components/CursorOverlay.tsx` | Viewport overlay rendering animated remote cursors with user name tags |
| `frontend/src/features/chat/components/ChatBox.tsx` | Real-time chat drawer with unread counter, timestamps, and auto-scroll |
| `frontend/src/features/presence/components/ParticipantList.tsx` | Active room roster dropdown indicating Host vs Participant roles |

## Verification & Tests

- `backend/tests/test_chat_presence.py`: Automated multi-client test verifying message broadcast, SQLite persistence, history recovery, cursor broadcast with sender exclusion, and roster query.
- Full backend suite (21 tests) passing.
- Frontend build passing with zero errors (`dist/assets/index-DKR5hyL8.js`).

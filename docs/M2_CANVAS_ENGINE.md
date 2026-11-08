# Milestone 2: Room Actor & Authoritative Canvas Engine

## Architecture Overview

Milestone 2 implements the stateful, authoritative collaboration engine of CollabBoard X, extended with multi-page notebook state, cascading page deletion, and element-level object locking.

```
                              +----------------------------+
                              |    Client Mutation Request |
                              |       (CANVAS_OP_REQ)      |
                              +--------------+-------------+
                                             |
                                             v
                              +----------------------------+
                              |       EventRegistry        |
                              +--------------+-------------+
                                             |
                                             v
                              +----------------------------+
                              |   RoomActor Ingestion Queue|
                              |   (asyncio.Queue Serializer|
                              +--------------+-------------+
                                             |
                     +-----------------------+-----------------------+
                     |                                               |
                     v                                               v
        [ Deduplication Check ]                          [ Assign Monotonic Seq ]
        (Matches client_op_id in                         (server_seq = seq + 1)
         sliding window)                                             |
                     |                                               v
          +----------+----------+                        [ Apply to Authoritative State ]
          |                     |                        - ADD, UPDATE, TRANSFORM, DEL
      (Duplicate)           (Valid Op)                   - PAGE_CREATE, PAGE_DELETE
          |                     |                        - LOCK_ELEMENT, UNLOCK_ELEMENT
          v                     |                                    |
    Send Duplicate ACK          |                        +-----------+-----------+
    without seq bump            |                        |                       |
                                |                        v                       v
                                |              [ SQLite WAL Persistence ]  [ Periodic Snapshot ]
                                |              (append_operation)         (save_snapshot)
                                |                        |                       |
                                +------------------------+-----------------------+
                                                         |
                                                         v
                                           +----------------------------+
                                           |  Dispatched Outputs:       |
                                           |  1. CANVAS_OP_ACK (Author) |
                                           |  2. CANVAS_OP_BROADCAST    |
                                           |     (All Room Members)     |
                                           +----------------------------+
```

## Key Files Implemented

| File Path | Description |
|---|---|
| `backend/app/modules/base.py` | `FeatureModule` abstract base class defining lifecycle and event bindings |
| `backend/app/modules/registry.py` | `ModuleRegistry` with topological dependency ordering and reverse shutdown |
| `backend/app/storage/database.py` | SQLite manager with WAL mode (`PRAGMA journal_mode=WAL;`), FKs, and schemas |
| `backend/app/storage/repositories/base.py` | `ICanvasRepository` abstraction |
| `backend/app/storage/repositories/canvas_repo.py` | `SQLiteCanvasRepository` implementing atomic operation logs and snapshots |
| `backend/app/modules/canvas/models.py` | Pydantic v2 schemas: `CanvasElement`, `ElementType` (PENCIL, HIGHLIGHTER, SHAPES, TEXT, IMAGE, STICKER), `NotebookPage`, `PageTemplate`, `CanvasOperation` |
| `backend/app/modules/canvas/authoritative_state.py` | Authoritative in-memory canvas model enforcing LWW mutation semantics, multi-page notebook management, object locking protection, and cascading page deletions |
| `backend/app/engine/room_actor.py` | Per-room serialized actor: monotonic sequencing, deduplication, gap replay |
| `backend/app/engine/room_manager.py` | Room actor registry and lifecycle factory |
| `backend/app/modules/canvas/module.py` | `CanvasFeatureModule` wiring all components to `EventRegistry` |

## Verification & Automated Tests

All tests passed:
- `backend/tests/test_canvas_engine.py`: Unit tests for ADD, UPDATE, TRANSFORM, DELETE, and CLEAR mutations, plus multi-page notebook page creation, locked element mutation rejection, and cascading page deletion.
- `backend/tests/test_room_actor.py`: Concurrency test with 30 concurrent operations, verifying strict monotonic sequence ordering (`seq = 1..30`), deduplication rejection (`status: DUPLICATE`), and historical gap replay (`ROOM_REPLAY_REQ`).
- `backend/tests/test_canvas_module_integration.py`: End-to-end multi-client room join, snapshot reception, drawing operation broadcasting, and acknowledgements.

# Milestone 1: Core Networking & Transport Gateway

## Architecture Overview

Milestone 1 delivers the foundational dual-interface transport layer and event routing pipeline for CollabBoard X.

```
                           +---------------------------+
                           |     Client Applications   |
                           +-------------+-------------+
                                         |
                 +-----------------------+-----------------------+
                 | (WebSocket over TCP)                          | (Raw TCP Sockets)
                 v                                               v
     +-----------------------+                       +-----------------------+
     |   FastAPI WebSocket   |                       |   Raw TCP Socket      |
     |   Endpoint (:8000)    |                       |   Server (:9001)      |
     +-----------+-----------+                       +-----------+-----------+
                 |                                               |
                 | (Text JSON)                                   | (Length-Prefixed Bytes)
                 v                                               v
     +-----------------------+                       +-----------------------+
     |   WebSocketSession    |                       |   StreamFramer +      |
     |                       |                       |   RawTCPSession       |
     +-----------+-----------+                       +-----------+-----------+
                 |                                               |
                 +-----------------------+-----------------------+
                                         |
                                         v
                           +---------------------------+
                           |  MessageEnvelope & Codec  |
                           +-------------+-------------+
                                         |
                                         v
                           +---------------------------+
                           |  ConnectionManager &      |
                           |  EventRegistry Dispatcher |
                           +---------------------------+
```

## Key Files Implemented

| File Path | Description |
|---|---|
| `backend/app/core/config.py` | Pydantic v2 Settings for LAN bindings, timeouts, frame sizes, and ports |
| `backend/app/core/logging.py` | Structured timestamped console logging |
| `backend/app/core/exceptions.py` | Domain-specific exception hierarchy (`FramingError`, `ProtocolError`, etc.) |
| `backend/app/core/context.py` | `ApplicationContext` dependency injection container |
| `backend/app/core/lifecycle.py` | Server startup, raw socket spawning, and heartbeat loop |
| `backend/app/transport/framing.py` | 4-byte big-endian length prefix framer and stream buffer |
| `backend/app/transport/envelope.py` | `MessageEnvelope` schema and `EnvelopeCodec` serializer |
| `backend/app/transport/session.py` | Unified `ClientSession` with `WebSocketSession` and `RawTCPSession` |
| `backend/app/transport/connection_manager.py` | Multi-transport session registry and room broadcast manager |
| `backend/app/transport/raw_tcp_server.py` | Explicit socket server for Computer Networks lab compliance |
| `backend/app/transport/websocket_gateway.py` | FastAPI WebSocket route handler for web clients |
| `backend/app/engine/event_bus.py` | Asynchronous event registry with filter pipeline and error isolation |
| `backend/app/main.py` | Application root, CORS configuration, and health endpoints |
| `tools/lab_tcp_client.py` | CLI raw TCP socket demonstration client |

## Computer Networks Laboratory Verification

The raw TCP socket listener implements:
- Direct socket binding using `asyncio.start_server`.
- Binary stream framing with format: `[4-byte big-endian unsigned int (N)] + [N bytes UTF-8 payload]`.
- Proper streaming buffer handling that tolerates partial reads, segmented frames, and multi-frame bursts.
- Demonstration via `python tools/lab_tcp_client.py` using standard BSD sockets (`socket.socket`).

## Test Suite Execution

All 15 automated unit and integration tests passed:
- `backend/tests/test_framing.py` (5 tests)
- `backend/tests/test_envelope.py` (4 tests)
- `backend/tests/test_event_bus.py` (3 tests)
- `backend/tests/test_raw_tcp_socket.py` (1 test)
- `backend/tests/test_websocket_gateway.py` (1 test)
- `backend/tests/test_cross_protocol_broadcast.py` (1 test)

# Milestone 3: Frontend Foundation & Collaborative Whiteboard

## Architecture Overview

Milestone 3 implements the React 18 + TypeScript + Vite frontend client for CollabBoard X.

```
+-----------------------------------------------------------------------------------------+
|                                    React 18 Frontend                                    |
|                                                                                         |
|  +--------------------+        +---------------------+        +----------------------+  |
|  | ConnectionManager  | <----> |     CanvasStore     | <----> |  ToolRegistry &      |  |
|  | - WS Lifecycle     |        | - Authoritative map |        |  RendererRegistry    |  |
|  | - Sequence tracking|        | - Optimistic queue  |        | - Select, Pencil,    |  |
|  | - Gap auto-replay  |        | - Undo / Redo       |        |   Rect, Ellipse,     |  |
|  | - Exponential retry|        | - Viewport transform|        |   Line, Arrow, Text  |  |
|  +---------+----------+        +----------+----------+        +-----------+----------+  |
|            |                              |                               |             |
|            v                              v                               v             |
|  +--------------------+        +-----------------------------------------------------+  |
|  |  WebSocket Gateway |        |        60 FPS Double-Buffered CanvasView            |  |
|  |     (Backend)      |        |        (High-DPI Retina Infinite Canvas)            |  |
|  +--------------------+        +-----------------------------------------------------+  |
+-----------------------------------------------------------------------------------------+
```

## Key Files Implemented

| File Path | Description |
|---|---|
| `frontend/src/types/protocol.ts` | Complete TypeScript protocol definitions matching backend schemas |
| `frontend/src/core/network/EnvelopeCodec.ts` | Envelope encoder/decoder and message builder |
| `frontend/src/core/network/ConnectionManager.ts` | WebSocket client, reconnect backoff, sequence gap detection, and replay |
| `frontend/src/features/canvas/registry/ToolRegistry.ts` | Dynamic plug-in registry for canvas drawing tools |
| `frontend/src/features/canvas/registry/RendererRegistry.ts` | Dynamic plug-in registry for 2D element renderers |
| `frontend/src/features/canvas/renderers/builtinRenderers.ts` | Renderers for Pencil, Rectangle, Ellipse, Line, Arrow, and Text |
| `frontend/src/features/canvas/tools/builtinTools.ts` | Interactive tools for Select/Move, Pencil, Rectangle, Ellipse, Line, Arrow, Text |
| `frontend/src/features/canvas/state/CanvasStore.ts` | Reactive whiteboard store, optimistic updates, undo/redo, pan/zoom |
| `frontend/src/features/canvas/components/CanvasView.tsx` | Double-buffered 60FPS canvas loop, mouse wheel zoom, pointer events |
| `frontend/src/features/canvas/components/CanvasToolbar.tsx` | Floating glassmorphism toolbar with color swatches, sizes, and tools |
| `frontend/src/pages/DashboardPage.tsx` | Board creation, room code joining, and LAN server health monitor |
| `frontend/src/pages/WhiteboardRoomPage.tsx` | Integrated whiteboard room page with live connection status and participant counter |

## Verification

- `tsc && vite build`: Completed with zero TypeScript errors or warnings.
- Production bundle generated at `frontend/dist/`.
- Pre-built frontend mounted and statically served directly by FastAPI at `/`.

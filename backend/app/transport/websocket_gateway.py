"""WebSocket Gateway router for browser-based clients."""

import asyncio
import logging
import uuid
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.transport.session import WebSocketSession
from app.transport.envelope import EnvelopeCodec
from app.core.exceptions import ProtocolError
from app.core.context import get_app_context

logger = logging.getLogger("collabboard.transport.websocket")

router = APIRouter(tags=["transport"])


@router.websocket("/ws/connect")
@router.websocket("/ws/rooms/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: Optional[str] = None,
    client_id: Optional[str] = Query(default=None),
) -> None:
    """Primary WebSocket connection endpoint for browser clients."""
    await websocket.accept()

    context = get_app_context()
    client_host = websocket.client.host if websocket.client else "unknown"
    client_port = websocket.client.port if websocket.client else 0
    remote_address = f"{client_host}:{client_port}"

    session_id = client_id if client_id else f"ws-{uuid.uuid4().hex[:12]}"
    session = WebSocketSession(
        session_id=session_id,
        websocket=websocket,
        remote_address=remote_address,
    )

    if room_id:
        session.room_id = room_id

    await context.connection_manager.register_session(session)

    logger.info(f"[WebSocket] Connected: {session_id} from {remote_address} (Room: {room_id})")

    try:
        while session.is_active:
            data = await websocket.receive_text()
            try:
                envelope = EnvelopeCodec.decode_str(data)
                session.update_heartbeat()
                # If room_id wasn't in envelope but was in route, populate it
                if not envelope.room_id and room_id:
                    envelope.room_id = room_id

                # Enforce room ban check if user was kicked
                host_mod = context.modules.get("host_control")
                if host_mod and room_id and host_mod.is_user_banned(room_id, session):
                    logger.warning(f"[WebSocket] Ejecting banned user {session_id} from room {room_id}")
                    try:
                        await session.send_envelope(
                            MessageEnvelope(
                                room_id=room_id,
                                sender_id="server",
                                type="HOST_USER_KICKED",
                                payload={"reason": "You have been removed from this room by the host."},
                            )
                        )
                    except Exception:
                        pass
                    await session.close(code=1008, reason="Removed by host")
                    break

                # Dispatch envelope to registered handlers
                asyncio.create_task(context.event_bus.dispatch(session, envelope))
            except ProtocolError as e:
                logger.warning(f"[WebSocket] Protocol error from {session_id}: {e.message}")
            except Exception as e:
                logger.error(f"[WebSocket] Error processing message from {session_id}: {e}", exc_info=True)

    except WebSocketDisconnect:
        logger.info(f"[WebSocket] Disconnected: {session_id}")
    except Exception as e:
        logger.error(f"[WebSocket] Unexpected error in session {session_id}: {e}", exc_info=True)
    finally:
        await context.connection_manager.unregister_session(session_id)
        await session.close()

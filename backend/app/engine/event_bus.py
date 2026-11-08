"""Event registry and asynchronous event dispatcher."""

import asyncio
import logging
from typing import Awaitable, Callable, Dict, List, Optional
from app.transport.session import ClientSession
from app.transport.envelope import MessageEnvelope
from app.core.exceptions import CollabBoardException

logger = logging.getLogger("collabboard.engine.event_bus")

# Type definitions
EventHandler = Callable[[ClientSession, MessageEnvelope], Awaitable[None]]
EventFilter = Callable[[ClientSession, MessageEnvelope], Awaitable[bool]]


class EventRegistry:
    """Central registry and asynchronous dispatcher for all application-level events."""

    def __init__(self):
        self._handlers: Dict[str, List[EventHandler]] = {}
        self._filters: List[EventFilter] = []

    def register(self, event_type: str, handler: EventHandler) -> None:
        """Binds a handler function to a specific event type."""
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
        logger.debug(f"Registered event handler for '{event_type}': {handler.__name__}")

    def add_filter(self, filter_fn: EventFilter) -> None:
        """Adds a pre-dispatch filter (middleware) that can inspect or reject events."""
        self._filters.append(filter_fn)

    async def dispatch(self, session: ClientSession, envelope: MessageEnvelope) -> bool:
        """Dispatches an envelope through filters to registered event handlers.
        
        Returns True if at least one handler processed the event, False otherwise.
        """
        # Execute pre-dispatch filter pipeline
        for f in self._filters:
            try:
                allowed = await f(session, envelope)
                if not allowed:
                    logger.warning(
                        f"Event '{envelope.type}' rejected by filter for session {session.session_id}"
                    )
                    return False
            except Exception as e:
                logger.error(f"Error executing filter on event '{envelope.type}': {e}", exc_info=True)
                return False

        handlers = self._handlers.get(envelope.type, [])
        if not handlers:
            logger.warning(
                f"No handler registered for event type '{envelope.type}' from session {session.session_id}"
            )
            # Notify sender of unknown event type
            await session.send_envelope(
                MessageEnvelope(
                    room_id=envelope.room_id,
                    sender_id="server",
                    type="ERROR_RESPONSE",
                    client_seq=envelope.client_seq,
                    payload={
                        "error": "UNKNOWN_EVENT_TYPE",
                        "message": f"No handler registered for event type '{envelope.type}'",
                        "original_event_id": envelope.message_id,
                    },
                )
            )
            return False

        # Execute all handlers registered for this event type
        for handler in handlers:
            try:
                await handler(session, envelope)
            except CollabBoardException as e:
                logger.warning(f"Domain error in handler for '{envelope.type}': {e.message}")
                await session.send_envelope(
                    MessageEnvelope(
                        room_id=envelope.room_id,
                        sender_id="server",
                        type="ERROR_RESPONSE",
                        client_seq=envelope.client_seq,
                        payload=e.to_dict(),
                    )
                )
            except Exception as e:
                logger.error(
                    f"Unhandled error in handler {handler.__name__} for event '{envelope.type}': {e}",
                    exc_info=True,
                )
                await session.send_envelope(
                    MessageEnvelope(
                        room_id=envelope.room_id,
                        sender_id="server",
                        type="ERROR_RESPONSE",
                        client_seq=envelope.client_seq,
                        payload={
                            "error": "INTERNAL_SERVER_ERROR",
                            "message": str(e),
                            "event_type": envelope.type,
                        },
                    )
                )

        return True

    def get_registered_event_types(self) -> List[str]:
        """Returns a list of all currently registered event types."""
        return list(self._handlers.keys())

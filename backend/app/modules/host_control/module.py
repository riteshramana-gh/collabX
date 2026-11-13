"""Host control module for room administration, user moderation, and snapshot management."""

import json
import logging
import time
from typing import List
from app.modules.base import FeatureModule
from app.core.context import ApplicationContext
from app.engine.event_bus import EventRegistry
from app.core.exceptions import AuthorizationError
from app.transport.envelope import MessageEnvelope
from app.transport.session import ClientSession

logger = logging.getLogger("collabboard.modules.host")


class HostControlModule(FeatureModule):
    """Provides host administrative capabilities: room locking, kicking, and snapshot export/restore."""

    @property
    def name(self) -> str:
        return "host_control"

    @property
    def dependencies(self) -> List[str]:
        return ["canvas"]

    async def initialize(self, context: ApplicationContext) -> None:
        self.context = context
        self.locked_rooms = set()
        self.banned_users: Dict[str, Set[str]] = {}
        logger.info("HostControlModule initialized")

    def register_events(self, registry: EventRegistry) -> None:
        registry.register("HOST_LOCK_ROOM", self.handle_lock_room)
        registry.register("HOST_KICK_USER", self.handle_kick_user)
        registry.register("HOST_MUTE_USER", self.handle_mute_user)
        registry.register("HOST_SET_USER_ROLE", self.handle_set_user_role)
        registry.register("HOST_EXPORT_SNAPSHOT", self.handle_export_snapshot)
        registry.register("HOST_RESTORE_SNAPSHOT", self.handle_restore_snapshot)

    async def handle_mute_user(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Allows room host to mute a specific participant or mute all participants."""
        room_id = envelope.room_id
        if session.role != "HOST":
            logger.warning(f"User {session.session_id} attempted to mute participants without HOST permissions")
            return

        target_session_id = envelope.payload.get("target_session_id")
        if target_session_id == "all":
            logger.info(f"Host {session.display_name} muted all participants in room {room_id}")
            await self.context.connection_manager.broadcast_to_room(
                room_id,
                MessageEnvelope(
                    room_id=room_id,
                    sender_id="server",
                    type="HOST_MUTED_BY_ADMIN",
                    payload={"target_session_id": "all", "muted_by": session.display_name},
                ),
            )
        elif target_session_id:
            target_session = await self.context.connection_manager.get_session(target_session_id)
            if target_session and target_session.room_id == room_id:
                logger.info(f"Host {session.display_name} muted participant {target_session.display_name}")
                await target_session.send_envelope(
                    MessageEnvelope(
                        room_id=room_id,
                        sender_id="server",
                        type="HOST_MUTED_BY_ADMIN",
                        payload={"target_session_id": target_session_id, "muted_by": session.display_name},
                    )
                )

    async def handle_set_user_role(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Sets participant permission role (EDITOR vs VIEWER). Only the HOST can change roles."""
        room_id = envelope.room_id
        if session.role != "HOST":
            logger.warning(f"User {session.session_id} attempted to set roles without HOST permissions")
            return

        target_session_id = envelope.payload.get("target_session_id")
        new_role = envelope.payload.get("role", "EDITOR").upper()
        if new_role not in ("EDITOR", "VIEWER"):
            new_role = "EDITOR"

        if not target_session_id:
            return

        target_session = await self.context.connection_manager.get_session(target_session_id)
        if target_session and target_session.room_id == room_id:
            target_session.role = new_role
            logger.info(f"Host {session.display_name} set {target_session.display_name} role to {new_role}")

            # Notify the target user
            await target_session.send_envelope(
                MessageEnvelope(
                    room_id=room_id,
                    sender_id="server",
                    type="HOST_ROLE_UPDATED",
                    payload={"role": new_role, "updated_by": session.display_name},
                )
            )

            # Broadcast updated role to all room participants
            await self.context.connection_manager.broadcast_to_room(
                room_id,
                MessageEnvelope(
                    room_id=room_id,
                    sender_id="server",
                    type="PRESENCE_ROLE_CHANGED",
                    payload={
                        "session_id": target_session_id,
                        "display_name": target_session.display_name,
                        "role": new_role,
                    },
                ),
            )

            # If user became VIEWER, remove their cursor from all peers
            if new_role == "VIEWER":
                await self.context.connection_manager.broadcast_to_room(
                    room_id,
                    MessageEnvelope(
                        room_id=room_id,
                        sender_id="server",
                        type="PRESENCE_CURSOR_REMOVE",
                        payload={"session_id": target_session_id},
                    ),
                )

    async def handle_lock_room(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Locks or unlocks board editing access for the room."""
        room_id = envelope.room_id
        if session.role != "HOST":
            logger.warning(f"User {session.session_id} attempted to lock room without HOST permissions")
            return

        lock_state = bool(envelope.payload.get("is_locked", True))
        room_actor = await self.context.room_manager.get_room(room_id)
        if room_actor:
            room_actor.is_board_locked = lock_state

        if lock_state:
            self.locked_rooms.add(room_id)
        else:
            self.locked_rooms.discard(room_id)

        # Broadcast lock status to all members in the room
        broadcast_env = MessageEnvelope(
            room_id=room_id,
            sender_id="server",
            type="HOST_ROOM_LOCKED",
            payload={"is_locked": lock_state, "locked_by": session.display_name},
        )
        await self.context.connection_manager.broadcast_to_room(room_id, broadcast_env)

    async def handle_kick_user(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Kicks a participant from the room."""
        room_id = envelope.room_id
        if session.role != "HOST":
            logger.warning(f"User {session.session_id} attempted to kick user without HOST permissions")
            return

        target_session_id = envelope.payload.get("target_session_id")
        reason = envelope.payload.get("reason", "Kicked by room host")

        if not target_session_id:
            return

        target_session = await self.context.connection_manager.get_session(target_session_id)
        if target_session and target_session.room_id == room_id:
            # Record banned identity to prevent immediate re-joining
            if room_id not in self.banned_users:
                self.banned_users[room_id] = set()
            self.banned_users[room_id].add(target_session_id)
            if target_session.display_name:
                self.banned_users[room_id].add(target_session.display_name.strip().lower())
            client_ip = getattr(target_session, "client_ip", None)
            if client_ip:
                self.banned_users[room_id].add(client_ip)

            # Send notification to kicked user
            try:
                await target_session.send_envelope(
                    MessageEnvelope(
                        room_id=room_id,
                        sender_id="server",
                        type="HOST_USER_KICKED",
                        payload={"reason": reason},
                    )
                )
            except Exception:
                pass

            # Remove from room and terminate connection
            await self.context.connection_manager.leave_room(target_session_id, room_id)
            await target_session.close(code=1008, reason=reason)

            # Broadcast to remaining members
            await self.context.connection_manager.broadcast_to_room(
                room_id,
                MessageEnvelope(
                    room_id=room_id,
                    sender_id="server",
                    type="PRESENCE_LEFT",
                    payload={"session_id": target_session_id, "reason": "KICKED"},
                ),
            )

    def is_user_banned(self, room_id: str, session: ClientSession) -> bool:
        """Checks if a user is currently banned/kicked from the given room."""
        banned = self.banned_users.get(room_id, set())
        if not banned:
            return False
        if session.session_id in banned:
            return True
        if session.display_name and session.display_name.strip().lower() in banned:
            return True
        client_ip = getattr(session, "client_ip", None)
        if client_ip and client_ip in banned:
            return True
        return False

    async def handle_export_snapshot(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Exports the complete canvas state, metadata, and history into a downloadable JSON payload."""
        room_id = envelope.room_id
        if session.role != "HOST":
            logger.warning(f"User {session.session_id} attempted to export snapshot without HOST permissions")
            return

        room_actor = await self.context.room_manager.get_room(room_id)
        if not room_actor:
            return

        canvas_snapshot = room_actor.canvas_state.get_snapshot()
        export_bundle = {
            "version": "1.0",
            "app": "CollabBoard X",
            "room_id": room_id,
            "exported_at": int(time.time() * 1000),
            "sequence_number": room_actor.current_seq,
            "elements": canvas_snapshot.get("elements", {}),
        }

        await session.send_envelope(
            MessageEnvelope(
                room_id=room_id,
                sender_id="server",
                type="HOST_SNAPSHOT_EXPORTED",
                client_seq=envelope.client_seq,
                payload={"snapshot": export_bundle},
            )
        )

<<<<<<< HEAD
    def _get_owner_info(self, session: ClientSession) -> tuple:
        username = getattr(session, "authenticated_username", None) or (session.display_name or "").strip() or "Anonymous"
        ip = getattr(session, "client_ip", None) or "127.0.0.1"
        owner_key = username.lower()
        return owner_key, username, ip

    async def handle_save_version(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Saves current room state as a named notebook version with 3-notebook limit per user/ip (Host-only)."""
        room_id = envelope.room_id
        if getattr(session, "role", "EDITOR") != "HOST":
            await session.send_envelope(
                MessageEnvelope(
                    room_id=room_id,
                    sender_id="server",
                    type="NOTEBOOK_VERSION_SAVE_RES",
                    client_seq=envelope.client_seq,
                    payload={"success": False, "error": "PERMISSION_DENIED", "message": "Only the room host can save whiteboard notebook versions."},
                )
            )
            return

        room_actor = await self.context.room_manager.get_room(room_id)
        if not room_actor:
            return

        canvas_repo = self.context.repositories["canvas_repo"]
        owner_key, owner_username, owner_ip = self._get_owner_info(session)

        replace_version_id = envelope.payload.get("replace_version_id")
        current_count = await canvas_repo.count_saved_versions_for_owner(owner_key)

        MAX_LIMIT = 3
        if current_count >= MAX_LIMIT and not replace_version_id:
            existing_versions = await canvas_repo.get_saved_versions_for_owner(owner_key)
            await session.send_envelope(
                MessageEnvelope(
                    room_id=room_id,
                    sender_id="server",
                    type="NOTEBOOK_VERSION_SAVE_RES",
                    client_seq=envelope.client_seq,
                    payload={
                        "success": False,
                        "error": "LIMIT_REACHED",
                        "message": f"Notebook limit reached (maximum {MAX_LIMIT} notebooks allowed for '{owner_username}'). Delete an existing notebook version or select one to overwrite.",
                        "current_count": current_count,
                        "max_allowed": MAX_LIMIT,
                        "versions": existing_versions,
                    },
                )
            )
            return

        version_id = replace_version_id or f"ver-{uuid.uuid4().hex[:8]}"
        version_name = (envelope.payload.get("version_name") or "").strip() or f"Version {current_count + 1} ({time.strftime('%b %d, %H:%M')})"

        canvas_snapshot = room_actor.canvas_state.get_snapshot()
        elements = canvas_snapshot.get("elements", {})
        pages = canvas_snapshot.get("pages", {})

        saved_record = await canvas_repo.save_notebook_version(
            version_id=version_id,
            owner_key=owner_key,
            owner_username=owner_username,
            owner_ip=owner_ip,
            room_id=room_id,
            version_name=version_name,
            sequence_number=room_actor.current_seq,
            elements_count=len(elements),
            pages_count=len(pages),
            state=canvas_snapshot,
        )

        all_versions = await canvas_repo.get_saved_versions_for_owner(owner_key)
        await session.send_envelope(
            MessageEnvelope(
                room_id=room_id,
                sender_id="server",
                type="NOTEBOOK_VERSION_SAVE_RES",
                client_seq=envelope.client_seq,
                payload={
                    "success": True,
                    "version": saved_record,
                    "versions": all_versions,
                    "current_count": len(all_versions),
                    "max_allowed": MAX_LIMIT,
                },
            )
        )

    async def handle_list_versions(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Returns all saved notebook versions for the requesting user/ip."""
        room_id = envelope.room_id
        canvas_repo = self.context.repositories["canvas_repo"]
        owner_key, owner_username, _ = self._get_owner_info(session)

        versions = await canvas_repo.get_saved_versions_for_owner(owner_key)
        await session.send_envelope(
            MessageEnvelope(
                room_id=room_id,
                sender_id="server",
                type="NOTEBOOK_VERSION_LIST_RES",
                client_seq=envelope.client_seq,
                payload={
                    "versions": versions,
                    "current_count": len(versions),
                    "max_allowed": 3,
                    "owner_username": owner_username,
                },
            )
        )

    async def handle_restore_version(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Restores a saved notebook version to the active whiteboard room (Host-only)."""
        room_id = envelope.room_id
        if getattr(session, "role", "EDITOR") != "HOST":
            await session.send_envelope(
                MessageEnvelope(
                    room_id=room_id,
                    sender_id="server",
                    type="NOTEBOOK_VERSION_RESTORE_RES",
                    client_seq=envelope.client_seq,
                    payload={"success": False, "error": "PERMISSION_DENIED", "message": "Only the room host can restore notebook versions."},
                )
            )
            return

        version_id = envelope.payload.get("version_id")
        if not version_id:
            return

        canvas_repo = self.context.repositories["canvas_repo"]
        saved_version = await canvas_repo.get_saved_version_by_id(version_id)
        if not saved_version:
            await session.send_envelope(
                MessageEnvelope(
                    room_id=room_id,
                    sender_id="server",
                    type="NOTEBOOK_VERSION_RESTORE_RES",
                    client_seq=envelope.client_seq,
                    payload={"success": False, "error": "NOT_FOUND", "message": "Saved version not found."},
                )
            )
            return

        room_actor = await self.context.room_manager.get_or_create_room(room_id)
        snapshot_state = saved_version["state"]

        # Restore in-memory state
        room_actor.canvas_state.restore_snapshot(snapshot_state)
        room_actor.current_seq += 1
        new_seq = room_actor.current_seq

        # Save to SQLite WAL snapshots
        await canvas_repo.save_snapshot(
            room_id, new_seq, room_actor.canvas_state.get_snapshot()
        )
        await canvas_repo.update_room_seq(room_id, new_seq)

        # Broadcast restored snapshot to all participants in room
        snapshot_env = await room_actor.get_initial_snapshot_envelope()
        await self.context.connection_manager.broadcast_to_room(room_id, snapshot_env)

        # Broadcast version restored announcement
        await self.context.connection_manager.broadcast_to_room(
            room_id,
            MessageEnvelope(
                room_id=room_id,
                sender_id="server",
                type="NOTEBOOK_VERSION_RESTORED_NOTIFICATION",
                payload={
                    "version_id": version_id,
                    "version_name": saved_version["version_name"],
                    "restored_by": session.display_name or "Host",
                },
            ),
        )

        await session.send_envelope(
            MessageEnvelope(
                room_id=room_id,
                sender_id="server",
                type="NOTEBOOK_VERSION_RESTORE_RES",
                client_seq=envelope.client_seq,
                payload={
                    "success": True,
                    "version_id": version_id,
                    "version_name": saved_version["version_name"],
                },
            )
        )

    async def handle_delete_version(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Deletes a saved notebook version (Host-only)."""
        room_id = envelope.room_id
        if getattr(session, "role", "EDITOR") != "HOST":
            await session.send_envelope(
                MessageEnvelope(
                    room_id=room_id,
                    sender_id="server",
                    type="NOTEBOOK_VERSION_DELETE_RES",
                    client_seq=envelope.client_seq,
                    payload={"success": False, "error": "PERMISSION_DENIED", "message": "Only the room host can delete notebook versions."},
                )
            )
            return

        version_id = envelope.payload.get("version_id")
        if not version_id:
            return

        canvas_repo = self.context.repositories["canvas_repo"]
        owner_key, _, _ = self._get_owner_info(session)

        # Only allow deleting own version or host deleting
        deleted = await canvas_repo.delete_saved_version(version_id, owner_key if session.role != "HOST" else None)
        remaining = await canvas_repo.get_saved_versions_for_owner(owner_key)

        await session.send_envelope(
            MessageEnvelope(
                room_id=room_id,
                sender_id="server",
                type="NOTEBOOK_VERSION_DELETE_RES",
                client_seq=envelope.client_seq,
                payload={
                    "success": deleted,
                    "version_id": version_id,
                    "versions": remaining,
                    "current_count": len(remaining),
                    "max_allowed": 3,
                },
            )
        )

=======
>>>>>>> parent of bdcdf02 (UNDO/REDO VERSION HISTORY ADDED)
    async def handle_restore_snapshot(self, session: ClientSession, envelope: MessageEnvelope) -> None:
        """Restores canvas state from an imported snapshot bundle."""
        room_id = envelope.room_id
        if session.role != "HOST":
            logger.warning(f"User {session.session_id} attempted to restore snapshot without HOST permissions")
            return

        snapshot_data = envelope.payload.get("snapshot", {})
        if not snapshot_data or "elements" not in snapshot_data:
            return

        room_actor = await self.context.room_manager.get_or_create_room(room_id)

        # Restore in-memory state
        room_actor.canvas_state.restore_snapshot(snapshot_data)
        room_actor.current_seq += 1
        new_seq = room_actor.current_seq

        # Save to database
        await self.context.repositories["canvas_repo"].save_snapshot(
            room_id, new_seq, room_actor.canvas_state.get_snapshot()
        )
        await self.context.repositories["canvas_repo"].update_room_seq(room_id, new_seq)

        # Broadcast restored snapshot to all participants
        snapshot_env = await room_actor.get_initial_snapshot_envelope()
        await self.context.connection_manager.broadcast_to_room(room_id, snapshot_env)

    async def shutdown(self) -> None:
        logger.info("HostControlModule shutdown cleanly")

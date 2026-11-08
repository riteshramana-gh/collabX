"""Custom exception hierarchy for CollabBoard X."""

from typing import Optional, Dict, Any


class CollabBoardException(Exception):
    """Base exception for all domain-specific errors."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error": self.__class__.__name__,
            "message": self.message,
            "details": self.details,
        }


class FramingError(CollabBoardException):
    """Raised when incoming byte stream fails length-prefixed framing checks."""
    pass


class ProtocolError(CollabBoardException):
    """Raised when a message envelope is malformed or invalid."""
    pass


class AuthenticationError(CollabBoardException):
    """Raised when authentication credentials or token are invalid."""
    pass


class AuthorizationError(CollabBoardException):
    """Raised when a participant performs an action forbidden by their role."""
    pass


class RoomNotFoundError(CollabBoardException):
    """Raised when the specified room ID does not exist."""
    pass


class RoomLockedError(CollabBoardException):
    """Raised when attempting to join a locked room."""
    pass


class SequenceGapError(CollabBoardException):
    """Raised when a client detects a sequence number gap requiring replay."""
    pass


class DuplicateOperationError(CollabBoardException):
    """Raised when an operation with an already processed client_op_id is received."""
    pass

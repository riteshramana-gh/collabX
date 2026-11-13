"""FastAPI REST router for user registration, authentication, and session introspection."""

import logging
from typing import Optional
from fastapi import APIRouter, Header, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from app.core.context import get_app_context

logger = logging.getLogger("collabboard.transport.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=50)
    password: str = Field(..., min_length=3, max_length=128)
    display_name: Optional[str] = Field(None, max_length=60)


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=128)


@router.post("/register")
async def register(req: RegisterRequest) -> JSONResponse:
    """Registers a new user account with unique username enforcement."""
    context = get_app_context()
    auth_repo = context.repositories.get("auth_repo")
    if not auth_repo:
        return JSONResponse(
            status_code=503,
            content={"success": False, "error": "SERVICE_UNAVAILABLE", "message": "Auth repository not ready"},
        )

    res = await auth_repo.register_user(
        username=req.username,
        password=req.password,
        display_name=req.display_name,
    )
    if not res.get("success"):
        status_code = 409 if res.get("error") == "USERNAME_TAKEN" else 400
        return JSONResponse(status_code=status_code, content=res)

    return JSONResponse(status_code=200, content=res)


@router.post("/login")
async def login(req: LoginRequest) -> JSONResponse:
    """Authenticates an existing user and returns a session token."""
    context = get_app_context()
    auth_repo = context.repositories.get("auth_repo")
    if not auth_repo:
        return JSONResponse(
            status_code=503,
            content={"success": False, "error": "SERVICE_UNAVAILABLE", "message": "Auth repository not ready"},
        )

    res = await auth_repo.login_user(
        username=req.username,
        password=req.password,
    )
    if not res.get("success"):
        return JSONResponse(status_code=401, content=res)

    return JSONResponse(status_code=200, content=res)


@router.get("/me")
async def get_current_user(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
) -> JSONResponse:
    """Validates session token and returns active user identity."""
    context = get_app_context()
    auth_repo = context.repositories.get("auth_repo")
    if not auth_repo:
        return JSONResponse(status_code=200, content={"authenticated": False})

    token_str = token
    if not token_str and authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token_str = parts[1]
        elif len(parts) == 1:
            token_str = parts[0]

    if not token_str:
        return JSONResponse(status_code=200, content={"authenticated": False})

    user = await auth_repo.get_user_by_token(token_str)
    if not user:
        return JSONResponse(status_code=200, content={"authenticated": False})

    return JSONResponse(
        status_code=200,
        content={
            "authenticated": True,
            "username": user["username"],
            "display_name": user["display_name"],
            "created_at": user["created_at"],
        },
    )

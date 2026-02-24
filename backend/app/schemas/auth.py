"""Pydantic schemas for authentication and user info."""

from pydantic import BaseModel
from typing import Optional


class UserInfoResponse(BaseModel):
    uid: str
    email: str
    role: str
    display_name: str


class UserRoleUpdateRequest(BaseModel):
    role: str  # "admin" or "user"


class UserProfileResponse(BaseModel):
    uid: str
    email: Optional[str] = None
    displayName: Optional[str] = None
    tier: str = "free"
    role: Optional[str] = "user"
    createdAt: Optional[float] = None
    updatedAt: Optional[float] = None

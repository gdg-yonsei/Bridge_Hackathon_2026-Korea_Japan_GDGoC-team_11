from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    """Response for GET /auth/me — profile fields stored by the backend."""

    id: UUID
    email: str | None = None
    nickname: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdate(BaseModel):
    """Request body for PATCH /auth/me — update app-domain fields like nickname."""

    nickname: str | None = Field(None, min_length=1, max_length=50)

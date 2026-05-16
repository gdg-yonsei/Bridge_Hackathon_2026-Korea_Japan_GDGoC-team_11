from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class UserOut(BaseModel):
    """GET /auth/me 응답 — 백엔드가 보관하는 profile 정보."""

    id: UUID
    email: str | None = None
    nickname: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdate(BaseModel):
    """PATCH /auth/me 요청 — 닉네임 등 앱 도메인 필드 변경."""

    nickname: str | None = Field(None, min_length=1, max_length=50)

"""Supabase auth.users 와 1:1 로 매핑되는 public.profiles 테이블.

Supabase 의 표준 패턴이며, auth 데이터(비번, 세션 등)는 auth.users 가 갖고,
앱 도메인 필드(닉네임 등)는 여기에 둔다. id 는 auth.users.id 와 동일한 UUID.
프로필 행은 첫 로그인 시 백엔드에서 upsert 한다.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.entity.base_entity import Base


class User(Base):
    __tablename__ = "profiles"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    email: Mapped[str | None] = mapped_column(String(255))
    nickname: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

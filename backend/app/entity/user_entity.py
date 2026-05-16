"""public.profiles table — 1:1 with Supabase auth.users.

Standard Supabase pattern: auth data (password, sessions) lives in auth.users;
app-domain fields (nickname, etc.) live here. The `id` is the same UUID as auth.users.id.
The profiles row is upserted by the backend on first login.
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

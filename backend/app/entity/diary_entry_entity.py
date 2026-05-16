from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import DiaryStatus, Emotion
from app.entity.base_entity import Base


class DiaryEntry(Base):
    __tablename__ = "diary_entries"
    __table_args__ = (UniqueConstraint("user_id", "entry_date", name="uq_user_entry_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    entry_date: Mapped[date] = mapped_column(Date, index=True)
    title: Mapped[str | None] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[DiaryStatus] = mapped_column(
        Enum(DiaryStatus, name="diary_status"), default=DiaryStatus.pending
    )

    primary_emotion: Mapped[Emotion | None] = mapped_column(Enum(Emotion, name="emotion"))
    joy_intensity: Mapped[int | None] = mapped_column(Integer)
    sad_intensity: Mapped[int | None] = mapped_column(Integer)
    anger_intensity: Mapped[int | None] = mapped_column(Integer)
    anxiety_intensity: Mapped[int | None] = mapped_column(Integer)
    calm_intensity: Mapped[int | None] = mapped_column(Integer)
    emotion_summary: Mapped[str | None] = mapped_column(Text)
    emotion_model: Mapped[str | None] = mapped_column(String(100))
    emotion_raw: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    songs: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

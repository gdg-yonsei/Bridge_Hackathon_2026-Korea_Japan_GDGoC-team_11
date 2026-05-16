from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.entity.base_entity import Base


class Emotion(StrEnum):
    joy = "joy"
    sad = "sad"
    anger = "anger"
    anxiety = "anxiety"
    calm = "calm"


class EmotionAnalysis(Base):
    __tablename__ = "emotion_analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(
        ForeignKey("diary_entries.id", ondelete="CASCADE"), unique=True
    )
    primary_emotion: Mapped[Emotion] = mapped_column(Enum(Emotion, name="emotion"))
    scores: Mapped[dict] = mapped_column(JSONB)
    summary: Mapped[str] = mapped_column(Text)
    model_name: Mapped[str | None] = mapped_column(String(100))
    raw_response: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    entry: Mapped["DiaryEntry"] = relationship(back_populates="analysis")

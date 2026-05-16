from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.entity.base_entity import Base


class DiaryStatus(StrEnum):
    pending = "pending"
    analyzing = "analyzing"
    done = "done"
    failed = "failed"


class DiaryEntry(Base):
    __tablename__ = "diary_entries"
    __table_args__ = (
        UniqueConstraint("user_id", "entry_date", name="uq_user_entry_date"),
    )

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
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    analysis: Mapped["EmotionAnalysis | None"] = relationship(
        back_populates="entry", uselist=False, cascade="all, delete-orphan"
    )
    songs: Mapped[list["SongRecommendation"]] = relationship(
        back_populates="entry",
        cascade="all, delete-orphan",
        order_by="SongRecommendation.rank",
    )

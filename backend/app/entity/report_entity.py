from __future__ import annotations

from datetime import date, datetime
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
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.entity.base_entity import Base
from app.entity.emotion_analysis_entity import Emotion


class Report(Base):
    """기간 리포트 — 사용자가 start/end 를 주면 즉시 생성.

    UNIQUE(user_id, period_start, period_end) 로 같은 기간을 다시 트리거하면
    이전 결과를 덮어쓴다 (regenerate semantics).
    """

    __tablename__ = "reports"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "period_start", "period_end", name="uq_user_report_period"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)

    dominant_emotion: Mapped[Emotion] = mapped_column(Enum(Emotion, name="emotion"))
    summary: Mapped[str] = mapped_column(Text)
    mood_chart: Mapped[dict] = mapped_column(JSONB)

    model_name: Mapped[str | None] = mapped_column(String(100))
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

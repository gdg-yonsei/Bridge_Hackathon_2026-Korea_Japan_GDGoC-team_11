from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import select

from app.core.enums import DiaryStatus, Emotion
from app.entity.diary_entry_entity import DiaryEntry
from app.repository.base_repo import BaseRepository


class DiaryRepository(BaseRepository[DiaryEntry]):
    model = DiaryEntry

    def get_by_user_and_date(self, user_id: UUID, entry_date: date) -> DiaryEntry | None:
        stmt = select(DiaryEntry).where(
            DiaryEntry.user_id == user_id,
            DiaryEntry.entry_date == entry_date,
        )
        return self.session.scalars(stmt).one_or_none()

    def list_by_month(self, user_id: UUID, year: int, month: int) -> list[DiaryEntry]:
        start = date(year, month, 1)
        end_year = year + (1 if month == 12 else 0)
        end_month = 1 if month == 12 else month + 1
        end = date(end_year, end_month, 1)

        stmt = (
            select(DiaryEntry)
            .where(
                DiaryEntry.user_id == user_id,
                DiaryEntry.entry_date >= start,
                DiaryEntry.entry_date < end,
            )
            .order_by(DiaryEntry.entry_date)
        )
        return list(self.session.scalars(stmt).all())

    def list_by_user_and_range(self, user_id: UUID, start: date, end: date) -> list[DiaryEntry]:
        """Inclusive [start, end] range query used by reports."""
        stmt = (
            select(DiaryEntry)
            .where(
                DiaryEntry.user_id == user_id,
                DiaryEntry.entry_date >= start,
                DiaryEntry.entry_date <= end,
            )
            .order_by(DiaryEntry.entry_date)
        )
        return list(self.session.scalars(stmt).all())

    def set_status(self, entry: DiaryEntry, status: DiaryStatus) -> None:
        entry.status = status
        self.session.flush()

    def save_analysis(
        self,
        entry: DiaryEntry,
        *,
        primary_emotion: Emotion,
        scores: dict[str, float],
        summary: str,
        model_name: str | None,
        raw_response: dict[str, Any] | None,
        crisis_score: float | None = None,
        solis_message: str | None = None,
        suggested_action: str | None = None,
        needs_hotline: bool = False,
        songs: list[dict[str, Any]] | None = None,
    ) -> None:
        """Write the analysis result onto the diary row.

        `scores` carries all 9 emotion floats in [0, 1]. Songs is forwarded
        as-is when provided; pass None to leave the column unchanged.
        """
        entry.primary_emotion = primary_emotion
        entry.scores = scores
        entry.emotion_summary = summary
        entry.emotion_model = model_name
        entry.emotion_raw = raw_response
        entry.crisis_score = crisis_score
        entry.solis_message = solis_message
        entry.suggested_action = suggested_action
        entry.needs_hotline = needs_hotline
        if songs is not None:
            entry.songs = songs
        self.session.flush()

    def clear_analysis(self, entry: DiaryEntry) -> None:
        """Reset analysis-derived columns when the entry content is being re-analysed."""
        entry.primary_emotion = None
        entry.scores = None
        entry.emotion_summary = None
        entry.emotion_model = None
        entry.emotion_raw = None
        entry.crisis_score = None
        entry.solis_message = None
        entry.suggested_action = None
        entry.needs_hotline = False
        entry.songs = None
        self.session.flush()

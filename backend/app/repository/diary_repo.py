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
        intensities: dict[str, int],
        summary: str,
        model_name: str | None,
        raw_response: dict[str, Any] | None,
        songs: list[dict[str, Any]] | None = None,
    ) -> None:
        """Write the analysis result onto the diary row.

        `intensities` must contain integer values keyed by emotion name
        (joy / sad / anger / anxiety / calm). Songs is forwarded as-is when
        provided; pass None to leave the column unchanged, or an empty list
        to clear it.
        """
        entry.primary_emotion = primary_emotion
        entry.joy_intensity = intensities.get("joy")
        entry.sad_intensity = intensities.get("sad")
        entry.anger_intensity = intensities.get("anger")
        entry.anxiety_intensity = intensities.get("anxiety")
        entry.calm_intensity = intensities.get("calm")
        entry.emotion_summary = summary
        entry.emotion_model = model_name
        entry.emotion_raw = raw_response
        if songs is not None:
            entry.songs = songs
        self.session.flush()

    def clear_analysis(self, entry: DiaryEntry) -> None:
        """Reset analysis-derived columns when the entry content is being re-analysed."""
        entry.primary_emotion = None
        entry.joy_intensity = None
        entry.sad_intensity = None
        entry.anger_intensity = None
        entry.anxiety_intensity = None
        entry.calm_intensity = None
        entry.emotion_summary = None
        entry.emotion_model = None
        entry.emotion_raw = None
        entry.songs = None
        self.session.flush()

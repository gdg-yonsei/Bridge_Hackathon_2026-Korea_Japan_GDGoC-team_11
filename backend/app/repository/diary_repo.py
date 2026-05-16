from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.entity.diary_entry_entity import DiaryEntry, DiaryStatus
from app.repository.base_repo import BaseRepository


class DiaryRepository(BaseRepository[DiaryEntry]):
    model = DiaryEntry

    def get_with_relations(self, entry_id: int) -> DiaryEntry | None:
        stmt = (
            select(DiaryEntry)
            .where(DiaryEntry.id == entry_id)
            .options(
                selectinload(DiaryEntry.analysis),
                selectinload(DiaryEntry.songs),
            )
        )
        return self.session.scalars(stmt).one_or_none()

    def get_by_user_and_date(
        self, user_id: UUID, entry_date: date
    ) -> DiaryEntry | None:
        stmt = select(DiaryEntry).where(
            DiaryEntry.user_id == user_id,
            DiaryEntry.entry_date == entry_date,
        )
        return self.session.scalars(stmt).one_or_none()

    def list_by_month(
        self, user_id: UUID, year: int, month: int
    ) -> list[DiaryEntry]:
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
            .options(selectinload(DiaryEntry.analysis))
            .order_by(DiaryEntry.entry_date)
        )
        return list(self.session.scalars(stmt).all())

    def list_by_user_and_range(
        self, user_id: UUID, start: date, end: date
    ) -> list[DiaryEntry]:
        """주간 리포트 등에서 [start, end] 양끝 포함 범위 조회."""
        stmt = (
            select(DiaryEntry)
            .where(
                DiaryEntry.user_id == user_id,
                DiaryEntry.entry_date >= start,
                DiaryEntry.entry_date <= end,
            )
            .options(selectinload(DiaryEntry.analysis))
            .order_by(DiaryEntry.entry_date)
        )
        return list(self.session.scalars(stmt).all())

    def set_status(self, entry: DiaryEntry, status: DiaryStatus) -> None:
        entry.status = status
        self.session.flush()

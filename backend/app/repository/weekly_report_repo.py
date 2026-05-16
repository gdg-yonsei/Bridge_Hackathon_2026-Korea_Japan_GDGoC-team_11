from datetime import date
from uuid import UUID

from sqlalchemy import select

from app.entity.weekly_report_entity import WeeklyReport
from app.repository.base_repo import BaseRepository


class WeeklyReportRepository(BaseRepository[WeeklyReport]):
    model = WeeklyReport

    def get_by_user_and_week(
        self, user_id: UUID, week_start: date
    ) -> WeeklyReport | None:
        stmt = select(WeeklyReport).where(
            WeeklyReport.user_id == user_id,
            WeeklyReport.week_start == week_start,
        )
        return self.session.scalars(stmt).one_or_none()

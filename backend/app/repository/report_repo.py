from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.entity.report_entity import Report
from app.repository.base_repo import BaseRepository


class ReportRepository(BaseRepository[Report]):
    model = Report

    def upsert(
        self,
        user_id: UUID,
        period_start: date,
        period_end: date,
        **fields: Any,
    ) -> Report:
        """같은 기간을 재트리거하면 결과를 덮어쓰기 (regenerate semantics)."""
        stmt = (
            pg_insert(Report)
            .values(
                user_id=user_id,
                period_start=period_start,
                period_end=period_end,
                **fields,
            )
            .on_conflict_do_update(
                index_elements=["user_id", "period_start", "period_end"],
                set_={**fields, "generated_at": func.now()},
            )
            .returning(Report)
        )
        row = self.session.execute(stmt).scalar_one()
        self.session.flush()
        return row

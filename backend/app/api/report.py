from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.entity.user_entity import User
from app.models.report import WeeklyReportOut
from app.repository.weekly_report_repo import WeeklyReportRepository

router = APIRouter()


def _parse_iso_week(week: str) -> date:
    """'2026-W20' → 해당 주 월요일 date."""
    try:
        return datetime.strptime(f"{week}-1", "%G-W%V-%u").date()
    except ValueError as e:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Invalid week format. Expected ISO week like '2026-W20'.",
        ) from e


@router.get("/weekly", response_model=WeeklyReportOut)
def get_weekly_report(
    week: str = Query(..., examples=["2026-W20"]),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WeeklyReportOut:
    week_start = _parse_iso_week(week)
    report = WeeklyReportRepository(db).get_by_user_and_week(user.id, week_start)
    if report is None:
        # TODO: 자동 생성 (Graph B) 트리거. 지금은 404로 명시.
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Weekly report not generated yet. Generation endpoint TBD.",
        )
    return WeeklyReportOut.model_validate(report)

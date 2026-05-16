from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.entity.user_entity import User
from app.models.report import ReportCreate, ReportOut
from app.services.report_service import generate_report

router = APIRouter()


@router.post("", response_model=ReportOut)
def create_report(
    payload: ReportCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ReportOut:
    """기간을 받아 Gemini 로 리포트 생성 — 동기 호출이라 응답까지 수 초 걸림.

    같은 (user, period_start, period_end) 로 재호출하면 결과를 덮어쓴다.
    """
    report = generate_report(
        db=db,
        user_id=user.id,
        period_start=payload.period_start,
        period_end=payload.period_end,
    )
    return ReportOut.model_validate(report)

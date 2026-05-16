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
    """Generate a report for the given date range via Gemini — synchronous, expect a few seconds.

    Re-calling with the same (user, period_start, period_end) overwrites the previous result.
    """
    report = generate_report(
        db=db,
        user_id=user.id,
        period_start=payload.period_start,
        period_end=payload.period_end,
    )
    return ReportOut.model_validate(report)

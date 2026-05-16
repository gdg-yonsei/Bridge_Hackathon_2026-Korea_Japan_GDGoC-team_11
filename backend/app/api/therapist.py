"""Therapist matching API endpoint."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.entity.user_entity import User
from app.models.therapist import TherapistMatchRequest, TherapistMatchResponse
from app.services.therapist_service import match_therapists

router = APIRouter(prefix="/therapist", tags=["therapist"])


@router.post("/match", response_model=TherapistMatchResponse)
def match_therapist(
    payload: TherapistMatchRequest,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TherapistMatchResponse:
    return match_therapists(
        db=db,
        therapist_summary=payload.therapist_summary,
        user_emotions=payload.user_emotions,
        language=payload.language,
    )

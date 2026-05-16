"""Therapist directory + matching API."""

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.core.rate_limit import limiter
from app.entity.user_entity import User
from app.models.therapist import (
    TherapistMatchRequest,
    TherapistMatchResponse,
    TherapistProfile,
)
from app.repository.therapist_repo import TherapistRepository
from app.services.therapist_service import match_therapists

router = APIRouter(prefix="/therapist", tags=["therapist"])


@router.get("", response_model=list[TherapistProfile])
@limiter.limit("60/hour")
def list_therapists(
    request: Request,
    country: Literal["Korea", "Japan"] | None = Query(
        None, description="Match `location` suffix — Korea or Japan."
    ),
    language: str | None = Query(
        None, description="Must include this language (e.g. 'korean', 'japanese', 'english')."
    ),
    concern: str | None = Query(
        None, description="Must include this specialty in `specializes_in` (e.g. 'anxiety')."
    ),
    emotion: str | None = Query(
        None, description="Must include this emotion in `emotions_treated` (e.g. 'sad')."
    ),
    online: bool | None = Query(None, description="Offers online sessions."),
    in_person: bool | None = Query(None, description="Offers in-person sessions."),
    min_rating: float | None = Query(None, ge=0.0, le=5.0, description="Minimum rating (0-5)."),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TherapistProfile]:
    therapists = TherapistRepository(db).filter(
        country=country,
        language=language,
        concern=concern,
        emotion=emotion,
        online=online,
        in_person=in_person,
        min_rating=min_rating,
    )
    return [TherapistProfile.model_validate(t) for t in therapists]


@router.post("/match", response_model=TherapistMatchResponse)
@limiter.limit("10/hour")
def match_therapist(
    request: Request,
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

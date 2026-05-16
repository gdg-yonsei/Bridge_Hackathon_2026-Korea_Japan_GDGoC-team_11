"""Therapist matching API endpoint."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.therapist_service import match_therapists

router = APIRouter(prefix="/therapist", tags=["therapist"])


@router.post("/match")
def match_therapist(payload: dict):
    result = match_therapists(
        therapist_summary=payload["therapist_summary"],
        user_emotions=payload["user_emotions"],
        language=payload.get("language", "both"),
    )
    return result
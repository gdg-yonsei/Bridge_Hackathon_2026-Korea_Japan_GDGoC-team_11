"""Therapist matching service — two-layer algorithm.

Layer 1: Mathematical score matching over the DB-resident therapist directory
         (emotion overlap + concern keyword overlap + online availability).
Layer 2: Gemini semantic ranking with structured output via response_schema.
"""

from __future__ import annotations

import json
import logging

from fastapi import HTTPException, status
from google.genai import types
from sqlalchemy.orm import Session

from app.core.gemini_client import generate_with_fallback
from app.entity.therapist_entity import Therapist
from app.models.therapist import (
    TherapistMatch,
    TherapistMatchResponse,
    TherapistProfile,
    TherapistRanking,
    TherapistRankingList,
    TherapistSummary,
)
from app.repository.therapist_repo import TherapistRepository
from app.services.prompts import THERAPIST_MATCH_SYSTEM

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────
# LAYER 1 — Mathematical Score Matching
# ─────────────────────────────────────────


def _calculate_match_score(
    user_emotions: dict[str, float],
    user_concerns: list[str],
    therapist: Therapist,
) -> float:
    """Score a therapist against the user (0..~1.0)."""
    score = 0.0

    # 1. emotion overlap, weighted by user-side intensity (50%)
    treated = set(therapist.emotions_treated or [])
    for emotion, intensity in user_emotions.items():
        if emotion in treated:
            score += float(intensity) * 0.5

    # 2. concern keyword overlap (30%)
    specialties = " ".join(therapist.specializes_in or []).lower()
    if user_concerns:
        matched = sum(
            1
            for concern in user_concerns
            if any(word in specialties for word in concern.lower().split())
        )
        score += (matched / len(user_concerns)) * 0.3

    # 3. online availability bonus (20%)
    if therapist.online_available:
        score += 0.2

    return round(score, 3)


def _layer1_top_candidates(
    therapists: list[Therapist],
    user_emotions: dict[str, float],
    user_concerns: list[str],
    top_n: int = 5,
) -> list[tuple[Therapist, float]]:
    scored = [(t, _calculate_match_score(user_emotions, user_concerns, t)) for t in therapists]
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return scored[:top_n]


# ─────────────────────────────────────────
# LAYER 2 — Gemini Semantic Matching
# ─────────────────────────────────────────


def _layer2_gemini_rank(
    candidates: list[Therapist],
    therapist_summary: TherapistSummary,
) -> list[TherapistRanking]:
    if not candidates:
        return []

    candidate_payload = [TherapistProfile.model_validate(t).model_dump() for t in candidates]

    user_prompt = (
        "USER CLINICAL SUMMARY:\n"
        f"{therapist_summary.model_dump_json(indent=2)}\n\n"
        "THERAPIST CANDIDATES:\n"
        f"{json.dumps(candidate_payload, indent=2, ensure_ascii=False)}\n\n"
        f"Include ALL {len(candidates)} candidates in the ranked output."
    )

    try:
        response = generate_with_fallback(
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=THERAPIST_MATCH_SYSTEM,
                response_mime_type="application/json",
                response_schema=TherapistRankingList,
                temperature=0.3,
            ),
        )
    except Exception as e:
        logger.exception("Gemini call failed during therapist matching")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Therapist matching failed: {e}",
        ) from e

    parsed: TherapistRankingList | None = getattr(response, "parsed", None)
    if parsed is None:
        try:
            parsed = TherapistRankingList.model_validate(json.loads(response.text))
        except (ValueError, TypeError) as e:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                "Gemini returned malformed therapist ranking JSON",
            ) from e
    return parsed.rankings


# ─────────────────────────────────────────
# MAIN MATCHING FUNCTION
# ─────────────────────────────────────────


def match_therapists(
    db: Session,
    therapist_summary: TherapistSummary,
    user_emotions: dict[str, float],
    language: str = "both",
) -> TherapistMatchResponse:
    repo = TherapistRepository(db)
    if language == "korean":
        candidates = repo.list_by_location_suffix("Korea")
    elif language == "japanese":
        candidates = repo.list_by_location_suffix("Japan")
    else:
        candidates = repo.list_all()

    if not candidates:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No therapists available for the requested language",
        )

    layer1 = _layer1_top_candidates(
        therapists=candidates,
        user_emotions=user_emotions,
        user_concerns=therapist_summary.key_concerns,
        top_n=5,
    )
    layer1_therapists = [t for t, _ in layer1]
    logger.info(
        "Layer 1 top candidates: %s",
        [t.therapist_id for t in layer1_therapists],
    )

    rankings = _layer2_gemini_rank(layer1_therapists, therapist_summary)

    by_id = {t.therapist_id: t for t in candidates}
    final: list[TherapistMatch] = []
    for ranking in rankings[:3]:
        therapist = by_id.get(ranking.therapist_id)
        if therapist is None:
            continue
        profile = TherapistProfile.model_validate(therapist).model_dump()
        final.append(
            TherapistMatch(
                **profile,
                match_score=ranking.match_score,
                match_reason=ranking.match_reason,
                matched_concerns=ranking.matched_concerns,
                approach_fit=ranking.approach_fit,
            )
        )

    return TherapistMatchResponse(
        top_matches=final,
        total_candidates_evaluated=len(candidates),
        layer1_filtered=len(layer1_therapists),
    )

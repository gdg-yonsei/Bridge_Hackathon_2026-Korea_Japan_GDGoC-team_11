"""Therapist matching service — two layer algorithm.

Layer 1: Mathematical score matching (fast filter)
Layer 2: Gemini semantic matching (smart ranking)
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from google.genai import types

from app.core.config import settings
from app.core.gemini_client import get_gemini_client

logger = logging.getLogger(__name__)

# load therapists dataset once at startup
THERAPISTS_PATH = Path(__file__).parent.parent / "data" / "therapists.json"
with open(THERAPISTS_PATH, "r") as f:
    THERAPISTS = json.load(f)


# ─────────────────────────────────────────
# LAYER 1 — Mathematical Score Matching
# ─────────────────────────────────────────

def _calculate_match_score(
    user_emotions: dict[str, float],
    user_concerns: list[str],
    therapist: dict,
) -> float:
    """Calculate match score between user and therapist mathematically."""

    score = 0.0

    # 1. emotion overlap score (50% of total score)
    therapist_emotions = therapist.get("emotions_treated", [])
    for emotion, intensity in user_emotions.items():
        if emotion in therapist_emotions:
            score += intensity * 0.5  # weight by emotion intensity

    # 2. concern keyword overlap score (30% of total score)
    therapist_specialties = " ".join(therapist.get("specializes_in", [])).lower()
    matched_concerns = 0
    for concern in user_concerns:
        if any(word in therapist_specialties for word in concern.lower().split()):
            matched_concerns += 1
    if user_concerns:
        score += (matched_concerns / len(user_concerns)) * 0.3

    # 3. online availability bonus (20% of total score)
    if therapist.get("online_available"):
        score += 0.2

    return round(score, 3)


def _filter_top_candidates(
    user_emotions: dict[str, float],
    user_concerns: list[str],
    top_n: int = 5,
) -> list[dict]:
    """Layer 1 — filter top N therapists mathematically."""

    scored = []
    for therapist in THERAPISTS:
        math_score = _calculate_match_score(
            user_emotions, user_concerns, therapist
        )
        scored.append({
            **therapist,
            "math_score": math_score,
        })

    # sort by math score, take top N
    scored.sort(key=lambda x: x["math_score"], reverse=True)
    return scored[:top_n]


# ─────────────────────────────────────────
# LAYER 2 — Gemini Semantic Matching
# ─────────────────────────────────────────

def _gemini_rank(
    candidates: list[dict],
    therapist_summary: dict,
) -> list[dict]:
    """Layer 2 — Gemini re-ranks top candidates semantically."""

    # strip math_score before sending to Gemini
    clean_candidates = [
        {k: v for k, v in t.items() if k != "math_score"}
        for t in candidates
    ]

    prompt = f"""
You are a clinical therapist matching system.
Rank these therapists from best to worst match for this user.

USER CLINICAL SUMMARY:
{json.dumps(therapist_summary, indent=2)}

THERAPIST CANDIDATES:
{json.dumps(clean_candidates, indent=2)}

Consider:
- How well their specialties match the user's key concerns
- Whether their therapy approach fits the user's emotional patterns
- Language and cultural fit
- Online availability for accessibility

Return ONLY a JSON array ranked best to worst:
[
    {{
        "therapist_id": "KR001",
        "match_score": 0.95,
        "match_reason": "specific reason why this therapist fits this user",
        "matched_concerns": ["concern 1", "concern 2"],
        "approach_fit": "why their approach fits the user's situation"
    }}
]

Include ALL {len(clean_candidates)} candidates in the ranking.
"""

    client = get_gemini_client()
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.3,
        ),
    )

    raw = response.text.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    rankings = json.loads(raw)
    return rankings


# ─────────────────────────────────────────
# MAIN MATCHING FUNCTION
# ─────────────────────────────────────────

def match_therapists(
    therapist_summary: dict,
    user_emotions: dict[str, float],
    language: str = "both",
) -> dict:
    """
    Two-layer therapist matching.

    Args:
        therapist_summary: output from report_service (summary, key_concerns etc.)
        user_emotions: emotion scores from diary analysis
        language: "korean", "japanese", or "both"

    Returns:
        top 3 matched therapists with scores and reasons
    """

    # filter by language first
    available = THERAPISTS
    if language == "korean":
        available = [t for t in THERAPISTS if t["location"].endswith("Korea")]
    elif language == "japanese":
        available = [t for t in THERAPISTS if t["location"].endswith("Japan")]

    # get key concerns from summary
    key_concerns = therapist_summary.get("key_concerns", [])

    # LAYER 1 — mathematical filter → top 5
    top_candidates = _filter_top_candidates(
        user_emotions=user_emotions,
        user_concerns=key_concerns,
        top_n=5,
    )

    logger.info(
        "Layer 1 top candidates: %s",
        [t["therapist_id"] for t in top_candidates]
    )

    # LAYER 2 — Gemini semantic ranking → top 3
    gemini_rankings = _gemini_rank(
        candidates=top_candidates,
        therapist_summary=therapist_summary,
    )

    # merge Gemini rankings with full therapist profiles
    therapist_map = {t["therapist_id"]: t for t in THERAPISTS}
    final_matches = []

    for ranking in gemini_rankings[:3]:  # top 3 only
        therapist_id = ranking["therapist_id"]
        profile = therapist_map.get(therapist_id, {})
        final_matches.append({
            **profile,
            "match_score": ranking["match_score"],
            "match_reason": ranking["match_reason"],
            "matched_concerns": ranking["matched_concerns"],
            "approach_fit": ranking["approach_fit"],
        })

    return {
        "top_matches": final_matches,
        "total_candidates_evaluated": len(THERAPISTS),
        "layer1_filtered": len(top_candidates),
        "matching_method": "two-layer: mathematical + AI semantic"
    }
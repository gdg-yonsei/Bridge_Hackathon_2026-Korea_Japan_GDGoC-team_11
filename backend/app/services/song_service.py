"""Song recommendation — Gemini suggests candidates, Spotify resolves them.

Flow:
  1. Gemini proposes 5 famous English/Korean tracks fitting the diary's
     emotional context (`response_schema=SongSuggestionList`).
  2. Each suggestion is searched on Spotify with `prefer_with_preview=True`.
  3. Among resolved tracks, filter by `popularity >= 50` (a casual listener
     would recognise it). Fall back to >= 30, then "anything" if needed.
  4. Pick the highest-popularity match, preferring ones with a preview_url.
  5. Returns at most ONE song.

Best-effort: returns `None` on any failure so the caller can persist
emotion analysis without songs and continue.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from google.genai import types
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.gemini_client import get_gemini_client
from app.core.spotify_client import SpotifyError, search_track
from app.models.diary import DiaryAnalysisLLMResult, SongOut
from app.services.prompts import RECOMMEND_SONGS_SYSTEM

logger = logging.getLogger(__name__)


# Spotify's `popularity` is 0-100 (recency-weighted). 50 ≈ recognisable to
# a casual listener; 30 is "niche but findable"; below 30 is mostly obscure.
_POPULARITY_FLOORS = (50.0, 30.0, 0.0)


class SongSuggestion(BaseModel):
    title: str
    artist: str
    reason: str = Field(..., description="One sentence tying this song to the diary.")


class SongSuggestionList(BaseModel):
    """Wrapper so Gemini `response_schema` can take a Pydantic model
    (top-level lists aren't directly accepted)."""

    songs: list[SongSuggestion]


def _build_user_prompt(content: str, analysis: DiaryAnalysisLLMResult) -> str:
    scores_line = ", ".join(
        f"{emo}={getattr(analysis.scores, emo):.2f}"
        for emo in ("joy", "calm", "comfort", "sad", "anxious", "angry")
    )
    return (
        f"DIARY ENTRY:\n{content}\n\n"
        f"EMOTIONAL ANALYSIS:\n"
        f"- primary_emotion: {analysis.primary_emotion.value}\n"
        f"- scores: {scores_line}\n"
        f"- summary: {analysis.summary}\n"
    )


def _gemini_suggest(content: str, analysis: DiaryAnalysisLLMResult) -> list[SongSuggestion]:
    client = get_gemini_client()
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=_build_user_prompt(content, analysis),
        config=types.GenerateContentConfig(
            system_instruction=RECOMMEND_SONGS_SYSTEM,
            response_mime_type="application/json",
            response_schema=SongSuggestionList,
            temperature=0.7,
        ),
    )
    parsed: SongSuggestionList | None = getattr(response, "parsed", None)
    if parsed is None:
        parsed = SongSuggestionList.model_validate(json.loads(response.text))
    return parsed.songs


def _resolve(suggestions: list[SongSuggestion]) -> list[tuple[dict[str, Any], str]]:
    """Map each LLM suggestion to a real Spotify track + the suggestion's
    `reason`. Drops suggestions that don't resolve to a track.
    """
    out: list[tuple[dict[str, Any], str]] = []
    for s in suggestions:
        query = f"track:{s.title} artist:{s.artist}"
        track = search_track(query, prefer_with_preview=True)
        if track is None:
            # Fall back to a looser query — exact-field syntax misses on slight
            # title/artist variations Gemini might pick up.
            track = search_track(f"{s.title} {s.artist}", prefer_with_preview=True)
        if track is not None:
            out.append((track, s.reason))
    return out


def _pick_best(resolved: list[tuple[dict[str, Any], str]]) -> tuple[dict[str, Any], str]:
    """Apply the popularity-floor cascade and return the winning track."""
    for floor in _POPULARITY_FLOORS:
        passing = [(t, r) for t, r in resolved if float(t.get("popularity", 0)) >= floor]
        if passing:
            break
    # Sort by (popularity desc, has-preview desc).
    passing.sort(
        key=lambda pair: (float(pair[0].get("popularity", 0)), bool(pair[0].get("preview_url"))),
        reverse=True,
    )
    return passing[0]


def recommend_song(content: str, analysis: DiaryAnalysisLLMResult) -> SongOut | None:
    """Return at most one song recommendation, or None on any failure."""
    try:
        suggestions = _gemini_suggest(content, analysis)
    except Exception:
        logger.exception("Gemini song suggestion failed")
        return None

    if not suggestions:
        logger.info("Gemini returned 0 song suggestions for this entry")
        return None

    try:
        resolved = _resolve(suggestions)
    except SpotifyError as exc:
        # Credentials missing or invalid — skip songs but don't crash analysis.
        logger.warning("Spotify resolve skipped: %s", exc)
        return None

    if not resolved:
        logger.info("None of the %d suggestions resolved on Spotify", len(suggestions))
        return None

    track, reason = _pick_best(resolved)
    artists = track.get("artists") or []
    return SongOut(
        rank=1,
        title=track.get("name") or "",
        artist=", ".join(a.get("name", "") for a in artists) if artists else "",
        reason=reason,
        preview_url=track.get("preview_url"),
        external_url=(track.get("external_urls") or {}).get("spotify"),
    )

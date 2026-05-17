"""Diary analysis background orchestration — Gemini emotion classification."""

from __future__ import annotations

import json
import logging
import time
from random import uniform

from google.genai import types

from app.core.config import settings
from app.core.enums import DiaryStatus
from app.core.gemini_client import generate_with_fallback
from app.db.database import SessionLocal
from app.models.diary import DiaryAnalysisLLMResult, LiveEmotionResult
from app.repository.diary_repo import DiaryRepository
from app.services.prompts import CLASSIFY_EMOTION_SYSTEM, CLASSIFY_LIVE_SYSTEM
from app.services.song_service import recommend_song

logger = logging.getLogger(__name__)

# Transient Gemini failures (5xx, 429, network blips, occasional schema-mismatch
# outputs) are common enough that one-shot calls land on status='failed' more
# often than they should. The background path tolerates a few seconds of extra
# latency, so we retry with exponential backoff before giving up.
_ANALYSIS_MAX_ATTEMPTS = 3
_ANALYSIS_BACKOFF_BASE_SECONDS = 1.5


def live_classify(content: str) -> LiveEmotionResult:
    """Lightweight Gemini classification for the live-preview endpoint.

    No DB write, no Solis reflection fields. Optimised for short snippets
    sent on every debounced keystroke.
    """
    response = generate_with_fallback(
        contents=content,
        config=types.GenerateContentConfig(
            system_instruction=CLASSIFY_LIVE_SYSTEM,
            response_mime_type="application/json",
            response_schema=LiveEmotionResult,
            temperature=0.3,
        ),
    )
    parsed: LiveEmotionResult | None = getattr(response, "parsed", None)
    if parsed is None:
        parsed = LiveEmotionResult.model_validate(json.loads(response.text))
    return parsed


def _call_gemini(title: str | None, content: str, entry_date: str) -> DiaryAnalysisLLMResult:
    prompt = f"Date: {entry_date}\nTitle: {title or '(no title)'}\n\n{content}"
    response = generate_with_fallback(
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=CLASSIFY_EMOTION_SYSTEM,
            response_mime_type="application/json",
            response_schema=DiaryAnalysisLLMResult,
            temperature=0.4,
        ),
    )
    parsed: DiaryAnalysisLLMResult | None = getattr(response, "parsed", None)
    if parsed is None:
        parsed = DiaryAnalysisLLMResult.model_validate(json.loads(response.text))
    return parsed


def _call_gemini_with_retry(
    title: str | None, content: str, entry_date: str
) -> DiaryAnalysisLLMResult:
    """Wrap _call_gemini with exponential backoff so a transient blip doesn't
    flip the entry to status='failed'. Re-raises the last exception so the
    surrounding handler can still mark the entry failed when all attempts fail.
    """
    last_exc: Exception | None = None
    for attempt in range(1, _ANALYSIS_MAX_ATTEMPTS + 1):
        try:
            return _call_gemini(title, content, entry_date)
        except Exception as exc:  # noqa: BLE001 — log & retry below
            last_exc = exc
            if attempt == _ANALYSIS_MAX_ATTEMPTS:
                break
            delay = _ANALYSIS_BACKOFF_BASE_SECONDS * (2 ** (attempt - 1)) * uniform(0.7, 1.3)
            logger.warning(
                "Gemini analysis failed (attempt %d/%d): %s — retrying in %.1fs",
                attempt,
                _ANALYSIS_MAX_ATTEMPTS,
                exc,
                delay,
            )
            time.sleep(delay)
    assert last_exc is not None
    raise last_exc


def trigger_analysis(entry_id: int) -> None:
    """FastAPI BackgroundTasks entry point."""
    db = SessionLocal()
    try:
        diary_repo = DiaryRepository(db)
        entry = diary_repo.get(entry_id)
        if entry is None:
            logger.warning("trigger_analysis: entry %s not found", entry_id)
            return

        diary_repo.set_status(entry, DiaryStatus.analyzing)
        db.commit()

        result = _call_gemini_with_retry(
            title=entry.title,
            content=entry.content,
            entry_date=entry.entry_date.isoformat(),
        )

        # Safety net — override Gemini if a crisis phrase is detected. The model
        # is correct most of the time, but high-recall keyword matching is the
        # backstop we don't want to compromise on.
        if _check_crisis_keywords(entry.content):
            result.needs_hotline = True
            result.crisis_score = max(result.crisis_score, 0.9)
            logger.warning("Crisis keyword override applied for entry %s", entry_id)

        # Song recommendation is best-effort — failure (Spotify creds missing,
        # all suggestions unresolved, Gemini blip) doesn't fail the analysis.
        song_list: list[dict] | None = None
        try:
            song = recommend_song(entry.content, result)
            if song is not None:
                song_list = [song.model_dump(mode="json")]
            else:
                song_list = []
        except Exception:
            logger.exception("song recommendation failed for entry %s", entry_id)

        diary_repo.save_analysis(
            entry,
            primary_emotion=result.primary_emotion,
            scores=result.scores.model_dump(),
            summary=result.summary,
            model_name=settings.gemini_model,
            raw_response=result.model_dump(mode="json"),
            crisis_score=result.crisis_score,
            solis_message=result.solis_message,
            suggested_action=result.suggested_action,
            needs_hotline=result.needs_hotline,
            songs=song_list,
        )

        diary_repo.set_status(entry, DiaryStatus.done)
        db.commit()

    except Exception:
        logger.exception("trigger_analysis failed for entry %s", entry_id)
        db.rollback()
        _safe_mark_failed(db, entry_id)
    finally:
        db.close()


def _safe_mark_failed(db, entry_id: int) -> None:
    try:
        entry = DiaryRepository(db).get(entry_id)
        if entry is not None:
            DiaryRepository(db).set_status(entry, DiaryStatus.failed)
            db.commit()
    except Exception:
        logger.exception("could not mark entry %s as failed", entry_id)


# Tuned for high-recall on first-person crisis intent while avoiding the worst
# false positives (e.g. "last day of school", "I can't go on vacation").
CRISIS_KEYWORDS = (
    # suicidal ideation
    "want to die",
    "wanna die",
    "end my life",
    "kill myself",
    "killing myself",
    "take my own life",
    "don't want to live",
    "dont want to live",
    "no reason to live",
    "not worth living",
    "better off dead",
    "better off without me",
    # self harm
    "hurt myself",
    "hurting myself",
    "cut myself",
    "cutting myself",
    "harm myself",
    "harming myself",
    # hopelessness — 1st-person prefixed to avoid benign matches
    "no point in living",
    "i can't go on",
    "i cannot go on",
    "i cant go on",
    "give up on life",
    "giving up on life",
    "want to disappear",
    "nobody would miss me",
    "no one would miss me",
    "world is better without me",
    # crisis signals
    "goodbye forever",
    "final goodbye",
    "my last day on earth",
    "won't be here tomorrow",
)


def _check_crisis_keywords(text: str) -> bool:
    text_lower = text.lower()
    for keyword in CRISIS_KEYWORDS:
        if keyword in text_lower:
            logger.warning("CRISIS KEYWORD DETECTED: '%s' found in entry", keyword)
            return True
    return False

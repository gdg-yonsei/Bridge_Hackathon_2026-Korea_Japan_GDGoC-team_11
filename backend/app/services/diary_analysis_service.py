"""Diary analysis background orchestration — Gemini emotion classification."""

from __future__ import annotations

import json
import logging

from google.genai import types

from app.core.config import settings
from app.core.enums import DiaryStatus
from app.core.gemini_client import get_gemini_client
from app.db.database import SessionLocal
from app.models.diary import DiaryAnalysisLLMResult
from app.repository.diary_repo import DiaryRepository
from app.services.prompts import CLASSIFY_EMOTION_SYSTEM

logger = logging.getLogger(__name__)


def _call_gemini(title: str | None, content: str, entry_date: str) -> DiaryAnalysisLLMResult:
    prompt = f"Date: {entry_date}\nTitle: {title or '(no title)'}\n\n{content}"
    client = get_gemini_client()
    response = client.models.generate_content(
        model=settings.gemini_model,
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

        result = _call_gemini(
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
            songs=None,
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


CRISIS_KEYWORDS = (
    # suicidal ideation
    "want to die",
    "wanna die",
    "i want to die",
    "end my life",
    "end it all",
    "ending it all",
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
    # hopelessness
    "no point anymore",
    "no point in living",
    "can't go on",
    "cannot go on",
    "cant go on",
    "give up on life",
    "giving up on life",
    "disappear forever",
    "want to disappear",
    "nobody would miss me",
    "no one would miss me",
    "world is better without me",
    # crisis signals
    "goodbye forever",
    "final goodbye",
    "last day",
    "won't be here tomorrow",
)


def _check_crisis_keywords(text: str) -> bool:
    text_lower = text.lower()
    for keyword in CRISIS_KEYWORDS:
        if keyword in text_lower:
            logger.warning("CRISIS KEYWORD DETECTED: '%s' found in entry", keyword)
            return True
    return False

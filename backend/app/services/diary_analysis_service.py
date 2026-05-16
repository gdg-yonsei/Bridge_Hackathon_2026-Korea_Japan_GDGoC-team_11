"""Diary analysis background orchestration — Gemini emotion classification."""

from __future__ import annotations

import json
import logging

from google.genai import types

from app.core.config import settings
from app.core.gemini_client import get_gemini_client
from app.db.database import SessionLocal
from app.entity.diary_entry_entity import DiaryStatus
from app.models.diary import DiaryAnalysisLLMResult
from app.repository.diary_repo import DiaryRepository
from app.repository.emotion_repo import EmotionRepository

logger = logging.getLogger(__name__)


_SYSTEM_INSTRUCTION = """\
You are an expert emotion analyst. Given a diary entry, classify the writer's
primary emotion and provide per-emotion probability scores.

Rules:
- primary_emotion must be exactly one of: joy, sad, anger, anxiety, calm
- scores must cover all five emotions; values are floats in [0, 1] that sum to 1.0
- summary must be a single concise sentence describing the emotional tone
- Respond in JSON matching the provided schema
"""


def _call_gemini(title: str | None, content: str, entry_date: str) -> DiaryAnalysisLLMResult:
    prompt = (
        f"Date: {entry_date}\n"
        f"Title: {title or '(no title)'}\n\n"
        f"{content}"
    )
    client = get_gemini_client()
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_INSTRUCTION,
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
    """FastAPI BackgroundTasks entry point.

    Opens its own DB session, always closes it.
    Marks entry status='failed' on any exception.
    """
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

        EmotionRepository(db).upsert(
            entry_id=entry.id,
            primary_emotion=result.primary_emotion,
            scores=result.scores,
            summary=result.summary,
            model_name=settings.gemini_model,
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

"""Diary analysis background orchestration — Gemini emotion classification."""

from __future__ import annotations

import json
import logging

from google.genai import types

from app.core.config import settings
from app.core.enums import DiaryStatus, Emotion
from app.core.gemini_client import get_gemini_client
from app.db.database import SessionLocal
from app.models.diary import DiaryAnalysisLLMResult
from app.repository.diary_repo import DiaryRepository

logger = logging.getLogger(__name__)


_SYSTEM_INSTRUCTION = """\
You are an expert emotion analyst. Given a diary entry, rate the writer's
felt intensity for each of five emotions on a 1..10 scale.

Rules:
- Rate each of joy / sad / anger / anxiety / calm independently — multiple
  emotions can be high at the same time. There is no normalisation across
  emotions; do NOT make the five values sum to anything in particular.
- 1 means the emotion is barely present in the entry; 10 means overwhelming.
- summary must be a single concise sentence describing the overall emotional tone.
- Respond in JSON matching the provided schema.
"""


def _argmax_emotion(intensities: dict[str, int]) -> Emotion:
    name, _ = max(intensities.items(), key=lambda kv: kv[1])
    return Emotion(name)


def _call_gemini(title: str | None, content: str, entry_date: str) -> DiaryAnalysisLLMResult:
    prompt = f"Date: {entry_date}\nTitle: {title or '(no title)'}\n\n{content}"
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

        intensities = {
            "joy": result.joy,
            "sad": result.sad,
            "anger": result.anger,
            "anxiety": result.anxiety,
            "calm": result.calm,
        }
        diary_repo.save_analysis(
            entry,
            primary_emotion=_argmax_emotion(intensities),
            intensities=intensities,
            summary=result.summary,
            model_name=settings.gemini_model,
            raw_response=result.model_dump(mode="json"),
            # Song recommendations are deferred — leave the column as-is.
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


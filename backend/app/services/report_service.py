"""Period-report generation.

Numbers (mood_chart, stats, dominant emotion) are computed app-side from the
diary entries so they cannot diverge from the actual data. Gemini is only
asked to produce a short narrative summary in second person.
"""

from __future__ import annotations

import json
import logging
from collections import Counter
from datetime import date
from uuid import UUID

from fastapi import HTTPException, status
from google.genai import types
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.enums import EMOTIONS, Emotion
from app.core.gemini_client import get_gemini_client
from app.entity.diary_entry_entity import DiaryEntry
from app.entity.report_entity import Report
from app.models.report import ReportLLMResult
from app.repository.diary_repo import DiaryRepository
from app.repository.report_repo import ReportRepository

logger = logging.getLogger(__name__)


SYSTEM_INSTRUCTION = """\
You are an empathetic journaling companion. Given a user's diary entries over
a date range, write a concise emotional summary of the period.

Constraints:
- 3-5 sentences, written in the second person ("You felt...", "You navigated...").
- No numerical claims — do not invent or quote intensities.
- Focus on patterns and shifts rather than restating individual entries.
- Respond in JSON matching the provided schema.
"""


def _scores_of(entry: DiaryEntry) -> dict[str, float] | None:
    """Return the full 9-emotion score dict, or None if not yet analysed.

    Defaults missing emotions to 0.0 so charts can assume all 9 keys exist.
    """
    if entry.scores is None:
        return None
    return {emo: float(entry.scores.get(emo, 0.0)) for emo in EMOTIONS}


def _build_user_prompt(diaries: list[DiaryEntry], start: date, end: date) -> str:
    lines = [f"Date range: {start.isoformat()} to {end.isoformat()}", ""]
    for d in diaries:
        title = d.title or "(no title)"
        lines.append(f"## {d.entry_date.isoformat()} — {title}")
        lines.append(d.content)
        if d.primary_emotion is not None and d.emotion_summary:
            lines.append(f"(primary: {d.primary_emotion.value}; {d.emotion_summary})")
        lines.append("")
    return "\n".join(lines)


def _aggregate(
    diaries: list[DiaryEntry],
) -> tuple[dict[str, dict[str, float]], dict[str, dict[str, float | int]], Emotion]:
    """Returns (mood_chart, stats, dominant_emotion)."""
    mood_chart: dict[str, dict[str, float]] = {}
    analysed: list[tuple[DiaryEntry, dict[str, float]]] = []
    for d in diaries:
        scores = _scores_of(d)
        if scores is None:
            continue
        mood_chart[d.entry_date.isoformat()] = scores
        analysed.append((d, scores))

    stats: dict[str, dict[str, float | int]] = {}
    primary_counts: Counter[str] = Counter(
        d.primary_emotion.value for d, _ in analysed if d.primary_emotion is not None
    )
    for emo in EMOTIONS:
        values = [scores[emo] for _, scores in analysed]
        if not values:
            stats[emo] = {"avg": 0.0, "peak": 0.0, "days": 0}
            continue
        stats[emo] = {
            "avg": round(sum(values) / len(values), 3),
            "peak": round(max(values), 3),
            "days": primary_counts.get(emo, 0),
        }

    if primary_counts:
        dominant_name, _ = primary_counts.most_common(1)[0]
    else:
        dominant_name = max(EMOTIONS, key=lambda e: stats[e]["avg"])
    return mood_chart, stats, Emotion(dominant_name)


def _call_gemini_for_summary(user_prompt: str) -> str:
    try:
        client = get_gemini_client()
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                response_mime_type="application/json",
                response_schema=ReportLLMResult,
                temperature=0.6,
            ),
        )
    except Exception as e:
        logger.exception("Gemini call failed")
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Report generation failed: {e}",
        ) from e

    parsed: ReportLLMResult | None = getattr(response, "parsed", None)
    if parsed is None:
        try:
            parsed = ReportLLMResult.model_validate(json.loads(response.text))
        except (ValueError, TypeError) as e:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                "Gemini returned malformed JSON",
            ) from e
    return parsed.summary


def generate_report(
    db: Session,
    user_id: UUID,
    period_start: date,
    period_end: date,
) -> Report:
    if period_end < period_start:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "period_end must be >= period_start",
        )

    diaries = DiaryRepository(db).list_by_user_and_range(user_id, period_start, period_end)
    if not diaries:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No diary entries found in this period",
        )

    mood_chart, stats, dominant = _aggregate(diaries)
    summary = _call_gemini_for_summary(_build_user_prompt(diaries, period_start, period_end))

    report = ReportRepository(db).upsert(
        user_id=user_id,
        period_start=period_start,
        period_end=period_end,
        dominant_emotion=dominant,
        summary=summary,
        mood_chart=mood_chart,
        stats=stats,
        model_name=settings.gemini_model,
    )
    db.commit()
    db.refresh(report)
    return report

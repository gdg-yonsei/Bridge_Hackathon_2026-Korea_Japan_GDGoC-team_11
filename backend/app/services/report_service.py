"""기간 리포트 생성 서비스.

흐름:
  1. 해당 기간의 diary_entries + analyses 조회
  2. Gemini 에 영어 프롬프트 전송 (구조화 응답 강제)
  3. 결과를 reports 테이블에 upsert (같은 기간 재트리거 시 덮어쓰기)
  4. ReportOut 반환
"""

from __future__ import annotations

import json
import logging
from datetime import date
from uuid import UUID

from fastapi import HTTPException, status
from google.genai import types
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.gemini_client import get_gemini_client
from app.entity.diary_entry_entity import DiaryEntry
from app.entity.report_entity import Report
from app.models.report import ReportLLMResult
from app.repository.diary_repo import DiaryRepository
from app.repository.report_repo import ReportRepository

logger = logging.getLogger(__name__)


SYSTEM_INSTRUCTION = """\
You are an empathetic journaling companion. Given a user's diary entries over
a date range, produce a concise emotional report.

Return JSON matching the provided schema. Use ONLY the emotion labels
joy, sad, anger, anxiety, calm. The summary should be 3-5 sentences,
written in the second person ("You felt...", "You navigated...").
mood_chart keys must be ISO date strings (YYYY-MM-DD) for days that had a diary entry.
"""


def _build_user_prompt(diaries: list[DiaryEntry], start: date, end: date) -> str:
    lines = [f"Date range: {start.isoformat()} to {end.isoformat()}", ""]
    for d in diaries:
        title = d.title or "(no title)"
        lines.append(f"## {d.entry_date.isoformat()} — {title}")
        lines.append(d.content)
        if d.analysis is not None:
            lines.append(
                f"(analyzed emotion: {d.analysis.primary_emotion.value}; "
                f"summary: {d.analysis.summary})"
            )
        lines.append("")
    return "\n".join(lines)


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

    diaries = DiaryRepository(db).list_by_user_and_range(
        user_id, period_start, period_end
    )
    if not diaries:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "No diary entries found in this period",
        )

    user_prompt = _build_user_prompt(diaries, period_start, period_end)

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

    # SDK 가 parsed 객체를 주거나, 안 주면 text 를 직접 파싱.
    parsed: ReportLLMResult | None = getattr(response, "parsed", None)
    if parsed is None:
        try:
            parsed = ReportLLMResult.model_validate(json.loads(response.text))
        except (ValueError, TypeError) as e:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                "Gemini returned malformed JSON",
            ) from e

    report = ReportRepository(db).upsert(
        user_id=user_id,
        period_start=period_start,
        period_end=period_end,
        dominant_emotion=parsed.dominant_emotion,
        summary=parsed.summary,
        mood_chart=parsed.mood_chart,
        model_name=settings.gemini_model,
    )
    db.commit()
    db.refresh(report)
    return report

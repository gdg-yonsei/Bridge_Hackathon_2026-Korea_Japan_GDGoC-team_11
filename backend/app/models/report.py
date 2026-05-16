from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.entity.emotion_analysis_entity import Emotion


class ReportCreate(BaseModel):
    """POST /reports 요청 body."""

    period_start: date = Field(..., description="시작일 (포함)")
    period_end: date = Field(..., description="종료일 (포함)")


class ReportOut(BaseModel):
    """리포트 응답."""

    period_start: date
    period_end: date
    dominant_emotion: Emotion
    summary: str
    mood_chart: dict     # {date_str: {emotion: score}} 또는 형식 자유
    model_name: str | None = None
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReportLLMResult(BaseModel):
    """Gemini 구조화 출력 강제용 스키마."""

    dominant_emotion: Emotion
    summary: str = Field(..., description="3~5문장 narrative — 'You felt...' 톤")
    mood_chart: dict[str, dict[str, float]] = Field(
        ...,
        description='{"2026-05-11": {"joy": 0.5, "sad": 0.3, ...}} 처럼 날짜별 감정 점수',
    )

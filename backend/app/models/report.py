from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.entity.emotion_analysis_entity import Emotion


class ReportCreate(BaseModel):
    """Request body for POST /reports."""

    period_start: date = Field(..., description="Start date (inclusive)")
    period_end: date = Field(..., description="End date (inclusive)")


class ReportOut(BaseModel):
    """Report response."""

    period_start: date
    period_end: date
    dominant_emotion: Emotion
    summary: str
    mood_chart: dict
    model_name: str | None = None
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReportLLMResult(BaseModel):
    """Gemini structured output schema for report generation."""

    dominant_emotion: Emotion
    summary: str = Field(..., description="3-5 sentence narrative in second person ('You felt...')")
    mood_chart: dict[str, dict[str, float]] = Field(
        ...,
        description='Per-day emotion scores e.g. {"2026-05-11": {"joy": 0.5, "sad": 0.3, ...}}',
    )

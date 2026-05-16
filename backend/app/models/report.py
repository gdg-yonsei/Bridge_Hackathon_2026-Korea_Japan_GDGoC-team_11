from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import Emotion


class ReportCreate(BaseModel):
    """Request body for POST /reports."""

    period_start: date = Field(..., description="Start date (inclusive)")
    period_end: date = Field(..., description="End date (inclusive)")


class EmotionStat(BaseModel):
    """Per-emotion aggregate over the report period."""

    avg: float = Field(..., description="Mean score (0.0-1.0) across all analysed entries")
    peak: float = Field(..., description="Highest score observed (0.0-1.0)")
    days: int = Field(..., description="Number of entries where this was the primary emotion")


class ReportOut(BaseModel):
    """Report response."""

    period_start: date
    period_end: date
    dominant_emotion: Emotion
    summary: str
    mood_chart: dict[str, dict[str, float]] = Field(
        ...,
        description='Per-day scores, e.g. {"2026-05-11": {"joy": 0.7, "sad": 0.1, ...}}',
    )
    stats: dict[str, EmotionStat] = Field(
        ...,
        description="Aggregated per-emotion stats over the period",
    )
    model_name: str | None = None
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReportLLMResult(BaseModel):
    """Gemini structured output schema. Gemini only writes the narrative;
    mood_chart, stats, and dominant_emotion are computed app-side from the
    diary entries to avoid hallucinated numbers.
    """

    summary: str = Field(
        ...,
        description="3-5 sentence narrative in second person, e.g. 'You felt...'",
    )

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import Emotion


class ReportCreate(BaseModel):
    """Request body for POST /reports."""

    period_start: date = Field(..., description="Start date (inclusive)")
    period_end: date = Field(..., description="End date (inclusive)")


class EmotionStat(BaseModel):
    """Per-emotion aggregate over the report period."""

    avg: float = Field(..., description="Mean intensity (1-10) across all analysed entries")
    peak: int = Field(..., description="Highest intensity observed (1-10)")
    days: int = Field(..., description="Number of entries where this was the primary emotion")


class ReportOut(BaseModel):
    """Report response."""

    period_start: date
    period_end: date
    dominant_emotion: Emotion
    summary: str
    mood_chart: dict[str, dict[str, int]] = Field(
        ...,
        description='Per-day intensities, e.g. {"2026-05-11": {"joy": 7, "sad": 3, ...}}',
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

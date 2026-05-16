from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import DiaryStatus, Emotion


class EmotionScores(BaseModel):
    """All 9 emotions, floats in [0, 1]. The LLM may use the full range
    independently per emotion — they are not normalised to sum to 1."""

    joy: float = Field(0.0, ge=0.0, le=1.0)
    sad: float = Field(0.0, ge=0.0, le=1.0)
    anger: float = Field(0.0, ge=0.0, le=1.0)
    anxiety: float = Field(0.0, ge=0.0, le=1.0)
    calm: float = Field(0.0, ge=0.0, le=1.0)
    embarrassment: float = Field(0.0, ge=0.0, le=1.0)
    envy: float = Field(0.0, ge=0.0, le=1.0)
    boredom: float = Field(0.0, ge=0.0, le=1.0)
    nostalgia: float = Field(0.0, ge=0.0, le=1.0)


class DiaryAnalysisLLMResult(BaseModel):
    """Gemini structured-output schema for diary emotion analysis."""

    primary_emotion: Emotion
    scores: EmotionScores
    summary: str = Field(
        ..., description="One sentence summarising the emotional tone of the entry."
    )

    crisis_score: float = Field(
        default=0.0, ge=0.0, le=1.0, description="Crisis risk score between 0.0 and 1.0"
    )
    solis_message: str = Field(
        default="",
        description="Warm personal reflection from Solis, max 3 sentences",
    )
    suggested_action: str = Field(
        default="",
        description="One small gentle suggestion for the user",
    )
    needs_hotline: bool = Field(
        default=False,
        description="True if user needs crisis hotline",
    )


class DiaryCreate(BaseModel):
    entry_date: date
    title: str | None = Field(None, max_length=200)
    content: str = Field(min_length=1)


class DiaryUpdate(BaseModel):
    title: str | None = Field(None, max_length=200)
    content: str | None = Field(None, min_length=1)


class DiaryAccepted(BaseModel):
    """202 response for POST /diary."""

    entry_id: int
    entry_date: date
    status: DiaryStatus


class SongOut(BaseModel):
    rank: int
    title: str
    artist: str
    reason: str | None = None
    external_url: str | None = None


class DiaryListItem(BaseModel):
    """Calendar monthly view — one entry per day."""

    entry_id: int
    entry_date: date
    primary_emotion: Emotion | None = None
    status: DiaryStatus

    model_config = ConfigDict(from_attributes=True)


class DiaryDetail(BaseModel):
    """GET /diary/{id} — flat shape matching the diary_entries row.

    `scores` carries all 9 emotion floats once analysis is complete; null
    while pending or on failure.
    """

    id: int
    entry_date: date
    title: str | None
    content: str
    status: DiaryStatus
    primary_emotion: Emotion | None = None
    scores: dict[str, float] | None = None
    emotion_summary: str | None = None
    crisis_score: float | None = None
    solis_message: str | None = None
    suggested_action: str | None = None
    needs_hotline: bool = False
    songs: list[SongOut] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

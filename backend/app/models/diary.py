from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import DiaryStatus, Emotion


class DiaryAnalysisLLMResult(BaseModel):
    """Gemini structured output schema for diary emotion analysis.

    Intensities are integers in [1, 10] — 1 is barely present, 10 is intense.
    """

    joy: int = Field(..., ge=1, le=10)
    sad: int = Field(..., ge=1, le=10)
    anger: int = Field(..., ge=1, le=10)
    anxiety: int = Field(..., ge=1, le=10)
    calm: int = Field(..., ge=1, le=10)
    summary: str = Field(
        ...,
        description="One sentence summarising the emotional tone of the entry.",
    )

    crisis_score: float = Field(
        default=0.0,
        description="Crisis risk score between 0.0 and 1.0",
    )
    nuri_message: str = Field(
        default="",
        description="Warm personal reflection from Nuri, max 3 sentences",
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

    The five `*_intensity` fields are integers in [1, 10] when analysis
    is complete; null while pending or on failure.
    """

    id: int
    entry_date: date
    title: str | None
    content: str
    status: DiaryStatus
    primary_emotion: Emotion | None = None
    joy_intensity: int | None = None
    sad_intensity: int | None = None
    anger_intensity: int | None = None
    anxiety_intensity: int | None = None
    calm_intensity: int | None = None
    emotion_summary: str | None = None
    songs: list[SongOut] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

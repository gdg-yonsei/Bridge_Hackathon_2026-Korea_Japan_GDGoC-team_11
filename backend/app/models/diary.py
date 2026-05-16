from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.entity.diary_entry_entity import DiaryStatus
from app.entity.emotion_analysis_entity import Emotion
from app.models.emotion import EmotionAnalysisOut
from app.models.song import SongRecOut


class DiaryAnalysisLLMResult(BaseModel):
    """Gemini structured output schema for diary emotion analysis."""

    primary_emotion: Emotion
    scores: dict[str, float] = Field(
        ...,
        description='Emotion scores summing to ~1.0, e.g. {"joy": 0.6, "sad": 0.1, ...}',
    )
    summary: str = Field(
        ...,
        description="One sentence summarising the emotional tone of the entry.",
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


class DiaryListItem(BaseModel):
    """Calendar monthly view — one entry per day."""

    entry_id: int
    entry_date: date
    primary_emotion: Emotion | None = None
    status: DiaryStatus

    model_config = ConfigDict(from_attributes=True)


class DiaryDetail(BaseModel):
    """GET /diary/{id} — single entry with analysis result."""

    id: int
    entry_date: date
    title: str | None
    content: str
    status: DiaryStatus
    created_at: datetime
    updated_at: datetime
    analysis: EmotionAnalysisOut | None = None
    songs: list[SongRecOut] = []

    model_config = ConfigDict(from_attributes=True)

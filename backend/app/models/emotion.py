from pydantic import BaseModel, ConfigDict, Field

from app.entity.emotion_analysis_entity import Emotion


class EmotionScores(BaseModel):
    """Per-emotion scores normalised to sum to 1.0 by the LLM."""

    joy: float = Field(0.0, ge=0.0, le=1.0)
    sad: float = Field(0.0, ge=0.0, le=1.0)
    anger: float = Field(0.0, ge=0.0, le=1.0)
    anxiety: float = Field(0.0, ge=0.0, le=1.0)
    calm: float = Field(0.0, ge=0.0, le=1.0)
    embarrassment: float = Field(0.0, ge=0.0, le=1.0)
    envy: float = Field(0.0, ge=0.0, le=1.0)
    boredom: float = Field(0.0, ge=0.0, le=1.0)
    nostalgia: float = Field(0.0, ge=0.0, le=1.0)


class EmotionResult(BaseModel):
    """Schema for enforcing LLM structured output (vLLM guided_json)."""

    primary_emotion: Emotion
    scores: EmotionScores
    summary: str


class EmotionAnalysisOut(BaseModel):
    """API response schema — what frontend receives."""

    primary_emotion: Emotion
    scores: dict[str, float]
    summary: str

    # YOUR NEW FIELDS — frontend needs these to display Nuri's message
    crisis_score: float = Field(default=0.0)
    nuri_message: str = Field(default="")
    suggested_action: str = Field(default="")
    needs_hotline: bool = Field(default=False)

    model_config = ConfigDict(from_attributes=True)
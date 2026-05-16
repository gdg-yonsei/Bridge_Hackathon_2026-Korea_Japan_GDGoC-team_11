from pydantic import BaseModel, ConfigDict, Field

from app.entity.emotion_analysis_entity import Emotion


class EmotionScores(BaseModel):
    """Per-emotion scores normalised to sum to 1.0 by the LLM."""

    joy: float = Field(0.0, ge=0.0, le=1.0)
    sad: float = Field(0.0, ge=0.0, le=1.0)
    anger: float = Field(0.0, ge=0.0, le=1.0)
    anxiety: float = Field(0.0, ge=0.0, le=1.0)
    calm: float = Field(0.0, ge=0.0, le=1.0)


class EmotionResult(BaseModel):
    """Schema for enforcing LLM structured output (vLLM guided_json)."""

    primary_emotion: Emotion
    scores: EmotionScores
    summary: str


class EmotionAnalysisOut(BaseModel):
    """API response schema."""

    primary_emotion: Emotion
    scores: dict[str, float]
    summary: str

    model_config = ConfigDict(from_attributes=True)

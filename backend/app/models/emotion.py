from pydantic import BaseModel, ConfigDict, Field

from app.entity.emotion_analysis_entity import Emotion


class EmotionScores(BaseModel):
    """감정별 점수. 합은 1.0이 되도록 LLM 단에서 정규화."""

    joy: float = Field(0.0, ge=0.0, le=1.0)
    sad: float = Field(0.0, ge=0.0, le=1.0)
    anger: float = Field(0.0, ge=0.0, le=1.0)
    anxiety: float = Field(0.0, ge=0.0, le=1.0)
    calm: float = Field(0.0, ge=0.0, le=1.0)


class EmotionResult(BaseModel):
    """LLM 구조화 출력 강제용 — vLLM guided_json 입력 스키마."""

    primary_emotion: Emotion
    scores: EmotionScores
    summary: str


class EmotionAnalysisOut(BaseModel):
    """API 응답용."""

    primary_emotion: Emotion
    scores: dict[str, float]
    summary: str

    model_config = ConfigDict(from_attributes=True)

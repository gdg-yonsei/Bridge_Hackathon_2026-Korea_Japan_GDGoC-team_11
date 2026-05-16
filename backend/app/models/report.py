from datetime import date

from pydantic import BaseModel, ConfigDict

from app.entity.emotion_analysis_entity import Emotion


class WeeklyReportOut(BaseModel):
    week_start: date
    week_end: date
    dominant_emotion: Emotion
    summary: str
    mood_chart: dict   # 요일별 감정 점수 등 차트 raw data

    model_config = ConfigDict(from_attributes=True)

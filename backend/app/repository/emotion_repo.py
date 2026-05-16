from typing import Any

from sqlalchemy import select

from app.entity.emotion_analysis_entity import EmotionAnalysis
from app.repository.base_repo import BaseRepository


class EmotionRepository(BaseRepository[EmotionAnalysis]):
    model = EmotionAnalysis

    def get_by_entry(self, entry_id: int) -> EmotionAnalysis | None:
        stmt = select(EmotionAnalysis).where(EmotionAnalysis.entry_id == entry_id)
        return self.session.scalars(stmt).one_or_none()

    def upsert(self, entry_id: int, **fields: Any) -> EmotionAnalysis:
        """분석 재실행 시 기존 결과를 덮어쓰기 위한 upsert."""
        existing = self.get_by_entry(entry_id)
        if existing is not None:
            for key, value in fields.items():
                setattr(existing, key, value)
            self.session.flush()
            return existing

        new = EmotionAnalysis(entry_id=entry_id, **fields)
        return self.add(new)

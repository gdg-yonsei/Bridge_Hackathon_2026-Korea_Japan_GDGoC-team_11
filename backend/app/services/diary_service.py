"""일기 분석 백그라운드 오케스트레이션.

현재는 LangGraph 노드가 아직 구현되지 않아 **stub**으로 동작:
  - 상태를 analyzing → done 으로 옮기고
  - placeholder 감정 분석 결과를 저장한다.

vLLM 연동 (PLAN.md §8 #2·#3) 이 끝나면 이 함수의 본체를
`services/chat_service/graph.py` 의 그래프 invoke 로 교체.
"""

from __future__ import annotations

import logging

from app.db.database import SessionLocal
from app.entity.diary_entry_entity import DiaryStatus
from app.entity.emotion_analysis_entity import Emotion
from app.repository.diary_repo import DiaryRepository
from app.repository.emotion_repo import EmotionRepository

logger = logging.getLogger(__name__)


PLACEHOLDER_SUMMARY = "(분석 미구현) vLLM 연동 후 실제 결과로 교체됩니다."
PLACEHOLDER_SCORES = {
    "joy": 0.2,
    "sad": 0.2,
    "anger": 0.0,
    "anxiety": 0.0,
    "calm": 0.6,
}


def trigger_analysis(entry_id: int) -> None:
    """FastAPI BackgroundTasks 진입점.

    독립된 DB 세션을 만들어 작업하고 항상 닫는다.
    예외가 발생하면 entry.status='failed' 로 마킹.
    """
    db = SessionLocal()
    try:
        diaries = DiaryRepository(db)
        entry = diaries.get(entry_id)
        if entry is None:
            logger.warning("trigger_analysis: entry %s not found", entry_id)
            return

        diaries.set_status(entry, DiaryStatus.analyzing)
        db.commit()

        # TODO(vllm): build_graph().invoke({"entry_id": entry.id, "content": entry.content})
        # 결과를 받아 emotion_repo.upsert + song_repo.replace_for_entry 호출.
        EmotionRepository(db).upsert(
            entry_id=entry.id,
            primary_emotion=Emotion.calm,
            scores=PLACEHOLDER_SCORES,
            summary=PLACEHOLDER_SUMMARY,
            model_name="placeholder",
        )

        diaries.set_status(entry, DiaryStatus.done)
        db.commit()

    except Exception:
        logger.exception("trigger_analysis failed for entry %s", entry_id)
        db.rollback()
        _safe_mark_failed(db, entry_id)
    finally:
        db.close()


def _safe_mark_failed(db, entry_id: int) -> None:
    try:
        entry = DiaryRepository(db).get(entry_id)
        if entry is not None:
            DiaryRepository(db).set_status(entry, DiaryStatus.failed)
            db.commit()
    except Exception:
        logger.exception("could not mark entry %s as failed", entry_id)

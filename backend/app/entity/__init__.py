"""SQLAlchemy 매퍼 등록을 위해 모든 엔티티를 import해 두는 곳.

`Base.metadata.create_all` 이나 mapper 설정 시 엔티티들이 import 되어 있어야
relationship 의 forward-ref (`Mapped["DiaryEntry"]` 등)가 해석됨.
"""

from app.entity.base_entity import Base
from app.entity.conversation_entity import Conversation
from app.entity.diary_entry_entity import DiaryEntry, DiaryStatus
from app.entity.emotion_analysis_entity import Emotion, EmotionAnalysis
from app.entity.message_entity import Message, MessageRole
from app.entity.report_entity import Report
from app.entity.song_recommendation_entity import SongRecommendation
from app.entity.user_entity import User

__all__ = [
    "Base",
    "Conversation",
    "DiaryEntry",
    "DiaryStatus",
    "Emotion",
    "EmotionAnalysis",
    "Message",
    "MessageRole",
    "Report",
    "SongRecommendation",
    "User",
]

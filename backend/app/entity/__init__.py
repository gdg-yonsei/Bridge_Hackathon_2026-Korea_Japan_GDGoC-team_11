"""Import all entities here so SQLAlchemy registers them with the mapper.

`Base.metadata.create_all` and relationship forward-refs
(e.g. `Mapped["DiaryEntry"]`) require every entity to be imported before use.
"""

from app.entity.base_entity import Base
from app.entity.conversation_entity import Conversation
from app.entity.diary_entry_entity import DiaryEntry
from app.entity.message_entity import Message
from app.entity.report_entity import Report
from app.entity.user_entity import User

__all__ = [
    "Base",
    "Conversation",
    "DiaryEntry",
    "Message",
    "Report",
    "User",
]

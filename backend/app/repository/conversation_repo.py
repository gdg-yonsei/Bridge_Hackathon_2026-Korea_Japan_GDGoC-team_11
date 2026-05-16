from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.entity.conversation_entity import Conversation
from app.repository.base_repo import BaseRepository


class ConversationRepository(BaseRepository[Conversation]):
    model = Conversation

    def get_by_diary_entry(self, diary_entry_id: int) -> Conversation | None:
        """일기 entry 에 매핑된 대화 (messages 까지 eager load)."""
        stmt = (
            select(Conversation)
            .where(Conversation.diary_entry_id == diary_entry_id)
            .options(selectinload(Conversation.messages))
        )
        return self.session.scalars(stmt).one_or_none()

    def get_or_create_for_diary(
        self, user_id: UUID, diary_entry_id: int
    ) -> Conversation:
        existing = self.get_by_diary_entry(diary_entry_id)
        if existing is not None:
            return existing
        conv = Conversation(user_id=user_id, diary_entry_id=diary_entry_id)
        return self.add(conv)

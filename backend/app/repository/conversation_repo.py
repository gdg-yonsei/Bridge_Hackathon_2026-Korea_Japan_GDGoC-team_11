from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.entity.conversation_entity import Conversation
from app.repository.base_repo import BaseRepository


class ConversationRepository(BaseRepository[Conversation]):
    model = Conversation

    def get_with_messages(self, conversation_id: int) -> Conversation | None:
        stmt = (
            select(Conversation)
            .where(Conversation.id == conversation_id)
            .options(selectinload(Conversation.messages))
        )
        return self.session.scalars(stmt).one_or_none()

    def list_for_user(
        self, user_id: UUID, *, diary_entry_id: int | None = None
    ) -> list[Conversation]:
        stmt = select(Conversation).where(Conversation.user_id == user_id)
        if diary_entry_id is not None:
            stmt = stmt.where(Conversation.diary_entry_id == diary_entry_id)
        stmt = stmt.order_by(Conversation.updated_at.desc())
        return list(self.session.scalars(stmt).all())

    def create(
        self,
        user_id: UUID,
        *,
        diary_entry_id: int | None = None,
        title: str | None = None,
    ) -> Conversation:
        conv = Conversation(
            user_id=user_id,
            diary_entry_id=diary_entry_id,
            title=title,
        )
        return self.add(conv)

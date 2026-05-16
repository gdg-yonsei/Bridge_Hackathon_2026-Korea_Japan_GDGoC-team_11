from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.entity.message_entity import MessageRole


class ChatMessageIn(BaseModel):
    """POST /chat/{diary_entry_id} 요청 body."""

    message: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    role: MessageRole
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatTurnResponse(BaseModel):
    """POST /chat/{diary_entry_id} 응답 — 이번 턴에 추가된 두 메시지."""

    conversation_id: int
    user_message: MessageOut
    assistant_message: MessageOut


class ConversationDetail(BaseModel):
    """GET /chat/{diary_entry_id} 응답 — 전체 히스토리."""

    id: int
    diary_entry_id: int
    created_at: datetime
    updated_at: datetime
    messages: list[MessageOut]

    model_config = ConfigDict(from_attributes=True)

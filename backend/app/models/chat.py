from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.entity.message_entity import MessageRole


class ChatMessageIn(BaseModel):
    """Request body for POST /chat/{diary_entry_id}."""

    message: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    role: MessageRole
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatTurnResponse(BaseModel):
    """Response for POST /chat/{diary_entry_id} — the two messages added this turn."""

    conversation_id: int
    user_message: MessageOut
    assistant_message: MessageOut


class ConversationDetail(BaseModel):
    """Response for GET /chat/{diary_entry_id} — full conversation history."""

    id: int
    diary_entry_id: int
    created_at: datetime
    updated_at: datetime
    messages: list[MessageOut]

    model_config = ConfigDict(from_attributes=True)

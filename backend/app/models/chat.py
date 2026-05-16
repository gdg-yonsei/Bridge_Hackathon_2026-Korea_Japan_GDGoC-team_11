from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.core.enums import MessageRole


class ChatMessageIn(BaseModel):
    """Request body for POST /conversations/{cid}/messages."""

    message: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    role: MessageRole
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatTurnResponse(BaseModel):
    """Response for POST /conversations/{cid}/messages — the two messages added this turn."""

    user_message: MessageOut
    assistant_message: MessageOut


class ConversationCreate(BaseModel):
    """Request body for POST /conversations.

    Both fields optional. `diary_entry_id` null means a standalone chat
    without diary context; setting it binds the conversation to that diary.
    """

    diary_entry_id: int | None = None
    title: str | None = Field(None, max_length=120)


class ConversationSummary(BaseModel):
    """List item for GET /conversations."""

    id: int
    diary_entry_id: int | None = None
    title: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversationDetail(BaseModel):
    """GET /conversations/{cid} — full conversation history."""

    id: int
    diary_entry_id: int | None = None
    title: str | None = None
    created_at: datetime
    updated_at: datetime
    messages: list[MessageOut]

    model_config = ConfigDict(from_attributes=True)

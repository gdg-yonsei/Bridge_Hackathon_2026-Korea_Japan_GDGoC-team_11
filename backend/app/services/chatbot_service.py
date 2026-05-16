"""Chatbot orchestration — Gemini conversational turn.

A conversation is created up-front via the chat router (`POST /conversations`).
This service takes an existing conversation id, appends the new user message,
calls Gemini with the running history, appends the assistant reply, and returns
the two new messages.
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import HTTPException, status
from google.genai import types
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.enums import MessageRole
from app.core.gemini_client import get_gemini_client
from app.entity.conversation_entity import Conversation
from app.entity.diary_entry_entity import DiaryEntry
from app.entity.message_entity import Message
from app.repository.conversation_repo import ConversationRepository
from app.repository.diary_repo import DiaryRepository
from app.services.prompts import SOLIS_CHAT_SYSTEM

logger = logging.getLogger(__name__)


def _build_system_prompt(diary: DiaryEntry | None) -> str:
    if diary is None:
        return SOLIS_CHAT_SYSTEM
    title = diary.title or "(no title)"
    return (
        f"{SOLIS_CHAT_SYSTEM}\n\n"
        "The user has written this diary entry:\n"
        "---\n"
        f"Date: {diary.entry_date.isoformat()}\n"
        f"Title: {title}\n"
        "Content:\n"
        f"{diary.content}\n"
        "---\n"
    )


# Gemini uses "user" and "model" as turn roles.
_ROLE_MAP = {MessageRole.user: "user", MessageRole.assistant: "model"}


def _build_history(conversation: Conversation) -> list[types.Content]:
    history: list[types.Content] = []
    for m in conversation.messages:
        role = _ROLE_MAP.get(m.role)
        if role is None:
            # Stored system messages are folded into system_instruction.
            continue
        history.append(types.Content(role=role, parts=[types.Part.from_text(text=m.content)]))
    return history


def send_message(
    db: Session,
    user_id: UUID,
    conversation_id: int,
    user_message_text: str,
) -> tuple[Conversation, Message, Message]:
    conv_repo = ConversationRepository(db)
    conversation = conv_repo.get_with_messages(conversation_id)
    if conversation is None or conversation.user_id != user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")

    diary: DiaryEntry | None = None
    if conversation.diary_entry_id is not None:
        diary = DiaryRepository(db).get(conversation.diary_entry_id)
        if diary is None or diary.user_id != user_id:
            # Diary was deleted out from under the conversation — treat as standalone.
            diary = None

    user_msg = Message(role=MessageRole.user, content=user_message_text)
    conversation.messages.append(user_msg)
    db.flush()

    history = _build_history(conversation)
    try:
        response = get_gemini_client().models.generate_content(
            model=settings.gemini_model,
            contents=history,
            config=types.GenerateContentConfig(
                system_instruction=_build_system_prompt(diary),
                temperature=0.7,
            ),
        )
        assistant_text = (response.text or "").strip()
    except Exception as e:
        logger.exception("Gemini call failed for conversation %s", conversation_id)
        db.rollback()
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Chatbot unavailable: {e}",
        ) from e

    if not assistant_text:
        assistant_text = "(The chatbot returned an empty response. Try rephrasing your message.)"

    assistant_msg = Message(role=MessageRole.assistant, content=assistant_text)
    conversation.messages.append(assistant_msg)
    db.commit()
    db.refresh(user_msg)
    db.refresh(assistant_msg)

    return conversation, user_msg, assistant_msg

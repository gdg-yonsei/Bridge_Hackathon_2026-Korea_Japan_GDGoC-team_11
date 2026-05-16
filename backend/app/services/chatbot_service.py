"""CBT chatbot orchestration — synchronous vLLM (CBT-Copilot, OpenAI-compatible) call.

A conversation is created up-front via the chat router (`POST /conversations`).
This service takes an existing conversation id, appends the new user message,
calls the LLM, appends the assistant reply, and returns the two new messages.

Latency: ~1-3s for a 3B model.
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.enums import MessageRole
from app.core.llm_client import get_llm_client
from app.entity.conversation_entity import Conversation
from app.entity.diary_entry_entity import DiaryEntry
from app.entity.message_entity import Message
from app.repository.conversation_repo import ConversationRepository
from app.repository.diary_repo import DiaryRepository

logger = logging.getLogger(__name__)


_STANDALONE_SYSTEM_PROMPT = (
    "You are a compassionate Cognitive Behavioral Therapy companion. "
    "Reflect with the user using CBT techniques: validate emotions, gently "
    "identify cognitive distortions, and ask Socratic questions to help "
    "reframe negative patterns. Keep responses concise (2-4 sentences). "
    "Do not diagnose or prescribe medication."
)


def _build_system_prompt(diary: DiaryEntry | None) -> str:
    if diary is None:
        return _STANDALONE_SYSTEM_PROMPT
    title = diary.title or "(no title)"
    return (
        "You are a compassionate Cognitive Behavioral Therapy companion. "
        "The user has written this diary entry:\n\n"
        "---\n"
        f"Date: {diary.entry_date.isoformat()}\n"
        f"Title: {title}\n"
        "Content:\n"
        f"{diary.content}\n"
        "---\n\n"
        "Reflect with the user using CBT techniques: validate emotions, gently "
        "identify cognitive distortions, and ask Socratic questions to help "
        "reframe negative patterns. Keep responses concise (2-4 sentences). "
        "Do not diagnose or prescribe medication."
    )


def _build_llm_messages(
    conversation: Conversation, diary: DiaryEntry | None
) -> list[dict[str, str]]:
    payload: list[dict[str, str]] = [{"role": "system", "content": _build_system_prompt(diary)}]
    for m in conversation.messages:
        # Stored system messages are ignored; the system prompt is rebuilt every turn.
        if m.role == MessageRole.system:
            continue
        payload.append({"role": m.role.value, "content": m.content})
    return payload


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

    llm_payload = _build_llm_messages(conversation, diary)
    try:
        response = get_llm_client().chat.completions.create(
            model=settings.vllm_model,
            messages=llm_payload,
            temperature=0.7,
            max_tokens=512,
        )
        assistant_text = (response.choices[0].message.content or "").strip()
    except Exception as e:
        logger.exception("LLM call failed for conversation %s", conversation_id)
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

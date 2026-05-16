"""CBT 챗봇 오케스트레이션 — vLLM (CBT-Copilot, OpenAI 호환) 호출.

각 일기 entry 마다 정확히 1 개의 conversation 이 생성된다 (첫 메시지 시 자동).
새 user 메시지를 받으면:
  1. (없으면) conversation 생성
  2. user 메시지를 DB 에 append
  3. 시스템 프롬프트 + 일기 컨텍스트 + 전체 대화 히스토리로 LLM 호출
  4. assistant 응답을 DB 에 append
  5. (user, assistant) 메시지 두 개 반환

동기 호출 — 3B 모델이라 보통 1~3 초.
"""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.llm_client import get_llm_client
from app.entity.conversation_entity import Conversation
from app.entity.diary_entry_entity import DiaryEntry
from app.entity.message_entity import Message, MessageRole
from app.repository.conversation_repo import ConversationRepository
from app.repository.diary_repo import DiaryRepository

logger = logging.getLogger(__name__)


def _build_system_prompt(entry: DiaryEntry) -> str:
    title = entry.title or "(no title)"
    return (
        "You are a compassionate Cognitive Behavioral Therapy companion. "
        "The user has written this diary entry:\n\n"
        "---\n"
        f"Date: {entry.entry_date.isoformat()}\n"
        f"Title: {title}\n"
        "Content:\n"
        f"{entry.content}\n"
        "---\n\n"
        "Reflect with the user using CBT techniques: validate emotions, gently "
        "identify cognitive distortions, and ask Socratic questions to help "
        "reframe negative patterns. Keep responses concise (2-4 sentences). "
        "Do not diagnose or prescribe medication."
    )


def _build_llm_messages(
    conversation: Conversation, entry: DiaryEntry
) -> list[dict[str, str]]:
    payload: list[dict[str, str]] = [
        {"role": "system", "content": _build_system_prompt(entry)}
    ]
    for m in conversation.messages:
        if m.role == MessageRole.system:
            # 저장된 system 메시지는 무시 (시스템 프롬프트는 매 턴 동적 재생성).
            continue
        payload.append({"role": m.role.value, "content": m.content})
    return payload


def send_message(
    db: Session,
    user_id: UUID,
    diary_entry_id: int,
    user_message_text: str,
) -> tuple[Conversation, Message, Message]:
    diary = DiaryRepository(db).get(diary_entry_id)
    if diary is None or diary.user_id != user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Diary not found")

    conv_repo = ConversationRepository(db)
    conversation = conv_repo.get_or_create_for_diary(user_id, diary_entry_id)

    # 1) user 메시지 append (relationship 으로 FK·in-memory 모두 일관)
    user_msg = Message(role=MessageRole.user, content=user_message_text)
    conversation.messages.append(user_msg)
    db.flush()

    # 2) LLM 호출
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
        logger.exception("LLM call failed for diary %s", diary_entry_id)
        db.rollback()
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Chatbot unavailable: {e}",
        ) from e

    if not assistant_text:
        # 모델이 빈 응답을 줘도 fallback 으로 안내 텍스트 저장
        assistant_text = "(The chatbot returned an empty response. Try rephrasing your message.)"

    # 3) assistant 메시지 append + commit
    assistant_msg = Message(role=MessageRole.assistant, content=assistant_text)
    conversation.messages.append(assistant_msg)
    db.commit()
    db.refresh(user_msg)
    db.refresh(assistant_msg)

    return conversation, user_msg, assistant_msg

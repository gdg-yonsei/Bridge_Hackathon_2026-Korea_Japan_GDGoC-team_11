from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.entity.user_entity import User
from app.models.chat import (
    ChatMessageIn,
    ChatTurnResponse,
    ConversationDetail,
    MessageOut,
)
from app.repository.conversation_repo import ConversationRepository
from app.repository.diary_repo import DiaryRepository
from app.services.chatbot_service import send_message

router = APIRouter()


@router.post("/{diary_entry_id}", response_model=ChatTurnResponse)
def chat(
    diary_entry_id: int,
    payload: ChatMessageIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatTurnResponse:
    """이 일기에 대한 CBT 챗봇에 메시지 전송.

    첫 호출 시 conversation 자동 생성. user 와 assistant 메시지를 모두 DB 에 저장
    한 뒤 두 개 다 반환. 동기 호출 — vLLM 응답까지 1~3 초 정도 걸림.
    """
    conversation, user_msg, assistant_msg = send_message(
        db=db,
        user_id=user.id,
        diary_entry_id=diary_entry_id,
        user_message_text=payload.message,
    )
    return ChatTurnResponse(
        conversation_id=conversation.id,
        user_message=MessageOut.model_validate(user_msg),
        assistant_message=MessageOut.model_validate(assistant_msg),
    )


@router.get("/{diary_entry_id}", response_model=ConversationDetail)
def get_chat_history(
    diary_entry_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationDetail:
    """이 일기의 대화 전체 히스토리. 대화가 아직 없으면 404."""
    diary = DiaryRepository(db).get(diary_entry_id)
    if diary is None or diary.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Diary not found")

    conversation = ConversationRepository(db).get_by_diary_entry(diary_entry_id)
    if conversation is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "No conversation yet for this diary"
        )
    return ConversationDetail.model_validate(conversation)


@router.delete("/{diary_entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_chat(
    diary_entry_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """대화 삭제 (메시지 CASCADE)."""
    diary = DiaryRepository(db).get(diary_entry_id)
    if diary is None or diary.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Diary not found")

    conv_repo = ConversationRepository(db)
    conversation = conv_repo.get_by_diary_entry(diary_entry_id)
    if conversation is None:
        return  # 이미 없음 — 204
    conv_repo.delete(conversation)
    db.commit()

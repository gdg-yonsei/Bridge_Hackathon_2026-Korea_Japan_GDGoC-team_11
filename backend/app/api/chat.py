from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.entity.user_entity import User
from app.models.chat import (
    ChatMessageIn,
    ChatTurnResponse,
    ConversationCreate,
    ConversationDetail,
    ConversationSummary,
    MessageOut,
)
from app.repository.conversation_repo import ConversationRepository
from app.repository.diary_repo import DiaryRepository
from app.services.chatbot_service import send_message

router = APIRouter()


@router.get("", response_model=list[ConversationSummary])
def list_conversations(
    diary_id: int | None = Query(
        None, description="Optional filter — only conversations bound to this diary entry"
    ),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ConversationSummary]:
    conversations = ConversationRepository(db).list_for_user(user.id, diary_entry_id=diary_id)
    return [ConversationSummary.model_validate(c) for c in conversations]


@router.post("", response_model=ConversationSummary, status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: ConversationCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationSummary:
    diary_id = payload.diary_entry_id
    if diary_id is not None:
        diary = DiaryRepository(db).get(diary_id)
        if diary is None or diary.user_id != user.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Diary not found")

    conversation = ConversationRepository(db).create(
        user.id, diary_entry_id=diary_id, title=payload.title
    )
    db.commit()
    db.refresh(conversation)
    return ConversationSummary.model_validate(conversation)


@router.get("/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ConversationDetail:
    conversation = ConversationRepository(db).get_with_messages(conversation_id)
    if conversation is None or conversation.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return ConversationDetail.model_validate(conversation)


@router.post("/{conversation_id}/messages", response_model=ChatTurnResponse)
def post_message(
    conversation_id: int,
    payload: ChatMessageIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatTurnResponse:
    _conversation, user_msg, assistant_msg = send_message(
        db=db,
        user_id=user.id,
        conversation_id=conversation_id,
        user_message_text=payload.message,
    )
    return ChatTurnResponse(
        user_message=MessageOut.model_validate(user_msg),
        assistant_message=MessageOut.model_validate(assistant_msg),
    )


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    conv_repo = ConversationRepository(db)
    conversation = conv_repo.get(conversation_id)
    if conversation is None or conversation.user_id != user.id:
        # Idempotent: 204 even if it's already gone.
        return
    conv_repo.delete(conversation)
    db.commit()

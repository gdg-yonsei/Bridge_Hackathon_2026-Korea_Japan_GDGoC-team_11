"""Auth router.

Sign-up and login are handled entirely by the frontend via Supabase Auth
(`signUp` / `signInWithPassword` from `@supabase/supabase-js`).
The backend only verifies tokens, so this router is limited to identity
retrieval and profile updates.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db
from app.entity.user_entity import User
from app.models.user import ProfileUpdate, UserOut

router = APIRouter()


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if payload.nickname is not None:
        user.nickname = payload.nickname
    db.commit()
    db.refresh(user)
    return user

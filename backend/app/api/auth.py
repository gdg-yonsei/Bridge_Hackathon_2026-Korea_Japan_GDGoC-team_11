"""인증 라우터.

회원가입/로그인은 Supabase Auth 가 프론트엔드에서 직접 처리한다
(`@supabase/supabase-js` 의 `signUp` / `signInWithPassword`).
백엔드는 토큰 검증만 담당하므로 여기엔 사용자 식별 / 프로필 갱신 정도만 둔다.
"""

from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user
from app.entity.user_entity import User
from app.models.user import ProfileUpdate, UserOut
from app.repository.user_repo import UserRepository
from app.core.dependencies import get_db
from sqlalchemy.orm import Session

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

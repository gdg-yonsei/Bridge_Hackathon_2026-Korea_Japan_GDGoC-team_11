from collections.abc import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import verify_supabase_token
from app.db.database import SessionLocal
from app.entity.user_entity import User
from app.repository.user_repo import UserRepository

# tokenUrl 은 OpenAPI 문서용일 뿐 실제로 사용되지 않는다 (로그인은 Supabase 가 처리).
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=True)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """프론트가 Authorization: Bearer <supabase access_token> 으로 호출.

    토큰 검증 후 profiles 행이 없으면 자동 생성 (Supabase auth.users 와 동기).
    """
    claims = verify_supabase_token(token)
    if claims is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    users = UserRepository(db)
    user = users.upsert_from_supabase(
        user_id=claims.user_id,
        email=claims.email,
    )
    db.commit()
    db.refresh(user)
    return user

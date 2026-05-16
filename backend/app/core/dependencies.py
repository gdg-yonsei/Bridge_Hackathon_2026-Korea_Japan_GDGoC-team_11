from collections.abc import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import verify_supabase_token
from app.db.database import SessionLocal
from app.entity.user_entity import User
from app.repository.user_repo import UserRepository

# tokenUrl is only for OpenAPI docs — actual login is handled by Supabase on the frontend.
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
    """Called with Authorization: Bearer <supabase access_token>.

    Verifies the token, then upserts a profiles row if one does not exist yet.
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

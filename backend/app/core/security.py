"""Supabase JWT 검증 유틸.

Supabase가 발급한 access token 은 HS256 으로 서명되어 있고,
서명 키는 Settings → API → JWT Secret 에서 가져온다.
페이로드에는 `sub` (UUID, auth.users.id), `email`, `role`, `aud="authenticated"`, `exp` 등이 들어있다.
"""

from dataclasses import dataclass
from uuid import UUID

from jose import JWTError, jwt

from app.core.config import settings

ALGORITHM = "HS256"
SUPABASE_AUDIENCE = "authenticated"


@dataclass(frozen=True)
class SupabaseClaims:
    """검증된 Supabase JWT 의 핵심 필드."""

    user_id: UUID
    email: str | None
    role: str | None


def verify_supabase_token(token: str) -> SupabaseClaims | None:
    """Supabase JWT 를 검증하고 핵심 클레임을 반환. 실패 시 None."""
    if not settings.supabase_jwt_secret:
        # 설정 누락 — 호출자가 401 로 응답하게 None 반환
        return None

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=[ALGORITHM],
            audience=SUPABASE_AUDIENCE,
        )
    except JWTError:
        return None

    sub = payload.get("sub")
    if sub is None:
        return None

    try:
        user_id = UUID(str(sub))
    except (TypeError, ValueError):
        return None

    return SupabaseClaims(
        user_id=user_id,
        email=payload.get("email"),
        role=payload.get("role"),
    )

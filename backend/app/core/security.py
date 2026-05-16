"""Supabase JWT verification utility.

Supabase access tokens are signed with HS256.
The signing key comes from Settings → API → JWT Secret.
The payload contains `sub` (UUID = auth.users.id), `email`, `role`,
`aud="authenticated"`, `exp`, and other standard claims.
"""

from dataclasses import dataclass
from uuid import UUID

from jose import JWTError, jwt

from app.core.config import settings

ALGORITHM = "HS256"
SUPABASE_AUDIENCE = "authenticated"


@dataclass(frozen=True)
class SupabaseClaims:
    """Key fields extracted from a verified Supabase JWT."""

    user_id: UUID
    email: str | None
    role: str | None


def verify_supabase_token(token: str) -> SupabaseClaims | None:
    """Verify a Supabase JWT and return the core claims. Returns None on failure."""
    if not settings.supabase_jwt_secret:
        # Missing config — let the caller respond with 401.
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

"""Supabase JWT verification.

Supabase's current key system signs access tokens with the project's ECC
(P-256) private key (ES256). We fetch the public JWKS from the project's
`/auth/v1/.well-known/jwks.json` once per process (with a soft TTL) and
verify token signatures against the JWK whose `kid` matches the token header.

Legacy HS256 (shared `SUPABASE_JWT_SECRET`) is kept as a fallback so tokens
signed by a not-yet-revoked legacy key continue to verify during rotation.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from threading import Lock
from uuid import UUID

import httpx
from jose import JWTError, jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

SUPABASE_AUDIENCE = "authenticated"
_JWKS_PATH = "/auth/v1/.well-known/jwks.json"
_JWKS_TTL_SECONDS = 3600

_jwks_cache: dict | None = None
_jwks_fetched_at: float = 0.0
_jwks_lock = Lock()


@dataclass(frozen=True)
class SupabaseClaims:
    """Key fields extracted from a verified Supabase JWT."""

    user_id: UUID
    email: str | None
    role: str | None


def _fetch_jwks() -> dict | None:
    global _jwks_cache, _jwks_fetched_at
    with _jwks_lock:
        now = time.monotonic()
        if _jwks_cache is not None and (now - _jwks_fetched_at) < _JWKS_TTL_SECONDS:
            return _jwks_cache
        if not settings.supabase_url:
            return _jwks_cache
        url = settings.supabase_url.rstrip("/") + _JWKS_PATH
        try:
            response = httpx.get(url, timeout=5.0)
            response.raise_for_status()
            _jwks_cache = response.json()
            _jwks_fetched_at = now
        except (httpx.HTTPError, ValueError) as exc:
            # Serve stale cache (if any) on transient failure rather than 401-storming.
            logger.warning("Failed to fetch JWKS from %s: %s", url, exc)
        return _jwks_cache


def _find_jwk(jwks: dict, kid: str | None) -> dict | None:
    keys = jwks.get("keys") or []
    if kid is None:
        return keys[0] if len(keys) == 1 else None
    return next((k for k in keys if k.get("kid") == kid), None)


def verify_supabase_token(token: str) -> SupabaseClaims | None:
    """Verify a Supabase JWT and return the core claims. Returns None on any failure."""
    try:
        header = jwt.get_unverified_header(token)
    except JWTError:
        return None

    alg = header.get("alg")
    kid = header.get("kid")

    if alg in {"ES256", "RS256"}:
        jwks = _fetch_jwks()
        if not jwks:
            return None
        jwk = _find_jwk(jwks, kid)
        if jwk is None:
            return None
        key: dict | str = jwk
        algorithms = [alg]
    elif alg == "HS256":
        if not settings.supabase_jwt_secret:
            return None
        key = settings.supabase_jwt_secret
        algorithms = ["HS256"]
    else:
        return None

    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=algorithms,
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

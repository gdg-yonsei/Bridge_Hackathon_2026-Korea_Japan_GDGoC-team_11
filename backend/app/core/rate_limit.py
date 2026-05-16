"""Rate limiting for LLM-bound endpoints.

Keyed by authenticated user id when available, else by client IP. Uses
slowapi's in-memory backend — fine for a single uvicorn worker; swap the
`storage_uri` to redis if we scale out.
"""

from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.responses import JSONResponse


def _user_or_ip(request: Request) -> str:
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        # Bucket per token tail — avoids decoding the JWT just to derive the key.
        return f"token:{auth[-24:]}"
    return get_remote_address(request)


limiter = Limiter(key_func=_user_or_ip)


def rate_limit_exceeded_handler(_request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded: {exc.detail}"},
    )

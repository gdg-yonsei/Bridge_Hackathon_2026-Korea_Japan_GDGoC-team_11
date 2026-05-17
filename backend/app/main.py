import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

from app.api import auth, chat, diary, report, song, therapist
from app.core.config import settings
from app.core.rate_limit import limiter, rate_limit_exceeded_handler

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(title="GDGoC Team 1 Backend", version="0.1.0")

# slowapi attaches itself via app.state.limiter + an exception handler.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

_allowed = settings.cors_origin_list or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed,
    # Bearer tokens, not cookies — credentials don't add anything and break wildcard CORS.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(diary.router, prefix="/diary", tags=["diary"])
app.include_router(chat.router, prefix="/conversations", tags=["chat"])
app.include_router(report.router, prefix="/reports", tags=["reports"])
app.include_router(therapist.router)
app.include_router(song.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

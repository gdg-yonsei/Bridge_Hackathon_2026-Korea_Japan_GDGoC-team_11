"""Lazy SQLAlchemy engine + session factory.

엔진 생성을 import 시점에서 지연시킨다 — DATABASE_URL 이 비어 있어도
앱이 부팅되어 /health, /docs 가 동작하도록 하기 위함. DB 가 실제로
필요한 엔드포인트만 500 으로 명확한 에러를 낸다.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

if TYPE_CHECKING:
    from sqlalchemy.engine import Engine
    from sqlalchemy.orm import Session

_MISSING_URL = (
    "DATABASE_URL is empty. Copy backend/.env.example to backend/.env "
    "and fill in the Supabase connection string."
)

if settings.database_url:
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
else:
    engine = None  # type: ignore[assignment]

    def SessionLocal(*_args, **_kwargs) -> "Session":  # type: ignore[no-redef]
        raise RuntimeError(_MISSING_URL)


def require_engine() -> "Engine":
    """init_db / Alembic 등 스크립트에서 사용. 엔진이 없으면 명확히 에러."""
    if engine is None:
        raise RuntimeError(_MISSING_URL)
    return engine

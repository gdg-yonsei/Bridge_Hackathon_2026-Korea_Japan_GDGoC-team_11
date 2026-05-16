"""Lazy SQLAlchemy engine + session factory.

Engine creation is deferred from import time so the app can boot
(serving /health and /docs) even when DATABASE_URL is empty.
Only endpoints that actually need the DB will fail with a clear error.
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

    def SessionLocal(*_args, **_kwargs) -> Session:  # type: ignore[no-redef]
        raise RuntimeError(_MISSING_URL)


def require_engine() -> Engine:
    """Used by init_db / Alembic scripts. Raises clearly if the engine is missing."""
    if engine is None:
        raise RuntimeError(_MISSING_URL)
    return engine

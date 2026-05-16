"""Table creation helper.

In production, apply backend/supabase/schema.sql via the Supabase SQL Editor.
Use this only for quick local bootstrapping when you need create_all.

Run:
    uv run python -m app.db.init_db
"""

from app.db.database import require_engine
from app.entity import Base  # noqa: F401 — ensures all entities are registered with the mapper


def init_db() -> None:
    Base.metadata.create_all(bind=require_engine())


if __name__ == "__main__":
    init_db()
    print("DB tables created.")

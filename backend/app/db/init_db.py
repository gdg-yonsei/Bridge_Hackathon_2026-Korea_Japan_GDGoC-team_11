"""테이블 생성 헬퍼.

운영에서는 backend/supabase/schema.sql 을 Supabase SQL Editor 에 붙여넣는
방식을 사용하지만, 빠른 로컬 부트스트랩이 필요할 때만 이걸로 create_all 실행.

실행:
    uv run python -m app.db.init_db
"""

from app.db.database import require_engine
from app.entity import Base  # noqa: F401 — 모든 엔티티가 mapper 에 등록되도록


def init_db() -> None:
    Base.metadata.create_all(bind=require_engine())


if __name__ == "__main__":
    init_db()
    print("DB 테이블 생성 완료.")

"""테이블 생성 헬퍼. 프로덕션에선 Alembic 마이그레이션을 쓰고,
개발 환경 부트스트랩 용도로만 사용.

실행:
    uv run python -m app.db.init_db
"""

from app.db.database import engine
from app.entity import Base  # noqa: F401 — 모든 엔티티가 mapper에 등록되도록


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("DB 테이블 생성 완료.")

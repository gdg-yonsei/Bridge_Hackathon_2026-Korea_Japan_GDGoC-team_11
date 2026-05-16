from uuid import UUID

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.entity.user_entity import User
from app.repository.base_repo import BaseRepository


class UserRepository(BaseRepository[User]):
    """Supabase profiles 테이블 접근.

    `get(user_id)` 는 BaseRepository.get 으로 동작 (UUID 가 PK 라서 그대로 OK).
    """

    model = User

    def upsert_from_supabase(
        self,
        user_id: UUID,
        email: str | None,
        nickname: str | None = None,
    ) -> User:
        """Supabase 첫 로그인 시 profile 생성 또는 email 갱신.

        Postgres ON CONFLICT 로 idempotent 하게 upsert. nickname 은
        이미 존재할 경우 사용자가 설정한 값을 보존 (덮어쓰지 않음).
        """
        stmt = (
            pg_insert(User)
            .values(id=user_id, email=email, nickname=nickname)
            .on_conflict_do_update(
                index_elements=[User.id],
                set_={"email": email},
            )
            .returning(User)
        )
        row = self.session.execute(stmt).scalar_one()
        self.session.flush()
        return row

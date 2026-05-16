from uuid import UUID

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.entity.user_entity import User
from app.repository.base_repo import BaseRepository


class UserRepository(BaseRepository[User]):
    """Access layer for the Supabase profiles table.

    `get(user_id)` works via BaseRepository.get since UUID is the PK.
    """

    model = User

    def upsert_from_supabase(
        self,
        user_id: UUID,
        email: str | None,
        nickname: str | None = None,
    ) -> User:
        """Create or refresh a profile row on first Supabase login.

        Idempotent via Postgres ON CONFLICT. An existing nickname is preserved
        (not overwritten) because the user may have customised it.
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

from sqlalchemy import select

from app.entity.user_entity import User
from app.repository.base_repo import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        return self.session.scalars(stmt).one_or_none()

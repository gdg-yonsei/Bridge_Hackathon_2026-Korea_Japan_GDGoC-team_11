from typing import Generic, TypeVar

from sqlalchemy.orm import Session

from app.entity.base_entity import Base

T = TypeVar("T", bound=Base)


class BaseRepository(Generic[T]):
    """SQLAlchemy 2.0 세션 기반 공통 CRUD.

    서브클래스는 `model: type[T]`만 지정하면 됨.
    트랜잭션 커밋은 호출자(서비스 or get_db 의존성) 책임.
    """

    model: type[T]

    def __init__(self, session: Session):
        self.session = session

    def get(self, id_: int) -> T | None:
        return self.session.get(self.model, id_)

    def add(self, obj: T) -> T:
        self.session.add(obj)
        self.session.flush()
        return obj

    def delete(self, obj: T) -> None:
        self.session.delete(obj)
        self.session.flush()

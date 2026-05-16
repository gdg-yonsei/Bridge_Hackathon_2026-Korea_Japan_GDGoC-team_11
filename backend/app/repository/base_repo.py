from typing import Generic, TypeVar

from sqlalchemy.orm import Session

from app.entity.base_entity import Base

T = TypeVar("T", bound=Base)


class BaseRepository(Generic[T]):
    """Common CRUD over a SQLAlchemy 2.0 session.

    Subclasses only need to declare `model: type[T]`.
    Transaction commits are the caller's responsibility (service layer or get_db dependency).
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

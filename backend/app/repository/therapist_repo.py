from sqlalchemy import select

from app.entity.therapist_entity import Therapist
from app.repository.base_repo import BaseRepository


class TherapistRepository(BaseRepository[Therapist]):
    model = Therapist

    def list_all(self) -> list[Therapist]:
        return list(self.session.scalars(select(Therapist)).all())

    def list_by_location_suffix(self, suffix: str) -> list[Therapist]:
        """Filter therapists whose `location` ends with the given country name
        (e.g. ``"Korea"`` or ``"Japan"``).
        """
        stmt = select(Therapist).where(Therapist.location.like(f"%{suffix}"))
        return list(self.session.scalars(stmt).all())

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

    def filter(
        self,
        *,
        country: str | None = None,
        language: str | None = None,
        concern: str | None = None,
        emotion: str | None = None,
        online: bool | None = None,
        in_person: bool | None = None,
        min_rating: float | None = None,
    ) -> list[Therapist]:
        """Return therapists matching all of the (optional) constraints (AND).

        - country: matches the suffix of the `location` text column
        - language / concern / emotion: JSONB array containment (`@>`) on the
          corresponding column — the row's array must include the given value
        - online / in_person / min_rating: direct column predicates
        """
        stmt = select(Therapist)
        if country is not None:
            stmt = stmt.where(Therapist.location.like(f"%{country}"))
        # Seed data convention: languages are Title-Case ("Korean"), concerns
        # and emotions are lowercase ("anxiety", "sad"). Normalize the inputs
        # so the API isn't fussy about casing.
        if language is not None:
            stmt = stmt.where(Therapist.languages.contains([language.title()]))
        if concern is not None:
            stmt = stmt.where(Therapist.specializes_in.contains([concern.lower()]))
        if emotion is not None:
            stmt = stmt.where(Therapist.emotions_treated.contains([emotion.lower()]))
        if online is not None:
            stmt = stmt.where(Therapist.online_available.is_(online))
        if in_person is not None:
            stmt = stmt.where(Therapist.in_person_available.is_(in_person))
        if min_rating is not None:
            stmt = stmt.where(Therapist.rating >= min_rating)
        return list(self.session.scalars(stmt).all())

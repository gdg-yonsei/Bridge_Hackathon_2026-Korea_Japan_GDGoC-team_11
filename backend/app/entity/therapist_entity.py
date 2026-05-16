from __future__ import annotations

from sqlalchemy import Boolean, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.entity.base_entity import Base


class Therapist(Base):
    """Therapist directory. Read-only seeded data — see schema.sql.

    Array-of-string columns (languages, certifications, approach,
    specializes_in, emotions_treated) use JSONB so the schema stays
    flexible for the hackathon dataset.
    """

    __tablename__ = "therapists"

    therapist_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    location: Mapped[str] = mapped_column(String(120))
    languages: Mapped[list[str]] = mapped_column(JSONB)
    certifications: Mapped[list[str]] = mapped_column(JSONB)
    approach: Mapped[list[str]] = mapped_column(JSONB)
    specializes_in: Mapped[list[str]] = mapped_column(JSONB)
    emotions_treated: Mapped[list[str]] = mapped_column(JSONB)
    online_available: Mapped[bool] = mapped_column(Boolean, default=False)
    in_person_available: Mapped[bool] = mapped_column(Boolean, default=False)
    years_experience: Mapped[int | None] = mapped_column(Integer)
    education: Mapped[str | None] = mapped_column(Text)
    bio: Mapped[str | None] = mapped_column(Text)
    price_per_session: Mapped[str | None] = mapped_column(String(64))
    rating: Mapped[float | None] = mapped_column(Float)

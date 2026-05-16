from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.entity.base_entity import Base


class Conversation(Base):
    """CBT chatbot conversation — exactly one per diary entry (UNIQUE diary_entry_id)."""

    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    diary_entry_id: Mapped[int] = mapped_column(
        ForeignKey("diary_entries.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.id",
    )

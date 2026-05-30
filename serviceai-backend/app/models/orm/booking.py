import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"


class Booking(Base):
    __tablename__ = "bookings_v2"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    legacy_booking_id: Mapped[str | None] = mapped_column(String(128), unique=True)
    user_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    provider_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("providers.id", ondelete="CASCADE"), nullable=False
    )
    service_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus), default=BookingStatus.PENDING, nullable=False
    )
    location_address: Mapped[str | None] = mapped_column(String(512))
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    price_agreed: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    status_history: Mapped[list["BookingStatusHistory"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan"
    )


class BookingStatusHistory(Base):
    __tablename__ = "booking_status_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("bookings_v2.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), nullable=False)
    changed_by: Mapped[str | None] = mapped_column(String(128))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    booking: Mapped["Booking"] = relationship(back_populates="status_history")


class VoiceCallLog(Base):
    __tablename__ = "voice_call_logs_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    booking_id: Mapped[str | None] = mapped_column(String(128))
    call_type: Mapped[str] = mapped_column(String(50), nullable=False)
    provider_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    provider_name: Mapped[str] = mapped_column(String(255), nullable=False)
    user_name: Mapped[str] = mapped_column(String(255), nullable=False)
    outcome: Mapped[str | None] = mapped_column(String(50))
    transcript: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

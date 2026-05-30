from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Provider(Base):
    __tablename__ = "providers"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    area: Mapped[str] = mapped_column(String(100), nullable=False)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    profile: Mapped["ProviderProfile"] = relationship(
        back_populates="provider", uselist=False, cascade="all, delete-orphan"
    )
    services: Mapped[list["ProviderService"]] = relationship(
        back_populates="provider", cascade="all, delete-orphan"
    )
    portfolio: Mapped[list["ProviderPortfolio"]] = relationship(
        back_populates="provider", cascade="all, delete-orphan"
    )
    reviews: Mapped[list["ProviderReview"]] = relationship(
        back_populates="provider", cascade="all, delete-orphan"
    )
    availability: Mapped[list["ProviderAvailability"]] = relationship(
        back_populates="provider", cascade="all, delete-orphan"
    )


class ProviderProfile(Base):
    __tablename__ = "provider_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("providers.id", ondelete="CASCADE"), nullable=False
    )
    bio: Mapped[str | None] = mapped_column(Text)
    experience_years: Mapped[int] = mapped_column(Integer, default=0)
    skills: Mapped[list] = mapped_column(JSONB, default=list)
    languages: Mapped[list] = mapped_column(JSONB, default=list)
    price_range: Mapped[dict] = mapped_column(JSONB, default=dict)
    website: Mapped[str | None] = mapped_column(String(512))
    linkedin: Mapped[str | None] = mapped_column(String(512))
    cover_image_url: Mapped[str | None] = mapped_column(String(512))

    provider: Mapped["Provider"] = relationship(back_populates="profile")


class ProviderService(Base):
    __tablename__ = "provider_services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("providers.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    price_min: Mapped[int] = mapped_column(Integer, default=0)
    price_max: Mapped[int] = mapped_column(Integer, default=0)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    provider: Mapped["Provider"] = relationship(back_populates="services")


class ProviderPortfolio(Base):
    __tablename__ = "provider_portfolio"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("providers.id", ondelete="CASCADE"), nullable=False
    )
    image_url: Mapped[str] = mapped_column(String(512), nullable=False)
    caption: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    provider: Mapped["Provider"] = relationship(back_populates="portfolio")


class ProviderReview(Base):
    __tablename__ = "provider_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("providers.id", ondelete="CASCADE"), nullable=False
    )
    reviewer_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    provider: Mapped["Provider"] = relationship(back_populates="reviews")


class ProviderAvailability(Base):
    __tablename__ = "provider_availability"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("providers.id", ondelete="CASCADE"), nullable=False
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Mon, 6=Sun
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)  # HH:MM
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)

    provider: Mapped["Provider"] = relationship(back_populates="availability")

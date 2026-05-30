import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserDevice(Base):
    __tablename__ = "user_devices"

    id: Mapped[str] = mapped_column(
        String(128), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(128), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    device_token: Mapped[str | None] = mapped_column(String(512))
    public_key: Mapped[str | None] = mapped_column(Text)  # RSA-OAEP public key for E2EE
    platform: Mapped[str] = mapped_column(String(20), default="unknown")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_seen: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

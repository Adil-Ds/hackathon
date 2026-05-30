"""initial schema

Revision ID: 01c6a2c1157e
Revises:
Create Date: 2026-05-29 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "01c6a2c1157e"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("firebase_uid", sa.String(128), nullable=False, unique=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "role",
            sa.Enum("user", "provider", "admin", name="userrole"),
            nullable=False,
            server_default="user",
        ),
        sa.Column("phone", sa.String(20)),
        sa.Column("avatar_url", sa.String(512)),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("NOW()"),
        ),
    )

    op.create_table(
        "providers",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("business_name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("area", sa.String(100), nullable=False),
        sa.Column("rating", sa.Float, server_default="0.0"),
        sa.Column("review_count", sa.Integer, server_default="0"),
        sa.Column("is_verified", sa.Boolean, server_default="false"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    op.create_table(
        "provider_profiles",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("provider_id", sa.String(128), sa.ForeignKey("providers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("bio", sa.Text),
        sa.Column("experience_years", sa.Integer, server_default="0"),
        sa.Column("skills", postgresql.JSONB, server_default="[]"),
        sa.Column("languages", postgresql.JSONB, server_default="[]"),
        sa.Column("price_range", postgresql.JSONB, server_default="{}"),
        sa.Column("website", sa.String(512)),
        sa.Column("linkedin", sa.String(512)),
        sa.Column("cover_image_url", sa.String(512)),
    )

    op.create_table(
        "provider_services",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("provider_id", sa.String(128), sa.ForeignKey("providers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("price_min", sa.Integer, server_default="0"),
        sa.Column("price_max", sa.Integer, server_default="0"),
        sa.Column("duration_minutes", sa.Integer, server_default="60"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
    )

    op.create_table(
        "provider_portfolio",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("provider_id", sa.String(128), sa.ForeignKey("providers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("image_url", sa.String(512), nullable=False),
        sa.Column("caption", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    op.create_table(
        "provider_reviews",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("provider_id", sa.String(128), sa.ForeignKey("providers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reviewer_id", sa.String(128), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rating", sa.Integer, nullable=False),
        sa.Column("comment", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    op.create_table(
        "provider_availability",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("provider_id", sa.String(128), sa.ForeignKey("providers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_of_week", sa.Integer, nullable=False),
        sa.Column("start_time", sa.String(5), nullable=False),
        sa.Column("end_time", sa.String(5), nullable=False),
        sa.Column("is_available", sa.Boolean, server_default="true"),
    )

    op.create_table(
        "bookings_v2",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("legacy_booking_id", sa.String(128), unique=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider_id", sa.String(128), sa.ForeignKey("providers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("service_name", sa.String(255), nullable=False),
        sa.Column(
            "status",
            sa.Enum("PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REJECTED", name="bookingstatus"),
            nullable=False,
            server_default="PENDING",
        ),
        sa.Column("location_address", sa.String(512)),
        sa.Column("scheduled_at", sa.DateTime(timezone=True)),
        sa.Column("price_agreed", sa.Integer, server_default="0"),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    op.create_table(
        "booking_status_history",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("booking_id", sa.String(128), sa.ForeignKey("bookings_v2.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.Enum("PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "REJECTED", name="bookingstatus"), nullable=False),
        sa.Column("changed_by", sa.String(128)),
        sa.Column("note", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    op.create_table(
        "voice_call_logs_v2",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("booking_id", sa.String(128)),
        sa.Column("call_type", sa.String(50), nullable=False),
        sa.Column("provider_phone", sa.String(20), nullable=False),
        sa.Column("provider_name", sa.String(255), nullable=False),
        sa.Column("user_name", sa.String(255), nullable=False),
        sa.Column("outcome", sa.String(50)),
        sa.Column("transcript", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    op.create_table(
        "conversations",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("encrypted_keys", postgresql.JSONB, server_default="{}"),
        sa.Column("booking_id", sa.String(128)),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("last_message_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "conversation_participants",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("conversation_id", sa.String(128), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("last_read_at", sa.DateTime(timezone=True)),
    )

    op.create_table(
        "messages",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("conversation_id", sa.String(128), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", sa.String(128), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("encrypted_payload", sa.Text, nullable=False),
        sa.Column("message_type", sa.String(20), server_default="text"),
        sa.Column("is_deleted", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    op.create_table(
        "message_read_receipts",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("message_id", sa.String(128), sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "BOOKING_CREATED", "BOOKING_CONFIRMED", "BOOKING_CANCELLED",
                "NEW_MESSAGE", "CALL_INCOMING", "REVIEW_RECEIVED", "SYSTEM",
                name="notificationtype",
            ),
            nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("data", postgresql.JSONB),
        sa.Column("is_read", sa.Boolean, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    op.create_table(
        "user_devices",
        sa.Column("id", sa.String(128), primary_key=True),
        sa.Column("user_id", sa.String(128), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_token", sa.String(512)),
        sa.Column("public_key", sa.Text),
        sa.Column("platform", sa.String(20), server_default="unknown"),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("last_seen", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("NOW()")),
    )

    # Indexes
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])
    op.create_index("ix_messages_created_at", "messages", ["created_at"])
    op.create_index("ix_conversation_participants_user_id", "conversation_participants", ["user_id"])
    op.create_index("ix_bookings_v2_user_id", "bookings_v2", ["user_id"])
    op.create_index("ix_bookings_v2_provider_id", "bookings_v2", ["provider_id"])
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])


def downgrade() -> None:
    op.drop_table("user_devices")
    op.drop_table("notifications")
    op.drop_table("message_read_receipts")
    op.drop_table("messages")
    op.drop_table("conversation_participants")
    op.drop_table("conversations")
    op.drop_table("voice_call_logs_v2")
    op.drop_table("booking_status_history")
    op.drop_table("bookings_v2")
    op.drop_table("provider_availability")
    op.drop_table("provider_reviews")
    op.drop_table("provider_portfolio")
    op.drop_table("provider_services")
    op.drop_table("provider_profiles")
    op.drop_table("providers")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS userrole")
    op.execute("DROP TYPE IF EXISTS bookingstatus")
    op.execute("DROP TYPE IF EXISTS notificationtype")

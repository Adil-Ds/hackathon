import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.orm.conversation import Conversation, ConversationParticipant


async def create_conversation(
    db: AsyncSession,
    participant_ids: list[str],
    booking_id: Optional[str] = None,
    encrypted_keys: dict = None,
) -> Conversation:
    conv = Conversation(
        id=str(uuid.uuid4()),
        booking_id=booking_id,
        encrypted_keys=encrypted_keys or {},
    )
    db.add(conv)
    await db.flush()

    for uid in participant_ids:
        db.add(ConversationParticipant(conversation_id=conv.id, user_id=uid))

    await db.commit()
    await db.refresh(conv)
    return conv


async def get_conversation_by_id(
    db: AsyncSession, conversation_id: str
) -> Optional[Conversation]:
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.participants))
    )
    return result.scalar_one_or_none()


async def get_user_conversations(
    db: AsyncSession, user_id: str
) -> list[Conversation]:
    result = await db.execute(
        select(Conversation)
        .join(
            ConversationParticipant,
            and_(
                ConversationParticipant.conversation_id == Conversation.id,
                ConversationParticipant.user_id == user_id,
            ),
        )
        .where(Conversation.is_active == True)
        .options(selectinload(Conversation.participants))
        .order_by(Conversation.last_message_at.desc().nulls_last())
    )
    return list(result.scalars().unique().all())


async def update_last_read(
    db: AsyncSession, conversation_id: str, user_id: str
) -> None:
    result = await db.execute(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
    )
    participant = result.scalar_one_or_none()
    if participant:
        participant.last_read_at = datetime.now(timezone.utc)
        await db.commit()


async def update_conversation_last_message(
    db: AsyncSession, conversation_id: str
) -> None:
    conv = await get_conversation_by_id(db, conversation_id)
    if conv:
        conv.last_message_at = datetime.now(timezone.utc)
        await db.commit()


async def is_participant(
    db: AsyncSession, conversation_id: str, user_id: str
) -> bool:
    result = await db.execute(
        select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == user_id,
        )
    )
    return result.scalar_one_or_none() is not None

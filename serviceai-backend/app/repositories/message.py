import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.orm.message import Message, MessageReadReceipt


async def create_message(
    db: AsyncSession,
    conversation_id: str,
    sender_id: str,
    encrypted_payload: str,
    message_type: str = "text",
) -> Message:
    msg = Message(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        sender_id=sender_id,
        encrypted_payload=encrypted_payload,
        message_type=message_type,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def get_messages(
    db: AsyncSession,
    conversation_id: str,
    before_id: Optional[str] = None,
    limit: int = 50,
) -> list[Message]:
    q = (
        select(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.is_deleted == False,
        )
        .options(selectinload(Message.read_receipts))
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    if before_id:
        before_msg = await get_message_by_id(db, before_id)
        if before_msg:
            q = q.where(Message.created_at < before_msg.created_at)

    result = await db.execute(q)
    msgs = list(result.scalars().all())
    msgs.reverse()
    return msgs


async def get_message_by_id(
    db: AsyncSession, message_id: str
) -> Optional[Message]:
    result = await db.execute(
        select(Message)
        .where(Message.id == message_id)
        .options(selectinload(Message.read_receipts))
    )
    return result.scalar_one_or_none()


async def mark_messages_read(
    db: AsyncSession, conversation_id: str, user_id: str
) -> int:
    result = await db.execute(
        select(Message)
        .where(
            Message.conversation_id == conversation_id,
            Message.sender_id != user_id,
            Message.is_deleted == False,
        )
        .options(selectinload(Message.read_receipts))
    )
    messages = list(result.scalars().all())
    count = 0
    for msg in messages:
        already_read = any(r.user_id == user_id for r in msg.read_receipts)
        if not already_read:
            db.add(
                MessageReadReceipt(
                    message_id=msg.id,
                    user_id=user_id,
                    read_at=datetime.now(timezone.utc),
                )
            )
            count += 1
    if count:
        await db.commit()
    return count


async def get_unread_count(
    db: AsyncSession, conversation_id: str, user_id: str
) -> int:
    result = await db.execute(
        select(Message).where(
            Message.conversation_id == conversation_id,
            Message.sender_id != user_id,
            Message.is_deleted == False,
        )
    )
    messages = list(result.scalars().all())
    ids = [m.id for m in messages]
    if not ids:
        return 0

    receipts_result = await db.execute(
        select(MessageReadReceipt.message_id).where(
            MessageReadReceipt.message_id.in_(ids),
            MessageReadReceipt.user_id == user_id,
        )
    )
    read_ids = {r[0] for r in receipts_result.all()}
    return len(set(ids) - read_ids)

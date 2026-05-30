from sqlalchemy.ext.asyncio import AsyncSession

from app.core import redis as r
from app.models.orm.message import Message
from app.repositories import conversation as conv_repo
from app.repositories import message as msg_repo


async def send_message(
    db: AsyncSession,
    conversation_id: str,
    sender_id: str,
    encrypted_payload: str,
    message_type: str = "text",
) -> Message:
    msg = await msg_repo.create_message(
        db,
        conversation_id=conversation_id,
        sender_id=sender_id,
        encrypted_payload=encrypted_payload,
        message_type=message_type,
    )

    await conv_repo.update_conversation_last_message(db, conversation_id)

    # Fan out via Redis pub/sub so all backend instances deliver the message
    await r.publish(
        f"conv:{conversation_id}",
        {
            "type": "new_message",
            "conversation_id": conversation_id,
            "message": {
                "id": msg.id,
                "sender_id": sender_id,
                "encrypted_payload": encrypted_payload,
                "message_type": message_type,
                "created_at": msg.created_at.isoformat(),
                "read_by": [],
            },
        },
    )

    # Track per-user unread counts in Redis for quick lookup
    conv = await conv_repo.get_conversation_by_id(db, conversation_id)
    if conv:
        for participant in conv.participants:
            if participant.user_id != sender_id:
                await r.increment(f"unread:{participant.user_id}:{conversation_id}")

    return msg


async def mark_read(
    db: AsyncSession,
    conversation_id: str,
    user_id: str,
) -> int:
    count = await msg_repo.mark_messages_read(db, conversation_id, user_id)
    await conv_repo.update_last_read(db, conversation_id, user_id)

    # Reset Redis unread counter
    await r.reset_key(f"unread:{user_id}:{conversation_id}")

    # Notify all participants that this user read the conversation
    await r.publish(
        f"conv:{conversation_id}",
        {
            "type": "message_read",
            "conversation_id": conversation_id,
            "user_id": user_id,
        },
    )

    return count

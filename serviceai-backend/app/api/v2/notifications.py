"""
Notification endpoints — list, mark read, mark all read, unread count.
Works with the Notification ORM model + Redis for realtime badge updates.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.redis import publish
from app.core.security import AuthenticatedUser, get_current_user
from app.models.orm.notification import Notification, NotificationType

router = APIRouter(prefix="/v2/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: str
    type: str
    title: str
    body: str
    data: Optional[dict] = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CreateNotificationRequest(BaseModel):
    user_id: str
    type: str
    title: str
    body: str
    data: Optional[dict] = None


async def create_notification(
    db: AsyncSession,
    user_id: str,
    ntype: str,
    title: str,
    body: str,
    data: dict = None,
) -> Notification:
    """Helper called by other services to create & push a notification."""
    note = Notification(
        id=str(uuid.uuid4()),
        user_id=user_id,
        type=NotificationType(ntype) if ntype in NotificationType.__members__ else NotificationType.SYSTEM,
        title=title,
        body=body,
        data=data,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    await publish(f"user:{user_id}:notifications", {
        "type": "new_notification",
        "notification": {
            "id": note.id,
            "type": note.type.value,
            "title": note.title,
            "body": note.body,
            "data": note.data,
            "is_read": False,
            "created_at": note.created_at.isoformat(),
        },
    })
    return note


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    offset: int = 0,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Notification).where(Notification.user_id == current_user.uid)
    if unread_only:
        q = q.where(Notification.is_read == False)
    q = q.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(q)
    return [NotificationOut.model_validate(n) for n in result.scalars().all()]


@router.get("/unread-count")
async def unread_count(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(func.count()).where(
            Notification.user_id == current_user.uid,
            Notification.is_read == False,
        )
    )
    count = result.scalar() or 0
    return {"unread_count": count}


@router.patch("/{notification_id}/read")
async def mark_one_read(
    notification_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.uid,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Notification not found")
    note.is_read = True
    await db.commit()
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == current_user.uid,
            Notification.is_read == False,
        )
    )
    notes = result.scalars().all()
    for n in notes:
        n.is_read = True
    await db.commit()
    return {"marked_read": len(notes)}

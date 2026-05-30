from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.models.orm.booking import Booking, BookingStatus, BookingStatusHistory
from app.models.schemas_v2.booking import BookingStatusUpdate, BookingV2Out

router = APIRouter(prefix="/v2/bookings", tags=["bookings-v2"])

VALID_TRANSITIONS = {
    BookingStatus.PENDING: {BookingStatus.CONFIRMED, BookingStatus.CANCELLED, BookingStatus.REJECTED},
    BookingStatus.CONFIRMED: {BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED},
    BookingStatus.IN_PROGRESS: {BookingStatus.COMPLETED, BookingStatus.CANCELLED},
    BookingStatus.COMPLETED: set(),
    BookingStatus.CANCELLED: set(),
    BookingStatus.REJECTED: set(),
}


async def _get_booking(db: AsyncSession, booking_id: str) -> Optional[Booking]:
    result = await db.execute(
        select(Booking)
        .where(Booking.id == booking_id)
        .options(selectinload(Booking.status_history))
    )
    return result.scalar_one_or_none()


@router.get("", response_model=list[BookingV2Out])
async def list_bookings(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking)
        .where(Booking.user_id == current_user.uid)
        .options(selectinload(Booking.status_history))
        .order_by(Booking.created_at.desc())
    )
    return [BookingV2Out.model_validate(b) for b in result.scalars().all()]


@router.get("/{booking_id}", response_model=BookingV2Out)
async def get_booking(
    booking_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    booking = await _get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.user_id != current_user.uid and current_user.role not in ("admin", "provider"):
        raise HTTPException(status_code=403, detail="Access denied")
    return BookingV2Out.model_validate(booking)


@router.patch("/{booking_id}/status", response_model=BookingV2Out)
async def update_booking_status(
    booking_id: str,
    body: BookingStatusUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    booking = await _get_booking(db, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    try:
        new_status = BookingStatus(body.status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}")

    allowed = VALID_TRANSITIONS.get(booking.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {booking.status} to {new_status}",
        )

    booking.status = new_status
    booking.updated_at = datetime.now(timezone.utc)

    db.add(
        BookingStatusHistory(
            booking_id=booking.id,
            status=new_status,
            changed_by=current_user.uid,
            note=body.note,
        )
    )
    await db.commit()
    await db.refresh(booking)

    # Broadcast realtime update to all participants via Redis
    try:
        from app.core.redis import publish
        await publish(f"user:{booking.user_id}:notifications", {
            "type": "booking_update",
            "booking_id": booking.id,
            "status": new_status.value,
        })
        await publish(f"user:{booking.provider_id}:notifications", {
            "type": "booking_update",
            "booking_id": booking.id,
            "status": new_status.value,
        })
    except Exception:
        pass

    return BookingV2Out.model_validate(booking)


@router.get("/analytics/summary")
async def analytics_summary(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Booking).where(Booking.user_id == current_user.uid)
    )
    bookings = list(result.scalars().all())

    counts = {s.value: 0 for s in BookingStatus}
    for b in bookings:
        counts[b.status.value] += 1

    return {
        "total": len(bookings),
        "by_status": counts,
        "completed": counts.get("COMPLETED", 0),
        "pending": counts.get("PENDING", 0),
        "confirmed": counts.get("CONFIRMED", 0),
    }

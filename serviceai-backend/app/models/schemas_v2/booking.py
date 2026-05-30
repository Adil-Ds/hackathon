from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class BookingStatusUpdate(BaseModel):
    status: str
    note: Optional[str] = None


class BookingStatusHistoryOut(BaseModel):
    status: str
    changed_by: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BookingV2Out(BaseModel):
    id: str
    legacy_booking_id: Optional[str] = None
    user_id: str
    provider_id: str
    service_name: str
    status: str
    location_address: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    price_agreed: int
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    status_history: list[BookingStatusHistoryOut] = []

    model_config = {"from_attributes": True}

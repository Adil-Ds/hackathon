from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ConversationCreate(BaseModel):
    participant_ids: list[str]
    booking_id: Optional[str] = None
    # optional pre-encrypted AES key per participant: {user_id: encrypted_key}
    encrypted_keys: dict[str, str] = {}


class ConversationOut(BaseModel):
    id: str
    booking_id: Optional[str] = None
    booking_status: Optional[str] = None  # populated server-side from bookings_v2
    is_active: bool
    created_at: datetime
    last_message_at: Optional[datetime] = None
    participant_ids: list[str] = []
    unread_count: int = 0
    last_message_preview: Optional[str] = None

    model_config = {"from_attributes": True}


class SendMessageRequest(BaseModel):
    encrypted_payload: str
    message_type: str = "text"


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    encrypted_payload: str
    message_type: str
    is_deleted: bool
    created_at: datetime
    read_by: list[str] = []

    model_config = {"from_attributes": True}

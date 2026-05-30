from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    firebase_uid: str
    email: EmailStr
    name: str
    role: str = "user"
    phone: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class UserOut(BaseModel):
    id: str
    firebase_uid: str
    email: str
    name: str
    role: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class DeviceRegisterRequest(BaseModel):
    device_token: Optional[str] = None
    public_key: Optional[str] = None
    platform: str = "unknown"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

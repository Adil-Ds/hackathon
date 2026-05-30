from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import AuthenticatedUser, create_jwt_token, get_current_user
from app.models.schemas_v2.user import (
    DeviceRegisterRequest,
    TokenResponse,
    UserCreate,
    UserOut,
    UserUpdate,
)
from app.repositories import user as user_repo

router = APIRouter(prefix="/v2/auth", tags=["auth-v2"])


@router.post("/sync", response_model=TokenResponse)
async def sync_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Called after Firebase sign-in to sync the user into our PostgreSQL DB
    and return a JWT for subsequent API calls.
    """
    user = await user_repo.create_or_update_user(
        db,
        firebase_uid=body.firebase_uid,
        email=body.email,
        name=body.name,
        role=body.role,
        phone=body.phone,
    )
    token = create_jwt_token(uid=user.id, email=user.email, role=user.role.value)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def get_me(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await user_repo.get_user_by_id(db, current_user.uid)
    if not user:
        user = await user_repo.get_user_by_firebase_uid(db, current_user.uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UserUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user = await user_repo.update_user_profile(
        db,
        user_id=current_user.uid,
        name=body.name,
        phone=body.phone,
        avatar_url=body.avatar_url,
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


@router.post("/device")
async def register_device(
    body: DeviceRegisterRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    device = await user_repo.register_device(
        db,
        user_id=current_user.uid,
        device_token=body.device_token,
        public_key=body.public_key,
        platform=body.platform,
    )
    return {"id": device.id, "platform": device.platform}


class EnsureUserRequest(BaseModel):
    firebase_uid: str
    email: str
    name: str
    role: str = "user"
    phone: Optional[str] = None


@router.post("/ensure-user")
async def ensure_user(
    body: EnsureUserRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Create or fetch a user row by Firebase UID — no auth token required.
    Used by mobile to sync any user (e.g. a provider) before starting a chat.
    """
    user = await user_repo.create_or_update_user(
        db,
        firebase_uid=body.firebase_uid,
        email=body.email,
        name=body.name,
        role=body.role,
        phone=body.phone,
    )
    return {"id": user.id, "firebase_uid": user.firebase_uid, "role": user.role.value}


@router.get("/keys/{user_id}")
async def get_public_key(
    user_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    key = await user_repo.get_user_public_key(db, user_id)
    if not key:
        raise HTTPException(status_code=404, detail="No public key for this user")
    return {"user_id": user_id, "public_key": key}

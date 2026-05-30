"""
User repository.

DESIGN: users.id == firebase_uid
    This keeps current_user.uid (Firebase UID from token) in sync with users.id
    so every other table's FK (providers.user_id, conversations, etc.) just works
    without a secondary lookup.
"""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm.user import User, UserRole
from app.models.orm.device import UserDevice


async def get_user_by_firebase_uid(db: AsyncSession, firebase_uid: str) -> Optional[User]:
    # id == firebase_uid, but also support lookup by firebase_uid column for safety
    result = await db.execute(
        select(User).where(
            (User.id == firebase_uid) | (User.firebase_uid == firebase_uid)
        )
    )
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def create_or_update_user(
    db: AsyncSession,
    firebase_uid: str,
    email: str,
    name: str,
    role: str = "user",
    phone: Optional[str] = None,
) -> User:
    user = await get_user_by_firebase_uid(db, firebase_uid)
    if user:
        user.name  = name
        user.email = email
        if phone:
            user.phone = phone
    else:
        user = User(
            id=firebase_uid,          # ← Firebase UID IS the PG primary key
            firebase_uid=firebase_uid,
            email=email,
            name=name,
            role=UserRole(role) if role in UserRole.__members__ else UserRole.user,
            phone=phone,
        )
        db.add(user)

    await db.commit()
    await db.refresh(user)
    return user


async def update_user_profile(
    db: AsyncSession,
    user_id: str,
    name: Optional[str] = None,
    phone: Optional[str] = None,
    avatar_url: Optional[str] = None,
) -> Optional[User]:
    user = await get_user_by_id(db, user_id)
    if not user:
        return None
    if name is not None:       user.name       = name
    if phone is not None:      user.phone      = phone
    if avatar_url is not None: user.avatar_url = avatar_url
    await db.commit()
    await db.refresh(user)
    return user


async def register_device(
    db: AsyncSession,
    user_id: str,
    device_token: Optional[str],
    public_key: Optional[str],
    platform: str = "unknown",
) -> UserDevice:
    result = await db.execute(
        select(UserDevice).where(
            UserDevice.user_id == user_id,
            UserDevice.platform == platform,
        )
    )
    device = result.scalar_one_or_none()
    if device:
        if device_token: device.device_token = device_token
        if public_key:   device.public_key   = public_key
    else:
        device = UserDevice(
            user_id=user_id,
            device_token=device_token,
            public_key=public_key,
            platform=platform,
        )
        db.add(device)
    await db.commit()
    await db.refresh(device)
    return device


async def get_user_public_key(db: AsyncSession, user_id: str) -> Optional[str]:
    result = await db.execute(
        select(UserDevice.public_key).where(
            UserDevice.user_id == user_id,
            UserDevice.is_active == True,
            UserDevice.public_key.is_not(None),
        )
    )
    row = result.first()
    return row[0] if row else None

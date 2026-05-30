from typing import Optional
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.orm.provider import (
    Provider,
    ProviderAvailability,
    ProviderProfile,
    ProviderReview,
    ProviderService,
)


async def get_provider_by_id(
    db: AsyncSession, provider_id: str
) -> Optional[Provider]:
    result = await db.execute(
        select(Provider)
        .where(Provider.id == provider_id)
        .options(
            selectinload(Provider.profile),
            selectinload(Provider.services),
            selectinload(Provider.availability),
            selectinload(Provider.reviews),
            selectinload(Provider.portfolio),
        )
    )
    return result.scalar_one_or_none()


async def get_provider_by_user_id(
    db: AsyncSession, user_id: str
) -> Optional[Provider]:
    result = await db.execute(
        select(Provider)
        .where(Provider.user_id == user_id)
        .options(
            selectinload(Provider.profile),
            selectinload(Provider.services),
            selectinload(Provider.availability),
            selectinload(Provider.reviews),
        )
    )
    return result.scalar_one_or_none()


async def list_providers(
    db: AsyncSession,
    category: Optional[str] = None,
    city: Optional[str] = None,
    area: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> list[Provider]:
    q = select(Provider).where(Provider.is_active == True)
    if category:
        q = q.where(Provider.category.ilike(f"%{category}%"))
    if city:
        q = q.where(Provider.city.ilike(f"%{city}%"))
    if area:
        q = q.where(Provider.area.ilike(f"%{area}%"))
    q = q.options(
        selectinload(Provider.profile),
        selectinload(Provider.services),
        selectinload(Provider.availability),
    ).limit(limit).offset(offset)
    result = await db.execute(q)
    return list(result.scalars().all())


async def create_provider(
    db: AsyncSession,
    user_id: str,
    business_name: str,
    category: str,
    city: str,
    area: str,
    bio: Optional[str] = None,
    experience_years: int = 0,
    skills: list = None,
    languages: list = None,
    price_range: dict = None,
    website: Optional[str] = None,
    linkedin: Optional[str] = None,
    services: list = None,
    availability: list = None,
) -> Provider:
    provider = Provider(
        id=str(uuid.uuid4()),
        user_id=user_id,
        business_name=business_name,
        category=category,
        city=city,
        area=area,
    )
    db.add(provider)
    await db.flush()

    profile = ProviderProfile(
        provider_id=provider.id,
        bio=bio,
        experience_years=experience_years,
        skills=skills or [],
        languages=languages or [],
        price_range=price_range or {},
        website=website,
        linkedin=linkedin,
    )
    db.add(profile)

    for svc in (services or []):
        db.add(
            ProviderService(
                provider_id=provider.id,
                name=svc.get("name", ""),
                description=svc.get("description"),
                price_min=svc.get("price_min", 0),
                price_max=svc.get("price_max", 0),
                duration_minutes=svc.get("duration_minutes", 60),
            )
        )

    for av in (availability or []):
        db.add(
            ProviderAvailability(
                provider_id=provider.id,
                day_of_week=av.get("day_of_week", 0),
                start_time=av.get("start_time", "09:00"),
                end_time=av.get("end_time", "17:00"),
                is_available=av.get("is_available", True),
            )
        )

    await db.commit()
    return await get_provider_by_id(db, provider.id)


async def add_review(
    db: AsyncSession,
    provider_id: str,
    reviewer_id: str,
    rating: int,
    comment: Optional[str] = None,
) -> ProviderReview:
    review = ProviderReview(
        provider_id=provider_id,
        reviewer_id=reviewer_id,
        rating=rating,
        comment=comment,
    )
    db.add(review)
    await db.flush()
    return review

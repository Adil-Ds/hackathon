from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import AuthenticatedUser, get_current_user
from app.models.orm.user import User
from app.models.schemas_v2.provider import (
    ProviderOnboardRequest,
    ProviderOut,
    ProviderPublicProfile,
    ProviderReviewCreate,
    ProviderReviewOut,
)
from app.repositories import provider as prov_repo
from app.services import provider_service

router = APIRouter(prefix="/v2/providers", tags=["providers-v2"])


def _build_public_profile(provider, firebase_uid: str = None) -> ProviderPublicProfile:
    profile = provider.profile
    return ProviderPublicProfile(
        id=provider.id,
        firebase_uid=firebase_uid,
        business_name=provider.business_name,
        category=provider.category,
        city=provider.city,
        area=provider.area,
        rating=provider.rating,
        review_count=provider.review_count,
        is_verified=provider.is_verified,
        bio=profile.bio if profile else None,
        experience_years=profile.experience_years if profile else 0,
        skills=profile.skills if profile else [],
        languages=profile.languages if profile else [],
        price_range=profile.price_range if profile else {},
        website=profile.website if profile else None,
        services=[
            {
                "id": s.id,
                "name": s.name,
                "description": s.description,
                "price_min": s.price_min,
                "price_max": s.price_max,
                "duration_minutes": s.duration_minutes,
                "is_active": s.is_active,
            }
            for s in provider.services
        ],
        availability=[
            {
                "id": a.id,
                "day_of_week": a.day_of_week,
                "start_time": a.start_time,
                "end_time": a.end_time,
                "is_available": a.is_available,
            }
            for a in provider.availability
        ],
        reviews=[
            {
                "id": r.id,
                "provider_id": r.provider_id,
                "reviewer_id": r.reviewer_id,
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at,
            }
            for r in provider.reviews
        ],
    )


@router.post("/onboard", response_model=ProviderOut)
async def onboard_provider(
    body: ProviderOnboardRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    provider = await provider_service.onboard_provider(
        db, user_id=current_user.uid, data=body.model_dump()
    )
    return ProviderOut.model_validate(provider)


@router.get("/me", response_model=ProviderPublicProfile)
async def get_my_profile(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    provider = await prov_repo.get_provider_by_user_id(db, current_user.uid)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    r = await db.execute(select(User.firebase_uid).where(User.id == provider.user_id))
    return _build_public_profile(provider, firebase_uid=r.scalar_one_or_none())


@router.get("", response_model=list[ProviderPublicProfile])
async def list_providers(
    category: Optional[str] = None,
    city: Optional[str] = None,
    area: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    providers = await prov_repo.list_providers(
        db, category=category, city=city, area=area, limit=limit, offset=offset
    )
    return [_build_public_profile(p) for p in providers]


@router.get("/{provider_id}", response_model=ProviderPublicProfile)
async def get_provider(
    provider_id: str,
    db: AsyncSession = Depends(get_db),
):
    provider = await prov_repo.get_provider_by_id(db, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    r = await db.execute(select(User.firebase_uid).where(User.id == provider.user_id))
    return _build_public_profile(provider, firebase_uid=r.scalar_one_or_none())


@router.post("/{provider_id}/reviews", response_model=ProviderOut)
async def submit_review(
    provider_id: str,
    body: ProviderReviewCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    provider = await prov_repo.get_provider_by_id(db, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    updated = await provider_service.submit_review(
        db,
        provider_id=provider_id,
        reviewer_id=current_user.uid,
        rating=body.rating,
        comment=body.comment,
    )
    return ProviderOut.model_validate(updated)

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm.provider import Provider, ProviderReview
from app.repositories import provider as prov_repo


async def onboard_provider(db: AsyncSession, user_id: str, data: dict) -> Provider:
    existing = await prov_repo.get_provider_by_user_id(db, user_id)
    if existing:
        # Update key fields if they've changed (idempotent re-registration)
        changed = False
        for field in ("business_name", "category", "city", "area"):
            val = data.get(field)
            if val and getattr(existing, field, None) != val:
                setattr(existing, field, val)
                changed = True
        if changed:
            await db.commit()
        return existing

    return await prov_repo.create_provider(
        db,
        user_id=user_id,
        business_name=data["business_name"],
        category=data["category"],
        city=data["city"],
        area=data["area"],
        bio=data.get("bio"),
        experience_years=data.get("experience_years", 0),
        skills=data.get("skills", []),
        languages=data.get("languages", []),
        price_range=data.get("price_range", {}),
        website=data.get("website"),
        linkedin=data.get("linkedin"),
        services=[s.model_dump() if hasattr(s, "model_dump") else s for s in data.get("services", [])],
        availability=[a.model_dump() if hasattr(a, "model_dump") else a for a in data.get("availability", [])],
    )


async def submit_review(
    db: AsyncSession,
    provider_id: str,
    reviewer_id: str,
    rating: int,
    comment: Optional[str] = None,
) -> Provider:
    await prov_repo.add_review(
        db,
        provider_id=provider_id,
        reviewer_id=reviewer_id,
        rating=rating,
        comment=comment,
    )
    await _recalculate_rating(db, provider_id)
    await db.commit()
    return await prov_repo.get_provider_by_id(db, provider_id)


async def _recalculate_rating(db: AsyncSession, provider_id: str) -> None:
    result = await db.execute(
        select(
            func.avg(ProviderReview.rating).label("avg_rating"),
            func.count(ProviderReview.id).label("count"),
        ).where(ProviderReview.provider_id == provider_id)
    )
    row = result.one()
    avg = float(row.avg_rating or 0)
    count = int(row.count or 0)

    provider = await db.get(Provider, provider_id)
    if provider:
        provider.rating = round(avg, 2)
        provider.review_count = count

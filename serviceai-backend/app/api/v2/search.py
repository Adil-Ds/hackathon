"""
Provider discovery & search endpoint.
Combines internal PostgreSQL providers with the existing JSON mock providers.
Supports: text search, category, city, area, rating, verified, experience, availability, price, distance.
"""
from typing import Optional
import json, os, math

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.core.database import get_db
from app.models.orm.provider import Provider, ProviderProfile, ProviderAvailability
from app.models.orm.user import User
from sqlalchemy.orm import selectinload

router = APIRouter(prefix="/v2/search", tags=["search"])

_PROVIDERS_PATH = os.path.join(
    os.path.dirname(__file__), "../../../../data/providers.json"
)


def _haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _load_mock_providers():
    try:
        with open(_PROVIDERS_PATH, "r") as f:
            return json.load(f).get("providers", [])
    except Exception:
        return []


def _mock_to_unified(p: dict, user_lat=None, user_lng=None) -> dict:
    dist = None
    if user_lat and user_lng and p.get("lat") and p.get("lng"):
        dist = round(_haversine(user_lat, user_lng, p["lat"], p["lng"]), 2)
    return {
        "id": p.get("id", ""),
        "source": "scraped",
        "business_name": p.get("name", ""),
        "category": p.get("category", ""),
        "city": p.get("city", ""),
        "area": p.get("area", ""),
        "rating": float(p.get("rating", 0)),
        "review_count": int(p.get("review_count", 0)),
        "is_verified": bool(p.get("verified", False)),
        "experience_years": int(p.get("experience_years", 0)),
        "price_min": int(p.get("price_min", 0)),
        "price_max": int(p.get("price_max", 0)),
        "distance_km": dist,
        "phone": p.get("phone"),
        "available_days": p.get("available_days", []),
        "bio": None,
        "skills": [],
    }


def _db_to_unified(p, user_lat=None, user_lng=None, firebase_uid=None) -> dict:
    profile = p.profile
    avail_days = [a.day_of_week for a in p.availability if a.is_available]
    return {
        "id": p.id,
        "firebase_uid": firebase_uid,
        "source": "platform",
        "business_name": p.business_name,
        "category": p.category,
        "city": p.city,
        "area": p.area,
        "rating": float(p.rating),
        "review_count": int(p.review_count),
        "is_verified": bool(p.is_verified),
        "experience_years": int(profile.experience_years if profile else 0),
        "price_min": int((profile.price_range or {}).get("min", 0)) if profile else 0,
        "price_max": int((profile.price_range or {}).get("max", 0)) if profile else 0,
        "distance_km": None,
        "phone": None,
        "available_days": avail_days,
        "bio": profile.bio if profile else None,
        "skills": (profile.skills or []) if profile else [],
    }


def _score_provider(p: dict, q: str = "", user_lat=None, user_lng=None) -> float:
    score = 0.0
    score += p["rating"] * 10
    score += min(p["review_count"] * 0.1, 10)
    if p["is_verified"]:
        score += 8
    if p["source"] == "platform":
        score += 5  # boost internal providers
    if p["distance_km"] is not None:
        score += max(0, 15 - p["distance_km"] * 1.5)
    if q:
        q_lower = q.lower()
        if q_lower in (p["business_name"] or "").lower():
            score += 20
        if q_lower in (p["category"] or "").lower():
            score += 15
        if any(q_lower in (s or "").lower() for s in p["skills"]):
            score += 10
    return round(score, 2)


@router.get("/providers")
async def search_providers(
    q: Optional[str] = Query(None, description="Text search — name, category, skills"),
    category: Optional[str] = None,
    city: Optional[str] = None,
    area: Optional[str] = None,
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    max_price: Optional[int] = None,
    min_price: Optional[int] = None,
    min_experience: Optional[int] = Query(None, ge=0),
    verified_only: bool = False,
    has_availability: Optional[int] = Query(None, description="Day of week 0=Mon…6=Sun"),
    sort_by: str = Query("relevance", enum=["relevance", "rating", "price_asc", "price_desc", "experience"]),
    user_lat: Optional[float] = None,
    user_lng: Optional[float] = None,
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """
    Unified provider search combining platform providers (PostgreSQL) + scraped providers (JSON).
    Returns ranked, deduplicated results.
    """
    results = []

    # ── 1. Query PostgreSQL providers ─────────────────────────────────────────
    try:
        q_stmt = (
            select(Provider, User.firebase_uid)
            .join(User, Provider.user_id == User.id, isouter=True)
            .where(Provider.is_active == True)
            .options(
                selectinload(Provider.profile),
                selectinload(Provider.availability),
            )
        )
        if category:
            q_stmt = q_stmt.where(Provider.category.ilike(f"%{category}%"))
        if city:
            q_stmt = q_stmt.where(Provider.city.ilike(f"%{city}%"))
        if area:
            q_stmt = q_stmt.where(Provider.area.ilike(f"%{area}%"))
        if min_rating:
            q_stmt = q_stmt.where(Provider.rating >= min_rating)
        if verified_only:
            q_stmt = q_stmt.where(Provider.is_verified == True)
        if q:
            q_stmt = q_stmt.where(
                or_(
                    Provider.business_name.ilike(f"%{q}%"),
                    Provider.category.ilike(f"%{q}%"),
                    Provider.area.ilike(f"%{q}%"),
                )
            )

        db_result = await db.execute(q_stmt)
        db_rows = db_result.all()

        for row in db_rows:
            p, firebase_uid = row[0], row[1]
            profile = p.profile
            if min_experience and profile and profile.experience_years < min_experience:
                continue
            if min_price and profile:
                pmax = (profile.price_range or {}).get("max", 0)
                if pmax and pmax < min_price:
                    continue
            if max_price and profile:
                pmin = (profile.price_range or {}).get("min", 0)
                if pmin and pmin > max_price:
                    continue
            if has_availability is not None:
                days = [a.day_of_week for a in p.availability if a.is_available]
                if has_availability not in days:
                    continue
            results.append(_db_to_unified(p, user_lat, user_lng, firebase_uid=firebase_uid))
    except Exception:
        pass

    # ── 2. Query scraped/mock providers from JSON ─────────────────────────────
    mock_providers = _load_mock_providers()
    for p in mock_providers:
        if category and category.lower() not in (p.get("category") or "").lower():
            continue
        if city and city.lower() not in (p.get("city") or "").lower():
            continue
        if area and area.lower() not in (p.get("area") or "").lower():
            continue
        if min_rating and float(p.get("rating", 0)) < min_rating:
            continue
        if verified_only and not p.get("verified", False):
            continue
        if min_experience and int(p.get("experience_years", 0)) < min_experience:
            continue
        if q:
            q_lower = q.lower()
            name_match = q_lower in (p.get("name") or "").lower()
            cat_match = q_lower in (p.get("category") or "").lower()
            if not name_match and not cat_match:
                continue
        results.append(_mock_to_unified(p, user_lat, user_lng))

    # ── 3. Deduplicate by name+city ───────────────────────────────────────────
    seen = set()
    deduped = []
    for p in results:
        key = (p["business_name"].lower(), p["city"].lower())
        if key not in seen:
            seen.add(key)
            deduped.append(p)

    # ── 4. Score & sort ───────────────────────────────────────────────────────
    for p in deduped:
        p["_score"] = _score_provider(p, q or "", user_lat, user_lng)

    if sort_by == "relevance":
        deduped.sort(key=lambda x: x["_score"], reverse=True)
    elif sort_by == "rating":
        deduped.sort(key=lambda x: x["rating"], reverse=True)
    elif sort_by == "price_asc":
        deduped.sort(key=lambda x: x["price_min"])
    elif sort_by == "price_desc":
        deduped.sort(key=lambda x: x["price_max"], reverse=True)
    elif sort_by == "experience":
        deduped.sort(key=lambda x: x["experience_years"], reverse=True)

    total = len(deduped)
    paginated = deduped[offset : offset + limit]
    for p in paginated:
        p.pop("_score", None)

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "results": paginated,
    }

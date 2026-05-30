from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ProviderServiceOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    price_min: int
    price_max: int
    duration_minutes: int
    is_active: bool

    model_config = {"from_attributes": True}


class ProviderServiceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price_min: int = 0
    price_max: int = 0
    duration_minutes: int = 60


class ProviderAvailabilityOut(BaseModel):
    id: int
    day_of_week: int
    start_time: str
    end_time: str
    is_available: bool

    model_config = {"from_attributes": True}


class ProviderAvailabilityCreate(BaseModel):
    day_of_week: int
    start_time: str
    end_time: str
    is_available: bool = True


class ProviderReviewOut(BaseModel):
    id: int
    provider_id: str
    reviewer_id: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProviderReviewCreate(BaseModel):
    rating: int
    comment: Optional[str] = None


class ProviderOnboardRequest(BaseModel):
    business_name: str
    category: str
    city: str
    area: str
    bio: Optional[str] = None
    experience_years: int = 0
    skills: list[str] = []
    languages: list[str] = []
    price_range: dict = {}
    website: Optional[str] = None
    linkedin: Optional[str] = None
    services: list[ProviderServiceCreate] = []
    availability: list[ProviderAvailabilityCreate] = []


class ProviderOut(BaseModel):
    id: str
    user_id: str
    business_name: str
    category: str
    city: str
    area: str
    rating: float
    review_count: int
    is_verified: bool
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProviderPublicProfile(BaseModel):
    id: str
    firebase_uid: Optional[str] = None  # Firebase UID of the provider's account
    business_name: str
    category: str
    city: str
    area: str
    rating: float
    review_count: int
    is_verified: bool
    bio: Optional[str] = None
    experience_years: int = 0
    skills: list[str] = []
    languages: list[str] = []
    price_range: dict = {}
    website: Optional[str] = None
    services: list[ProviderServiceOut] = []
    availability: list[ProviderAvailabilityOut] = []
    reviews: list[ProviderReviewOut] = []

    model_config = {"from_attributes": True}

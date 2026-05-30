from typing import Optional
from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # PostgreSQL
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "serviceai"
    POSTGRES_USER: str = "serviceai"
    POSTGRES_PASSWORD: str = "serviceai_pass"

    @computed_field
    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @computed_field
    @property
    def DATABASE_URL_SYNC(self) -> str:
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET: str = "hackathon-secret-key-change-in-prod"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 24

    # Firebase Admin SDK (optional — leave blank to skip Firebase token verification)
    FIREBASE_SERVICE_ACCOUNT_PATH: Optional[str] = None

    # Groq / VAPI (already in .env — just declared here for completeness)
    GROQ_API_KEY: Optional[str] = None
    VAPI_API_KEY: Optional[str] = None
    VAPI_PHONE_NUMBER_ID: Optional[str] = None
    VAPI_ASSISTANT_ID: Optional[str] = None


settings = Settings()

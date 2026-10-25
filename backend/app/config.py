from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # matches the frontend's 10 MB document limit


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"
    database_url: str = "sqlite:///./educore.db"
    jwt_secret: str = Field(min_length=32)
    cors_origins: str = "http://localhost:5173"
    storage_dir: str = "./storage"
    access_token_ttl_min: int = 15
    refresh_token_ttl_days: int = 30
    allow_public_registration: bool = False
    allowed_email_domain: str = ""
    google_client_id: str = ""
    microsoft_client_id: str = ""
    stripe_webhook_secret: str = ""
    semester_start_winter: str = "2026-09-14"
    semester_start_summer: str = "2027-02-15"
    semester_weeks: int = 13
    timezone: str = "Europe/Bratislava"
    seed_admin_password: str = "ChangeMe!12345"
    rate_limit_enabled: bool = True

    @property
    def is_prod(self) -> bool:
        return self.env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]

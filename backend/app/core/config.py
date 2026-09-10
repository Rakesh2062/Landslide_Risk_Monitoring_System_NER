from pydantic import ConfigDict
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Suppress pydantic v2 warning about fields starting with model_
    model_config = ConfigDict(
        protected_namespaces=('settings_',),
        env_file='.env',
        extra='ignore',
    )

    database_url: str = "postgresql://postgres:password@localhost:5432/landslide_db"
    jwt_secret_key: str = "dev-secret-key-change-in-production-abc123xyz"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 480
    upload_dir: str = "uploads"
    base_url: str = "http://localhost:8000"

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""

    sms_enabled: bool = False       # set True to enable real SMS via Twilio
    sms_demo_recipient: str = ""
    # Comma-separated E.164 numbers that should receive emergency SMS broadcasts.
    # Keep this in the hosting provider's environment variables, never in source.
    sms_broadcast_recipients: str = ""

    app_env: str = "development"
    # Production must fail visibly if the trained model is unavailable.
    # Enable the empirical fallback only for an explicitly configured dev/demo run.
    allow_empirical_fallback: bool = False
    model_version: str = "unversioned"

    google_oauth_client_id: str = ""
    # JSON content of a Firebase service-account key. Keep it backend-only.
    firebase_service_account_json: str = ""

    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    # Google Gemini API key — used by the /api/chat AI assistant endpoint
    gemini_api_key: str = ""


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

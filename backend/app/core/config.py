from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    # API Settings
    PROJECT_NAME: str = "GroceryApp API"

    # CORS — React Native dev + Render production
    ALLOWED_ORIGINS: List[str] = ["*"]

    # Firebase
    # For local dev: use FIREBASE_CREDENTIALS_PATH (file path)
    # For cloud (Render): use FIREBASE_CREDENTIALS_JSON (JSON string)
    FIREBASE_CREDENTIALS_PATH: str = ""
    FIREBASE_CREDENTIALS_JSON: str = ""  # JSON string for cloud deployment
    FIREBASE_DATABASE_URL: str = ""

    # Google Maps
    GOOGLE_MAPS_API_KEY: str = ""

    # Open Food Facts
    OPEN_FOOD_FACTS_API: str = "https://world.openfoodfacts.org/api/v2"

    # AI Service (Ollama local or OpenAI-compatible endpoint)
    AI_SERVICE_URL: Optional[str] = None
    AI_MODEL_NAME: str = "llama3.2"

    # Web UI — Firebase client-side config (public keys, safe to expose)
    FIREBASE_WEB_API_KEY: str = ""
    FIREBASE_WEB_AUTH_DOMAIN: str = ""
    FIREBASE_WEB_PROJECT_ID: str = ""

    # Admin bootstrap — Firebase UIDs that are always admin
    ADMIN_UIDS: List[str] = []

    # Email — Invitation delivery (cascading providers)
    RESEND_API_KEY: str = ""
    SENDGRID_API_KEY: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "GroceryApp <noreply@groceryapp.com>"

    # OCR — Receipt scanning providers
    GOOGLE_VISION_API_KEY: str = ""  # or use Firebase service account (Vision API must be enabled)
    MINDEE_API_KEY: str = ""  # from mindee.com dashboard
    MISTRAL_API_KEY: str = ""  # LLM fallback for receipt parsing (free tier: 1M tokens/month)

    # Environment
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "Healthcare AI Medical Document Intelligence"
    API_V1_STR: str = "/api/v1"
    
    # Storage Configuration (Private & Secure)
    STORAGE_DIR: Path = Path(os.getenv("STORAGE_DIR", str(BASE_DIR / "storage" / "documents")))
    MAX_FILE_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB limit
    ALLOWED_EXTENSIONS: set = {
        # Documents
        ".pdf", ".doc", ".docx", ".txt", ".rtf",
        # Images
        ".jpg", ".jpeg", ".png", ".webp", ".tiff", ".bmp",
        # Spreadsheets
        ".xls", ".xlsx", ".csv",
        # Medical Imaging format
        ".dcm", ".dicom"
    }
    
    # Database Configuration (PostgreSQL default with local SQLite fallback for dev/testing)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{BASE_DIR / 'healthcare_records.db'}"
    )
    
    # AI / LLM Configuration
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    AI_MODEL_NAME: str = os.getenv("AI_MODEL_NAME", "gemini-1.5-pro")
    
    # Security & Server Host/Port
    HOST: str = os.getenv("BACKEND_HOST", "127.0.0.1")
    PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
    SECRET_KEY: str = os.getenv("SECRET_KEY", "healthcare-luxury-secret-key-2026-production")
    DEFAULT_PATIENT_ID: str = "pat-101"  # Matches active demo session
    BACKEND_CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5000",
        "http://127.0.0.1:5000"
    ]

    # Payment Gateway Configuration (Mock Test Mode or Real Razorpay)
    PAYMENT_MODE: str = os.getenv("PAYMENT_MODE", "mock").lower()
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "rzp_test_mediverse_2026")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "mediverse_test_secret_key_2026")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "mediverse_test_webhook_secret_2026")
    NEXT_PUBLIC_RAZORPAY_KEY_ID: str = os.getenv("NEXT_PUBLIC_RAZORPAY_KEY_ID", "rzp_test_mediverse_2026")


    class Config:
        case_sensitive = True

settings = Settings()

# Ensure secure storage directory exists
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)

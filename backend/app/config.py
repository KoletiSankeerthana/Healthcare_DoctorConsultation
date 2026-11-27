import os
import sys
from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings

# Ensure project root and backend directory are in sys.path
_current_file = Path(__file__).resolve()
BASE_DIR = _current_file.parent.parent  # backend/
ROOT_DIR = BASE_DIR.parent              # project root/

for _p in [str(ROOT_DIR), str(BASE_DIR)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)


def resolve_sqlite_db_path(raw_url: str = None, explicit_path: str = None) -> Path:
    """
    Intelligently resolves an absolute, reliable SQLite database file path.
    Handles:
    - Explicit SQLITE_DB_PATH (e.g. Render persistent disk /var/data/healthcare_records.db)
    - Relative DATABASE_URL (e.g. sqlite:///./backend/healthcare_records.db) across both root and backend CWDs
    - Existing local database files (preserving records)
    - Safely creating parent directories with mkdir(parents=True, exist_ok=True)
    - Verifying parent directory write permissions
    """
    # 1. SQLITE_DB_PATH environment variable takes highest priority
    if explicit_path and explicit_path.strip():
        p = Path(explicit_path.strip())
        if p.is_absolute():
            resolved = p.resolve()
        elif (BASE_DIR / p).exists():
            resolved = (BASE_DIR / p).resolve()
        elif (ROOT_DIR / p).exists():
            resolved = (ROOT_DIR / p).resolve()
        else:
            # Handle possible redundant 'backend' prefix in relative path
            parts = [x for x in p.parts if x != '.']
            if parts and parts[0] == 'backend' and BASE_DIR.name == 'backend':
                stripped = Path(*parts[1:])
                if (BASE_DIR / stripped).exists():
                    resolved = (BASE_DIR / stripped).resolve()
                else:
                    resolved = (BASE_DIR / stripped).resolve()
            else:
                resolved = (BASE_DIR / p).resolve()

        resolved.parent.mkdir(parents=True, exist_ok=True)
        _verify_dir_writable(resolved.parent)
        return resolved

    # 2. Parse from DATABASE_URL if provided and indicates SQLite
    if raw_url and raw_url.strip():
        url_str = raw_url.strip()
        if url_str.startswith("sqlite:////"):
            raw_path = "/" + url_str[11:]
        elif url_str.startswith("sqlite:///"):
            raw_path = url_str[10:]
        elif url_str.startswith("sqlite://"):
            raw_path = url_str[9:]
        else:
            raw_path = url_str

        if raw_path == ":memory:":
            return Path(":memory:")

        p = Path(raw_path)
        if p.is_absolute():
            resolved = p.resolve()
        elif p.exists():
            resolved = p.resolve()
        elif (BASE_DIR / p).exists():
            resolved = (BASE_DIR / p).resolve()
        elif (ROOT_DIR / p).exists():
            resolved = (ROOT_DIR / p).resolve()
        elif (BASE_DIR / p.name).exists():
            # e.g., raw_path was ./backend/healthcare_records.db and CWD is already backend/
            resolved = (BASE_DIR / p.name).resolve()
        else:
            # File does not exist yet (e.g. fresh Render deployment)
            parts = [x for x in p.parts if x != '.']
            if parts and parts[0] == 'backend' and BASE_DIR.name == 'backend':
                # Strip duplicate 'backend' folder
                resolved = (BASE_DIR / Path(*parts[1:])).resolve()
            else:
                resolved = (BASE_DIR / p).resolve()

        resolved.parent.mkdir(parents=True, exist_ok=True)
        _verify_dir_writable(resolved.parent)
        return resolved

    # 3. Default fallback: search for existing database in standard locations
    if (BASE_DIR / "healthcare_records.db").exists():
        resolved = (BASE_DIR / "healthcare_records.db").resolve()
    elif (ROOT_DIR / "backend" / "healthcare_records.db").exists():
        resolved = (ROOT_DIR / "backend" / "healthcare_records.db").resolve()
    else:
        resolved = (BASE_DIR / "healthcare_records.db").resolve()

    resolved.parent.mkdir(parents=True, exist_ok=True)
    _verify_dir_writable(resolved.parent)
    return resolved


def _verify_dir_writable(directory: Path) -> None:
    """Verifies that a directory exists and is writable by touching a temporary probe."""
    try:
        test_file = directory / f".healvia_probe_{os.getpid()}"
        test_file.touch()
        test_file.unlink()
    except Exception as e:
        import logging
        logging.getLogger("uvicorn.error").warning(
            f"[Healvia Database Warning] Directory '{directory}' write probe failed: {e}. "
            "Ensure directory has write permissions or configure SQLITE_DB_PATH."
        )


def format_sqlite_url(path: Path) -> str:
    """Formats an absolute Path into a valid SQLAlchemy SQLite connection URL."""
    if str(path) == ":memory:":
        return "sqlite:///:memory:"
    posix_path = path.as_posix()
    if posix_path.startswith("/"):
        return f"sqlite:///{posix_path}"  # Produces 4 slashes on Unix (sqlite:////...)
    return f"sqlite:///{posix_path}"      # Produces 3 slashes on Windows (sqlite:///C:/...)


def get_initial_database_url() -> str:
    """Calculates the active DATABASE_URL respecting PostgreSQL, SQLITE_DB_PATH, and safe SQLite paths."""
    sqlite_env = os.getenv("SQLITE_DB_PATH", "").strip()
    db_url_env = os.getenv("DATABASE_URL", "").strip()

    # If explicit external database (PostgreSQL / MySQL) is provided, preserve as-is
    if db_url_env and any(db_url_env.startswith(prefix) for prefix in ("postgresql://", "postgres://", "mysql://", "cockroachdb://")):
        return db_url_env

    resolved_sqlite = resolve_sqlite_db_path(raw_url=db_url_env, explicit_path=sqlite_env)
    return format_sqlite_url(resolved_sqlite)


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
    
    # Database Configuration (Configurable SQLite or PostgreSQL)
    SQLITE_DB_PATH: str = os.getenv("SQLITE_DB_PATH", "")
    DATABASE_URL: str = get_initial_database_url()

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def sanitize_database_url(cls, v: str) -> str:
        sqlite_env = os.getenv("SQLITE_DB_PATH", "").strip()
        db_url_env = v.strip() if v else os.getenv("DATABASE_URL", "").strip()
        if db_url_env and any(db_url_env.startswith(prefix) for prefix in ("postgresql://", "postgres://", "mysql://", "cockroachdb://")):
            return db_url_env
        resolved_sqlite = resolve_sqlite_db_path(raw_url=db_url_env, explicit_path=sqlite_env)
        return format_sqlite_url(resolved_sqlite)
    
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

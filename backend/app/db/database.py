import sys
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Ensure project root and backend dir are in sys.path
_current_file = Path(__file__).resolve()
_backend_dir = _current_file.parent.parent.parent  # backend/
_root_dir = _backend_dir.parent                    # project root/

for _p in [str(_root_dir), str(_backend_dir)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from backend.app.config import settings
except ImportError:
    from app.config import settings

# For SQLite, check_same_thread=False is needed. Ensure directory exists defensively.
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
    if ":memory:" not in settings.DATABASE_URL:
        try:
            raw_url = settings.DATABASE_URL
            if raw_url.startswith("sqlite:////"):
                db_path = Path("/" + raw_url[11:])
            elif raw_url.startswith("sqlite:///"):
                db_path = Path(raw_url[10:])
            else:
                db_path = Path(raw_url[9:])
            db_path.parent.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            print(f"[Healvia Database Warning] Pre-engine directory creation note: {e}")

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

print(f"[Healvia Database] Initialized SQLAlchemy Engine with URL: {settings.DATABASE_URL}")
if settings.DATABASE_URL.startswith("sqlite") and "/var/data" not in settings.DATABASE_URL:
    print("[Healvia Database Notice] Running on container/local storage. To persist SQLite across Render redeployments, attach a Render Persistent Disk and set SQLITE_DB_PATH (e.g. /var/data/healthcare_records.db).")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """FastAPI Dependency for database session management."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

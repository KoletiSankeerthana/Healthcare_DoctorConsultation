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

def ensure_schema_migrations(target_engine=None):
    """Safely adds missing columns to existing SQLite tables."""
    eng = target_engine or engine
    from sqlalchemy import text
    new_cols = [
        ("document_analyses", "language", "VARCHAR(16) DEFAULT 'en'"),
        ("medical_documents", "patient_age_value", "VARCHAR(32)"),
        ("medical_documents", "patient_age_unit", "VARCHAR(32)"),
        ("medical_documents", "patient_dob", "VARCHAR(64)"),
        ("medical_documents", "patient_gender", "VARCHAR(32)"),
        ("medical_documents", "patient_uhid", "VARCHAR(128)"),
        ("medical_documents", "referring_doctor", "VARCHAR(255)"),
        ("medical_documents", "sample_collection_date", "VARCHAR(64)"),
        ("medical_documents", "specimen_type", "VARCHAR(128)"),
        ("medical_documents", "demographics_json", "JSON"),
        # Patient Health Profile extensions
        ("patient_profiles", "preferred_language", "VARCHAR(64) DEFAULT 'English'"),
        ("patient_profiles", "country", "VARCHAR(128) DEFAULT 'India'"),
        ("patient_profiles", "state", "VARCHAR(128) DEFAULT 'Tamil Nadu'"),
        ("patient_profiles", "city", "VARCHAR(128) DEFAULT 'Chennai'"),
        ("patient_profiles", "locality", "VARCHAR(128)"),
        ("patient_profiles", "street_address", "VARCHAR(255)"),
        ("patient_profiles", "house_flat", "VARCHAR(128)"),
        ("patient_profiles", "landmark", "VARCHAR(255)"),
        ("patient_profiles", "postal_code", "VARCHAR(32)"),
        ("patient_profiles", "home_latitude", "FLOAT"),
        ("patient_profiles", "home_longitude", "FLOAT"),
        ("patient_profiles", "preferred_location_latitude", "FLOAT"),
        ("patient_profiles", "preferred_location_longitude", "FLOAT"),
        ("patient_profiles", "preferred_location_address", "VARCHAR(255)"),
        ("patient_profiles", "medical_history", "JSON"),
        ("patient_profiles", "current_medications", "JSON"),
        ("patient_profiles", "previous_surgeries", "JSON"),
        ("patient_profiles", "emergency_contact_name", "VARCHAR(255)"),
        ("patient_profiles", "emergency_contact_phone", "VARCHAR(64)"),
        ("patient_profiles", "doctor_notes", "TEXT"),
        ("patient_profiles", "profile_completed", "BOOLEAN DEFAULT FALSE"),
        # Patient Location Architecture extensions
        ("patient_profiles", "registered_address", "TEXT"),
        ("patient_profiles", "registered_locality", "VARCHAR(128)"),
        ("patient_profiles", "registered_city", "VARCHAR(128)"),
        ("patient_profiles", "registered_state", "VARCHAR(128)"),
        ("patient_profiles", "registered_postal_code", "VARCHAR(32)"),
        ("patient_profiles", "registered_latitude", "FLOAT"),
        ("patient_profiles", "registered_longitude", "FLOAT"),
        ("patient_profiles", "current_latitude", "FLOAT"),
        ("patient_profiles", "current_longitude", "FLOAT"),
        ("patient_profiles", "current_accuracy", "FLOAT"),
        ("patient_profiles", "current_locality", "VARCHAR(128)"),
        ("patient_profiles", "current_city", "VARCHAR(128)"),
        ("patient_profiles", "current_state", "VARCHAR(128)"),
        ("patient_profiles", "current_postal_code", "VARCHAR(32)"),
        ("patient_profiles", "current_address", "VARCHAR(512)"),
        ("patient_profiles", "current_detected_at", "DATETIME"),
        ("patient_profiles", "search_latitude", "FLOAT"),
        ("patient_profiles", "search_longitude", "FLOAT"),
        ("patient_profiles", "search_address", "VARCHAR(512)"),
        ("patient_profiles", "search_city", "VARCHAR(128)"),
        ("patient_profiles", "search_radius_km", "FLOAT DEFAULT 5.0"),
        ("patient_profiles", "location_source", "VARCHAR(64) DEFAULT 'REGISTERED_ADDRESS'"),
        ("patient_profiles", "location_updated_at", "DATETIME"),
        # Doctor Profile Geospatial extensions
        ("doctor_profiles", "clinic_locality", "VARCHAR(128)"),
        ("doctor_profiles", "latitude", "FLOAT"),
        ("doctor_profiles", "longitude", "FLOAT"),
        # Doctor Availability & Concurrency extensions
        ("appointment_slot_holds", "consultation_mode", "VARCHAR(32) DEFAULT 'online'"),
        ("appointment_slot_holds", "idempotency_key", "VARCHAR(128)"),
        ("doctor_schedule_overrides", "consultation_modes", "JSON"),
        ("doctor_schedule_overrides", "clinic_location_id", "VARCHAR(64)"),
        # Cashfree Payment Gateway extensions
        ("payments", "cf_order_id", "VARCHAR(128)"),
        ("payments", "cf_payment_id", "VARCHAR(128)"),
        ("payments", "payment_session_id", "VARCHAR(512)"),
        ("payments", "cf_refund_id", "VARCHAR(128)"),
        ("orders", "cf_order_id", "VARCHAR(128)"),
        ("orders", "payment_session_id", "VARCHAR(512)")
    ]
    with eng.connect() as conn:
        for table, col, col_type in new_cols:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass

def get_db():
    """FastAPI Dependency for database session management."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

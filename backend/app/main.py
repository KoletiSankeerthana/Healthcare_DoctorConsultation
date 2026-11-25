"""
FastAPI Application Entry Point
AI Medical Document Intelligence and Doctor Consultation Platform
"""

import sys
import os
from pathlib import Path

# Ensure both project root and backend dir are in sys.path
_current_dir = Path(__file__).resolve().parent
_backend_dir = _current_dir.parent
_root_dir = _backend_dir.parent

for _p in [str(_root_dir), str(_backend_dir)]:
    if _p not in sys.path:
        sys.path.insert(0, _p)

from fastapi import FastAPI
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

try:
    from backend.app.config import settings
    from backend.app.db.database import Base, engine
    from backend.app.api.v1.medical_documents import router as medical_docs_router
    from backend.app.api.v1.doctor_verification import router as doctor_verification_router
    from backend.app.api.v1.payments import router as payments_router
    from backend.app.api.v1.doctors import router as doctors_router
    from backend.app.api.v1.symptom_assessments import router as symptom_assessments_router
    from backend.app.api.v1.patient import router as patient_router
except ImportError:
    from app.config import settings
    from app.db.database import Base, engine
    from app.api.v1.medical_documents import router as medical_docs_router
    from app.api.v1.doctor_verification import router as doctor_verification_router
    from app.api.v1.payments import router as payments_router
    from app.api.v1.doctors import router as doctors_router
    from app.api.v1.symptom_assessments import router as symptom_assessments_router
    from app.api.v1.patient import router as patient_router

# Initialize database schema tables
Base.metadata.create_all(bind=engine)

# Ensure new columns on existing SQLite tables
from sqlalchemy import text
with engine.connect() as conn:
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
        ("doctor_schedule_overrides", "clinic_location_id", "VARCHAR(64)")
    ]
    for table, col, col_type in new_cols:
        try:
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
            conn.commit()
        except Exception:
            pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Set all CORS enabled origins for frontend dev and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Common documentation aliases and redirects (prevents 404 or 405 on typos, trailing slashes, or HEAD probes)
@app.api_route("/doc", methods=["GET", "HEAD"], include_in_schema=False)
@app.api_route("/doc/", methods=["GET", "HEAD"], include_in_schema=False)
@app.api_route("/docs/", methods=["GET", "HEAD"], include_in_schema=False)
@app.api_route("/documentation", methods=["GET", "HEAD"], include_in_schema=False)
@app.api_route("/swagger", methods=["GET", "HEAD"], include_in_schema=False)
@app.api_route("/swagger/", methods=["GET", "HEAD"], include_in_schema=False)
@app.api_route("/api/docs", methods=["GET", "HEAD"], include_in_schema=False)
@app.api_route("/api/docs/", methods=["GET", "HEAD"], include_in_schema=False)
@app.api_route("/api/v1/docs", methods=["GET", "HEAD"], include_in_schema=False)
@app.api_route("/api/v1/docs/", methods=["GET", "HEAD"], include_in_schema=False)
def redirect_to_docs():
    return RedirectResponse(url="/docs")

@app.get("/api/v1/openapi.json", include_in_schema=False)
def openapi_v1_alias():
    return RedirectResponse(url="/openapi.json")

# Include API v1 Routers
app.include_router(medical_docs_router, prefix=settings.API_V1_STR)
app.include_router(doctor_verification_router, prefix=f"{settings.API_V1_STR}/doctor-verification", tags=["Doctor Verification"])
app.include_router(payments_router, prefix=settings.API_V1_STR)
app.include_router(doctors_router, prefix=settings.API_V1_STR)
app.include_router(symptom_assessments_router, prefix=settings.API_V1_STR)
app.include_router(patient_router, prefix=settings.API_V1_STR)

@app.get("/api/v1/auth/me", tags=["Auth"])
def get_current_authenticated_user(token: str = None, authorization: str = None):
    """Instant HTTP validation of session token for frontend authentication."""
    session_token = token
    if not session_token and authorization:
        session_token = authorization.replace("Bearer ", "").strip()
    if not session_token:
        return JSONResponse(status_code=401, content={"authenticated": False, "user": None})

    from backend.app.services.auth_service import get_user_by_session
    user_payload = get_user_by_session(session_token)
    if not user_payload:
        return JSONResponse(status_code=401, content={"authenticated": False, "user": None})

    return {"authenticated": True, "user": user_payload}

@app.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint that validates database connectivity and operational status."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            db_status = "connected"
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "service": "Healthcare Platform API",
                "database": f"error: {str(e)}"
            }
        )

    return {
        "status": "healthy",
        "service": "Healthcare Platform API",
        "database": db_status,
        "api_version": settings.API_V1_STR,
        "docs": "/docs"
    }

@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Welcome to Healthcare Platform API",
        "docs": "/docs",
        "health": "/health",
        "status": "healthy"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=True)

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
from sqlalchemy import text

try:
    from backend.app.config import settings
    from backend.app.db.database import Base, engine, ensure_schema_migrations
    from backend.app.api.v1.medical_documents import router as medical_docs_router
    from backend.app.api.v1.doctor_verification import router as doctor_verification_router
    from backend.app.api.v1.payments import router as payments_router
    from backend.app.api.v1.doctors import router as doctors_router
    from backend.app.api.v1.symptom_assessments import router as symptom_assessments_router
    from backend.app.api.v1.patient import router as patient_router
except ImportError:
    from app.config import settings
    from app.db.database import Base, engine, ensure_schema_migrations
    from app.api.v1.medical_documents import router as medical_docs_router
    from app.api.v1.doctor_verification import router as doctor_verification_router
    from app.api.v1.payments import router as payments_router
    from app.api.v1.doctors import router as doctors_router
    from app.api.v1.symptom_assessments import router as symptom_assessments_router
    from app.api.v1.patient import router as patient_router

# Initialize database schema tables
print(f"[Healvia Database] Initializing schema tables on {settings.DATABASE_URL}...")
if settings.DATABASE_URL.startswith("sqlite") and ":memory:" not in settings.DATABASE_URL:
    try:
        raw_url = settings.DATABASE_URL
        if raw_url.startswith("sqlite:////"):
            db_file_path = Path("/" + raw_url[11:])
        elif raw_url.startswith("sqlite:///"):
            db_file_path = Path(raw_url[10:])
        else:
            db_file_path = Path(raw_url[9:])
        db_file_path.parent.mkdir(parents=True, exist_ok=True)
    except Exception as dir_err:
        print(f"[Healvia Database Warning] Pre-init dir check: {dir_err}")

Base.metadata.create_all(bind=engine)
ensure_schema_migrations(engine)
print("[Healvia Database] Base schema tables and column migrations verified and ready.")

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

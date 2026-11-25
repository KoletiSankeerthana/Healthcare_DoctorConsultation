"""
FastAPI Router: Patient Health Profile & Context
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from backend.app.services.patient_service import get_patient_profile, save_patient_profile

router = APIRouter(prefix="/patient", tags=["Patient Health Profile"])

@router.get("/profile")
def get_profile(patient_id: str = Query("pat-101", description="Patient identifier")):
    """Retrieve patient health profile including medical conditions, allergies, and location."""
    profile = get_patient_profile(patient_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return profile

@router.post("/profile")
def update_profile(payload: Dict[str, Any]):
    """Update patient health profile."""
    res = save_patient_profile(payload)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to update profile"))
    return res

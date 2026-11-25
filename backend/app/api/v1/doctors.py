"""
FastAPI Router: Doctors Discovery, Profile & Dynamic Scheduling
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from backend.app.db.database import get_db
from backend.app.services.scheduling_service import (
    get_doctor_schedule,
    save_doctor_schedule,
    get_doctor_schedule_settings,
    save_doctor_schedule_settings,
    get_doctor_leaves,
    add_doctor_leave,
    cancel_doctor_leave,
    get_available_slots,
    hold_appointment_slot,
    release_slot_hold,
    book_appointment_atomic
)
from backend.app.services.db_bridge import get_approved_doctors, get_approved_doctor_by_id

router = APIRouter(tags=["Doctors & Scheduling"])

class BookAppointmentRequest(BaseModel):
    doctor_id: str
    date: str
    time: str
    type: str = "online"
    patient_id: str = "pat-101"
    patient_name: str = "Aditya Vardhan"
    patient_email: str = "patient@mediverse.org"
    patient_phone: str = "+91 98765 43210"
    symptoms: Optional[str] = "General consultation"
    notes: Optional[str] = ""
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    hold_id: Optional[str] = None

class HoldSlotRequest(BaseModel):
    date: str
    start_time: str
    end_time: str
    patient_id: str = "pat-101"
    hold_seconds: int = 300

@router.get("/doctors", response_model=List[Dict[str, Any]])
def list_doctors(
    search: str = Query("", description="Doctor name, clinic, or keyword"),
    specialty: str = Query("", description="Medical discipline filter"),
    city: str = Query("", description="City or metropolitan region"),
    consult_type: str = Query("", description="Consultation mode: online, in-person, or all"),
    min_exp: int = Query(0, description="Minimum years of clinical experience"),
    max_fee: float = Query(0.0, description="Maximum consultation fee"),
    min_rating: float = Query(0.0, description="Minimum star rating"),
    sort_by: str = Query("rating", description="Sort order: rating, experience, fee_asc, fee_desc")
):
    """Retrieve verified, approved doctors from database with clinical filtering."""
    filters = {
        "search": search,
        "specialty": specialty,
        "city": city,
        "consult_type": consult_type,
        "min_exp": min_exp,
        "max_fee": max_fee,
        "min_rating": min_rating,
        "sort_by": sort_by
    }
    return get_approved_doctors(**filters)

@router.get("/doctors/{doctor_id}")
def get_doctor_details(doctor_id: str):
    """Retrieve comprehensive physician credentials, verification status, and practice details."""
    doctor = get_approved_doctor_by_id(doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doctor

@router.get("/doctors/{doctor_id}/availability")
def get_doctor_availability_slots(
    doctor_id: str,
    date: str = Query(..., description="Date formatted as YYYY-MM-DD"),
    mode: str = Query("online", description="Consultation mode: online or in-person")
):
    """Retrieve real-time dynamically generated available consultation slots for a specific doctor and date."""
    return get_available_slots(doctor_id, date, mode)

@router.post("/doctors/{doctor_id}/hold-slot")
def hold_slot(doctor_id: str, payload: HoldSlotRequest):
    """Temporarily hold a consultation slot for 5 minutes during checkout to avoid booking collisions."""
    return hold_appointment_slot(
        doctor_id=doctor_id,
        date_str=payload.date,
        start_time_str=payload.start_time,
        end_time_str=payload.end_time,
        patient_id=payload.patient_id,
        hold_seconds=payload.hold_seconds
    )

@router.post("/doctors/{doctor_id}/book")
def book_consultation(doctor_id: str, payload: BookAppointmentRequest):
    """Atomic booking confirmation ensuring no duplicate bookings."""
    res = book_appointment_atomic(payload.model_dump())
    if not res.get("success"):
        raise HTTPException(
            status_code=409 if res.get("conflict") else 400,
            detail=res.get("error", "Unable to complete booking.")
        )
    return res

@router.get("/doctors/{doctor_id}/schedule")
def get_schedule(doctor_id: str):
    """Get weekly working sessions and schedule configuration for the doctor."""
    return get_doctor_schedule(doctor_id)

@router.post("/doctors/{doctor_id}/schedule")
def update_schedule(doctor_id: str, payload: Dict[str, Any]):
    """Update weekly working sessions for the doctor."""
    return save_doctor_schedule(doctor_id, payload)

@router.get("/appointments")
def list_appointments(
    role: str = Query("patient", description="Role: patient or doctor"),
    patient_id: Optional[str] = Query(None),
    doctor_id: Optional[str] = Query(None),
    status: str = Query("all")
):
    """List appointments for patient or doctor."""
    if role == "doctor" and doctor_id:
        return get_doctor_appointments(doctor_id, status)
    p_id = patient_id or "pt-101"
    return get_patient_appointments(p_id, status)

@router.get("/appointments/{appointment_id}/cancellation-policy")
def get_cancellation_policy(appointment_id: str):
    """Check if appointment is eligible for cancellation under the 24-hour deadline."""
    from backend.app.services.scheduling_service import check_cancellation_eligibility
    res = check_cancellation_eligibility(appointment_id)
    return res

class CancelAppointmentRequest(BaseModel):
    reason: str
    cancelled_by: str = "patient"

@router.post("/appointments/{appointment_id}/cancel")
def cancel_appointment_endpoint(appointment_id: str, payload: CancelAppointmentRequest):
    """Cancel an appointment with 24-hour non-refundable policy enforcement."""
    from backend.app.services.scheduling_service import cancel_appointment
    try:
        res = cancel_appointment(appointment_id, payload.reason, payload.cancelled_by)
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Internal server error while cancelling appointment.")

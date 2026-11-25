"""
Unit and Integration Tests for MediVerse Appointment Cancellation System & 24-Hour Policy
"""

import pytest
from datetime import datetime, timedelta
from backend.app.db.database import SessionLocal
from backend.app.db.models import Appointment
from backend.app.services.scheduling_service import (
    cancel_appointment,
    check_cancellation_eligibility,
    get_now_kolkata
)

def test_cancellation_policy_more_than_24h():
    """Appointments scheduled > 24h away must be eligible for cancellation."""
    db = SessionLocal()
    future_date = (get_now_kolkata() + timedelta(days=3)).strftime("%Y-%m-%d")
    apt = Appointment(
        id="apt-test-cancel-future-01",
        doctor_id="doc-1",
        doctor_name="Dr. Arvind Swaminathan",
        doctor_specialty="Cardiology",
        patient_id="pt-101",
        patient_name="Aditya Test",
        patient_email="patient@mediverse.org",
        patient_phone="+91 98765 43210",
        date=future_date,
        time="10:00 AM - 10:30 AM",
        start_time="10:00",
        end_time="10:30",
        type="online",
        status="upcoming",
        fee=1200
    )
    db.merge(apt)
    db.commit()
    db.close()

    res = check_cancellation_eligibility("apt-test-cancel-future-01")
    assert res["eligible"] is True
    assert res["hours_remaining"] > 24.0

    # Execute cancellation
    cancel_res = cancel_appointment("apt-test-cancel-future-01", "Schedule conflict", "patient")
    assert cancel_res["success"] is True

    # Verify status in DB
    db = SessionLocal()
    apt_db = db.query(Appointment).filter_by(id="apt-test-cancel-future-01").first()
    assert apt_db.status == "cancelled"
    assert "Schedule conflict" in apt_db.cancellation_reason
    db.delete(apt_db)
    db.commit()
    db.close()


def test_cancellation_policy_less_than_24h_locked():
    """Appointments scheduled < 24h away must be locked for patient cancellation."""
    db = SessionLocal()
    # 2 hours in the future
    near_time = get_now_kolkata() + timedelta(hours=2)
    near_date = near_time.strftime("%Y-%m-%d")
    near_start = near_time.strftime("%H:%M")

    apt = Appointment(
        id="apt-test-cancel-locked-01",
        doctor_id="doc-1",
        doctor_name="Dr. Arvind Swaminathan",
        doctor_specialty="Cardiology",
        patient_id="pt-101",
        patient_name="Aditya Test",
        patient_email="patient@mediverse.org",
        patient_phone="+91 98765 43210",
        date=near_date,
        time=f"{near_start} - 30 min",
        start_time=near_start,
        type="online",
        status="upcoming",
        fee=1200
    )
    db.merge(apt)
    db.commit()
    db.close()

    # Check eligibility
    res = check_cancellation_eligibility("apt-test-cancel-locked-01")
    assert res["eligible"] is False
    assert res["hours_remaining"] < 24.0
    assert "Cancellation locked" in (res["reason"] or "")

    # Attempt cancellation by patient must be rejected
    with pytest.raises(ValueError) as excinfo:
        cancel_appointment("apt-test-cancel-locked-01", "Last minute change", "patient")
    assert "24 hours" in str(excinfo.value)

    # But doctor can cancel even within 24 hours
    doc_cancel_res = cancel_appointment("apt-test-cancel-locked-01", "Emergency surgery", "doctor")
    assert doc_cancel_res["success"] is True

    db = SessionLocal()
    apt_db = db.query(Appointment).filter_by(id="apt-test-cancel-locked-01").first()
    assert apt_db.status == "cancelled"
    assert "Cancelled by Doctor" in apt_db.cancellation_reason
    db.delete(apt_db)
    db.commit()
    db.close()

import pytest
from datetime import datetime, timedelta
from backend.app.db.database import SessionLocal
from backend.app.db.models import (
    DoctorProfile,
    DoctorVerificationApplication,
    DoctorAvailability,
    DoctorAvailabilitySession,
    DoctorScheduleSettings,
    DoctorLeave,
    Appointment,
    AppointmentSlotHold
)
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

DOCTOR_ID = "doc-1" # Dr. Arvind Swaminathan (Cardiologist, verified & approved)

def test_doctor_schedule_and_settings_retrieval():
    """Verify doctor schedule includes multi-sessions, leaves, and schedule settings."""
    sched = get_doctor_schedule(DOCTOR_ID)
    assert sched is not None
    assert sched["doctor_id"] == DOCTOR_ID
    assert "weekly_schedule" in sched
    assert len(sched["weekly_schedule"]) == 7
    assert "settings" in sched
    assert "timezone" in sched["settings"]
    assert sched["settings"]["timezone"] == "Asia/Kolkata"
    assert "sessions" in sched["weekly_schedule"][0]

def test_save_doctor_schedule_settings():
    """Verify custom schedule settings can be persisted."""
    custom_settings = {
        "minimum_notice_minutes": 60,
        "maximum_advance_days": 45,
        "maximum_appointments_per_day": 25,
        "same_day_booking_enabled": True,
        "default_duration_minutes": 20,
        "buffer_minutes": 10
    }
    res = save_doctor_schedule_settings(DOCTOR_ID, custom_settings)
    assert res["success"] is True

    updated = get_doctor_schedule_settings(DOCTOR_ID)
    assert updated["minimum_notice_minutes"] == 60
    assert updated["maximum_advance_days"] == 45
    assert updated["maximum_appointments_per_day"] == 25
    assert updated["default_duration_minutes"] == 20
    assert updated["buffer_minutes"] == 10

def test_multi_session_saving_and_retrieval():
    """Verify that multiple sessions per day can be configured and saved."""
    # Configure Monday (weekday 0) with 2 sessions: Morning 09:00-12:00, Evening 16:00-19:00
    payload = {
        "weekly_schedule": [
            {
                "weekday": 0,
                "is_active": True,
                "consultation_duration": 30,
                "buffer_duration": 5,
                "consultation_modes": ["online", "in-person"],
                "max_appointments": 16,
                "sessions": [
                    {
                        "session_name": "Morning Clinic OPD",
                        "start_time": "09:00",
                        "end_time": "12:00",
                        "consultation_duration": 30,
                        "buffer_duration": 5,
                        "consultation_modes": ["online", "in-person"],
                        "is_active": True
                    },
                    {
                        "session_name": "Evening Telehealth Sessions",
                        "start_time": "16:00",
                        "end_time": "19:00",
                        "consultation_duration": 30,
                        "buffer_duration": 5,
                        "consultation_modes": ["online"],
                        "is_active": True
                    }
                ],
                "breaks": [
                    {"start_time": "13:00", "end_time": "14:00", "title": "Clinical Administration"}
                ]
            }
        ]
    }
    save_res = save_doctor_schedule(DOCTOR_ID, payload)
    assert save_res["success"] is True

    sched = get_doctor_schedule(DOCTOR_ID)
    mon = next(d for d in sched["weekly_schedule"] if d["weekday"] == 0)
    assert mon["is_active"] is True
    assert len(mon["sessions"]) == 2
    assert mon["sessions"][0]["session_name"] == "Morning Clinic OPD"
    assert mon["sessions"][1]["session_name"] == "Evening Telehealth Sessions"

def test_dynamic_slot_generation_with_buffer_and_sessions():
    """Verify slot generator properly honors session windows and buffer spacing."""
    # Find next Monday date
    today = datetime.now().date()
    days_ahead = (0 - today.weekday() + 7) % 7
    if days_ahead == 0:
        days_ahead = 7
    target_monday = (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")

    slots_data = get_available_slots(DOCTOR_ID, target_monday, consult_mode="all")
    assert slots_data["available"] is True
    assert slots_data["total_available_slots"] > 0
    assert "grouped_slots" in slots_data

    # Check that slots from morning and evening sessions exist
    slot_starts = [s["start_time"] for s in slots_data["slots"]]
    assert "09:00" in slot_starts
    assert "16:00" in slot_starts
    # Check that 13:00 (midday break/off hours) is NOT in slot starts
    assert "13:00" not in slot_starts
    assert "14:00" not in slot_starts

def test_leave_management_and_conflict_detection():
    """Verify leave creation, conflict identification, and slot blocking."""
    future_date = (datetime.now().date() + timedelta(days=12)).strftime("%Y-%m-%d")

    leave_payload = {
        "start_date": future_date,
        "end_date": future_date,
        "is_all_day": True,
        "leave_type": "conference",
        "reason": "National Cardiology Conference"
    }
    leave_res = add_doctor_leave(DOCTOR_ID, leave_payload)
    assert leave_res["success"] is True
    assert "leave_id" in leave_res
    leave_id = leave_res["leave_id"]

    # Slot availability on this date must now return unavailable
    slots_data = get_available_slots(DOCTOR_ID, future_date)
    assert slots_data["available"] is False
    assert "leave" in slots_data["reason"].lower()

    # Cancel the leave
    cancel_res = cancel_doctor_leave(DOCTOR_ID, leave_id)
    assert cancel_res["success"] is True

def test_temporary_slot_hold_and_concurrency():
    """Verify temporary slot holding prevents race condition duplicate bookings."""
    test_date = (datetime.now().date() + timedelta(days=15)).strftime("%Y-%m-%d")

    # Hold slot 09:00 to 09:30 for Patient A
    hold_a = hold_appointment_slot({
        "doctor_id": DOCTOR_ID,
        "patient_id": "patient-alice",
        "date": test_date,
        "start_time": "09:00",
        "end_time": "09:30",
        "hold_seconds": 60
    })
    assert hold_a["success"] is True
    hold_id = hold_a["hold_id"]

    # Patient B tries to hold overlapping slot 09:00 to 09:30 on the same date
    hold_b = hold_appointment_slot({
        "doctor_id": DOCTOR_ID,
        "patient_id": "patient-bob",
        "date": test_date,
        "start_time": "09:00",
        "end_time": "09:30",
        "hold_seconds": 60
    })
    assert hold_b["success"] is False
    assert "held by another patient" in hold_b["error"]

    # Release hold
    released = release_slot_hold(hold_id)
    assert released is True

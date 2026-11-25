import pytest
import os
import sys
import uuid
from datetime import datetime, date, timedelta

# Ensure project root is in path
sys.path.insert(0, os.path.abspath("."))

from backend.app.db.database import SessionLocal
from backend.app.db.models import (
    DoctorProfile,
    DoctorVerificationApplication,
    DoctorAvailability,
    DoctorAvailabilityBreak,
    Appointment,
    AppointmentSlotHold,
    VideoConsultation,
    ConsultationParticipant,
    ConsultationSignal,
    ConsultationMessage,
    ConsultationNote
)
from backend.app.services.scheduling_service import (
    get_or_create_default_availability,
    get_doctor_schedule,
    save_doctor_schedule,
    add_schedule_override,
    remove_schedule_override,
    get_available_slots,
    hold_appointment_slot,
    release_slot_hold,
    book_appointment_atomic,
    get_patient_appointments,
    get_doctor_appointments,
    cancel_appointment,
    join_video_consultation,
    send_consultation_signal,
    get_pending_signals,
    send_chat_message,
    get_chat_messages,
    end_video_consultation
)

TEST_DOC_ID = f"doc_test_{uuid.uuid4().hex[:6]}"
TEST_PATIENT_ID = f"pt_test_{uuid.uuid4().hex[:6]}"
TEST_DATE = "2026-12-15"  # A Tuesday

@pytest.fixture(scope="module")
def setup_test_doctor():
    db = SessionLocal()
    # Create doctor profile
    doc = DoctorProfile(
        id=TEST_DOC_ID,
        name="Dr. Testing Consultant",
        title="Consultant Cardiologist",
        specialty="Cardiology",
        specialty_slug="cardiology",
        qualifications=["MBBS", "MD Cardiology"],
        languages=["English", "Hindi"],
        experience_years=14,
        consultation_fee=1500,
        consultation_types=["online", "in-person"],
        clinic_name="Apex Heart Institute",
        clinic_address="MG Road",
        clinic_city="Bengaluru",
        rating=4.9,
        review_count=84,
        verified=True
    )
    db.add(doc)

    # Create approved verification application
    app = DoctorVerificationApplication(
        id=f"dva-{TEST_DOC_ID}",
        doctor_id=TEST_DOC_ID,
        application_reference=f"DOC-VER-TEST-{uuid.uuid4().hex[:4]}",
        status="approved",
        personal_info={
            "fullName": "Dr. Testing Consultant",
            "email": f"{TEST_DOC_ID}@apexheart.in",
            "phone": "+919845012345"
        },
        professional_info={
            "specialty": "Cardiology",
            "highestQualification": "MD Cardiology",
            "experienceYears": 14
        },
        registration_info={
            "registrationNumber": "KMC-TEST-99881",
            "issuingCouncil": "Karnataka Medical Council"
        },
        submitted_at=datetime.utcnow()
    )
    db.add(app)
    db.commit()
    db.close()

    yield TEST_DOC_ID

    # Cleanup
    clean_db = SessionLocal()
    clean_db.query(ConsultationSignal).filter(ConsultationSignal.room_id.like(f"%{TEST_DOC_ID}%")).delete(synchronize_session=False)
    clean_db.query(ConsultationMessage).filter(ConsultationMessage.sender_id.in_([TEST_DOC_ID, TEST_PATIENT_ID])).delete(synchronize_session=False)
    clean_db.query(AppointmentSlotHold).filter_by(doctor_id=TEST_DOC_ID).delete()
    clean_db.query(Appointment).filter_by(doctor_id=TEST_DOC_ID).delete()
    clean_db.query(DoctorAvailabilityBreak).filter(DoctorAvailabilityBreak.id.like(f"%{TEST_DOC_ID}%")).delete(synchronize_session=False)
    clean_db.query(DoctorAvailability).filter_by(doctor_id=TEST_DOC_ID).delete()
    clean_db.query(DoctorVerificationApplication).filter_by(doctor_id=TEST_DOC_ID).delete()
    clean_db.query(DoctorProfile).filter_by(id=TEST_DOC_ID).delete()
    clean_db.commit()
    clean_db.close()


def test_default_availability_creation(setup_test_doctor):
    """Verify default weekly availability is auto-generated for all 7 days with breaks."""
    db = SessionLocal()
    try:
        avail_list = get_or_create_default_availability(db, TEST_DOC_ID)
        assert len(avail_list) == 7

        # Check Monday (weekday=0) is active
        mon = next(a for a in avail_list if a.weekday == 0)
        assert mon.is_active is True
        assert mon.start_time == "09:00"
        assert mon.end_time == "17:00"
        assert mon.consultation_duration == 30
        assert len(mon.breaks) >= 1
        assert mon.breaks[0].start_time == "13:00"
    finally:
        db.close()


def test_dynamic_slot_generation(setup_test_doctor):
    """Verify slot engine yields valid slots and excludes lunch break."""
    slot_res = get_available_slots(TEST_DOC_ID, TEST_DATE)
    assert slot_res["available"] is True
    slots = slot_res["slots"]
    assert len(slots) > 0

    slot_times = [s["start_time"] for s in slots]
    assert "09:00" in slot_times

    # 13:00 to 14:00 is lunch break - verify excluded
    assert "13:00" not in slot_times
    assert "13:35" not in slot_times


def test_slot_hold_and_collision_prevention(setup_test_doctor):
    """Verify holding a slot prevents another patient from holding the same slot simultaneously."""
    slot_res = get_available_slots(TEST_DOC_ID, TEST_DATE)
    assert len(slot_res["slots"]) > 0
    test_slot = slot_res["slots"][1]
    slot_start = test_slot["start_time"]
    slot_end = test_slot["end_time"]

    # Patient 1 holds the slot
    hold_payload1 = {
        "doctor_id": TEST_DOC_ID,
        "patient_id": TEST_PATIENT_ID,
        "date": TEST_DATE,
        "start_time": slot_start,
        "end_time": slot_end,
        "hold_seconds": 300
    }
    hold1 = hold_appointment_slot(hold_payload1)
    assert hold1["success"] is True
    assert "hold_id" in hold1

    # Patient 2 tries to hold the same slot -> must fail with success=False
    other_patient = f"pt_other_{uuid.uuid4().hex[:6]}"
    hold_payload2 = {
        "doctor_id": TEST_DOC_ID,
        "patient_id": other_patient,
        "date": TEST_DATE,
        "start_time": slot_start,
        "end_time": slot_end,
        "hold_seconds": 300
    }
    hold2 = hold_appointment_slot(hold_payload2)
    assert hold2["success"] is False
    assert "held by another patient" in hold2["error"].lower()

    # Slot query should omit the held slot
    slot_res = get_available_slots(TEST_DOC_ID, TEST_DATE)
    avail_times = [s["start_time"] for s in slot_res["slots"]]
    assert slot_start not in avail_times

    # Release the hold
    released = release_slot_hold(hold1["hold_id"])
    assert released is True

    # Now slot is available again
    slot_res_after = get_available_slots(TEST_DOC_ID, TEST_DATE)
    avail_times_after = [s["start_time"] for s in slot_res_after["slots"]]
    assert slot_start in avail_times_after


def test_atomic_appointment_booking(setup_test_doctor):
    """Verify booking an appointment commits to DB and creates a dedicated VideoConsultation room."""
    slot_res = get_available_slots(TEST_DOC_ID, TEST_DATE)
    test_slot = slot_res["slots"][2]

    booking_payload = {
        "doctor_id": TEST_DOC_ID,
        "patient_id": TEST_PATIENT_ID,
        "patient_name": "Priya Sharma",
        "patient_email": "priya@test.org",
        "patient_phone": "+919876543210",
        "date": TEST_DATE,
        "time": test_slot["display_time"],
        "start_time": test_slot["start_time"],
        "end_time": test_slot["end_time"],
        "type": "online",
        "fee": 1500,
        "symptoms": "Persistent mild arrhythmia and elevated resting pulse",
        "payment_reference": "pay_test_001"
    }

    res = book_appointment_atomic(booking_payload)
    assert res["success"] is True
    apt = res["appointment"]
    assert apt["reference"].startswith("MED-")
    assert apt["status"] == "confirmed"
    assert apt["meeting_room_id"] is not None

    # Check that booked slot is now removed from available slots
    slot_res = get_available_slots(TEST_DOC_ID, TEST_DATE)
    avail_times = [s["start_time"] for s in slot_res["slots"]]
    assert test_slot["start_time"] not in avail_times


def test_webrtc_consultation_lifecycle(setup_test_doctor):
    """Verify doctor and patient can join room, exchange WebRTC signals, send chat messages, and conclude call."""
    slot_res = get_available_slots(TEST_DOC_ID, TEST_DATE)
    test_slot = slot_res["slots"][3]

    booking_payload = {
        "doctor_id": TEST_DOC_ID,
        "patient_id": TEST_PATIENT_ID,
        "patient_name": "Priya Sharma",
        "patient_email": "priya@test.org",
        "patient_phone": "+919876543210",
        "date": TEST_DATE,
        "time": test_slot["display_time"],
        "start_time": test_slot["start_time"],
        "end_time": test_slot["end_time"],
        "type": "online",
        "fee": 1500,
        "symptoms": "Follow-up consultation",
        "payment_reference": "pay_test_002"
    }
    res = book_appointment_atomic(booking_payload)
    assert res["success"] is True
    apt = res["appointment"]
    room_id = apt["meeting_room_id"]

    # 1. Patient joins
    p_join = join_video_consultation(
        room_id=room_id,
        user_id=TEST_PATIENT_ID,
        user_name="Priya Sharma",
        user_role="patient"
    )
    assert p_join["success"] is True
    assert p_join["token"] is not None
    assert p_join["user_role"] == "patient"
    assert len(p_join["ice_servers"]) > 0

    # 2. Doctor joins
    d_join = join_video_consultation(
        room_id=room_id,
        user_id=TEST_DOC_ID,
        user_name="Dr. Testing Consultant",
        user_role="doctor"
    )
    assert d_join["success"] is True
    assert d_join["user_role"] == "doctor"
    assert d_join["consultation_status"] == "in_progress"

    # 3. WebRTC SDP Offer / Answer exchange
    sig_offer = send_consultation_signal(
        room_id=room_id,
        sender_role="doctor",
        target_role="patient",
        signal_type="offer",
        signal_data={"type": "offer", "sdp": "v=0\r\no=doctor..."}
    )
    assert sig_offer["success"] is True

    # Patient fetches pending signals
    signals_for_patient = get_pending_signals(room_id, target_role="patient")
    assert len(signals_for_patient) == 1
    assert signals_for_patient[0]["signal_type"] == "offer"

    # 4. In-Call Chat Messaging
    chat1 = send_chat_message(
        room_id=room_id,
        sender_id=TEST_DOC_ID,
        sender_name="Dr. Testing Consultant",
        sender_role="doctor",
        message="Hello Priya, I am reviewing your ECG reading."
    )
    assert chat1["message"] == "Hello Priya, I am reviewing your ECG reading."

    chat2 = send_chat_message(
        room_id=room_id,
        sender_id=TEST_PATIENT_ID,
        sender_name="Priya Sharma",
        sender_role="patient",
        message="Thank you doctor, here are the recent values."
    )
    assert chat2["id"] is not None

    messages = get_chat_messages(room_id)
    assert len(messages) >= 2
    assert messages[0]["sender_role"] == "doctor"
    assert messages[1]["sender_role"] == "patient"

    # 5. Doctor concludes consultation and saves clinical notes
    end_res = end_video_consultation(
        room_id=room_id,
        payload={
            "ended_by_user_id": TEST_DOC_ID,
            "clinical_notes": "Sinus tachycardia, stable vitals. Prescribe Metoprolol 25mg once daily.",
            "diagnosis": "Sinus Tachycardia",
            "prescription": "Metoprolol 25mg 1-0-0 for 14 days"
        }
    )
    assert end_res["success"] is True
    assert end_res["duration_seconds"] is not None

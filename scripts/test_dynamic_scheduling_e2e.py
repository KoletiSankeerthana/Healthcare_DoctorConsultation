import os
import sys
from datetime import datetime, date, timedelta

# Add project root and backend directory to sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, "backend"))

from backend.app.db.database import SessionLocal, Base, engine
from backend.app.db.models import (
    User, DoctorProfile, DoctorAvailability, DoctorAvailabilityBreak,
    DoctorScheduleOverride, DoctorLeave, Appointment, VideoConsultation,
    DoctorNotification, PatientNotification, EmailNotificationLog
)
from backend.app.services.scheduling_service import (
    get_available_slots, save_doctor_schedule, add_schedule_override,
    add_doctor_leave, book_appointment_atomic, join_video_consultation,
    get_patient_notifications, get_doctor_notifications, get_email_logs,
    get_doctor_appointments, get_patient_appointments
)

def run_tests():
    print("=" * 60)
    print("RUNNING END-TO-END HEALTHCARE SCHEDULING VERIFICATION")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        # Step 1: Ensure Doctor & Patient exist in DB
        doc_id = "doc-1"
        pat_id = "usr-pat-101"
        
        doctor = db.query(DoctorProfile).filter_by(id=doc_id).first()
        if not doctor:
            print(f"[SETUP] Creating test doctor {doc_id}")
            doctor = DoctorProfile(
                id=doc_id,
                name="Dr. Arvind Swaminathan",
                specialty="Cardiology",
                experience_years=18,
                consultation_fee=1200.0,
                rating=4.9,
                total_reviews=142,
                verified=True,
                is_active=True
            )
            db.add(doctor)
            db.commit()
            
        doc_user = db.query(User).filter_by(doctor_id=doc_id).first()
        if not doc_user:
            doc_user = User(
                id="usr-doc-1",
                email="dr.arvind@apexheart.in",
                hashed_password="hash",
                full_name="Dr. Arvind Swaminathan",
                role="doctor",
                doctor_id=doc_id,
                is_active=True
            )
            db.add(doc_user)
            db.commit()

        pat_user = db.query(User).filter_by(id=pat_id).first()
        if not pat_user:
            pat_user = User(
                id=pat_id,
                email="aditya.vardhan@gmail.com",
                hashed_password="hash",
                full_name="Aditya Vardhan",
                role="patient",
                is_active=True
            )
            db.add(pat_user)
            db.commit()
            
        # Target dates for testing (use next week)
        today = date.today()
        # Find next Monday (day_of_week=0)
        days_ahead = (0 - today.weekday() + 7) % 7
        if days_ahead == 0:
            days_ahead = 7
        target_monday = today + timedelta(days=days_ahead)
        target_tuesday = target_monday + timedelta(days=1)
        
        target_monday_str = target_monday.strftime("%Y-%m-%d")
        target_tuesday_str = target_tuesday.strftime("%Y-%m-%d")
        print(f"[TEST DATE] Monday: {target_monday_str}, Tuesday: {target_tuesday_str}")

        # Clean up any leftover test data for target dates
        db.query(Appointment).filter(
            Appointment.doctor_id == doc_id,
            Appointment.date.in_([target_monday_str, target_tuesday_str])
        ).delete(synchronize_session=False)
        db.query(DoctorLeave).filter(
            DoctorLeave.doctor_id == doc_id,
            DoctorLeave.start_date.in_([target_monday_str, target_tuesday_str])
        ).delete(synchronize_session=False)
        db.commit()

        # TEST 1: Save Doctor Weekly Schedule & Breaks
        print("\n--- TEST 1: Doctor Weekly Schedule Configuration ---")
        schedule_payload = {
            "weekly_schedule": [
                {
                    "weekday": 0, # Monday
                    "is_active": True,
                    "start_time": "09:00",
                    "end_time": "12:00",
                    "consultation_duration": 30,
                    "buffer_duration": 0,
                    "breaks": [
                        {"start_time": "10:30", "end_time": "11:00", "title": "Morning Round"}
                    ]
                },
                {
                    "weekday": 1, # Tuesday
                    "is_active": True,
                    "start_time": "14:00",
                    "end_time": "17:00",
                    "consultation_duration": 30,
                    "buffer_duration": 0,
                    "breaks": []
                }
            ]
        }
        save_res = save_doctor_schedule(doc_id, schedule_payload)
        assert save_res.get("success"), f"Failed to save schedule: {save_res}"
        print("  ✓ Doctor weekly schedule with break saved successfully.")

        # TEST 2: Dynamic Available Slots Calculation (Excluding Breaks)
        print("\n--- TEST 2: Dynamic Slot Generation & Break Exclusion ---")
        slots_data = get_available_slots(doc_id, target_monday_str)
        available_slots = slots_data.get("available_slots", []) or slots_data.get("slots", [])
        slot_times = [s["start_time"] for s in available_slots]
        print(f"  Slots generated for Monday ({len(available_slots)} slots): {slot_times}")
        
        assert len(available_slots) > 0, "Expected available slots for Monday"
        assert "09:00" in slot_times, "Expected 09:00 slot"
        assert "10:30" not in slot_times, "10:30 break should NOT be in available slots!"
        print("  ✓ Dynamic slot generation verified. Break intervals excluded properly.")

        # TEST 3: Doctor Leave / Holiday Exclusion
        print("\n--- TEST 3: Doctor Leave Exclusion ---")
        leave_payload = {
            "start_date": target_tuesday_str,
            "end_date": target_tuesday_str,
            "is_all_day": True,
            "leave_type": "conference",
            "reason": "Medical Conference"
        }
        leave_res = add_doctor_leave(doc_id, leave_payload)
        assert leave_res.get("success"), f"Failed to add leave: {leave_res}"
        
        tue_slots = get_available_slots(doc_id, target_tuesday_str)
        tue_avail_slots = tue_slots.get("available_slots", []) or tue_slots.get("slots", [])
        print(f"  Tuesday slots when on leave: {len(tue_avail_slots)} slots (Reason: {tue_slots.get('reason') or tue_slots.get('message')})")
        assert len(tue_avail_slots) == 0, "Slots should be 0 during leave"
        assert "leave" in (tue_slots.get("reason") or "").lower() or "leave" in (tue_slots.get("message") or "").lower()
        print("  ✓ Leave properly blocked all slots.")

        # TEST 4: Automatic Appointment Confirmation & WebRTC Creation
        print("\n--- TEST 4: Atomic Booking & Instant Auto-Approval ---")
        selected_slot_obj = available_slots[0]
        selected_slot = selected_slot_obj["start_time"]
        end_slot = selected_slot_obj["end_time"]
        
        # Clean up existing test appointment if any
        existing_appts = db.query(Appointment).filter(
            Appointment.doctor_id == doc_id,
            Appointment.date == target_monday_str,
            Appointment.start_time == selected_slot
        ).all()
        for a in existing_appts:
            db.delete(a)
        db.commit()

        booking_payload = {
            "doctor_id": doc_id,
            "patient_id": pat_id,
            "patient_name": "Aditya Vardhan",
            "patient_email": "aditya.vardhan@gmail.com",
            "date": target_monday_str,
            "start_time": selected_slot,
            "end_time": end_slot,
            "time": f"{selected_slot} - {end_slot}",
            "type": "online",
            "notes": "Follow-up on ECG report"
        }
        booking_res = book_appointment_atomic(booking_payload)
        assert booking_res.get("success"), f"Booking failed: {booking_res}"
        appt_data = booking_res.get("appointment")
        print(f"  Booked Appointment ID: {appt_data.get('id')}")
        print(f"  Reference: {appt_data.get('appointment_reference')}")
        print(f"  Status: {appt_data.get('status')}")
        print(f"  Meeting Room: {appt_data.get('meeting_room_id')}")

        assert appt_data.get("status") == "confirmed", "Appointment must be automatically confirmed!"
        assert appt_data.get("appointment_reference"), "Must generate unique reference"
        assert appt_data.get("meeting_room_id"), "Must provision WebRTC meeting room ID"
        print("  ✓ Instant automatic confirmation verified.")

        # TEST 5: Slot Availability Update (Booked Slot Disappears)
        print("\n--- TEST 5: Real-time Slot Exclusivity ---")
        updated_slots = get_available_slots(doc_id, target_monday_str)
        updated_avail = updated_slots.get("available_slots", []) or updated_slots.get("slots", [])
        updated_times = [s["start_time"] for s in updated_avail]
        print(f"  Updated slots after booking {selected_slot}: {updated_times}")
        assert selected_slot not in updated_times, f"{selected_slot} should NO LONGER be in available slots!"
        print(f"  ✓ Slot {selected_slot} successfully removed from available slots.")

        # TEST 6: Concurrency & Double-Booking Protection
        print("\n--- TEST 6: Atomic Double-Booking Conflict Prevention ---")
        duplicate_payload = {
            "doctor_id": doc_id,
            "patient_id": "usr-pat-999",
            "patient_name": "Concurrent Patient",
            "patient_email": "concurrent@example.com",
            "date": target_monday_str,
            "start_time": selected_slot,
            "end_time": end_slot,
            "time": f"{selected_slot} - {end_slot}",
            "type": "online"
        }
        try:
            duplicate_res = book_appointment_atomic(duplicate_payload)
            duplicate_failed = not duplicate_res.get("success")
            err_msg = duplicate_res.get("error", "")
        except Exception as e:
            duplicate_failed = True
            err_msg = str(e)
            
        assert duplicate_failed, "Duplicate booking MUST fail!"
        assert "reserved" in err_msg.lower() or "conflict" in err_msg.lower() or "already booked" in err_msg.lower()
        print(f"  ✓ Double-booking rejected cleanly: '{err_msg}'")

        # TEST 7: Persistent Notifications Sync
        print("\n--- TEST 7: Persistent Patient & Doctor Notifications ---")
        doc_notifs = get_doctor_notifications(doc_id)
        pat_notifs = get_patient_notifications(pat_id)
        print(f"  Doctor notifications count: {len(doc_notifs)}")
        print(f"  Patient notifications count: {len(pat_notifs)}")
        assert any(appt_data.get("appointment_reference") in (n.get("message") or "") for n in doc_notifs), "Doctor should have received notification for this appointment"
        assert any(appt_data.get("appointment_reference") in (n.get("message") or "") for n in pat_notifs), "Patient should have received notification for this appointment"
        print("  ✓ Persistent notification sync verified for both parties.")

        # TEST 8: Dashboard Appointments Sync
        print("\n--- TEST 8: Real-Time Dashboard Queries ---")
        doc_appts = get_doctor_appointments(doc_id)
        pat_appts = get_patient_appointments(pat_id)
        assert any(a.get("id") == appt_data.get("id") for a in doc_appts), "Doctor dashboard must display confirmed appointment"
        assert any(a.get("id") == appt_data.get("id") for a in pat_appts), "Patient dashboard must display confirmed appointment"
        print("  ✓ Both doctor and patient dashboards have the confirmed appointment synchronized.")

        # TEST 9: WebRTC Authorization & Access Control
        print("\n--- TEST 9: WebRTC Secure Room Access ---")
        room_id = appt_data.get("meeting_room_id")
        
        # Test 9A: Unauthorized third-party user must be strictly rejected
        try:
            unauth_join = join_video_consultation(room_id, user_id="intruder-123", user_name="Intruder", user_role="patient")
            is_unauth_rejected = not unauth_join.get("success")
        except Exception as e:
            is_unauth_rejected = True
            unauth_join = {"error": str(e)}
        assert is_unauth_rejected, "Unauthorized user MUST be rejected!"
        assert "unauthorized" in unauth_join.get("error", "").lower()
        print(f"  ✓ Unauthorized intruder rejected cleanly: '{unauth_join.get('error')}'")

        # Test 9B: Future appointment date-guarding
        try:
            doc_join_future = join_video_consultation(room_id, user_id=doc_id, user_name="Dr. Arvind Swaminathan", user_role="doctor")
            future_guarded = False
        except ValueError as ve:
            future_guarded = True
            print(f"  ✓ Future consultation room date-guarding verified: '{ve}'")
            assert "not yet open" in str(ve).lower()
        assert future_guarded, "Future consultation must not be accessible before appointment date"

        # Test 9C: Authorized doctor and patient join when room is active today
        appt_in_db = db.query(Appointment).filter_by(id=appt_data.get("id")).first()
        appt_in_db.date = today.strftime("%Y-%m-%d")
        db.commit()

        doc_join = join_video_consultation(room_id, user_id=doc_id, user_name="Dr. Arvind Swaminathan", user_role="doctor")
        assert doc_join.get("success"), f"Authorized doctor join failed: {doc_join}"
        assert doc_join.get("webrtc"), "WebRTC configuration must be provided"
        print("  ✓ Authorized doctor permitted into consultation room with WebRTC credentials.")

        pat_join = join_video_consultation(room_id, user_id=pat_id, user_name="Aditya Vardhan", user_role="patient")
        assert pat_join.get("success"), f"Authorized patient join failed: {pat_join}"
        assert pat_join.get("webrtc"), "WebRTC configuration must be provided"
        print("  ✓ Authorized patient permitted into consultation room with WebRTC credentials.")

        print("\n" + "=" * 60)
        print("ALL 9 CORE CAPABILITIES PASSED VERIFICATION WITH 100% SUCCESS!")
        print("=" * 60)
        return True

    finally:
        db.close()

if __name__ == "__main__":
    success = run_tests()
    if not success:
        sys.exit(1)

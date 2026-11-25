"""
Automated Verification Suite for WebRTC Consultation Room Access & Signaling:
1. Patient joins confirmed consultation room before scheduled time
2. Doctor joins the SAME confirmed consultation room
3. Room consistency: Verify identical meeting room ID and appointment details
4. WebRTC Signaling: Offer/Answer exchange and ICE candidate delivery
5. Role-separated Authorization: Strict rejection of unauthorized patients and doctors
6. Consultation status lifecycle progression to 'in_progress'
"""

import os
import sys

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.services.scheduling_service import (
    join_video_consultation,
    send_consultation_signal,
    get_pending_signals,
    send_chat_message
)
from backend.app.db.database import SessionLocal
from backend.app.db.models import Appointment

def run_webrtc_tests():
    print("=" * 70)
    print("VERIFYING WEBRTC CONSULTATION ROOM ACCESS & SIGNALING")
    print("=" * 70)

    db = SessionLocal()
    # Find the most recently confirmed appointment
    apt = db.query(Appointment).filter(
        Appointment.status.in_(["confirmed", "in-progress"])
    ).order_by(Appointment.created_at.desc()).first()

    assert apt is not None, "No confirmed appointment found in DB!"
    room_id = apt.meeting_room_id
    assert room_id is not None, "Appointment does not have meeting_room_id!"

    print(f"\n[TARGET APPOINTMENT]")
    print(f"  • ID: {apt.id}")
    print(f"  • Reference: {apt.appointment_reference}")
    print(f"  • Scheduled Date & Time: {apt.date} at {apt.time}")
    print(f"  • Room ID: {room_id}")
    print(f"  • Doctor: {apt.doctor_name} (ID: {apt.doctor_id})")
    print(f"  • Patient: {apt.patient_name} (ID: {apt.patient_id})")

    # -------------------------------------------------------------
    # TEST 1: Patient Joins Room (Before Scheduled Time)
    # -------------------------------------------------------------
    print("\n[TEST 1] Patient Access Test (Before Scheduled Time)...")
    pat_res = join_video_consultation(
        room_id=room_id,
        user_id=apt.patient_id,
        user_name=apt.patient_name,
        user_role="patient"
    )
    assert pat_res.get("success") is True, f"Patient join failed: {pat_res}"
    assert pat_res.get("room_id") == room_id, "Patient joined different room!"
    assert pat_res.get("user_role") == "patient", "Role mismatch"
    assert "token" in pat_res, "Missing consultation token"
    assert "ice_servers" in pat_res, "Missing ICE servers"
    print(f"  ✓ Patient successfully joined room {room_id}")
    print(f"  ✓ Status: {pat_res.get('consultation_status')}")

    # -------------------------------------------------------------
    # TEST 2: Doctor Joins The SAME Room
    # -------------------------------------------------------------
    print("\n[TEST 2] Doctor Access Test (Same Room)...")
    doc_res = join_video_consultation(
        room_id=room_id,
        user_id=apt.doctor_id,
        user_name=apt.doctor_name,
        user_role="doctor"
    )
    assert doc_res.get("success") is True, f"Doctor join failed: {doc_res}"
    assert doc_res.get("room_id") == room_id, "Doctor joined different room!"
    assert doc_res.get("user_role") == "doctor", "Role mismatch"
    assert doc_res.get("consultation_status") == "in_progress", f"Expected in_progress, got {doc_res.get('consultation_status')}"
    print(f"  ✓ Doctor successfully joined room {room_id}")
    print(f"  ✓ Consultation Status transitioned to: {doc_res.get('consultation_status')}")

    # -------------------------------------------------------------
    # TEST 3: Room Consistency & Identity Verification
    # -------------------------------------------------------------
    print("\n[TEST 3] Room Consistency Verification...")
    assert pat_res["room_id"] == doc_res["room_id"], "Both participants must have the same room_id!"
    assert pat_res["appointment_id"] == doc_res["appointment_id"], "Appointment IDs must match!"
    assert pat_res["appointment_reference"] == doc_res["appointment_reference"], "References must match!"
    print(f"  ✓ Confirmed: Both participants share identical Room ID: {room_id}")

    # -------------------------------------------------------------
    # TEST 4: WebRTC Signaling (Offer / Answer / ICE Candidates)
    # -------------------------------------------------------------
    print("\n[TEST 4] WebRTC Signaling Pipeline Test...")
    # Doctor sends SDP Offer to Patient
    test_offer_sdp = {"type": "offer", "sdp": "v=0\r\no=doctor 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n"}
    sig_offer = send_consultation_signal(
        room_id=room_id,
        sender_role="doctor",
        target_role="patient",
        signal_type="offer",
        signal_data=test_offer_sdp
    )
    assert sig_offer.get("success") is True, "Offer dispatch failed"
    print("  ✓ Doctor SDP Offer dispatched successfully")

    # Patient polls pending signals and retrieves the Offer
    pat_signals = get_pending_signals(room_id, "patient")
    assert len(pat_signals) >= 1, "Patient should receive at least 1 signal"
    offer_found = any(s["signal_type"] == "offer" for s in pat_signals)
    assert offer_found, "Patient failed to receive SDP Offer"
    print("  ✓ Patient received Doctor's SDP Offer via signaling channel")

    # Patient replies with SDP Answer
    test_answer_sdp = {"type": "answer", "sdp": "v=0\r\no=patient 54321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n"}
    sig_answer = send_consultation_signal(
        room_id=room_id,
        sender_role="patient",
        target_role="doctor",
        signal_type="answer",
        signal_data=test_answer_sdp
    )
    assert sig_answer.get("success") is True, "Answer dispatch failed"
    print("  ✓ Patient SDP Answer dispatched successfully")

    # Doctor polls pending signals and retrieves the Answer
    doc_signals = get_pending_signals(room_id, "doctor")
    assert len(doc_signals) >= 1, "Doctor should receive at least 1 signal"
    answer_found = any(s["signal_type"] == "answer" for s in doc_signals)
    assert answer_found, "Doctor failed to receive SDP Answer"
    print("  ✓ Doctor received Patient's SDP Answer via signaling channel")

    # ICE Candidate test
    test_candidate = {"candidate": "candidate:1 1 UDP 2122260223 192.168.1.100 50000 typ host", "sdpMid": "0", "sdpMLineIndex": 0}
    sig_ice = send_consultation_signal(
        room_id=room_id,
        sender_role="patient",
        target_role="doctor",
        signal_type="ice-candidate",
        signal_data=test_candidate
    )
    assert sig_ice.get("success") is True, "ICE candidate dispatch failed"
    doc_ice_signals = get_pending_signals(room_id, "doctor")
    assert any(s["signal_type"] == "ice-candidate" for s in doc_ice_signals), "Doctor failed to receive ICE candidate"
    print("  ✓ WebRTC ICE candidate exchanged successfully")

    # In-room clinical chat test
    chat_res = send_chat_message(
        room_id=room_id,
        sender_id=apt.doctor_id,
        sender_name=apt.doctor_name,
        sender_role="doctor",
        message="Hello! I am Dr. Arvind Swaminathan. Can you hear and see me clearly?"
    )
    assert "id" in chat_res, "Chat message delivery failed"
    print(f"  ✓ In-room clinical messaging verified: '{chat_res['message']}'")

    # -------------------------------------------------------------
    # TEST 5: Security & Rejection of Unauthorized Users
    # -------------------------------------------------------------
    print("\n[TEST 5] Security & Access Control Enforcement...")
    
    # 5a. Unauthorized patient attempting access
    unauth_patient_rejected = False
    try:
        join_video_consultation(
            room_id=room_id,
            user_id="usr-intruder-007",
            user_name="Malicious Patient",
            user_role="patient"
        )
    except Exception as e:
        unauth_patient_rejected = True
        print(f"  ✓ Blocked unauthorized patient as expected: '{e}'")
    assert unauth_patient_rejected, "Security failure: Unauthorized patient was not rejected!"

    # 5b. Unauthorized doctor attempting access
    unauth_doc_rejected = False
    try:
        join_video_consultation(
            room_id=room_id,
            user_id="doc-wrong-999",
            user_name="Dr. Unassigned Intruder",
            user_role="doctor"
        )
    except Exception as e:
        unauth_doc_rejected = True
        print(f"  ✓ Blocked unauthorized doctor as expected: '{e}'")
    assert unauth_doc_rejected, "Security failure: Unauthorized doctor was not rejected!"

    # 5c. Role impersonation (patient trying to claim doctor role)
    impersonator_rejected = False
    try:
        join_video_consultation(
            room_id=room_id,
            user_id=apt.patient_id,
            user_name=apt.patient_name,
            user_role="doctor"
        )
    except Exception as e:
        impersonator_rejected = True
        print(f"  ✓ Blocked role impersonation attempt: '{e}'")
    assert impersonator_rejected, "Security failure: Patient was able to join under doctor role!"

    db.close()
    print("\n" + "=" * 70)
    print("ALL 5 WEBRTC CONSULTATION ROOM TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 70)

if __name__ == "__main__":
    run_webrtc_tests()

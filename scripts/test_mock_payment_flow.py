"""
End-to-End Automated Verification Script for MediVerse Payment System:
1. Dummy Payment (PAYMENT_MODE=mock) Order Creation
2. Dummy Payment Verification, TEST-PAY-XXXXXXXX ID generation & Atomic Booking Confirmation
3. Idempotency & Repeat Protection Check
4. Production Safety Guard Verification (Reject mock in production)
5. Razorpay Mode Fallback & Signature Enforcement Verification
"""

import os
import sys

# Ensure root is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Set mock mode initially
os.environ["PAYMENT_MODE"] = "mock"
if "NODE_ENV" in os.environ:
    del os.environ["NODE_ENV"]

from backend.app.services.payment_service import (
    get_payment_mode,
    create_payment_order,
    verify_and_confirm_payment,
    verify_razorpay_signature
)
from backend.app.db.database import SessionLocal
from backend.app.db.models import Payment, Order, Appointment, DoctorProfile

def run_all_checks():
    print("=" * 70)
    print("RUNNING AUTOMATED MEDIVERSE PAYMENT MODE & BOOKING TESTS")
    print("=" * 70)

    # ---------------------------------------------------------
    # TEST 1: Config & Mode Detection
    # ---------------------------------------------------------
    print("\n[TEST 1] Payment Mode Configuration Check...")
    mode = get_payment_mode()
    assert mode == "mock", f"Expected 'mock', got {mode}"
    print(f"  ✓ Active payment mode: {mode}")

    # ---------------------------------------------------------
    # TEST 2: Order Creation in Mock Mode
    # ---------------------------------------------------------
    print("\n[TEST 2] Order Creation in Mock Mode...")
    db = SessionLocal()
    doctor = db.query(DoctorProfile).first()
    doctor_id = doctor.id if doctor else "doc-1"
    doctor_name = doctor.name if doctor else "Dr. Arvind Swaminathan"

    import random
    test_slot_minute = random.choice(["00", "15", "30", "45"])
    test_slot_hour = random.randint(9, 16)
    test_time_str = f"{test_slot_hour:02d}:{test_slot_minute}"
    test_date_day = random.randint(10, 28)
    test_date_str = f"2026-12-{test_date_day:02d}"

    booking_payload = {
        "doctor_id": doctor_id,
        "date": test_date_str,
        "time": f"{test_time_str} AM",
        "start_time": test_time_str,
        "end_time": f"{test_slot_hour:02d}:55",
        "type": "online",
        "patient_name": "Test Patient",
        "patient_email": "test.patient@mediverse.org",
        "patient_phone": "+91 99887 76655",
        "symptoms": "Follow-up consultation for mock payment verification",
        "notes": "Automated verification test"
    }

    create_payload = {
        "service_type": "doctor_consultation",
        "doctor_id": doctor_id,
        "patient_name": "Test Patient",
        "patient_email": "test.patient@mediverse.org",
        "patient_phone": "+91 99887 76655",
        "metadata": {
            "doctor_name": doctor_name,
            "date": test_date_str,
            "time": f"{test_time_str} AM",
            "booking_payload": booking_payload
        }
    }

    order_res = create_payment_order("test-user-mock-1", create_payload)
    assert order_res.get("success") is True, f"Order creation failed: {order_res}"
    assert order_res.get("is_mock") is True, "Expected is_mock == True"
    assert order_res.get("payment_mode") == "mock", "Expected payment_mode == 'mock'"
    assert str(order_res.get("razorpay_order_id")).startswith("order_mock_"), "Expected order_mock_ prefix"
    
    order_id = order_res["order_id"]
    rzp_order_id = order_res["razorpay_order_id"]
    print(f"  ✓ Order created successfully: {order_id} (mock gateway ref: {rzp_order_id})")
    print(f"  ✓ Total Amount: ₹{order_res.get('amount') or order_res.get('total_amount')}")

    # ---------------------------------------------------------
    # TEST 3: Mock Payment Verification & Atomic Booking
    # ---------------------------------------------------------
    print("\n[TEST 3] Mock Payment Verification & Automatic Confirmation...")
    verify_payload = {
        "order_id": order_id,
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": "TEST-PAY-A1B2C3D4",
        "payment_method": "mock",
        "booking_payload": booking_payload
    }

    verify_res = verify_and_confirm_payment("test-user-mock-1", verify_payload)
    assert verify_res.get("success") is True, f"Verify failed: {verify_res}"
    assert verify_res.get("payment_mode") == "mock", "Expected mock payment_mode"
    assert verify_res.get("is_mock") is True, "Expected is_mock == True"
    assert str(verify_res.get("transaction_id")).startswith("TEST-PAY-"), "Expected TEST-PAY- prefix"
    
    apt = verify_res.get("appointment")
    assert apt is not None, "Expected confirmed appointment object"
    assert apt.get("reference") is not None, "Expected appointment reference number"
    assert "meeting_room_id" in apt or "meeting_link" in apt, "Expected WebRTC meeting link"

    print(f"  ✓ Dummy payment verified with ID: {verify_res['transaction_id']}")
    print(f"  ✓ Appointment Confirmed: Reference {apt['reference']}")
    print(f"  ✓ Doctor: {apt.get('doctor_name')}, Date: {apt.get('date')} {apt.get('time')}")
    print(f"  ✓ WebRTC Room: {apt.get('meeting_room_id')}")

    # Check database state
    p_record = db.query(Payment).filter_by(order_id=order_id).first()
    o_record = db.query(Order).filter_by(id=order_id).first()
    assert p_record.payment_status == "test_success", f"Expected test_success, got {p_record.payment_status}"
    assert p_record.payment_mode == "mock", f"Expected mock, got {p_record.payment_mode}"
    assert o_record.payment_status == "test_success", f"Expected test_success, got {o_record.payment_status}"
    assert o_record.order_status == "confirmed", f"Expected confirmed, got {o_record.order_status}"
    print("  ✓ Database payment & order tables properly updated to 'test_success' and 'confirmed'")

    # ---------------------------------------------------------
    # TEST 4: Idempotency & Re-execution Protection
    # ---------------------------------------------------------
    print("\n[TEST 4] Idempotency & Duplicate Verification Protection...")
    dup_res = verify_and_confirm_payment("test-user-mock-1", verify_payload)
    assert dup_res.get("success") is True, "Duplicate call should succeed idempotently"
    assert dup_res.get("transaction_id") == verify_res["transaction_id"], "Transaction ID should match"
    assert "already confirmed" in dup_res.get("message", "").lower(), "Expected already confirmed notification"
    print("  ✓ Idempotency verified: Duplicate payment verification safely returns existing confirmed appointment")

    # ---------------------------------------------------------
    # TEST 5: Production Safety Guard (Reject Mock in Production)
    # ---------------------------------------------------------
    print("\n[TEST 5] Production Safety Guard Check...")
    os.environ["NODE_ENV"] = "production"
    prod_mode = get_payment_mode()
    assert prod_mode == "razorpay", f"Production environment must strictly enforce 'razorpay', got {prod_mode}"
    
    # Attempting mock verification in production must be rejected
    res_prod = verify_and_confirm_payment("test-user-mock-1", {
        "order_id": order_id,
        "payment_mode": "mock",
        "razorpay_payment_id": "TEST-PAY-HACK999"
    })
    assert res_prod.get("success") is False, "Mock payment must fail in production!"
    assert "prohibited" in res_prod.get("error", "").lower() or "razorpay" in res_prod.get("error", "").lower()
    print(f"  ✓ Rejected mock payment in production as required: '{res_prod.get('error')}'")

    # Restore environment
    del os.environ["NODE_ENV"]
    os.environ["PAYMENT_MODE"] = "mock"

    # ---------------------------------------------------------
    # TEST 6: Real Razorpay Mode Cryptographic Signature Check
    # ---------------------------------------------------------
    print("\n[TEST 6] Razorpay Mode Fallback & HMAC Signature Verification...")
    os.environ["PAYMENT_MODE"] = "razorpay"
    razorpay_mode = get_payment_mode()
    assert razorpay_mode == "razorpay", f"Expected 'razorpay', got {razorpay_mode}"

    # Verify invalid signature is rejected in razorpay mode
    valid = verify_razorpay_signature("order_test123", "pay_test123", "invalid_fake_signature_hex")
    assert valid is False, "Invalid signature should be rejected by HMAC verification"
    print("  ✓ Razorpay mode intact: Invalid HMAC SHA256 signature properly rejected")

    # Restore to mock mode
    os.environ["PAYMENT_MODE"] = "mock"

    db.close()
    print("\n" + "=" * 70)
    print("ALL 6 TESTS PASSED SUCCESSFULLY! MOCK & RAZORPAY MODES FULLY VERIFIED.")
    print("=" * 70)

if __name__ == "__main__":
    run_all_checks()

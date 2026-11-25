"""
Comprehensive Test Suite for Real-Time Razorpay Payment Gateway Integration
Tests order creation, cryptographic signatures, webhooks, idempotency,
access control, atomic booking confirmation, and refunds.
"""

import pytest
import hmac
import hashlib
import json
import uuid
from datetime import datetime

from backend.app.config import settings
from backend.app.db.database import SessionLocal, Base, engine
from backend.app.db.models import Payment, Order, Appointment, DoctorProfile, User
from backend.app.services.payment_service import (
    create_payment_order,
    verify_and_confirm_payment,
    process_webhook_event,
    get_payment_status_by_id,
    get_user_payment_history,
    process_payment_refund,
    verify_razorpay_signature,
    verify_razorpay_webhook_signature
)


@pytest.fixture(scope="module", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # Ensure test user exists
    user = db.query(User).filter_by(id="usr-test-patient-1").first()
    if not user:
        user = User(
            id="usr-test-patient-1",
            email="test.patient@mediverse.in",
            password_hash="test_hash_123",
            full_name="Test Patient",
            role="patient"
        )
        db.add(user)

    other_user = db.query(User).filter_by(id="usr-test-patient-2").first()
    if not other_user:
        other_user = User(
            id="usr-test-patient-2",
            email="other.patient@mediverse.in",
            password_hash="test_hash_456",
            full_name="Other Patient",
            role="patient"
        )
        db.add(other_user)

    db.commit()
    db.close()


def test_1_create_payment_order_with_server_calculation():
    """Scenario 1: Creates an order with server-calculated price, GST, and coupon."""
    res = create_payment_order(
        user_id="usr-test-patient-1",
        payload={
            "service_type": "doctor_consultation",
            "doctor_id": "doc-chn-gen-01",
            "coupon_code": "WELCOME10"
        }
    )

    assert res["success"] is True
    assert "order_id" in res
    assert "razorpay_order_id" in res
    assert res["amount"] == 810.0  # 750 + 135 (18% GST) - 75 (10% discount)
    assert res["amount_paise"] == 81000
    assert res["currency"] == "INR"

    # Verify DB records
    db = SessionLocal()
    order = db.query(Order).filter_by(id=res["order_id"]).first()
    payment = db.query(Payment).filter_by(id=res["payment_id"]).first()

    assert order is not None
    assert payment is not None
    assert order.payment_status == "PENDING"
    assert payment.payment_status == "CREATED"
    db.close()


def test_2_successful_payment_verification_and_booking():
    """Scenario 2: Successful signature verification and atomic booking confirmation."""
    unique_date = f"2029-{(uuid.uuid4().int % 11) + 1:02d}-{(uuid.uuid4().int % 27) + 1:02d}"
    unique_min = (uuid.uuid4().int % 30) + 10
    start_time_str = f"14:{unique_min:02d}"
    end_time_str = f"14:{unique_min + 15:02d}"
    order_res = create_payment_order(
        user_id="usr-test-patient-1",
        payload={
            "service_type": "doctor_consultation",
            "doctor_id": "doc-chn-gen-01",
            "metadata": {
                "booking_payload": {
                    "doctor_id": "doc-chn-gen-01",
                    "date": unique_date,
                    "time": f"{start_time_str} - {end_time_str}",
                    "start_time": start_time_str,
                    "end_time": end_time_str,
                    "type": "online",
                    "patient_name": "Test Patient",
                    "patient_email": "test.patient@mediverse.in"
                }
            }
        }
    )

    rzp_order_id = order_res["razorpay_order_id"]
    rzp_payment_id = f"pay_{uuid.uuid4().hex[:12]}"

    # Compute valid HMAC SHA256 signature
    secret = settings.RAZORPAY_KEY_SECRET
    msg = f"{rzp_order_id}|{rzp_payment_id}".encode("utf-8")
    valid_sig = hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    verify_res = verify_and_confirm_payment(
        user_id="usr-test-patient-1",
        payload={
            "order_id": order_res["order_id"],
            "razorpay_order_id": rzp_order_id,
            "razorpay_payment_id": rzp_payment_id,
            "razorpay_signature": valid_sig,
            "payment_method": "upi"
        }
    )

    assert verify_res["success"] is True
    assert verify_res["payment"]["payment_status"] == "SUCCESS"
    assert verify_res["payment"]["signature_verified"] is True
    assert verify_res["appointment"] is not None
    assert verify_res["appointment"]["status"] == "confirmed"


def test_3_invalid_signature_rejection():
    """Scenario 3: Reject tampered or invalid cryptographic signatures."""
    order_res = create_payment_order(
        user_id="usr-test-patient-1",
        payload={"amount": 500.0}
    )

    rzp_order_id = order_res["razorpay_order_id"]

    verify_res = verify_and_confirm_payment(
        user_id="usr-test-patient-1",
        payload={
            "order_id": order_res["order_id"],
            "razorpay_order_id": rzp_order_id,
            "razorpay_payment_id": "pay_tampered_123",
            "razorpay_signature": "invalid_forged_signature_hex"
        }
    )

    assert verify_res["success"] is False
    assert "Invalid digital signature" in verify_res["error"]

    # Verify payment marked FAILED in DB
    db = SessionLocal()
    payment = db.query(Payment).filter_by(id=order_res["payment_id"]).first()
    assert payment.payment_status == "FAILED"
    db.close()


def test_4_payment_verification_idempotency():
    """Scenario 4: Duplicate verification requests return identical confirmation without re-booking."""
    order_res = create_payment_order(
        user_id="usr-test-patient-1",
        payload={"amount": 600.0}
    )

    rzp_order_id = order_res["razorpay_order_id"]
    rzp_payment_id = f"pay_{uuid.uuid4().hex[:12]}"
    secret = settings.RAZORPAY_KEY_SECRET
    msg = f"{rzp_order_id}|{rzp_payment_id}".encode("utf-8")
    valid_sig = hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()

    payload = {
        "order_id": order_res["order_id"],
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": rzp_payment_id,
        "razorpay_signature": valid_sig
    }

    # First verification
    res1 = verify_and_confirm_payment("usr-test-patient-1", payload)
    assert res1["success"] is True

    # Second identical verification (idempotent)
    res2 = verify_and_confirm_payment("usr-test-patient-1", payload)
    assert res2["success"] is True
    assert "already confirmed" in res2["message"].lower()


def test_5_webhook_signature_verification_and_event():
    """Scenario 5: Webhook signature verification and event handling."""
    order_res = create_payment_order(
        user_id="usr-test-patient-1",
        payload={"amount": 900.0}
    )

    rzp_order_id = order_res["razorpay_order_id"]
    rzp_payment_id = f"pay_{uuid.uuid4().hex[:12]}"

    event_data = {
        "id": f"evt_{uuid.uuid4().hex[:10]}",
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": rzp_payment_id,
                    "order_id": rzp_order_id,
                    "amount": 90000,
                    "status": "captured"
                }
            }
        }
    }

    raw_body = json.dumps(event_data).encode("utf-8")
    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
    valid_sig = hmac.new(webhook_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()

    # Webhook processing
    res = process_webhook_event(raw_body, valid_sig, event_data)
    assert res["success"] is True

    # Verify state in DB
    db = SessionLocal()
    payment = db.query(Payment).filter_by(id=order_res["payment_id"]).first()
    assert payment.payment_status == "SUCCESS"
    assert payment.signature_verified is True
    db.close()


def test_6_webhook_duplicate_event_idempotency():
    """Scenario 6: Handle duplicate webhook events gracefully."""
    event_id = f"evt_dup_{uuid.uuid4().hex[:8]}"
    order_res = create_payment_order("usr-test-patient-1", {"amount": 400.0})

    event_data = {
        "id": event_id,
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": f"pay_{uuid.uuid4().hex[:10]}",
                    "order_id": order_res["razorpay_order_id"]
                }
            }
        }
    }
    raw = json.dumps(event_data).encode("utf-8")
    sig = hmac.new(settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8"), raw, hashlib.sha256).hexdigest()

    # Fire 1st time
    res1 = process_webhook_event(raw, sig, event_data)
    assert res1["success"] is True

    # Fire 2nd time with exact same event ID
    res2 = process_webhook_event(raw, sig, event_data)
    assert res2["success"] is True
    assert "duplicate" in res2["message"].lower()


def test_7_user_access_control():
    """Scenario 7: Prevent Patient A from inspecting Patient B's transaction."""
    order_res = create_payment_order("usr-test-patient-1", {"amount": 750.0})
    payment_id = order_res["payment_id"]

    # Other patient attempts to access
    status_res = get_payment_status_by_id(payment_id, user_id="usr-test-patient-2")
    assert status_res["success"] is False
    assert "Access denied" in status_res["error"]

    # Owner accesses successfully
    owner_res = get_payment_status_by_id(payment_id, user_id="usr-test-patient-1")
    assert owner_res["success"] is True


def test_8_authorized_refund_flow():
    """Scenario 8: Process authorized refund and transition order to CANCELLED/REFUNDED."""
    # First create and complete payment
    order_res = create_payment_order("usr-test-patient-1", {"amount": 500.0})
    rzp_order_id = order_res["razorpay_order_id"]
    rzp_payment_id = f"pay_{uuid.uuid4().hex[:10]}"
    sig = hmac.new(
        settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        f"{rzp_order_id}|{rzp_payment_id}".encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    verify_and_confirm_payment("usr-test-patient-1", {
        "order_id": order_res["order_id"],
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": rzp_payment_id,
        "razorpay_signature": sig
    })

    # Initiate refund
    refund_res = process_payment_refund(
        payment_id=order_res["payment_id"],
        user_id="usr-test-patient-1",
        reason="Patient schedule conflict"
    )

    assert refund_res["success"] is True
    assert refund_res["payment_status"] == "REFUNDED"
    assert refund_res["refund_id"] is not None

    # Verify DB status
    db = SessionLocal()
    p = db.query(Payment).filter_by(id=order_res["payment_id"]).first()
    o = db.query(Order).filter_by(id=order_res["order_id"]).first()
    assert p.payment_status == "REFUNDED"
    assert o.payment_status == "REFUNDED"
    assert o.order_status == "cancelled"
    db.close()


def test_9_payment_history_query():
    """Scenario 9: Fetches user's verified payment history list."""
    history = get_user_payment_history(user_id="usr-test-patient-1", role="patient")
    assert isinstance(history, list)
    assert len(history) > 0
    item = history[0]
    assert "order_reference" in item
    assert "amount" in item
    assert "payment_status" in item
    assert "date" in item

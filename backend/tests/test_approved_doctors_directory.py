"""
Tests for Automatic Approved Doctor Display on Patient Directory & Appointment Booking
Validates:
- Real-time appearance on public doctors page when admin approves an application
- Real-time hiding when doctor is suspended or rejected
- Profile details authorization (never leak private docs)
- Appointment booking verification enforcement
"""

import pytest
import uuid
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.app.db.database import SessionLocal
from backend.app.db.models import (
    DoctorProfile,
    DoctorVerificationApplication,
    DoctorCredentialDocument,
    Appointment
)
from backend.app.services.db_bridge import (
    get_approved_doctors,
    get_approved_doctor_by_id,
    book_appointment,
    make_decision
)


@pytest.fixture
def db_session():
    session = SessionLocal()
    yield session
    session.close()


def test_only_approved_doctors_in_directory(db_session):
    """Verifies that get_approved_doctors returns ONLY verified doctors with status == 'approved'."""
    # 1. Create a pending doctor
    pending_id = f"doc-test-pending-{uuid.uuid4().hex[:6]}"
    pending_doc = DoctorProfile(
        id=pending_id,
        name="Dr. Pending Test",
        title="Consultant",
        specialty="General Medicine",
        specialty_slug="general-medicine",
        qualifications=["MBBS"],
        consultation_types=["online", "in-person"],
        languages=["English"],
        verified=False
    )
    db_session.add(pending_doc)

    pending_app = DoctorVerificationApplication(
        id=f"dva-{pending_id}",
        doctor_id=pending_id,
        application_reference=f"REF-{pending_id}",
        status="pending_review",
        personal_info={"full_name": "Dr. Pending Test", "email": "pending@test.org"},
        professional_info={"specialty": "General Medicine"},
        registration_info={"registration_number": "REG-TEST-PENDING"}
    )
    db_session.add(pending_app)
    db_session.commit()

    # Query approved doctors
    approved_list = get_approved_doctors()
    approved_ids = [d["id"] for d in approved_list]

    assert pending_id not in approved_ids, "Pending doctor must NOT appear on public doctors page"

    # 2. Approve this doctor through make_decision
    make_decision(
        app_id=pending_app.id,
        action="approve",
        reason_category="all_credentials_verified",
        justification="Verified medical degrees and NMC registration in good standing.",
        admin_id="admin-test"
    )

    # Re-query approved doctors
    approved_list_after = get_approved_doctors()
    approved_ids_after = [d["id"] for d in approved_list_after]

    assert pending_id in approved_ids_after, "Approved doctor MUST immediately appear on public doctors page"

    # 3. Check public profile detail
    detail = get_approved_doctor_by_id(pending_id)
    assert detail is not None
    assert detail["name"] == "Dr. Pending Test"
    assert detail["verified"] is True
    # Ensure no private documents or internal admin fields are leaked
    assert "documents" not in detail
    assert "reviews" not in detail
    assert "assigned_admin_id" not in detail

    # 4. Suspend this doctor
    make_decision(
        app_id=pending_app.id,
        action="suspend",
        reason_category="compliance_inquiry",
        justification="License temporarily audited.",
        admin_id="admin-test"
    )

    # Re-query: suspended doctor must immediately disappear
    approved_list_suspended = get_approved_doctors()
    approved_ids_suspended = [d["id"] for d in approved_list_suspended]
    assert pending_id not in approved_ids_suspended, "Suspended doctor must immediately disappear from public directory"

    # Detail page must return None / 404
    detail_suspended = get_approved_doctor_by_id(pending_id)
    assert detail_suspended is None, "Suspended doctor detail page must return None / 404"


def test_appointment_booking_guardrails(db_session):
    """Verifies that appointment booking enforces approved verification status."""
    # 1. Attempt to book with unapproved doctor
    unapproved_id = f"doc-fake-{uuid.uuid4().hex[:6]}"
    unapproved_doc = DoctorProfile(
        id=unapproved_id,
        name="Dr. Unapproved Fake",
        title="Consultant",
        specialty="Cardiology",
        specialty_slug="cardiology",
        qualifications=["MBBS"],
        consultation_types=["online", "in-person"],
        languages=["English"],
        verified=False
    )
    db_session.add(unapproved_doc)
    db_session.commit()

    with pytest.raises(ValueError, match="unverified|not approved"):
        book_appointment({
            "doctor_id": unapproved_id,
            "patient_name": "Test Patient",
            "patient_email": "patient@example.com",
            "date": "2026-12-01",
            "time": "10:30 AM",
            "type": "online"
        })

    # 2. Book with valid approved doctor (e.g., doc-1 seeded earlier)
    booking_res = book_appointment({
        "doctor_id": "doc-1",
        "patient_name": "John Doe",
        "patient_email": "john@example.com",
        "date": "2026-12-01",
        "time": "11:00 AM",
        "type": "online"
    })

    assert booking_res["success"] is True
    apt_data = booking_res["appointment"]
    assert apt_data["doctor_id"] == "doc-1"
    assert apt_data["doctor_name"] == "Dr. Arvind Swaminathan"
    assert apt_data["meeting_link"] is not None
    assert "https://meet.mediverse.health/" in apt_data["meeting_link"]

    # Verify persisted in database
    db_apt = db_session.query(Appointment).filter_by(id=apt_data["id"]).first()
    assert db_apt is not None
    assert db_apt.status == "upcoming"

"""
Test Suite: Doctor Credential Verification, Document Upload, and Admin Approval System
Tests registration, document uploads, validation rules, admin document-by-document audit,
approval, and rejection with mandatory justification.
"""

import io
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.database import get_db, SessionLocal
from backend.app.db.models import DoctorProfile, DoctorVerificationApplication, DoctorCredentialDocument

client = TestClient(app)


def test_doctor_registration_flow():
    """
    Test 1: Doctor registers with 3-step information.
    Verifies that the doctor is created with verified=False and application is in pending_review.
    """
    payload = {
        "personal_info": {
            "full_name": "Dr. Sunita Kulkarni",
            "email": "dr.sunita@kulkarni.example.com",
            "phone": "+91 98450 99887",
            "date_of_birth": "1983-04-12",
            "gender": "Female",
            "residential_address": "88 Malleshwaram, Bangalore",
            "photo_url": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80"
        },
        "professional_info": {
            "specialty": "Endocrinology",
            "highest_qualification": "DM (Endocrinology)",
            "university": "KMC Manipal",
            "graduation_year": 2009,
            "experience_years": 15,
            "current_hospital": "Manipal Endocrinology Center",
            "previous_experience": "Apollo Hospitals Bangalore",
            "consultation_modes": ["online", "in-person"],
            "languages": ["English", "Hindi", "Kannada"],
            "consultation_fee": 900.0,
            "biography": "Endocrinologist specializing in complex type 1 & 2 diabetes, thyroid disease, and adrenal disorders."
        },
        "registration_info": {
            "registration_number": "KMC-KAR-93821",
            "issuing_council": "Karnataka Medical Council",
            "state_council": "Karnataka Medical Council",
            "registration_date": "2009-08-20",
            "validity_details": "Active renewal until 2029",
            "primary_qualification": "MBBS",
            "specialization_qualification": "MD, DM"
        },
        "password": "SecureDoctorPassword2026!"
    }

    res = client.post("/api/v1/doctor-verification/register", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()

    assert data["status"] == "pending_review"
    assert data["application_reference"].startswith("DOC-VER-")
    assert "id" in data
    assert "doctor_id" in data

    # Verify doctor profile is NOT verified yet
    db = SessionLocal()
    doc_profile = db.query(DoctorProfile).filter_by(id=data["doctor_id"]).first()
    assert doc_profile is not None
    assert doc_profile.verified is False # STRICT GUARDRAIL: Unverified before approval
    db.close()


def test_credential_document_upload_and_validation():
    """
    Test 2: Document upload and file format validation.
    """
    # Create application first
    payload = {
        "personal_info": {
            "full_name": "Dr. Ramesh Gupta",
            "email": "dr.ramesh@gupta.example.com",
            "phone": "+91 99887 76655"
        },
        "professional_info": {
            "specialty": "Pediatrics",
            "highest_qualification": "MD (Pediatrics)",
            "university": "CMC Vellore",
            "graduation_year": 2012
        },
        "registration_info": {
            "registration_number": "TNMC-TAM-48291",
            "issuing_council": "Tamil Nadu Medical Council",
            "state_council": "Tamil Nadu Medical Council",
            "primary_qualification": "MBBS"
        },
        "password": "Password12345!"
    }

    reg_res = client.post("/api/v1/doctor-verification/register", json=payload)
    assert reg_res.status_code == 200
    app_id = reg_res.json()["id"]

    # Valid PDF upload
    pdf_bytes = io.BytesIO(b"%PDF-1.4 Mock MBBS Degree Certificate Content")
    files = {"file": ("mbbs_certificate.pdf", pdf_bytes, "application/pdf")}
    data = {
        "document_type": "medical_degree",
        "document_name": "MBBS Degree Certificate",
        "is_mandatory": "true"
    }

    upload_res = client.post(f"/api/v1/doctor-verification/{app_id}/documents", files=files, data=data)
    assert upload_res.status_code == 200, upload_res.text
    doc_data = upload_res.json()
    assert doc_data["document_type"] == "medical_degree"
    assert doc_data["is_mandatory"] is True
    assert doc_data["review_status"] == "pending"

    # Invalid file format (e.g. .exe)
    invalid_bytes = io.BytesIO(b"binary content")
    bad_files = {"file": ("malicious.exe", invalid_bytes, "application/octet-stream")}
    bad_upload_res = client.post(f"/api/v1/doctor-verification/{app_id}/documents", files=bad_files, data=data)
    assert bad_upload_res.status_code == 400
    assert "Unsupported file format" in bad_upload_res.json()["detail"]


def test_admin_applications_listing_and_stats():
    """
    Test 3: Admin lists applications with status filter and gets stats.
    """
    # Fetch admin stats
    stats_res = client.get("/api/v1/doctor-verification/admin/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "total_applications" in stats
    assert "pending_review" in stats
    assert "approved" in stats
    assert "rejected" in stats

    # Fetch admin applications list
    list_res = client.get("/api/v1/doctor-verification/admin/applications?status_filter=all")
    assert list_res.status_code == 200
    apps = list_res.json()
    assert isinstance(apps, list)
    assert len(apps) > 0


def test_document_by_document_review():
    """
    Test 4: Admin reviews an individual document (verified / invalid).
    """
    # Register doctor and upload a document
    reg_payload = {
        "personal_info": {"full_name": "Dr. Vikas Rao", "email": "dr.vikas@rao.com", "phone": "+91 91234 56789"},
        "professional_info": {"specialty": "Neurology", "highest_qualification": "DM", "university": "NIMHANS", "graduation_year": 2015},
        "registration_info": {"registration_number": "KMC-98102", "issuing_council": "KMC", "state_council": "KMC", "primary_qualification": "MBBS"},
        "password": "DocPassword123!"
    }
    app_id = client.post("/api/v1/doctor-verification/register", json=reg_payload).json()["id"]

    pdf_bytes = io.BytesIO(b"%PDF-1.4 Council registration")
    files = {"file": ("council_reg.pdf", pdf_bytes, "application/pdf")}
    doc_id = client.post(
        f"/api/v1/doctor-verification/{app_id}/documents",
        files=files,
        data={"document_type": "council_registration", "document_name": "Council Certificate", "is_mandatory": "true"}
    ).json()["id"]

    # Admin marks as verified
    rev_res = client.post(
        f"/api/v1/doctor-verification/admin/documents/{doc_id}/review",
        json={"review_status": "verified", "reviewer_comments": "Verified on KMC portal."}
    )
    assert rev_res.status_code == 200
    assert rev_res.json()["review_status"] == "verified"


def test_admin_decision_approve_activates_doctor():
    """
    Test 5: Admin approves application.
    Doctor's profile is activated (verified=True).
    """
    reg_payload = {
        "personal_info": {"full_name": "Dr. Meera Iyer", "email": "dr.meera@iyer.com", "phone": "+91 99880 11223"},
        "professional_info": {"specialty": "General Medicine", "highest_qualification": "MD", "university": "AIIMS", "graduation_year": 2013},
        "registration_info": {"registration_number": "DMC-94021", "issuing_council": "DMC", "state_council": "DMC", "primary_qualification": "MBBS"},
        "password": "DocPassword123!"
    }
    reg_data = client.post("/api/v1/doctor-verification/register", json=reg_payload).json()
    app_id = reg_data["id"]
    doctor_id = reg_data["doctor_id"]

    # Decision: approve
    decision_payload = {
        "action": "approve",
        "admin_id": "admin-gov-1"
    }
    dec_res = client.post(f"/api/v1/doctor-verification/admin/applications/{app_id}/decision", json=decision_payload)
    assert dec_res.status_code == 200
    assert dec_res.json()["status"] == "approved"

    # Check doctor profile is now verified!
    db = SessionLocal()
    doc = db.query(DoctorProfile).filter_by(id=doctor_id).first()
    assert doc is not None
    assert doc.verified is True
    db.close()


def test_admin_rejection_requires_justification():
    """
    Test 6: Admin attempts to reject without a justification (fails with 400),
    then rejects with valid category and justification (succeeds).
    """
    reg_payload = {
        "personal_info": {"full_name": "Dr. Unverified Fake", "email": "fake@doc.com", "phone": "+91 90000 00000"},
        "professional_info": {"specialty": "General", "highest_qualification": "None", "university": "Unknown", "graduation_year": 2020},
        "registration_info": {"registration_number": "INVALID-123", "issuing_council": "Unknown", "state_council": "Unknown", "primary_qualification": "None"},
        "password": "DocPassword123!"
    }
    app_id = client.post("/api/v1/doctor-verification/register", json=reg_payload).json()["id"]

    # Attempt rejection without justification
    bad_reject = {
        "action": "reject",
        "reason_category": "invalid_registration",
        "justification": "" # Missing justification
    }
    bad_res = client.post(f"/api/v1/doctor-verification/admin/applications/{app_id}/decision", json=bad_reject)
    assert bad_res.status_code == 400
    assert "detailed written justification" in bad_res.json()["detail"]

    # Rejection with valid justification
    valid_reject = {
        "action": "reject",
        "reason_category": "invalid_registration",
        "justification": "The provided registration ID could not be identified on any state or national medical council database."
    }
    good_res = client.post(f"/api/v1/doctor-verification/admin/applications/{app_id}/decision", json=valid_reject)
    assert good_res.status_code == 200
    assert good_res.json()["status"] == "rejected"


def test_request_additional_documents():
    """
    Test 7: Admin requests additional documents, moving status to additional_documents_required.
    """
    reg_payload = {
        "personal_info": {"full_name": "Dr. Ananya Sen", "email": "dr.ananya@sen.com", "phone": "+91 94444 33333"},
        "professional_info": {"specialty": "Dermatology", "highest_qualification": "MD", "university": "JIPMER", "graduation_year": 2016},
        "registration_info": {"registration_number": "JMC-38291", "issuing_council": "JMC", "state_council": "JMC", "primary_qualification": "MBBS"},
        "password": "DocPassword123!"
    }
    app_id = client.post("/api/v1/doctor-verification/register", json=reg_payload).json()["id"]

    req_payload = {
        "action": "request_additional_documents",
        "justification": "Please attach your Postgraduate Specialization Degree Certificate."
    }
    res = client.post(f"/api/v1/doctor-verification/admin/applications/{app_id}/decision", json=req_payload)
    assert res.status_code == 200
    assert res.json()["status"] == "additional_documents_required"

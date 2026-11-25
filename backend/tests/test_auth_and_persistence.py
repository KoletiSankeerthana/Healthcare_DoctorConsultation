"""
Unit and Integration Test Suite for Multi-Role Auth and Permanent Medical Document Storage
"""

import os
import sys
import uuid
import random
import pytest
from datetime import datetime

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.app.db.database import SessionLocal
from backend.app.db.models import User, PatientProfile, UserSession, MedicalDocument
from backend.app.services.auth_service import (
    register_patient,
    login_user,
    get_user_by_session,
    logout_user,
    hash_password,
    verify_password
)
from backend.app.services.document_service import (
    upload_document,
    list_patient_documents,
    get_document_details,
    delete_patient_document,
    get_document_download_info
)


def random_phone():
    return f"+9198{random.randint(10000000, 99999999)}"


class TestMultiRoleAuthentication:
    def test_bcrypt_hashing_and_verification(self):
        pw = "SecureHealthPass@2026"
        hashed = hash_password(pw)
        assert hashed != pw
        assert verify_password(pw, hashed) is True
        assert verify_password("WrongPassword@123", hashed) is False

    def test_patient_registration_and_session_creation(self):
        unique_email = f"patient_{uuid.uuid4().hex[:8]}@mediverse.org"
        phone = random_phone()
        payload = {
            "full_name": "Rohan Deshmukh",
            "email": unique_email,
            "phone": phone,
            "password": "RohanPassword@123",
            "gender": "Male",
            "date_of_birth": "1992-08-20"
        }
        res = register_patient(payload)
        assert res["success"] is True
        assert res["user"]["email"] == unique_email
        assert res["user"]["role"] == "patient"
        assert res["redirect_url"] == "/patient/dashboard"
        assert len(res["session_token"]) == 64

        # Verify session token validity
        auth_user = get_user_by_session(res["session_token"])
        assert auth_user is not None
        assert auth_user["email"] == unique_email
        assert auth_user["role"] == "patient"
        assert auth_user["patient_id"] is not None

    def test_login_with_email_and_phone(self):
        unique_email = f"user_{uuid.uuid4().hex[:8]}@mediverse.org"
        phone = random_phone()
        pw = "TestPassword@123"

        register_patient({
            "full_name": "Priya Sharma",
            "email": unique_email,
            "phone": phone,
            "password": pw
        })

        # Login via email
        login_res_email = login_user(unique_email, pw)
        assert login_res_email["success"] is True
        assert login_res_email["user"]["role"] == "patient"
        assert login_res_email["redirect_url"] == "/patient/dashboard"

        # Login via phone
        login_res_phone = login_user(phone, pw)
        assert login_res_phone["success"] is True
        assert login_res_phone["user"]["email"] == unique_email

        # Incorrect password fails
        with pytest.raises(ValueError, match="Incorrect password"):
            login_user(unique_email, "WrongPassword@999")

    def test_logout_revokes_session(self):
        unique_email = f"logout_{uuid.uuid4().hex[:8]}@mediverse.org"
        phone = random_phone()
        res = register_patient({
            "full_name": "Test User",
            "email": unique_email,
            "phone": phone,
            "password": "Password@123"
        })
        token = res["session_token"]

        assert get_user_by_session(token) is not None
        assert logout_user(token) is True
        assert get_user_by_session(token) is None


class TestPermanentMedicalDocumentStorage:
    def test_patient_upload_and_persistence_of_five_documents(self):
        patient_id = f"pat-test-{uuid.uuid4().hex[:8]}"

        # Patient uploads 5 distinct medical reports
        doc_names = [
            ("cbc_blood_test.pdf", "Blood test reports", "Complete Blood Count"),
            ("lipid_profile_report.pdf", "Blood test reports", "Lipid & Cholesterol Profile"),
            ("chest_xray_scan.png", "Radiology reports", "Chest X-Ray PA View"),
            ("cardio_prescription.pdf", "Prescriptions", "Cardiology Treatment Plan"),
            ("discharge_summary.pdf", "Discharge summaries", "Hospital Discharge Summary")
        ]

        uploaded_ids = []
        for filename, category, title in doc_names:
            fake_content = f"%PDF-1.4 Fake Medical Record Data for {title}".encode("utf-8")
            doc = upload_document(
                patient_id=patient_id,
                filename=filename,
                file_bytes=fake_content,
                category=category,
                title=title
            )
            assert doc["id"] is not None
            assert doc["patient_id"] == patient_id
            assert doc["title"] == title
            assert os.path.exists(doc["storage_path"])
            uploaded_ids.append(doc["id"])

        assert len(uploaded_ids) == 5

        # Query all documents for this patient
        docs = list_patient_documents(patient_id)
        assert len(docs) == 5

        # Verify all 5 documents remain in DB and match
        retrieved_ids = [d["id"] for d in docs]
        for uid in uploaded_ids:
            assert uid in retrieved_ids

    def test_patient_document_isolation(self):
        pat_a = f"pat-a-{uuid.uuid4().hex[:8]}"
        pat_b = f"pat-b-{uuid.uuid4().hex[:8]}"

        upload_document(pat_a, "report_a.pdf", b"Content A", "Blood test reports", "Report A")
        upload_document(pat_b, "report_b.pdf", b"Content B", "Blood test reports", "Report B")

        docs_a = list_patient_documents(pat_a)
        docs_b = list_patient_documents(pat_b)

        assert len(docs_a) == 1
        assert len(docs_b) == 1
        assert docs_a[0]["title"] == "Report A"
        assert docs_b[0]["title"] == "Report B"

    def test_document_details_and_ai_analysis_retrieval(self):
        pat = f"pat-{uuid.uuid4().hex[:8]}"
        uploaded = upload_document(
            patient_id=pat,
            filename="comprehensive_metabolic_panel.pdf",
            file_bytes=b"Sample bytes",
            category="Blood test reports",
            title="Comprehensive Metabolic Panel"
        )
        doc_id = uploaded["id"]

        details = get_document_details(doc_id, pat)
        assert details is not None
        assert details["id"] == doc_id
        assert len(details["laboratory_results"]) > 0
        assert details["analysis"] is not None
        assert "Hemoglobin" in details["raw_text"] or "Clinical Parameters" in details["raw_text"]

    def test_document_download_file_resolution(self):
        pat = f"pat-{uuid.uuid4().hex[:8]}"
        content = b"%PDF-1.4 Clinical Diagnostic Test Bytes"
        uploaded = upload_document(
            patient_id=pat,
            filename="vital_signs.pdf",
            file_bytes=content,
            category="Diagnostic reports",
            title="Vital Signs Assessment"
        )

        dl_info = get_document_download_info(uploaded["id"], pat)
        assert os.path.exists(dl_info["file_path"])
        assert dl_info["file_size"] == len(content)

    def test_authenticated_document_deletion(self):
        pat = f"pat-{uuid.uuid4().hex[:8]}"
        uploaded = upload_document(
            patient_id=pat,
            filename="temporary_scratch_report.pdf",
            file_bytes=b"Scratch",
            category="Other medical documents",
            title="Temporary Scratch Report"
        )
        doc_id = uploaded["id"]

        # Initial count is 1
        assert len(list_patient_documents(pat)) == 1

        # Delete document
        del_result = delete_patient_document(doc_id, pat)
        assert del_result["success"] is True

        # Document is soft deleted and excluded from patient list
        assert len(list_patient_documents(pat)) == 0

        # Cannot download deleted document
        with pytest.raises(ValueError, match="Document not found or unauthorized"):
            get_document_download_info(doc_id, pat)

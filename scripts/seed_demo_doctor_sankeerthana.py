"""
Seed Demo Doctor Dr. Sankeerthana & Configure Demo Patient Aditya
- Doctor: Dr. Sankeerthana (koletisankeerthana@gmail.com / DoctorPassword@123)
- Patient: Aditya Vardhan (sankeerthana2905@gmail.com / PatientPassword@123)
- Availability: Published schedule for all weekdays (09:00 - 18:00, 30 min duration)
"""

import sys
import os
import json
from datetime import datetime

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.db.database import SessionLocal
from backend.app.db.models import (
    User,
    DoctorProfile,
    PatientProfile,
    DoctorAvailability,
    DoctorVerificationApplication
)
from backend.app.services.auth_service import hash_password

def seed_demo_doctor_and_patient():
    db = SessionLocal()
    try:
        now = datetime.utcnow()

        # 1. Update Existing Demo Patient (Aditya Vardhan)
        pat_user = db.query(User).filter_by(id="usr-pat-101").first()
        if not pat_user:
            pat_user = db.query(User).filter(User.email.in_(["aditya.vardhan@gmail.com", "sankeerthana2905@gmail.com"])).first()

        if pat_user:
            pat_user.email = "sankeerthana2905@gmail.com"
            pat_user.full_name = "Aditya Vardhan"
            pat_user.is_active = True
            pat_user.is_verified = True
            print(f"Updated existing patient User: {pat_user.id} -> {pat_user.email}")
        else:
            pat_user = User(
                id="usr-pat-101",
                email="sankeerthana2905@gmail.com",
                phone="+91 98765 43210",
                password_hash=hash_password("PatientPassword@123"),
                role="patient",
                full_name="Aditya Vardhan",
                is_active=True,
                is_verified=True,
                created_at=now
            )
            db.add(pat_user)
            print(f"Created patient User: usr-pat-101 -> sankeerthana2905@gmail.com")

        pat_profile = db.query(PatientProfile).filter_by(id="pat-101").first()
        if not pat_profile:
            pat_profile = db.query(PatientProfile).filter(PatientProfile.email.in_(["aditya.vardhan@gmail.com", "sankeerthana2905@gmail.com"])).first()

        if pat_profile:
            pat_profile.email = "sankeerthana2905@gmail.com"
            pat_profile.full_name = "Aditya Vardhan"
            print(f"Updated PatientProfile: {pat_profile.id} -> {pat_profile.email}")
        else:
            pat_profile = PatientProfile(
                id="pat-101",
                user_id=pat_user.id,
                full_name="Aditya Vardhan",
                email="sankeerthana2905@gmail.com",
                phone="+91 98765 43210",
                date_of_birth="1988-05-14",
                gender="Male",
                address="42 Green Glen Layout, Bellandur, Bengaluru",
                blood_group="O+",
                allergies=["Penicillin"],
                emergency_contact="+91 98451 98765",
                created_at=now
            )
            db.add(pat_profile)
            print("Created PatientProfile: pat-101")

        # 2. Seed / Update Demo Doctor Profile (Dr. Sankeerthana)
        doc_id = "doc-sankeerthana"
        doc_profile = db.query(DoctorProfile).filter_by(id=doc_id).first()
        if not doc_profile:
            doc_profile = DoctorProfile(
                id=doc_id,
                name="Dr. Sankeerthana",
                title="Senior General Physician",
                specialty="General Physician",
                specialty_slug="general-physician",
                qualifications=["MBBS", "MD (General Medicine)"],
                experience_years=10,
                rating=4.95,
                review_count=112,
                consultation_fee=500.0,
                consultation_types=["online", "in-person"],
                languages=["English", "Telugu", "Hindi"],
                clinic_name="MediVerse Health Sanctuary Clinic",
                clinic_address="Road No. 36, Jubilee Hills",
                clinic_city="Hyderabad",
                clinic_pincode="500033",
                registration_number="TSMC-2015-88991",
                about="Experienced General Physician dedicated to comprehensive primary care, preventative wellness, chronic disease management, and personalized telehealth consultations.",
                expertise=["Primary Care", "Preventative Medicine", "Internal Medicine", "Telemedicine"],
                availability={
                    "nextAvailable": "Today, 10:00 AM",
                    "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                    "slots": ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM"]
                },
                verified=True,
                featured=True,
                avatar="/images/doctor-examining-patient.jpg",
                created_at=now
            )
            db.add(doc_profile)
            print(f"Created DoctorProfile: {doc_id}")
        else:
            doc_profile.verified = True
            doc_profile.specialty = "General Physician"
            print(f"DoctorProfile already exists: {doc_id}")

        # 3. Seed / Update Doctor User Account
        doc_user = db.query(User).filter_by(email="koletisankeerthana@gmail.com").first()
        if not doc_user:
            doc_user = User(
                id="usr-doc-sankeerthana",
                email="koletisankeerthana@gmail.com",
                phone="+91 98765 43222",
                password_hash=hash_password("DoctorPassword@123"),
                role="doctor",
                full_name="Dr. Sankeerthana",
                doctor_id=doc_id,
                is_active=True,
                is_verified=True,
                created_at=now
            )
            db.add(doc_user)
            print("Created doctor User: usr-doc-sankeerthana")
        else:
            doc_user.doctor_id = doc_id
            doc_user.is_verified = True
            doc_user.is_active = True
            doc_user.password_hash = hash_password("DoctorPassword@123")
            print("Updated doctor User: koletisankeerthana@gmail.com")

        # 4. Seed / Update Doctor Verification Application Record (for Doctor Dashboard compliance)
        dva_app = db.query(DoctorVerificationApplication).filter_by(doctor_id=doc_id).first()
        if not dva_app:
            dva_app = DoctorVerificationApplication(
                id="dva-sankeerthana",
                doctor_id=doc_id,
                application_reference="DOC-VER-SANKEERTHANA",
                status="approved",
                approved_at=now,
                assigned_admin_id="usr-admin-001",
                personal_info=json.dumps({
                    "full_name": "Dr. Sankeerthana",
                    "email": "koletisankeerthana@gmail.com",
                    "phone": "+91 98765 43222"
                }),
                professional_info=json.dumps({
                    "specialty": "General Physician",
                    "highest_qualification": "MBBS, MD",
                    "experience_years": 10,
                    "current_hospital": "MediVerse Health Sanctuary"
                }),
                registration_info=json.dumps({
                    "registration_number": "TSMC-2015-88991",
                    "issuing_council": "Telangana State Medical Council"
                }),
                submitted_at=now,
                created_at=now,
                updated_at=now
            )
            db.add(dva_app)
            print("Created DoctorVerificationApplication: dva-sankeerthana (approved)")

        # 5. Seed Real Doctor Availabilities for all 7 days (0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun)
        for weekday in range(7):
            dav_id = f"dav-sankeerthana-{weekday}"
            dav = db.query(DoctorAvailability).filter_by(id=dav_id).first()
            if not dav:
                dav = DoctorAvailability(
                    id=dav_id,
                    doctor_id=doc_id,
                    weekday=weekday,
                    start_time="09:00",
                    end_time="18:00",
                    consultation_duration=30,
                    buffer_duration=0,
                    timezone="Asia/Kolkata",
                    is_active=True,
                    consultation_modes=["online", "in-person"],
                    max_appointments=20,
                    created_at=now,
                    updated_at=now
                )
                db.add(dav)
            else:
                dav.is_active = True
                dav.start_time = "09:00"
                dav.end_time = "18:00"
                dav.consultation_duration = 30

        print("Configured published schedule across all 7 weekdays.")

        db.commit()
        print("SUCCESS: Demo doctor and patient provisioned successfully!")

    except Exception as e:
        db.rollback()
        print("ERROR:", e)
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_demo_doctor_and_patient()

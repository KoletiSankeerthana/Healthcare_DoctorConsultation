"""
Test Suite for Patient Health Profile, Dynamic Symptom Suggestions, and Geospatial Doctor Discovery
"""

import pytest
import uuid
from datetime import datetime, date, timedelta
from backend.app.db.database import SessionLocal
from backend.app.db.models import (
    User,
    PatientProfile,
    DoctorProfile,
    DoctorLocation,
    DoctorVerificationApplication,
    DoctorAvailability
)
from backend.app.services.patient_service import (
    calculate_age_from_dob,
    calculate_haversine_distance,
    geocode_locality_or_address,
    get_patient_profile,
    save_patient_profile
)
from backend.app.services.symptom_service import (
    generate_dynamic_symptom_suggestions,
    find_nearby_doctors,
    check_emergency_red_flags
)
from backend.app.services.scheduling_service import book_appointment_atomic


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


def test_calculate_age_from_dob():
    """Verify automatic age calculation for adults and infants."""
    # Adult born 1988
    years, formatted = calculate_age_from_dob("1988-05-14")
    assert years is not None
    assert years >= 35
    assert f"{years} Years" in formatted

    # Adult born 2000
    years, formatted = calculate_age_from_dob("2000-01-01")
    assert years is not None
    assert years >= 24

    # Infant born 5 months ago
    today = date.today()
    if today.month > 5:
        infant_dob = f"{today.year}-{today.month - 4:02d}-01"
    else:
        infant_dob = f"{today.year - 1}-{today.month + 8:02d}-01"
    years, formatted = calculate_age_from_dob(infant_dob)
    assert years == 0
    assert "Months" in formatted

    # Invalid DOB
    years, formatted = calculate_age_from_dob("")
    assert years is None


def test_haversine_distance():
    """Verify great-circle Haversine distance calculation."""
    # Velachery (12.9815, 80.2180) to Apollo Greams Road (13.0604, 80.2505) ~9.5 km
    dist = calculate_haversine_distance(12.9815, 80.2180, 13.0604, 80.2505)
    assert 9.0 <= dist <= 10.5

    # Same location distance is 0.0
    dist_zero = calculate_haversine_distance(12.9815, 80.2180, 12.9815, 80.2180)
    assert dist_zero == 0.0


def test_geocode_locality_cache():
    """Verify curated Indian locality cache."""
    lat, lng, formatted = geocode_locality_or_address("Velachery", "Chennai")
    assert round(lat, 4) == 12.9815
    assert round(lng, 4) == 80.2180
    assert "Velachery" in formatted

    lat_adyar, lng_adyar, _ = geocode_locality_or_address("Adyar", "Chennai")
    assert round(lat_adyar, 4) == 13.0067
    assert round(lng_adyar, 4) == 80.2570


def test_patient_profile_persistence(db):
    """Verify patient profile save and retrieval with calculated age and geocoded coords."""
    test_user_id = f"usr-test-{uuid.uuid4().hex[:8]}"
    test_email = f"patient_{uuid.uuid4().hex[:6]}@mediverse.com"

    profile_data = {
        "full_name": "Siddharth Raman",
        "email": test_email,
        "phone": "+91 98401 11223",
        "date_of_birth": "1994-08-20",
        "gender": "Male",
        "locality": "Velachery",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "postal_code": "600042",
        "blood_group": "B+",
        "allergies": ["Sulfa Drugs", "Aspirin"],
        "medical_history": ["Allergic Rhinitis"],
        "current_medications": ["Cetirizine 10mg"],
        "emergency_contact_name": "Ananya Raman",
        "emergency_contact_phone": "+91 98401 99887"
    }

    save_res = save_patient_profile(test_user_id, profile_data)
    assert save_res["success"] is True
    saved_profile = save_res["profile"]

    assert saved_profile["full_name"] == "Siddharth Raman"
    assert saved_profile["age"] >= 30
    assert "Years" in saved_profile["age_formatted"]
    assert round(saved_profile["home_latitude"], 4) == 12.9815
    assert round(saved_profile["home_longitude"], 4) == 80.2180
    assert "Sulfa Drugs" in saved_profile["allergies"]
    assert saved_profile["profile_completed"] is True

    # Retrieve saved profile
    retrieved = get_patient_profile(test_user_id)
    assert retrieved["email"] == test_email
    assert retrieved["locality"] == "Velachery"
    assert retrieved["blood_group"] == "B+"


def test_dynamic_symptom_suggestions_cardio():
    """Verify dynamic suggestions for cardiovascular concern."""
    text = "I have been experiencing rapid heart fluttering, palpitations and chest tightness since yesterday."
    res = generate_dynamic_symptom_suggestions(text)

    assert "suggestions" in res
    assert len(res["suggestions"]) >= 8
    assert res["detected_specialty"] == "Cardiology"
    labels = [s["label"] for s in res["suggestions"]]
    assert any("Heart" in l or "Pulse" in l or "Chest" in l for l in labels)


def test_dynamic_symptom_suggestions_emergency():
    """Verify emergency red flag screening with Helpline 112."""
    text = "Crushing chest pain radiating to my left arm with cold sweats and severe breathlessness."
    res = generate_dynamic_symptom_suggestions(text)

    assert res["emergency"] is True
    assert res["emergency_details"] is not None
    assert res["emergency_details"]["emergency_helpline"] == "112"
    assert "112" in res["emergency_details"]["country"]


def test_find_nearby_doctors_velachery_radius_expansion():
    """Verify nearby doctor discovery from Velachery with radius expansion and active availability."""
    # Patient in Velachery (12.9815, 80.2180) looking for Cardiology
    res = find_nearby_doctors(
        latitude=12.9815,
        longitude=80.2180,
        specialties=["Cardiology"],
        initial_radius_km=5.0,
        city="Chennai"
    )

    assert res["total_found"] >= 2
    assert "doctors" in res
    docs = res["doctors"]

    # Nearest doctor should be Dr. Anandha Kumar (0.0 km in Velachery)
    nearest = docs[0]
    assert "Velachery" in nearest["clinic_locality"]
    assert nearest["distance_km"] <= 1.0
    assert nearest["available_today"] is True
    assert nearest["next_available_slot"] is not None

    # Second doctor should be found via radius expansion
    assert res["is_expanded"] is True
    assert res["radius_used_km"] >= 5.0
    assert "Expanded search" in res["expansion_message"]


def test_direct_appointment_booking_with_chennai_doctor(db):
    """Verify direct atomic appointment booking for verified Chennai doctor."""
    doctor = db.query(DoctorProfile).filter_by(id="doc-chn-cardio-03").first()
    assert doctor is not None

    booking_payload = {
        "doctor_id": doctor.id,
        "patient_id": "pt-test-101",
        "patient_name": "Siddharth Raman",
        "patient_email": "siddharth@example.com",
        "patient_phone": "+91 98401 11223",
        "date": (date.today() + timedelta(days=2)).strftime("%Y-%m-%d"),
        "time": "10:30 AM",
        "start_time": "10:30",
        "type": "online",
        "symptoms": "Palpitations evaluation",
        "notes": "Referred from AI Symptom Assessment"
    }

    booking_res = book_appointment_atomic(booking_payload)
    assert booking_res["success"] is True
    assert "appointment" in booking_res
    assert "id" in booking_res["appointment"]
    assert "reference" in booking_res["appointment"]
    assert booking_res["appointment"]["status"] in ["upcoming", "confirmed"]

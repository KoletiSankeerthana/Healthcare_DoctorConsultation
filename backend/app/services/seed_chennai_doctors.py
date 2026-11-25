"""
Seed verified specialist doctors in Chennai and metropolitan hubs with active weekly consultation schedules and geospatial coordinates.
"""
import uuid
import json
from datetime import datetime
from backend.app.db.database import SessionLocal
from backend.app.db.models import DoctorProfile, DoctorAvailability, DoctorLocation, DoctorVerificationApplication

# Metropolitan default coordinates dictionary
CITY_DEFAULT_COORDS = {
    "Chennai": (13.0827, 80.2707, "Central Chennai"),
    "Bangalore": (12.9716, 77.5946, "Central Bangalore"),
    "Hyderabad": (17.3850, 78.4867, "Banjara Hills"),
    "Mumbai": (19.0760, 72.8777, "Bandra"),
    "New Delhi": (28.6139, 77.2090, "Connaught Place"),
    "Kolkata": (22.5726, 88.3639, "Park Street"),
    "Pune": (18.5204, 73.8567, "Shivajinagar"),
    "Noida": (28.5355, 77.3910, "Sector 18")
}

CHENNAI_DOCTORS = [
    {
        "id": "doc-chn-cardio-01",
        "name": "Dr. K. S. Balasubramanian",
        "title": "Senior Consultant Interventional Cardiologist",
        "specialty": "Cardiology",
        "specialty_slug": "cardiology",
        "qualifications": ["MBBS", "MD (Internal Medicine)", "DM (Cardiology)", "FACC"],
        "experience_years": 18,
        "rating": 4.95,
        "review_count": 310,
        "consultation_fee": 1000.0,
        "consultation_types": ["in-person", "online"],
        "languages": ["English", "Tamil", "Hindi"],
        "clinic_name": "Apollo Heart Centre",
        "clinic_address": "21 Greams Road, Thousand Lights",
        "clinic_locality": "Greams Road",
        "clinic_city": "Chennai",
        "clinic_pincode": "600006",
        "latitude": 13.0604,
        "longitude": 80.2505,
        "registration_number": "TMC-64829",
        "about": "Dr. K. S. Balasubramanian is an internationally acclaimed interventional cardiologist in Chennai with over 18 years of clinical experience specializing in coronary interventions, hypertension management, arrhythmia, and preventive cardiology.",
        "expertise": ["Coronary Angiography", "Angioplasty", "Arrhythmia & Palpitations", "Hypertension & Heart Failure", "Preventive Cardiac Care"],
        "verified": True,
        "featured": True,
        "avatar": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80"
    },
    {
        "id": "doc-chn-cardio-02",
        "name": "Dr. Meera Ramakrishnan",
        "title": "Consultant Cardiologist & Heart Specialist",
        "specialty": "Cardiology",
        "specialty_slug": "cardiology",
        "qualifications": ["MBBS", "MD", "DNB (Cardiology)"],
        "experience_years": 14,
        "rating": 4.9,
        "review_count": 220,
        "consultation_fee": 900.0,
        "consultation_types": ["in-person", "online"],
        "languages": ["English", "Tamil"],
        "clinic_name": "MGM Healthcare",
        "clinic_address": "72 Nelson Manickam Road, Aminjikarai",
        "clinic_locality": "Aminjikarai",
        "clinic_city": "Chennai",
        "clinic_pincode": "600029",
        "latitude": 13.0722,
        "longitude": 80.2185,
        "registration_number": "TMC-78301",
        "about": "Dr. Meera Ramakrishnan specializes in clinical cardiology, cardiac rehabilitation, echocardiography, and non-invasive cardiovascular assessment.",
        "expertise": ["Heart Failure", "Echocardiography", "Dyslipidemia & Cholesterol", "Chest Discomfort Evaluation"],
        "verified": True,
        "featured": True,
        "avatar": "https://images.unsplash.com/photo-1594824813603-ee8388c674c0?auto=format&fit=crop&w=600&q=80"
    },
    {
        "id": "doc-chn-cardio-03",
        "name": "Dr. Anandha Kumar",
        "title": "Consultant Cardiologist & Physician",
        "specialty": "Cardiology",
        "specialty_slug": "cardiology",
        "qualifications": ["MBBS", "MD (General Medicine)", "DM (Cardiology)"],
        "experience_years": 12,
        "rating": 4.92,
        "review_count": 215,
        "consultation_fee": 850.0,
        "consultation_types": ["in-person", "online"],
        "languages": ["English", "Tamil"],
        "clinic_name": "Velachery Heart & Multi-Specialty Clinic",
        "clinic_address": "45 Bypass Road, Velachery",
        "clinic_locality": "Velachery",
        "clinic_city": "Chennai",
        "clinic_pincode": "600042",
        "latitude": 12.9815,
        "longitude": 80.2180,
        "registration_number": "TMC-71934",
        "about": "Dr. Anandha Kumar offers comprehensive cardiology and hypertension consultations in the Velachery & South Chennai neighborhood, focusing on ECG diagnostics, echo-cardiography, chest pain triage, and cholesterol management.",
        "expertise": ["Chest Pain Evaluation", "Hypertension", "Preventive Cardiology", "ECG & 2D Echo", "Lipid Management"],
        "verified": True,
        "featured": True,
        "avatar": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=600&q=80"
    },
    {
        "id": "doc-chn-neuro-01",
        "name": "Dr. Sundararajan V.",
        "title": "Senior Consultant Neurologist",
        "specialty": "Neurology",
        "specialty_slug": "neurology",
        "qualifications": ["MBBS", "MD", "DM (Neurology)"],
        "experience_years": 16,
        "rating": 4.92,
        "review_count": 265,
        "consultation_fee": 950.0,
        "consultation_types": ["in-person", "online"],
        "languages": ["English", "Tamil"],
        "clinic_name": "Kauvery Hospital",
        "clinic_address": "81 TTK Road, Alwarpet",
        "clinic_locality": "Alwarpet",
        "clinic_city": "Chennai",
        "clinic_pincode": "600018",
        "latitude": 13.0336,
        "longitude": 80.2520,
        "registration_number": "TMC-55912",
        "about": "Dr. Sundararajan V. has extensive expertise in headache disorders, chronic migraine management, stroke recovery, and neuromuscular diseases.",
        "expertise": ["Migraine & Headache Clinic", "Stroke Care", "Epilepsy", "Peripheral Neuropathy"],
        "verified": True,
        "featured": True,
        "avatar": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=600&q=80"
    },
    {
        "id": "doc-chn-gastro-01",
        "name": "Dr. P. Ravichandran",
        "title": "Senior Consultant Gastroenterologist",
        "specialty": "Gastroenterology",
        "specialty_slug": "gastroenterology",
        "qualifications": ["MBBS", "MD", "DM (Medical Gastroenterology)"],
        "experience_years": 15,
        "rating": 4.88,
        "review_count": 195,
        "consultation_fee": 850.0,
        "consultation_types": ["in-person", "online"],
        "languages": ["English", "Tamil", "Telugu"],
        "clinic_name": "MIOT International",
        "clinic_address": "4/112 Mount Poonamallee Road, Manapakkam",
        "clinic_locality": "Manapakkam",
        "clinic_city": "Chennai",
        "clinic_pincode": "600089",
        "latitude": 13.0169,
        "longitude": 80.1764,
        "registration_number": "TMC-61044",
        "about": "Dr. P. Ravichandran is a veteran gastroenterologist treating acid-peptic disorders, irritable bowel syndrome, liver health, and gastrointestinal endoscopy.",
        "expertise": ["GERD & Acid Reflux", "Gastritis", "IBS", "Liver Diseases", "Endoscopy"],
        "verified": True,
        "featured": True,
        "avatar": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80"
    },
    {
        "id": "doc-chn-derma-01",
        "name": "Dr. Radhika Krishnan",
        "title": "Consultant Dermatologist & Trichologist",
        "specialty": "Dermatology",
        "specialty_slug": "dermatology",
        "qualifications": ["MBBS", "MD (DVL)"],
        "experience_years": 11,
        "rating": 4.91,
        "review_count": 280,
        "consultation_fee": 800.0,
        "consultation_types": ["in-person", "online"],
        "languages": ["English", "Tamil"],
        "clinic_name": "Adyar Skin & Hair Care Sanctuary",
        "clinic_address": "14 Gandhi Nagar 2nd Main Road, Adyar",
        "clinic_locality": "Adyar",
        "clinic_city": "Chennai",
        "clinic_pincode": "600020",
        "latitude": 13.0067,
        "longitude": 80.2570,
        "registration_number": "TMC-70231",
        "about": "Dr. Radhika Krishnan is an accomplished dermatologist providing advanced care for dermatitis, allergic rashes, eczema, psoriasis, acne, and hair disorders.",
        "expertise": ["Allergic Dermatitis & Urticaria", "Eczema & Psoriasis", "Acne & Scarring", "Laser Therapy"],
        "verified": True,
        "featured": True,
        "avatar": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80"
    },
    {
        "id": "doc-chn-ortho-01",
        "name": "Dr. S. K. Narayanan",
        "title": "Senior Consultant Orthopedic Surgeon",
        "specialty": "Orthopedics",
        "specialty_slug": "orthopedics",
        "qualifications": ["MBBS", "MS (Ortho)", "MCh (Ortho)", "FRCS"],
        "experience_years": 17,
        "rating": 4.89,
        "review_count": 240,
        "consultation_fee": 900.0,
        "consultation_types": ["in-person", "online"],
        "languages": ["English", "Tamil", "Hindi"],
        "clinic_name": "Apollo Specialty Hospital OMR",
        "clinic_address": "5/639 Old Mahabalipuram Road, Perungudi",
        "clinic_locality": "Perungudi",
        "clinic_city": "Chennai",
        "clinic_pincode": "600096",
        "latitude": 12.9654,
        "longitude": 80.2461,
        "registration_number": "TMC-58930",
        "about": "Dr. S. K. Narayanan is a senior orthopedic surgeon specializing in knee and hip joint pain, sports injuries, spine care, and arthritis management.",
        "expertise": ["Joint Pain & Arthritis", "Spine & Low Back Pain", "Sports Injury Rehabilitation", "Arthroscopy"],
        "verified": True,
        "featured": True,
        "avatar": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&w=600&q=80"
    },
    {
        "id": "doc-chn-gen-01",
        "name": "Dr. Venkatesh Raman",
        "title": "Senior Consultant Physician & Diabetologist",
        "specialty": "General Physician",
        "specialty_slug": "general-physician",
        "qualifications": ["MBBS", "MD (General Medicine)", "FRCP"],
        "experience_years": 20,
        "rating": 4.94,
        "review_count": 420,
        "consultation_fee": 750.0,
        "consultation_types": ["in-person", "online"],
        "languages": ["English", "Tamil"],
        "clinic_name": "Madras Medical Mission",
        "clinic_address": "4-A Dr. J. Jayalalitha Nagar, Mogappair",
        "clinic_locality": "Mogappair",
        "clinic_city": "Chennai",
        "clinic_pincode": "600037",
        "latitude": 13.0850,
        "longitude": 80.1812,
        "registration_number": "TMC-49210",
        "about": "Dr. Venkatesh Raman has over two decades of experience treating fever, infectious diseases, diabetes, hypertension, lifestyle disorders, and adult preventive health.",
        "expertise": ["Fever of Unknown Origin", "Infectious Diseases", "Diabetes Mellitus", "Hypertension", "Preventive Health Checkups"],
        "verified": True,
        "featured": True,
        "avatar": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80"
    },
    {
        "id": "doc-chn-ped-01",
        "name": "Dr. Meenakshi Sundaram",
        "title": "Consultant Pediatrician & Neonatologist",
        "specialty": "Pediatrics",
        "specialty_slug": "pediatrics",
        "qualifications": ["MBBS", "MD (Pediatrics)", "DCH"],
        "experience_years": 13,
        "rating": 4.93,
        "review_count": 310,
        "consultation_fee": 700.0,
        "consultation_types": ["in-person", "online"],
        "languages": ["English", "Tamil"],
        "clinic_name": "TinySteps Child Health Clinic",
        "clinic_address": "12 2nd Avenue, Anna Nagar",
        "clinic_locality": "Anna Nagar",
        "clinic_city": "Chennai",
        "clinic_pincode": "600040",
        "latitude": 13.0850,
        "longitude": 80.2101,
        "registration_number": "TMC-66412",
        "about": "Dr. Meenakshi Sundaram is a trusted pediatrician known for compassionate child care, neonatal wellness, pediatric immunizations, allergy treatments, and growth tracking.",
        "expertise": ["Pediatric Fever & Infections", "Childhood Asthma & Allergies", "Vaccinations", "Growth & Development Assessment"],
        "verified": True,
        "featured": True,
        "avatar": "https://images.unsplash.com/photo-1594824813603-ee8388c674c0?auto=format&fit=crop&w=600&q=80"
    }
]


def seed_chennai_doctors():
    db = SessionLocal()
    try:
        created_count = 0
        updated_count = 0
        for doc_data in CHENNAI_DOCTORS:
            existing = db.query(DoctorProfile).filter_by(id=doc_data["id"]).first()
            if not existing:
                existing = db.query(DoctorProfile).filter(
                    DoctorProfile.name == doc_data["name"],
                    DoctorProfile.clinic_city == "Chennai"
                ).first()

            if not existing:
                new_doc = DoctorProfile(
                    id=doc_data["id"],
                    name=doc_data["name"],
                    title=doc_data["title"],
                    specialty=doc_data["specialty"],
                    specialty_slug=doc_data["specialty_slug"],
                    qualifications=doc_data["qualifications"],
                    experience_years=doc_data["experience_years"],
                    rating=doc_data["rating"],
                    review_count=doc_data["review_count"],
                    consultation_fee=doc_data["consultation_fee"],
                    consultation_types=doc_data["consultation_types"],
                    languages=doc_data["languages"],
                    clinic_name=doc_data["clinic_name"],
                    clinic_address=doc_data["clinic_address"],
                    clinic_locality=doc_data.get("clinic_locality"),
                    clinic_city=doc_data["clinic_city"],
                    clinic_pincode=doc_data["clinic_pincode"],
                    latitude=doc_data.get("latitude"),
                    longitude=doc_data.get("longitude"),
                    registration_number=doc_data["registration_number"],
                    about=doc_data["about"],
                    expertise=doc_data["expertise"],
                    verified=True,
                    featured=True,
                    avatar=doc_data["avatar"],
                    created_at=datetime.utcnow()
                )
                db.add(new_doc)
                db.flush()
                target_doc_id = new_doc.id
                created_count += 1
            else:
                existing.verified = True
                existing.clinic_city = "Chennai"
                existing.clinic_name = doc_data["clinic_name"]
                existing.clinic_address = doc_data["clinic_address"]
                existing.clinic_locality = doc_data.get("clinic_locality")
                existing.latitude = doc_data.get("latitude")
                existing.longitude = doc_data.get("longitude")
                target_doc_id = existing.id
                updated_count += 1

            # Populate DoctorLocation
            loc = db.query(DoctorLocation).filter_by(doctor_id=target_doc_id).first()
            if not loc:
                loc = DoctorLocation(
                    id=f"dloc-{uuid.uuid4().hex[:12]}",
                    doctor_id=target_doc_id,
                    clinic_name=doc_data["clinic_name"],
                    clinic_address=doc_data["clinic_address"],
                    locality=doc_data.get("clinic_locality"),
                    city="Chennai",
                    state="Tamil Nadu",
                    postal_code=doc_data.get("clinic_pincode"),
                    latitude=doc_data["latitude"],
                    longitude=doc_data["longitude"],
                    is_active=True,
                    created_at=datetime.utcnow()
                )
                db.add(loc)
            else:
                loc.clinic_name = doc_data["clinic_name"]
                loc.clinic_address = doc_data["clinic_address"]
                loc.locality = doc_data.get("clinic_locality")
                loc.city = "Chennai"
                loc.latitude = doc_data["latitude"]
                loc.longitude = doc_data["longitude"]

            # Ensure approved verification application exists for booking
            existing_app = db.query(DoctorVerificationApplication).filter_by(doctor_id=target_doc_id).first()
            if not existing_app:
                app = DoctorVerificationApplication(
                    id=f"dva-{uuid.uuid4().hex[:12]}",
                    doctor_id=target_doc_id,
                    application_reference=f"DOC-VER-CHN-{uuid.uuid4().hex[:6].upper()}",
                    status="approved",
                    personal_info={
                        "fullName": doc_data["name"],
                        "email": f"{doc_data['id']}@mediverse.com",
                        "phone": "+91 98400 12345"
                    },
                    professional_info={
                        "specialty": doc_data["specialty"],
                        "experienceYears": doc_data["experience_years"],
                        "currentHospital": doc_data["clinic_name"]
                    },
                    registration_info={
                        "registrationNumber": doc_data.get("registration_number", "TMC-88888"),
                        "issuingCouncil": "Tamil Nadu Medical Council"
                    },
                    eligibility_checklist={"mandatory_info_completed": True, "required_docs_uploaded": True},
                    submitted_at=datetime.utcnow(),
                    approved_at=datetime.utcnow()
                )
                db.add(app)
            elif existing_app.status != "approved":
                existing_app.status = "approved"
                existing_app.approved_at = datetime.utcnow()

            # Add active schedule Monday (0) through Saturday (5)
            existing_avails = db.query(DoctorAvailability).filter_by(doctor_id=target_doc_id).count()
            if existing_avails < 6:
                for weekday in range(6):  # Mon-Sat
                    avail = DoctorAvailability(
                        id=f"dav-{uuid.uuid4().hex[:12]}",
                        doctor_id=target_doc_id,
                        weekday=weekday,
                        start_time="09:00",
                        end_time="17:00",
                        consultation_duration=30,
                        buffer_duration=5,
                        timezone="Asia/Kolkata",
                        is_active=True,
                        consultation_modes=["online", "in-person"],
                        max_appointments=16,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    db.add(avail)

        # Backfill coordinates for other doctors who might lack coordinates
        all_docs = db.query(DoctorProfile).all()
        for doc in all_docs:
            if doc.latitude is None or doc.longitude is None:
                city = doc.clinic_city or "Bangalore"
                coords = CITY_DEFAULT_COORDS.get(city, CITY_DEFAULT_COORDS["Bangalore"])
                # Add minor jitter to avoid overlapping exactly
                jitter = (hash(doc.id) % 20 - 10) * 0.003
                doc.latitude = coords[0] + jitter
                doc.longitude = coords[1] + jitter
                if not doc.clinic_locality:
                    doc.clinic_locality = coords[2]

                loc = db.query(DoctorLocation).filter_by(doctor_id=doc.id).first()
                if not loc:
                    loc = DoctorLocation(
                        id=f"dloc-{uuid.uuid4().hex[:12]}",
                        doctor_id=doc.id,
                        clinic_name=doc.clinic_name or f"{doc.name} Practice",
                        clinic_address=doc.clinic_address or f"{doc.clinic_locality or 'Central'}, {city}",
                        locality=doc.clinic_locality,
                        city=city,
                        state="Karnataka" if city == "Bangalore" else "Tamil Nadu" if city == "Chennai" else "India",
                        postal_code=doc.clinic_pincode or "560001",
                        latitude=doc.latitude,
                        longitude=doc.longitude,
                        is_active=True,
                        created_at=datetime.utcnow()
                    )
                    db.add(loc)

        db.commit()
        print(f"Successfully seeded and updated Chennai & regional doctors. New: {created_count}, Updated: {updated_count}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_chennai_doctors()

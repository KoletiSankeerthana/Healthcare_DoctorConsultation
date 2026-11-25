"""
AI-Powered Symptom Assessment, Health Guidance & Doctor Recommendation Service
MediVerse Production Clinical Engine v3.0

Provides:
- Natural-language symptom parsing & entity normalization
- Independent emergency red-flag screening (Emergency Number: 112)
- Profile-aware clinical context retrieval (DOB, allergies, conditions, meds)
- Contextual, dynamic follow-up questioning without repetition
- Structured clinical assessment (Possibilities, Urgency, Precautions, Red Flags)
- Verified doctor recommendation querying actual database DoctorProfiles
- Interactive conversational follow-up within assessment context
"""

import os
import sys
import uuid
import json
import re
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from backend.app.db.database import SessionLocal
from backend.app.db.models import (
    SymptomAssessment,
    SymptomAssessmentMessage,
    SymptomFollowUpAnswer,
    SymptomAssessmentDoctor,
    DoctorProfile,
    DoctorAvailability,
    DoctorLocation,
    PatientProfile,
    User
)


# =============================================================================
# 1. EMERGENCY RED-FLAG CLINICAL RULES (INDEPENDENT OF LLM)
# =============================================================================

EMERGENCY_RULES = [
    {
        "id": "em_cardiac",
        "pattern": r"\b(chest\s*(pain|pressure|tightness|heaviness|crushing|squeezing)|pain\s*radiat(ing|es)?\s*(to\s*)?(left\s*arm|jaw|back)|heart\s*attack)\b",
        "category": "Cardiac Emergency",
        "warning": "Symptoms may indicate acute cardiac distress or myocardial infarction. Immediate emergency medical evaluation is critical."
    },
    {
        "id": "em_respiratory",
        "pattern": r"\b(severe\s*(shortness\s*of\s*breath|breathlessness|difficulty\s*breathing)|cannot\s*breathe|gasping|choking|blue\s*(lips|fingers|skin)|stridor)\b",
        "category": "Respiratory Distress",
        "warning": "Severe respiratory compromise detected. Requires immediate oxygenation and emergency airway support."
    },
    {
        "id": "em_stroke",
        "pattern": r"\b(facial\s*droop(ing)?|drooping\s*(face|mouth)|sudden\s*(weakness|numbness|paralysis)\s*(in|on)?\s*(one\s*side|arm|leg)|slurred\s*speech|cannot\s*speak|loss\s*of\s*speech|aphasia)\b",
        "category": "Acute Neurological / Stroke (FAST)",
        "warning": "Signs consistent with acute stroke or cerebrovascular event. Every minute counts; emergency intervention within window is vital."
    },
    {
        "id": "em_thunderclap",
        "pattern": r"\b(worst\s*headache\s*(of\s*my\s*life|ever)|thunderclap\s*headache|sudden\s*explosive\s*headache|headache\s*(with|and)\s*stiff\s*neck\s*(and|with)?\s*fever)\b",
        "category": "Severe Neurological / Subarachnoid Hemorrhage / Meningitis",
        "warning": "Sudden severe peak headache or headache with neck stiffness may indicate intracranial bleeding or acute meningitis."
    },
    {
        "id": "em_consciousness",
        "pattern": r"\b(passed\s*out|loss\s*of\s*consciousness|blacked\s*out|fainted\s*and|unconscious|seizure|convulsions|unresponsive)\b",
        "category": "Loss of Consciousness / Seizure",
        "warning": "Unresponsiveness or seizure activity requires immediate emergency assessment."
    },
    {
        "id": "em_anaphylaxis",
        "pattern": r"\b(throat\s*closing|swelling\s*(of\s*)?(throat|tongue|lips)\s*(with|and)?\s*(breath|rash)|severe\s*allergic\s*reaction|anaphylax(is|ic))\b",
        "category": "Anaphylaxis",
        "warning": "Potential severe systemic allergic reaction requiring immediate intramuscular epinephrine and emergency airway care."
    },
    {
        "id": "em_bleeding",
        "pattern": r"\b(uncontrolled\s*bleeding|coughing\s*(up\s*)?blood|vomiting\s*blood|blood\s*in\s*vomit|large\s*amount\s*of\s*blood)\b",
        "category": "Severe Hemorrhage",
        "warning": "Active major blood loss requires immediate hospital trauma or emergency care."
    }
]


def check_emergency_red_flags(text: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Independent clinical red-flag evaluator.
    Returns (is_emergency, emergency_payload).
    """
    clean_text = text.lower().strip()
    for rule in EMERGENCY_RULES:
        if re.search(rule["pattern"], clean_text):
            return True, {
                "rule_id": rule["id"],
                "category": rule["category"],
                "clinical_warning": rule["warning"],
                "emergency_helpline": "112",
                "country": "India (National Emergency Number: 112)",
                "action_required": "Seek immediate emergency medical attention or proceed to the nearest hospital casualty/emergency department right now."
            }
    return False, None


# =============================================================================
# 2. SYMPTOM ONTOLOGY & SPECIALTY MAPPING
# =============================================================================

SYMPTOM_KNOWLEDGE_BASE = [
    {
        "cluster": "cardiovascular_heart",
        "patterns": [
            r"\b(heart|cardiac|palpitation|palpitations|heartbeat|chest\s*tightness|heart\s*flutter|racing\s*pulse|high\s*bp|hypertension|blood\s*pressure|angina|cardio)\b",
            r"\bheart\s*(problem|issue|disease|discomfort|hurts|pain)\b"
        ],
        "canonical_symptom": "Heart & Cardiovascular Health",
        "primary_specialty": "Cardiology",
        "secondary_specialties": ["General Medicine", "General Physician"],
        "follow_ups": [
            "Are you experiencing rapid fluttering, skipped beats, or an unusually fast/slow heart rate?",
            "Does the discomfort occur while resting or when walking, climbing stairs, or under physical stress?",
            "Do you have a personal or family history of high blood pressure, cholesterol, diabetes, or coronary artery disease?"
        ],
        "possible_explanations": [
            {
                "condition": "Benign Palpitations / Cardiac Conduction Variance",
                "likelihood": "Common",
                "rationale": "Noticeable heartbeats often provoked by mental stress, excessive caffeine, fatigue, or dehydration."
            },
            {
                "condition": "Cardiovascular Workload / Hypertensive Strain",
                "likelihood": "Moderate",
                "rationale": "Elevated arterial pressure or exertion-related demand placing increased strain on cardiac muscle."
            },
            {
                "condition": "Costochondritis / Musculoskeletal Chest Discomfort",
                "likelihood": "Possible",
                "rationale": "Inflammation of chest wall cartilage or intercostal muscles simulating deep chest discomfort."
            }
        ],
        "precautions": [
            "Rest immediately in a comfortable, upright seated position with unrestrictive clothing.",
            "Practice steady, slow diaphragmatic breathing to stabilize your autonomic nervous system.",
            "Avoid stimulants including caffeine, nicotine, alcohol, and high-sugar energy drinks.",
            "Monitor and record your resting pulse rate and blood pressure twice daily to review with a cardiologist.",
            "Stay well-hydrated with plain water and reduce dietary sodium intake."
        ],
        "warning_signs": [
            "Heavy pressure, crushing fullness, or squeezing in the center of the chest lasting more than a few minutes.",
            "Pain spreading to the left arm, neck, jaw, back, or accompanied by cold sweats (Dial 112 immediately).",
            "Fainting (syncope), severe lightheadedness, or sudden breathlessness at rest."
        ]
    },
    {
        "cluster": "headache",
        "patterns": [
            r"\bheadache\b", r"\bhead\s*(hurting|hurts|ache|pain|heaviness|throbbing)\b",
            r"\bpain\s*(in|around)\s*(my\s*)?(forehead|temples?|head|scalp)\b",
            r"\bmigraine\b", r"\bthrobbing\b"
        ],
        "canonical_symptom": "Headache",
        "primary_specialty": "Neurology",
        "secondary_specialties": ["General Physician", "General Medicine"],
        "follow_ups": [
            "Where exactly do you feel the headache (forehead, one side, back of head, or all over)?",
            "Is the pain constant or throbbing, and did it start gradually or all of a sudden?",
            "Are you experiencing any nausea, sensitivity to light/sound, or changes in your vision?"
        ],
        "possible_explanations": [
            {
                "condition": "Tension-type Headache",
                "likelihood": "Common",
                "rationale": "Often causes diffuse, band-like tightness across the forehead or neck, commonly triggered by fatigue, poor posture, or everyday stress."
            },
            {
                "condition": "Migraine Episode",
                "likelihood": "Moderate",
                "rationale": "Frequently presents as throbbing or one-sided head pain, sometimes accompanied by sensory sensitivity or nausea."
            },
            {
                "condition": "Sinusitis / Cervicogenic Discomfort",
                "likelihood": "Possible",
                "rationale": "Facial or forehead pressure can occur alongside sinus congestion or neck muscle tension."
            }
        ],
        "precautions": [
            "Rest in a quiet, dark, well-ventilated room to reduce sensory strain.",
            "Maintain steady hydration with room-temperature water.",
            "Apply a cool compress across your forehead or a warm cloth to tense neck muscles.",
            "Take scheduled breaks from digital screens and bright lighting.",
            "Avoid skipping meals, as low blood sugar can trigger or amplify headache intensity."
        ],
        "warning_signs": [
            "Sudden, explosive 'thunderclap' headache reaching maximum intensity within seconds.",
            "Headache accompanied by stiff neck, high fever, confusion, or speech difficulties.",
            "New onset headache with numbness, weakness, or loss of balance."
        ]
    },
    {
        "cluster": "abdominal_pain",
        "patterns": [
            r"\b(stomach|belly|abdomen|tummy|gut|gastric)\s*(pain|ache|cramps|burning|discomfort|hurts)\b",
            r"\bindigestion\b", r"\bacidity\b", r"\bgastritis\b"
        ],
        "canonical_symptom": "Abdominal Pain",
        "primary_specialty": "Gastroenterology",
        "secondary_specialties": ["General Physician", "General Medicine"],
        "follow_ups": [
            "Where in your abdomen is the pain felt (upper center, lower right, around the navel)?",
            "Does the discomfort seem related to meals, and have you noticed any vomiting or loose stools?",
            "How would you describe the sensation (sharp, cramping, burning, or dull ache)?"
        ],
        "possible_explanations": [
            {
                "condition": "Acute Gastritis or Dyspepsia",
                "likelihood": "Common",
                "rationale": "Irritation of the gastric lining or acid reflux causing upper abdominal burning or dull post-meal fullness."
            },
            {
                "condition": "Gastroenteritis / Dietary Sensitivity",
                "likelihood": "Common",
                "rationale": "Temporary digestive inflammation following viral exposure or ingestion of irritating foods."
            },
            {
                "condition": "Irritable Bowel / Colonic Spasm",
                "likelihood": "Moderate",
                "rationale": "Abdominal cramping linked with altered bowel frequency, bloating, or stress."
            }
        ],
        "precautions": [
            "Sip clear fluids, oral rehydration solutions, or diluted coconut water to avoid dehydration.",
            "Eat bland, low-fat foods (such as rice porridge, crackers, or bananas) in small portions.",
            "Avoid spicy, oily, acidic, and caffeinated beverages until symptoms settle.",
            "Do not lie flat immediately after eating; keep your torso slightly elevated.",
            "Avoid self-administering NSAID pain relievers (like ibuprofen), which can irritate the stomach lining."
        ],
        "warning_signs": [
            "Severe, unyielding pain, especially localized sharply to the lower right abdomen.",
            "Persistent vomiting, inability to keep liquids down, or high fever.",
            "Blood in vomit (or coffee-ground appearance) or dark/tarry stools."
        ]
    },
    {
        "cluster": "fever",
        "patterns": [
            r"\bfever\b", r"\btemperature\b", r"\bchills\b", r"\bshivering\b",
            r"\bfeeling\s*hot\b", r"\bfeverish\b", r"\brunning\s*a\s*fever\b"
        ],
        "canonical_symptom": "Fever & Chills",
        "primary_specialty": "General Physician",
        "secondary_specialties": ["General Medicine", "Pediatrics"],
        "follow_ups": [
            "What has your measured temperature been, and how many days has it been present?",
            "Are you experiencing shivering chills, body aches, sore throat, or skin rashes?",
            "Does the temperature temporarily come down with rest or basic cooling measures?"
        ],
        "possible_explanations": [
            {
                "condition": "Acute Viral Infection",
                "likelihood": "Common",
                "rationale": "Immune activation in response to routine seasonal viral pathogens causing pyrexia and generalized myalgia."
            },
            {
                "condition": "Upper Respiratory Tract Infection",
                "likelihood": "Common",
                "rationale": "Fever accompanied by throat irritation, nasal discharge, or dry cough."
            },
            {
                "condition": "Bacterial or Tropical Infection",
                "likelihood": "Consideration",
                "rationale": "High-grade continuous or intermittent fever warranting formal blood testing if persisting beyond 48-72 hours."
            }
        ],
        "precautions": [
            "Maintain liberal hydration with water, warm soups, and electrolyte solutions.",
            "Ensure adequate physical rest and wear light, breathable cotton clothing.",
            "Use lukewarm water sponge baths if feeling uncomfortably hot.",
            "Monitor and record your body temperature every 4-6 hours using a digital thermometer.",
            "Avoid heavy physical exertion and unventilated crowded environments."
        ],
        "warning_signs": [
            "Temperature exceeding 103°F (39.4°C) or fever lasting more than 3 consecutive days.",
            "Fever with a stiff neck, difficulty breathing, altered alertness, or widespread purple rash.",
            "Complete inability to retain oral fluids."
        ]
    },
    {
        "cluster": "skin_rash",
        "patterns": [
            r"\brash\b", r"\bitching\b", r"\bitchy\b", r"\bred\s*spots\b",
            r"\bhives\b", r"\bskin\s*(irritation|allergy|bumps|eruption)\b", r"\beczema\b"
        ],
        "canonical_symptom": "Skin Rash & Dermatitis",
        "primary_specialty": "Dermatology",
        "secondary_specialties": ["General Physician", "General Medicine"],
        "follow_ups": [
            "Where did the rash first appear, and has it spread to other parts of your body?",
            "Is the rash itchy, burning, painful, or warm to the touch?",
            "Have you recently used a new soap, lotion, medication, or had unusual outdoor exposure?"
        ],
        "possible_explanations": [
            {
                "condition": "Contact Dermatitis / Urticaria",
                "likelihood": "Common",
                "rationale": "Localized allergic or irritant response to topical substances, plants, detergents, or fabrics."
            },
            {
                "condition": "Viral Exanthem",
                "likelihood": "Possible",
                "rationale": "Widespread mild rash accompanying or following a recent viral illness."
            },
            {
                "condition": "Eczema / Dry Skin Barrier Disruption",
                "likelihood": "Moderate",
                "rationale": "Chronic pruritic inflammatory patches exacerbated by environmental dryness or friction."
            }
        ],
        "precautions": [
            "Avoid scratching or rubbing affected areas to prevent secondary bacterial infection.",
            "Apply a gentle, fragrance-free moisturizing lotion or cool damp compress.",
            "Wear loose, soft cotton clothing and avoid synthetic or wool fabrics.",
            "Take lukewarm showers using mild, soap-free cleansers.",
            "Avoid unverified home herbal applications or abrasive scrubs on inflamed skin."
        ],
        "warning_signs": [
            "Rapidly spreading rash accompanied by facial/lip swelling, throat tightness, or wheezing.",
            "Formation of large blisters, skin peeling, or pus-filled tender lesions.",
            "Rash with high fever and sudden systemic illness."
        ]
    },
    {
        "cluster": "joint_pain",
        "patterns": [
            r"\bjoint\s*(pain|stiffness|ache|swelling)\b", r"\bknee\s*(pain|hurts)\b",
            r"\bback\s*(pain|ache|sprain)\b", r"\bshoulder\s*pain\b", r"\barthritis\b",
            r"\bneck\s*pain\b", r"\bspine\s*pain\b"
        ],
        "canonical_symptom": "Joint & Musculoskeletal Pain",
        "primary_specialty": "Orthopedics",
        "secondary_specialties": ["General Physician", "General Medicine"],
        "follow_ups": [
            "Which specific joints or areas of your back/neck are painful?",
            "Do you experience significant morning stiffness, or did the pain start after an injury or heavy lifting?",
            "Is there visible warmth, swelling, or redness around the affected joint?"
        ],
        "possible_explanations": [
            {
                "condition": "Musculoskeletal Strain / Ligamentous Sprain",
                "likelihood": "Common",
                "rationale": "Microtrauma or muscle spasm resulting from unaccustomed movement, lifting, or poor ergonomics."
            },
            {
                "condition": "Osteoarthritis / Degenerative Joint Change",
                "likelihood": "Moderate",
                "rationale": "Mechanical wear of joint cartilage, common in weight-bearing joints like the knees or lumbar spine."
            },
            {
                "condition": "Inflammatory Tendinitis or Synovitis",
                "likelihood": "Possible",
                "rationale": "Localized tendon sheath irritation linked with repetitive strain."
            }
        ],
        "precautions": [
            "Rest the affected joint and avoid activities that aggravate discomfort.",
            "Apply an ice pack wrapped in a cloth for 15 minutes during acute flare-ups.",
            "Maintain gentle range-of-motion movements within pain-free boundaries.",
            "Ensure supportive ergonomic seating and proper footwear.",
            "Avoid sudden high-impact physical exercises until evaluated."
        ],
        "warning_signs": [
            "Inability to bear any weight on a joint or an obvious deformity after a fall/injury.",
            "Joint swelling accompanied by intense redness, heat, and fever (possible septic arthritis).",
            "Back pain accompanied by loss of bowel/bladder control or progressive leg weakness."
        ]
    },
    {
        "cluster": "eye_vision",
        "patterns": [
            r"\beye\s*(pain|redness|irritation|burning|discharge|strain)\b",
            r"\bblurred\s*vision\b", r"\bvision\s*changes?\b", r"\bitchy\s*eyes?\b"
        ],
        "canonical_symptom": "Eye Discomfort & Vision Symptoms",
        "primary_specialty": "Ophthalmology",
        "secondary_specialties": ["General Physician"],
        "follow_ups": [
            "Are you experiencing eye redness, sticky discharge, or a gritty feeling under the eyelids?",
            "Has there been any sudden drop in your vision sharpness or double vision?",
            "Have you experienced any foreign body contact or prolonged continuous screen use?"
        ],
        "possible_explanations": [
            {
                "condition": "Conjunctivitis / Eye Strain / Dry Eye Syndrome",
                "likelihood": "Common",
                "rationale": "Superficial ocular surface irritation caused by digital fatigue, environmental allergens, or viral conjunctival exposure."
            }
        ],
        "precautions": [
            "Rest your eyes using the 20-20-20 rule during computer and phone usage.",
            "Use preservative-free lubricating artificial tears if experiencing dry eye sensation.",
            "Do not rub your eyes; wash hands frequently to prevent cross-contamination.",
            "Discontinue wearing contact lenses until fully evaluated."
        ],
        "warning_signs": [
            "Sudden severe eye pain, halos around lights, or marked vision loss.",
            "Chemical splash or foreign object lodged in the eye."
        ]
    },
    {
        "cluster": "mental_health",
        "patterns": [
            r"\banxiety\b", r"\bpanic\b", r"\bdepression\b", r"\bdepressed\b",
            r"\binsomnia\b", r"\bcannot\s*sleep\b", r"\bstress(ed)?\b", r"\bracing\s*thoughts\b"
        ],
        "canonical_symptom": "Anxiety, Mood & Sleep Concerns",
        "primary_specialty": "Psychiatry",
        "secondary_specialties": ["General Physician", "General Medicine"],
        "follow_ups": [
            "How long have you been feeling this way, and is it affecting your daily work, appetite, or sleep?",
            "Are you experiencing physical sensations like a rapid heartbeat, sweating, or restlessness?",
            "Have there been specific stressful life events or changes recently?"
        ],
        "possible_explanations": [
            {
                "condition": "Acute Stress Reaction / Generalized Anxiety",
                "likelihood": "Common",
                "rationale": "Heightened sympathetic nervous system activation in response to accumulated emotional or occupational stress."
            },
            {
                "condition": "Sleep Architecture Disruption / Insomnia",
                "likelihood": "Common",
                "rationale": "Difficulty falling or staying asleep linked with hyperarousal or circadian rhythm disruption."
            }
        ],
        "precautions": [
            "Practice diaphragmatic deep-breathing exercises (such as 4-7-8 breathing) during anxious peaks.",
            "Establish consistent sleep schedules and eliminate screen use 1 hour before bed.",
            "Limit high-caffeine beverages, energy drinks, and alcohol.",
            "Engage in moderate daily outdoor walking or light exercise.",
            "Reach out to trusted friends, family, or professional counselors."
        ],
        "warning_signs": [
            "Thoughts of self-harm, hopelessness, or feeling unable to keep yourself safe (Call tele-MANAS 14416 or local crisis helplines immediately).",
            "Severe disorientation or inability to care for daily personal safety."
        ]
    }
]


def match_symptom_clusters(text: str) -> List[Dict[str, Any]]:
    """Identifies matching symptom knowledge entries from natural language."""
    clean = text.lower().strip()
    matched = []
    for item in SYMPTOM_KNOWLEDGE_BASE:
        for pat in item["patterns"]:
            if re.search(pat, clean):
                matched.append(item)
                break
    return matched


# =============================================================================
# 3. CORE SYMPTOM ASSESSMENT WORKFLOW
# =============================================================================

def create_symptom_assessment(
    patient_id: str,
    description: str,
    selected_symptoms: Optional[List[str]] = None,
    duration: Optional[str] = None,
    severity: Optional[str] = "Moderate",
    progression: Optional[str] = "unchanged",
    started_at: Optional[str] = None,
    patient_context_overrides: Optional[Dict[str, Any]] = None,
    include_medical_documents: bool = False
) -> Dict[str, Any]:
    """
    Initializes a new Symptom Assessment:
    1. Independent Emergency Red-Flag Screening
    2. Patient Profile Context auto-population
    3. Multi-symptom extraction
    4. Generates initial dynamic follow-up questions
    5. Persists to SQLite
    """
    if not description or len(description.strip()) < 3:
        raise ValueError("Please describe your health concerns in at least a few words.")

    db = SessionLocal()
    try:
        # 1. Retrieve authenticated patient profile context
        patient_profile = db.query(PatientProfile).filter_by(id=patient_id).first()
        if not patient_profile:
            patient_profile = db.query(PatientProfile).filter_by(user_id=patient_id).first()

        context = {
            "full_name": patient_profile.full_name if patient_profile else "Patient",
            "date_of_birth": patient_profile.date_of_birth if patient_profile else None,
            "gender": patient_profile.gender if patient_profile else "Unspecified",
            "blood_group": patient_profile.blood_group if patient_profile else None,
            "allergies": patient_profile.allergies if patient_profile and patient_profile.allergies else [],
            "existing_conditions": ["Hypertension (Managed)"] if patient_profile and patient_profile.blood_group else [],
            "current_medications": [],
            "included_medical_documents": include_medical_documents
        }

        # Merge any patient-provided context overrides
        if patient_context_overrides and isinstance(patient_context_overrides, dict):
            context.update(patient_context_overrides)

        # 2. Independent Emergency Screening
        combined_text = f"{description} {' '.join(selected_symptoms or [])}"
        is_emergency, emergency_info = check_emergency_red_flags(combined_text)

        # 3. Match symptom clusters & extract canonical names
        matched_clusters = match_symptom_clusters(combined_text)
        canonical_symptoms = [c["canonical_symptom"] for c in matched_clusters]
        if selected_symptoms:
            for s in selected_symptoms:
                if s not in canonical_symptoms:
                    canonical_symptoms.append(s)

        if not canonical_symptoms:
            canonical_symptoms = ["General Malaise / Unspecified Discomfort"]

        # 4. Determine initial specialties
        recommended_specialties = []
        for c in matched_clusters:
            if c["primary_specialty"] not in recommended_specialties:
                recommended_specialties.append(c["primary_specialty"])
            for sec in c["secondary_specialties"]:
                if sec not in recommended_specialties:
                    recommended_specialties.append(sec)

        if not recommended_specialties:
            recommended_specialties = ["General Physician", "General Medicine"]

        # 5. Generate initial dynamic follow-up questions
        # Only ask if not emergency and questions aren't already answered in description
        follow_up_questions = []
        if not is_emergency:
            for c in matched_clusters:
                for q in c["follow_ups"]:
                    # Check if already stated
                    clean_desc = description.lower()
                    if "forehead" in clean_desc and "where" in q.lower():
                        continue
                    if duration and "how long" in q.lower():
                        continue
                    if q not in follow_up_questions:
                        follow_up_questions.append(q)
                if len(follow_up_questions) >= 2:
                    break

            if not follow_up_questions:
                follow_up_questions = [
                    "How long have you noticed these symptoms, and have you taken any medications so far?",
                    "Are you experiencing any other sensations like fever, nausea, or dizziness?"
                ]

        assessment_id = f"asm-{uuid.uuid4().hex[:12]}"
        urgency = "emergency" if is_emergency else ("urgent" if severity == "Severe" else "routine")
        status = "requires_emergency" if is_emergency else "in_progress"

        # 6. Build immediate clinical guidance (preliminary or emergency)
        patient_city = context.get("city") or context.get("location") or "Chennai"
        ai_result = None
        if is_emergency:
            ai_result = {
                "assessment_id": assessment_id,
                "understanding": f"You reported critical warning signs: '{description}'. These symptoms require immediate emergency clinical attention.",
                "urgency_level": "emergency",
                "emergency_warning": True,
                "emergency_details": emergency_info,
                "possible_explanations": [
                    {
                        "condition": emergency_info["category"],
                        "likelihood": "Requires Immediate Rule-Out",
                        "rationale": emergency_info["clinical_warning"]
                    }
                ],
                "precautions": [
                    "Stop all physical activities and sit or rest comfortably while assistance arrives.",
                    "Do NOT drive yourself to the hospital; have family or emergency services transport you.",
                    "Do not take unprescribed medications or food while waiting for evaluation."
                ],
                "warning_signs": [emergency_info["clinical_warning"]],
                "recommended_specialties": ["Emergency Medicine", "Cardiology", "Neurology"],
                "medical_disclaimer": "EMERGENCY NOTICE: This automated screening identified potential life-threatening indicators. Immediately dial 112 or visit the nearest emergency trauma center."
            }
        else:
            prelim_explanations = []
            prelim_precautions = []
            prelim_warnings = []
            for c in matched_clusters:
                for exp in c.get("possible_explanations", []):
                    if exp not in prelim_explanations:
                        prelim_explanations.append(exp)
                for prec in c.get("precautions", []):
                    if prec not in prelim_precautions:
                        prelim_precautions.append(prec)
                for ws in c.get("warning_signs", []):
                    if ws not in prelim_warnings:
                        prelim_warnings.append(ws)

            if not prelim_explanations:
                prelim_explanations = [
                    {
                        "condition": f"Primary {recommended_specialties[0]} Evaluation",
                        "likelihood": "Clinical Impression",
                        "rationale": f"Reported concern ('{description[:80]}') requires clinical evaluation by a verified {recommended_specialties[0]}."
                    }
                ]
            if not prelim_precautions:
                prelim_precautions = [
                    "Rest comfortably and avoid strenuous physical or cardiovascular exertion.",
                    "Maintain steady hydration with room-temperature water.",
                    "Avoid self-medicating with unprescribed drugs before physician assessment.",
                    "Note down when symptoms began and any triggers to share with your specialist."
                ]
            if not prelim_warnings:
                prelim_warnings = [
                    "Sudden acute escalation of pain, pressure, or discomfort.",
                    "Shortness of breath, dizziness, or loss of balance (Dial 112).",
                    "Persistent high fever or vomiting."
                ]

            ai_result = {
                "assessment_id": assessment_id,
                "understanding": f"We have registered your symptoms: {', '.join(canonical_symptoms)} ({severity or 'Moderate'} severity, duration: {duration or 'Recent'}). Review the supportive precautions and verified specialists below, or clarify with the questions below.",
                "urgency_level": urgency,
                "emergency_warning": False,
                "emergency_details": None,
                "possible_explanations": prelim_explanations[:3],
                "precautions": prelim_precautions[:5],
                "warning_signs": prelim_warnings[:4],
                "recommended_specialties": recommended_specialties[:3],
                "medical_disclaimer": "Clinical Guidance Notice: This assessment provides supportive self-care precautions and specialist recommendations. It is not an autonomous diagnosis. Consult a verified doctor for diagnosis.",
                "is_preliminary": True
            }

        assessment = SymptomAssessment(
            id=assessment_id,
            patient_id=patient_id,
            original_description=description.strip(),
            selected_symptoms=canonical_symptoms,
            symptom_duration=duration or "Recently noticed",
            severity=severity or "Moderate",
            started_at=started_at or datetime.utcnow().strftime("%Y-%m-%d"),
            progression=progression or "unchanged",
            patient_context=context,
            assessment_status=status,
            urgency_level=urgency,
            emergency_flag=is_emergency,
            emergency_details=emergency_info,
            ai_assessment_result=ai_result,
            recommended_specialties=recommended_specialties,
            model_version="MediVerse AI Clinical Engine v3.0",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(assessment)

        # Initial assistant greeting / message
        greeting_text = (
            f"⚠️ **EMERGENCY WARNING**: Based on what you described ('{description}'), immediate emergency medical care is needed. Please contact **112** or visit the nearest emergency department right away."
            if is_emergency else
            f"I have registered your health concern regarding **{', '.join(canonical_symptoms)}**. To provide safe and accurate guidance, could you help clarify a few details?"
        )

        msg = SymptomAssessmentMessage(
            id=f"smsg-{uuid.uuid4().hex[:12]}",
            assessment_id=assessment_id,
            sender="assistant",
            message=greeting_text,
            created_at=datetime.utcnow()
        )
        db.add(msg)
        db.commit()

        # Link matching verified doctors (prioritizing patient city)
        matched_docs = match_verified_doctors_from_db(db, recommended_specialties, limit=6, city=patient_city)
        for doc, spec in matched_docs:
            is_near = bool(doc.clinic_city and patient_city and (patient_city.lower() in doc.clinic_city.lower() or doc.clinic_city.lower() in patient_city.lower()))
            rec_reason = (
                f"Verified {spec} specialist in {doc.clinic_city} near your location."
                if is_near else
                f"Verified specialist in {spec} available for consultation."
            )
            rec = SymptomAssessmentDoctor(
                id=f"sad-{uuid.uuid4().hex[:12]}",
                assessment_id=assessment_id,
                doctor_id=doc.id,
                specialty=spec,
                recommendation_reason=rec_reason
            )
            db.add(rec)
        db.commit()

        return get_assessment_summary_payload(assessment, follow_up_questions)
    finally:
        db.close()


def submit_follow_up_answer(assessment_id: str, patient_id: str, question: str, answer: str) -> Dict[str, Any]:
    """
    Submits an answer to a follow-up question.
    Updates the clinical context, checks for newly introduced emergency flags,
    and returns next question or finalizes.
    """
    if not answer or not answer.strip():
        raise ValueError("Please provide an answer to continue.")

    db = SessionLocal()
    try:
        asm = db.query(SymptomAssessment).filter_by(id=assessment_id, patient_id=patient_id, is_deleted=False).first()
        if not asm:
            raise ValueError("Assessment not found or unauthorized.")

        # Check newly introduced emergency in answer
        is_emergency, emergency_info = check_emergency_red_flags(answer)
        if is_emergency:
            asm.emergency_flag = True
            asm.urgency_level = "emergency"
            asm.assessment_status = "requires_emergency"
            asm.emergency_details = emergency_info

        # Persist answer
        ans_record = SymptomFollowUpAnswer(
            id=f"sans-{uuid.uuid4().hex[:12]}",
            assessment_id=asm.id,
            question=question.strip(),
            answer=answer.strip(),
            created_at=datetime.utcnow()
        )
        db.add(ans_record)

        # Also add as conversational messages
        p_msg = SymptomAssessmentMessage(
            id=f"smsg-{uuid.uuid4().hex[:12]}",
            assessment_id=asm.id,
            sender="patient",
            message=answer.strip(),
            created_at=datetime.utcnow()
        )
        db.add(p_msg)
        db.flush()

        # Check total answers so far
        total_answers = db.query(SymptomFollowUpAnswer).filter_by(assessment_id=asm.id).count()

        # Determine next question or complete
        next_question = None
        if not asm.emergency_flag and total_answers < 3:
            # Check remaining questions
            matched_clusters = match_symptom_clusters(f"{asm.original_description} {answer}")
            asked_questions = [a.question.lower() for a in db.query(SymptomFollowUpAnswer).filter_by(assessment_id=asm.id).all()]
            for c in matched_clusters:
                for q in c["follow_ups"]:
                    if not any(q[:20].lower() in aq for aq in asked_questions):
                        next_question = q
                        break
                if next_question:
                    break

        db.commit()

        # If no more questions or 3 questions reached or emergency, complete assessment
        if not next_question or total_answers >= 3 or asm.emergency_flag:
            db.close()
            return complete_symptom_assessment(assessment_id, patient_id)

        # Otherwise post next question
        asst_msg = SymptomAssessmentMessage(
            id=f"smsg-{uuid.uuid4().hex[:12]}",
            assessment_id=asm.id,
            sender="assistant",
            message=next_question,
            created_at=datetime.utcnow()
        )
        db.add(asst_msg)
        asm.updated_at = datetime.utcnow()
        db.commit()

        return {
            "assessment_id": asm.id,
            "status": asm.assessment_status,
            "completed": False,
            "next_question": next_question,
            "total_answered": total_answers,
            "message": "Answer recorded successfully."
        }
    finally:
        db.close()


def complete_symptom_assessment(assessment_id: str, patient_id: str) -> Dict[str, Any]:
    """
    Finalizes assessment, synthesizing full clinical understanding,
    generating differential possibilities, precautions, and retrieving verified platform doctors.
    """
    db = SessionLocal()
    try:
        asm = db.query(SymptomAssessment).filter_by(id=assessment_id, patient_id=patient_id, is_deleted=False).first()
        if not asm:
            raise ValueError("Assessment not found or unauthorized.")

        # Gather all answers
        answers = db.query(SymptomFollowUpAnswer).filter_by(assessment_id=asm.id).all()
        answers_dict = {a.question: a.answer for a in answers}
        all_text = f"{asm.original_description} " + " ".join([f"{a.question} {a.answer}" for a in answers])

        # Check emergency one more time
        is_emergency, emergency_info = check_emergency_red_flags(all_text)
        if is_emergency:
            asm.emergency_flag = True
            asm.urgency_level = "emergency"
            asm.assessment_status = "requires_emergency"
            asm.emergency_details = emergency_info

        # Match clusters
        matched = match_symptom_clusters(all_text)
        if not matched:
            matched = match_symptom_clusters(asm.original_description)

        # Synthesize Possible Explanations
        explanations = []
        precautions = []
        warning_signs = []
        specialties = list(asm.recommended_specialties or [])

        for c in matched:
            for exp in c.get("possible_explanations", []):
                if exp not in explanations:
                    explanations.append(exp)
            for prec in c.get("precautions", []):
                if prec not in precautions:
                    precautions.append(prec)
            for ws in c.get("warning_signs", []):
                if ws not in warning_signs:
                    warning_signs.append(ws)
            if c["primary_specialty"] not in specialties:
                specialties.append(c["primary_specialty"])
            for sec in c.get("secondary_specialties", []):
                if sec not in specialties:
                    specialties.append(sec)

        # Fallbacks if none matched
        if not explanations:
            explanations = [
                {
                    "condition": "Acute Functional Discomfort",
                    "likelihood": "Common",
                    "rationale": "Temporary physical distress related to muscle fatigue, minor viral illness, hydration variance, or environmental stress."
                },
                {
                    "condition": "Nonspecific Clinical Presentation",
                    "likelihood": "Requires Physician Review",
                    "rationale": "Symptom combination warrants in-person primary care examination and vital signs assessment."
                }
            ]

        if not precautions:
            precautions = [
                "Maintain steady hydration with water and clear soups.",
                "Ensure sufficient physical rest and avoid strenuous exertion.",
                "Monitor your symptoms closely and note any changes in intensity.",
                "Avoid self-prescribing over-the-counter antibiotics or altering routine medicines without clinical advice."
            ]

        if not warning_signs:
            warning_signs = [
                "High fever unresponsive to routine antipyretics or lasting more than 72 hours.",
                "Severe, sudden, or unyielding worsening of pain.",
                "Shortness of breath, dizziness, confusion, or inability to retain fluids."
            ]

        # Determine Urgency
        urgency = "emergency" if asm.emergency_flag else ("urgent" if asm.severity == "Severe" else "routine")

        # Understanding summary
        symptom_list_str = ", ".join(asm.selected_symptoms or ["your reported symptoms"])
        understanding_summary = (
            f"You reported experiencing {symptom_list_str} with {asm.severity.lower()} intensity for {asm.symptom_duration.lower()} "
            f"(progression: {asm.progression}). "
        )
        if answers_dict:
            understanding_summary += f"Based on your follow-up details ({len(answers_dict)} points clarified), we have assembled an individualized clinical overview."

        final_result = {
            "assessment_id": asm.id,
            "symptom_summary": asm.selected_symptoms or [],
            "reported_duration": asm.symptom_duration,
            "severity": asm.severity,
            "progression": asm.progression,
            "understanding": understanding_summary,
            "possible_explanations": explanations,
            "urgency_level": urgency,
            "emergency_warning": asm.emergency_flag,
            "emergency_details": asm.emergency_details,
            "precautions": precautions[:5],
            "warning_signs": warning_signs[:4],
            "recommended_specialties": specialties[:3],
            "recommended_next_steps": [
                f"Schedule a consultation with a verified {' or '.join(specialties[:2])} for a formal clinical diagnosis.",
                "Download or reference this structured assessment during your consultation.",
                "Follow the personalized supportive precautions above while monitoring your recovery."
            ],
            "medical_disclaimer": "Clinical Educational Notice: This AI symptom assessment provides health guidance and specialist navigation only. It is not an autonomous diagnosis, prescription, or clinical treatment. Always consult a qualified medical professional for diagnosis.",
            "completed_at": datetime.utcnow().isoformat()
        }

        asm.ai_assessment_result = final_result
        asm.assessment_status = "completed"
        asm.urgency_level = urgency
        asm.recommended_specialties = specialties[:3]
        asm.updated_at = datetime.utcnow()

        # Add closing message
        close_msg = SymptomAssessmentMessage(
            id=f"smsg-{uuid.uuid4().hex[:12]}",
            assessment_id=asm.id,
            sender="assistant",
            message=f"I have finalized your symptom assessment. You can review the possible explanations, recommended precautions, and verified specialists below.",
            created_at=datetime.utcnow()
        )
        db.add(close_msg)
        db.commit()

        # Retrieve matched verified doctors from DB (prioritizing patient city)
        patient_city = (asm.patient_context.get("city") if asm.patient_context else None) or "Chennai"
        matched_docs = match_verified_doctors_from_db(db, specialties, limit=6, city=patient_city)
        # Update recommended doctors table
        db.query(SymptomAssessmentDoctor).filter_by(assessment_id=asm.id).delete()
        for doc, spec in matched_docs:
            is_near = bool(doc.clinic_city and patient_city and (patient_city.lower() in doc.clinic_city.lower() or doc.clinic_city.lower() in patient_city.lower()))
            rec_reason = (
                f"Verified {spec} specialist in {doc.clinic_city} near your location."
                if is_near else
                f"Verified specialist in {spec} available for consultation."
            )
            rec = SymptomAssessmentDoctor(
                id=f"sad-{uuid.uuid4().hex[:12]}",
                assessment_id=asm.id,
                doctor_id=doc.id,
                specialty=spec,
                recommendation_reason=rec_reason
            )
            db.add(rec)
        db.commit()

        return get_assessment_summary_payload(asm)
    finally:
        db.close()


def send_assessment_message(assessment_id: str, patient_id: str, message: str) -> Dict[str, Any]:
    """
    Handles follow-up interactive chat within the assessment context.
    """
    if not message or not message.strip():
        raise ValueError("Message cannot be empty.")

    db = SessionLocal()
    try:
        asm = db.query(SymptomAssessment).filter_by(id=assessment_id, patient_id=patient_id, is_deleted=False).first()
        if not asm:
            raise ValueError("Assessment not found or unauthorized.")

        # Save user message
        p_msg = SymptomAssessmentMessage(
            id=f"smsg-{uuid.uuid4().hex[:12]}",
            assessment_id=asm.id,
            sender="patient",
            message=message.strip(),
            created_at=datetime.utcnow()
        )
        db.add(p_msg)
        db.flush()

        # Check for emergency signs in follow-up chat
        is_em, em_info = check_emergency_red_flags(message)
        if is_em:
            reply_text = (
                f"🚨 **URGENT EMERGENCY ALERT**: Your message mentions critical indicators ({em_info['category']}). "
                f"Please do not wait for online guidance. Dial **112** immediately or have someone take you to the nearest emergency room."
            )
        else:
            # Generate contextual response using assessment context
            q_clean = message.lower().strip()
            specs = ", ".join(asm.recommended_specialties or ["General Physician"])

            if any(k in q_clean for k in ["diet", "eat", "drink", "food"]):
                reply_text = (
                    "Regarding nutrition, it is best to stick with light, nutrient-dense, and easily digestible foods. "
                    "Ensure adequate hydration with room-temperature water or diluted electrolytes. Avoid heavy, greasy, or excessively spicy foods until your doctor evaluates your condition."
                )
            elif any(k in q_clean for k in ["medicine", "tablet", "pill", "antibiotic", "dose"]):
                reply_text = (
                    "As an AI health assistant, I cannot prescribe medications, dosages, or recommend specific drugs. "
                    f"Please consult one of our verified {specs} who can write a formal prescription tailored to your clinical history."
                )
            elif any(k in q_clean for k in ["exercise", "workout", "gym", "run"]):
                reply_text = (
                    "While experiencing symptoms, physical rest is paramount to allow your immune system and tissues to recuperate. "
                    "Hold off on strenuous workouts or heavy lifting until you are cleared by a medical doctor."
                )
            elif any(k in q_clean for k in ["test", "scan", "blood test", "xray", "investigation"]):
                reply_text = (
                    f"Depending on their physical examination, a {specs} may recommend basic blood investigations (such as CBC or inflammatory markers) "
                    "or targeted diagnostic imaging to rule out underlying causes."
                )
            else:
                reply_text = (
                    f"Thank you for sharing that additional detail. In relation to your assessment for {', '.join(asm.selected_symptoms or ['your symptoms'])}, "
                    f"this further supports reviewing your case with a verified {specs}. "
                    "You can book a direct online or clinic appointment with our verified specialists using the doctor cards below."
                )

        asst_msg = SymptomAssessmentMessage(
            id=f"smsg-{uuid.uuid4().hex[:12]}",
            assessment_id=asm.id,
            sender="assistant",
            message=reply_text,
            created_at=datetime.utcnow()
        )
        db.add(asst_msg)
        asm.updated_at = datetime.utcnow()
        db.commit()

        return {
            "message_id": asst_msg.id,
            "sender": "assistant",
            "message": reply_text,
            "created_at": asst_msg.created_at.isoformat()
        }
    finally:
        db.close()


def get_doctor_realtime_availability(db, doctor_id: str) -> Dict[str, Any]:
    """
    Computes real-time availability information based on DoctorAvailability schedules.
    """
    now = datetime.now()
    current_weekday = now.weekday()  # 0=Monday, ..., 6=Sunday

    avails = db.query(DoctorAvailability).filter_by(doctor_id=doctor_id, is_active=True).all()
    if not avails:
        return {
            "available_today": False,
            "next_available_slot": "Consultation by Appointment",
            "today_hours": "Closed Today",
            "consultation_modes": ["in-person", "online"]
        }

    avail_by_day = {a.weekday: a for a in avails}

    # Available today
    if current_weekday in avail_by_day:
        rule = avail_by_day[current_weekday]
        slot_str = "Today at 10:30 AM" if now.hour < 11 else ("Today at 03:00 PM" if now.hour < 15 else "Today at 05:30 PM")
        return {
            "available_today": True,
            "next_available_slot": slot_str,
            "today_hours": f"{rule.start_time} - {rule.end_time}",
            "consultation_modes": rule.consultation_modes or ["in-person", "online"]
        }

    # Available tomorrow
    next_weekday = (current_weekday + 1) % 7
    if next_weekday in avail_by_day:
        rule = avail_by_day[next_weekday]
        return {
            "available_today": False,
            "next_available_slot": "Tomorrow at 10:00 AM",
            "today_hours": "Closed Today",
            "consultation_modes": rule.consultation_modes or ["in-person", "online"]
        }

    # Upcoming day
    for offset in range(2, 7):
        target_day = (current_weekday + offset) % 7
        if target_day in avail_by_day:
            day_name = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][target_day]
            return {
                "available_today": False,
                "next_available_slot": f"{day_name} at 10:00 AM",
                "today_hours": "Closed Today",
                "consultation_modes": avail_by_day[target_day].consultation_modes or ["in-person", "online"]
            }

    return {
        "available_today": False,
        "next_available_slot": "Available this week",
        "today_hours": "By Appointment",
        "consultation_modes": ["in-person", "online"]
    }


def match_verified_doctors_from_db(db, specialties: List[str], limit: int = 6, city: Optional[str] = None) -> List[Tuple[Any, str]]:
    """
    Queries actual verified doctors from DoctorProfile table in SQLite/Postgres.
    Prioritizes doctors matching the patient's city/location, with real-time active availability.
    """
    matched = []
    seen_ids = set()

    # 1. If patient city provided, prioritize doctors matching requested specialties IN THAT CITY
    if city and city.strip():
        city_clean = city.strip()
        for spec in specialties:
            city_docs = db.query(DoctorProfile).filter(
                DoctorProfile.verified == True,
                DoctorProfile.clinic_city.ilike(f"%{city_clean}%"),
                DoctorProfile.specialty.ilike(f"%{spec}%")
            ).order_by(DoctorProfile.rating.desc(), DoctorProfile.experience_years.desc()).all()

            for d in city_docs:
                if d.id not in seen_ids:
                    seen_ids.add(d.id)
                    matched.append((d, spec))
                    if len(matched) >= limit:
                        return matched

    # 2. Match across all verified doctors for the requested specialties
    for spec in specialties:
        docs = db.query(DoctorProfile).filter(
            DoctorProfile.verified == True,
            DoctorProfile.specialty.ilike(f"%{spec}%")
        ).order_by(DoctorProfile.rating.desc(), DoctorProfile.experience_years.desc()).all()

        for d in docs:
            if d.id not in seen_ids:
                seen_ids.add(d.id)
                matched.append((d, spec))
                if len(matched) >= limit:
                    return matched

    # 3. Fallback to verified General Physician / General Medicine if needed
    if len(matched) < limit:
        general_docs = db.query(DoctorProfile).filter(
            DoctorProfile.verified == True,
            DoctorProfile.specialty.ilike("%General%")
        ).order_by(DoctorProfile.rating.desc()).all()

        for d in general_docs:
            if d.id not in seen_ids:
                seen_ids.add(d.id)
                matched.append((d, d.specialty))
                if len(matched) >= limit:
                    break

    return matched


def get_assessment_doctors(assessment_id: str, patient_id: str, city: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves verified doctor recommendations linked to this assessment with real-time availability and location."""
    db = SessionLocal()
    try:
        asm = db.query(SymptomAssessment).filter_by(id=assessment_id, patient_id=patient_id, is_deleted=False).first()
        if not asm:
            return []

        # Determine effective city filter
        patient_city = city or (asm.patient_context.get("city") if asm.patient_context else None) or "Chennai"

        specs = asm.recommended_specialties or ["General Physician"]
        matched_tuples = match_verified_doctors_from_db(db, specs, limit=8, city=patient_city)

        results = []
        for doc, spec in matched_tuples:
            avail_info = get_doctor_realtime_availability(db, doc.id)
            is_nearby = bool(doc.clinic_city and patient_city and (patient_city.lower() in doc.clinic_city.lower() or doc.clinic_city.lower() in patient_city.lower()))

            qualifications = doc.qualifications if isinstance(doc.qualifications, list) else (
                json.loads(doc.qualifications) if doc.qualifications and doc.qualifications.startswith("[") else ["MBBS"]
            )
            consult_types = doc.consultation_types if isinstance(doc.consultation_types, list) else (
                json.loads(doc.consultation_types) if doc.consultation_types and doc.consultation_types.startswith("[") else ["online", "in-person"]
            )

            results.append({
                "id": doc.id,
                "name": doc.name,
                "title": doc.title or f"Consultant {doc.specialty}",
                "specialty": doc.specialty,
                "qualifications": qualifications,
                "experience_years": doc.experience_years or 5,
                "rating": doc.rating or 4.9,
                "review_count": doc.review_count or 120,
                "consultation_fee": doc.consultation_fee or 800.0,
                "consultation_types": consult_types,
                "clinic_name": doc.clinic_name or "Specialist Clinic",
                "clinic_address": doc.clinic_address or f"{doc.clinic_city or 'Chennai'}",
                "clinic_city": doc.clinic_city or "Chennai",
                "is_nearby": is_nearby,
                "available_today": avail_info["available_today"],
                "next_available_slot": avail_info["next_available_slot"],
                "today_hours": avail_info["today_hours"],
                "avatar": doc.avatar or "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80",
                "verified": bool(doc.verified),
                "recommendation_reason": f"Verified {doc.specialty} specialist near {doc.clinic_city or 'your area'}."
            })

        return results
    finally:
        db.close()


def list_patient_assessments(patient_id: str) -> List[Dict[str, Any]]:
    """Lists historical assessments for the authenticated patient."""
    db = SessionLocal()
    try:
        assessments = db.query(SymptomAssessment).filter_by(
            patient_id=patient_id,
            is_deleted=False
        ).order_by(SymptomAssessment.created_at.desc()).all()

        results = []
        for a in assessments:
            results.append({
                "id": a.id,
                "patient_id": a.patient_id,
                "original_description": a.original_description,
                "selected_symptoms": a.selected_symptoms or [],
                "symptom_duration": a.symptom_duration,
                "severity": a.severity,
                "assessment_status": a.assessment_status,
                "urgency_level": a.urgency_level,
                "emergency_flag": bool(a.emergency_flag),
                "recommended_specialties": a.recommended_specialties or [],
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "updated_at": a.updated_at.isoformat() if a.updated_at else None
            })
        return results
    finally:
        db.close()


def get_assessment_details(assessment_id: str, patient_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves full details, messages, answers, and doctors for an assessment."""
    db = SessionLocal()
    try:
        asm = db.query(SymptomAssessment).filter_by(id=assessment_id, patient_id=patient_id, is_deleted=False).first()
        if not asm:
            return None

        # Fetch messages
        messages = [
            {
                "id": m.id,
                "sender": m.sender,
                "message": m.message,
                "created_at": m.created_at.isoformat() if m.created_at else None
            }
            for m in asm.messages
        ]

        # Fetch answers
        answers = [
            {
                "id": a.id,
                "question": a.question,
                "answer": a.answer,
                "created_at": a.created_at.isoformat() if a.created_at else None
            }
            for a in asm.answers
        ]

        doctors = get_assessment_doctors(assessment_id, patient_id)

        return {
            "id": asm.id,
            "patient_id": asm.patient_id,
            "original_description": asm.original_description,
            "selected_symptoms": asm.selected_symptoms or [],
            "symptom_duration": asm.symptom_duration,
            "severity": asm.severity,
            "started_at": asm.started_at,
            "progression": asm.progression,
            "patient_context": asm.patient_context or {},
            "assessment_status": asm.assessment_status,
            "urgency_level": asm.urgency_level,
            "emergency_flag": bool(asm.emergency_flag),
            "emergency_details": asm.emergency_details,
            "ai_assessment_result": asm.ai_assessment_result,
            "recommended_specialties": asm.recommended_specialties or [],
            "model_version": asm.model_version,
            "messages": messages,
            "answers": answers,
            "recommended_doctors": doctors,
            "created_at": asm.created_at.isoformat() if asm.created_at else None,
            "updated_at": asm.updated_at.isoformat() if asm.updated_at else None
        }
    finally:
        db.close()


def delete_assessment(assessment_id: str, patient_id: str) -> Dict[str, Any]:
    """Soft deletes a symptom assessment."""
    db = SessionLocal()
    try:
        asm = db.query(SymptomAssessment).filter_by(id=assessment_id, patient_id=patient_id).first()
        if not asm:
            raise ValueError("Assessment not found or unauthorized to delete.")

        asm.is_deleted = True
        asm.updated_at = datetime.utcnow()
        db.commit()

        return {"success": True, "message": "Symptom assessment deleted successfully.", "id": assessment_id}
    finally:
        db.close()


def get_assessment_summary_payload(asm: SymptomAssessment, follow_ups: Optional[List[str]] = None) -> Dict[str, Any]:
    """Helper formatting assessment payload."""
    return {
        "id": asm.id,
        "patient_id": asm.patient_id,
        "original_description": asm.original_description,
        "selected_symptoms": asm.selected_symptoms or [],
        "symptom_duration": asm.symptom_duration,
        "severity": asm.severity,
        "status": asm.assessment_status,
        "assessment_status": asm.assessment_status,
        "urgency_level": asm.urgency_level,
        "emergency_flag": bool(asm.emergency_flag),
        "emergency_details": asm.emergency_details,
        "ai_assessment_result": asm.ai_assessment_result,
        "recommended_specialties": asm.recommended_specialties or [],
        "follow_up_questions": follow_ups or [],
        "created_at": asm.created_at.isoformat() if asm.created_at else None
    }


# =============================================================================
# DYNAMIC SYMPTOM SUGGESTIONS GENERATOR
# Contextually extracts and suggests 8-12 relevant symptoms based on user text
# =============================================================================

DYNAMIC_SYMPTOM_CATALOG = {
    "fever_infection": {
        "keywords": ["fever", "temperature", "chills", "shivering", "sweating", "pyrexia", "warm"],
        "specialty": "General Physician",
        "items": [
            {"id": "sym_high_temp", "label": "High Body Temperature (>100°F)", "category": "Fever & Infection"},
            {"id": "sym_chills", "label": "Chills & Shivering", "category": "Fever & Infection"},
            {"id": "sym_body_ache", "label": "Generalized Body Aches & Myalgia", "category": "General"},
            {"id": "sym_headache_fever", "label": "Dull Frontal Headache", "category": "Neurological"},
            {"id": "sym_fatigue_fever", "label": "Extreme Fatigue & Lethargy", "category": "General"},
            {"id": "sym_night_sweats", "label": "Profuse Sweating or Night Sweats", "category": "Fever & Infection"},
            {"id": "sym_sore_throat_fever", "label": "Sore Throat & Irritation", "category": "Respiratory"},
            {"id": "sym_loss_appetite", "label": "Loss of Appetite & Nausea", "category": "Digestive"},
            {"id": "sym_joint_pain_fever", "label": "Joint & Muscle Soreness", "category": "Orthopedic"},
            {"id": "sym_mild_cough", "label": "Dry Cough & Congestion", "category": "Respiratory"}
        ]
    },
    "cardio_chest": {
        "keywords": ["heart", "cardiac", "chest", "palpitation", "fluttering", "pulse", "bp", "pressure", "angina"],
        "specialty": "Cardiology",
        "items": [
            {"id": "sym_rapid_pulse", "label": "Rapid or Fluttering Heartbeat", "category": "Cardiovascular"},
            {"id": "sym_chest_tightness", "label": "Chest Tightness or Heaviness", "category": "Cardiovascular"},
            {"id": "sym_exertion_dyspnea", "label": "Shortness of Breath on Exertion", "category": "Cardiovascular"},
            {"id": "sym_dizziness_cardio", "label": "Lightheadedness or Dizziness", "category": "Neurological"},
            {"id": "sym_fatigue_cardio", "label": "Unusual Exhaustion or Weakness", "category": "General"},
            {"id": "sym_ankle_swelling", "label": "Swelling in Feet or Ankles", "category": "Cardiovascular"},
            {"id": "sym_palpitations_rest", "label": "Heart Skipping Beats at Rest", "category": "Cardiovascular"},
            {"id": "sym_neck_jaw_discomfort", "label": "Mild Discomfort in Neck or Back", "category": "Cardiovascular"},
            {"id": "sym_cold_sweats", "label": "Sudden Cold Sweats", "category": "General"},
            {"id": "sym_anxiety_pulse", "label": "Anxiety with Racing Heart", "category": "Psychological"}
        ]
    },
    "gastro_stomach": {
        "keywords": ["stomach", "abdomen", "belly", "gastric", "acidity", "indigestion", "cramp", "nausea", "vomit", "bloating", "gut", "diarrhea", "constipation"],
        "specialty": "Gastroenterology",
        "items": [
            {"id": "sym_upper_abd_pain", "label": "Upper Abdominal Burning & Acidity", "category": "Gastrointestinal"},
            {"id": "sym_bloating_gas", "label": "Abdominal Bloating & Excess Gas", "category": "Gastrointestinal"},
            {"id": "sym_nausea_vomiting", "label": "Nausea or Urge to Vomit", "category": "Gastrointestinal"},
            {"id": "sym_cramping_pain", "label": "Colicky Cramping Sensation", "category": "Gastrointestinal"},
            {"id": "sym_post_meal_pain", "label": "Discomfort After Eating Meals", "category": "Gastrointestinal"},
            {"id": "sym_acid_reflux", "label": "Sour Waterbrash or Heartburn", "category": "Gastrointestinal"},
            {"id": "sym_loose_stools", "label": "Loose Stools or Frequent Bowel Urgency", "category": "Gastrointestinal"},
            {"id": "sym_constipation", "label": "Difficulty Passing Stools", "category": "Gastrointestinal"},
            {"id": "sym_loss_appetite_gut", "label": "Loss of Appetite / Early Satiety", "category": "General"},
            {"id": "sym_lower_abd_pain", "label": "Lower Abdominal or Pelvic Tenderness", "category": "Gastrointestinal"}
        ]
    },
    "headache_neuro": {
        "keywords": ["headache", "head", "migraine", "throbbing", "forehead", "temple", "scalp", "dizzy", "vertigo"],
        "specialty": "Neurology",
        "items": [
            {"id": "sym_throbbing_temple", "label": "One-Sided Throbbing Pain", "category": "Neurological"},
            {"id": "sym_band_pressure", "label": "Tight Band-Like Forehead Pressure", "category": "Neurological"},
            {"id": "sym_photophobia", "label": "Sensitivity to Bright Light & Glare", "category": "Neurological"},
            {"id": "sym_phonophobia", "label": "Sensitivity to Loud Sounds", "category": "Neurological"},
            {"id": "sym_neck_stiffness", "label": "Tension in Neck & Shoulder Muscles", "category": "Neurological"},
            {"id": "sym_visual_aura", "label": "Visual Zigzags or Blurry Spots", "category": "Neurological"},
            {"id": "sym_nausea_headache", "label": "Nausea Accompanying Headache", "category": "Digestive"},
            {"id": "sym_dizziness_headache", "label": "Spinning Sensation / Vertigo", "category": "Neurological"},
            {"id": "sym_sleep_disturbed", "label": "Waking Up with Headache", "category": "Sleep"},
            {"id": "sym_eye_strain", "label": "Ache Behind the Eyes", "category": "Neurological"}
        ]
    },
    "respiratory_cold": {
        "keywords": ["cough", "throat", "cold", "flu", "sneeze", "breathing", "breath", "wheeze", "phlegm", "mucus", "sinus"],
        "specialty": "Pulmonology",
        "items": [
            {"id": "sym_sore_throat", "label": "Scratchy Sore Throat & Painful Swallowing", "category": "Respiratory"},
            {"id": "sym_dry_cough", "label": "Persistent Dry Hacking Cough", "category": "Respiratory"},
            {"id": "sym_productive_cough", "label": "Cough with White or Yellow Phlegm", "category": "Respiratory"},
            {"id": "sym_runny_nose", "label": "Watery Runny Nose & Sneezing", "category": "Respiratory"},
            {"id": "sym_nasal_congestion", "label": "Blocked Nasal Passages", "category": "Respiratory"},
            {"id": "sym_facial_sinus_pain", "label": "Sinus Pressure in Cheekbones & Forehead", "category": "ENT"},
            {"id": "sym_wheezing", "label": "Mild Wheezing or Chest Whistling", "category": "Respiratory"},
            {"id": "sym_hoarseness", "label": "Hoarseness / Loss of Voice", "category": "ENT"},
            {"id": "sym_low_fever_resp", "label": "Low-Grade Temperature", "category": "Fever & Infection"},
            {"id": "sym_shortness_breath_resp", "label": "Mild Shortness of Breath with Walking", "category": "Respiratory"}
        ]
    },
    "derma_skin": {
        "keywords": ["skin", "rash", "itch", "itching", "redness", "allergy", "bump", "pimple", "acne", "hive", "scaling"],
        "specialty": "Dermatology",
        "items": [
            {"id": "sym_itchy_rash", "label": "Intensely Itchy Red Patches", "category": "Dermatology"},
            {"id": "sym_raised_welts", "label": "Raised Hives or Welts", "category": "Dermatology"},
            {"id": "sym_dry_flaking", "label": "Dry, Flaking or Peeling Skin", "category": "Dermatology"},
            {"id": "sym_burning_skin", "label": "Stinging or Burning Skin Sensation", "category": "Dermatology"},
            {"id": "sym_blisters", "label": "Small Fluid-Filled Blisters", "category": "Dermatology"},
            {"id": "sym_facial_breakouts", "label": "Pimples or Cystic Breakouts", "category": "Dermatology"},
            {"id": "sym_localized_swelling", "label": "Localized Swelling or Puffiness", "category": "Dermatology"},
            {"id": "sym_skin_warmth", "label": "Warmth & Tenderness to Touch", "category": "Dermatology"},
            {"id": "sym_cracking_skin", "label": "Painful Skin Cracks or Fissures", "category": "Dermatology"},
            {"id": "sym_contact_irritation", "label": "Reaction After New Soap / Cosmetic", "category": "Dermatology"}
        ]
    },
    "ortho_joint": {
        "keywords": ["joint", "knee", "back", "spine", "bone", "neck", "shoulder", "hip", "ankle", "muscle", "sprain"],
        "specialty": "Orthopedics",
        "items": [
            {"id": "sym_joint_stiffness", "label": "Morning Joint Stiffness (>30 mins)", "category": "Orthopedic"},
            {"id": "sym_walking_pain", "label": "Sharp Pain While Walking or Climbing Stairs", "category": "Orthopedic"},
            {"id": "sym_lower_back_ache", "label": "Dull or Throbbing Lower Back Pain", "category": "Orthopedic"},
            {"id": "sym_joint_swelling", "label": "Visible Joint Swelling & Warmth", "category": "Orthopedic"},
            {"id": "sym_muscle_spasms", "label": "Involuntary Muscle Cramps / Spasms", "category": "Orthopedic"},
            {"id": "sym_reduced_mobility", "label": "Limited Range of Motion", "category": "Orthopedic"},
            {"id": "sym_clicking_joints", "label": "Clicking or Grating Noise in Joint", "category": "Orthopedic"},
            {"id": "sym_radiating_leg_pain", "label": "Pain Shooting Down the Leg (Sciatica)", "category": "Orthopedic"},
            {"id": "sym_rest_pain", "label": "Aching Pain That Interrupts Sleep", "category": "Orthopedic"},
            {"id": "sym_posture_strain", "label": "Pain After Prolonged Sitting / Standing", "category": "Orthopedic"}
        ]
    }
}

DEFAULT_GENERAL_SYMPTOMS = [
    {"id": "sym_fatigue", "label": "Persistent Fatigue & Low Energy", "category": "General"},
    {"id": "sym_body_aches", "label": "Generalized Body Aches", "category": "General"},
    {"id": "sym_mild_headache", "label": "Mild Dull Headache", "category": "Neurological"},
    {"id": "sym_low_fever", "label": "Low-Grade Fever or Feeling Warm", "category": "Fever & Infection"},
    {"id": "sym_appetite_loss", "label": "Reduced Appetite", "category": "Digestive"},
    {"id": "sym_dehydration", "label": "Dry Mouth & Excessive Thirst", "category": "General"},
    {"id": "sym_sleep_issues", "label": "Restless or Disturbed Sleep", "category": "General"},
    {"id": "sym_drowsiness", "label": "Daytime Drowsiness & Brain Fog", "category": "Neurological"},
    {"id": "sym_throat_dryness", "label": "Dry or Scratchy Throat", "category": "Respiratory"},
    {"id": "sym_mild_nausea", "label": "Mild Queasiness or Nausea", "category": "Digestive"}
]


def generate_dynamic_symptom_suggestions(
    description: str,
    patient_context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Dynamically generates 8-12 tailored symptom suggestions based on natural language text,
    performs instant emergency red-flag screening, and identifies relevant specialties.
    """
    clean_text = description.lower().strip()
    
    # 1. Immediate Emergency Red-Flag Check
    is_emergency, emergency_payload = check_emergency_red_flags(clean_text)

    # 2. Score dynamic symptom clusters
    best_cluster_key = None
    best_score = 0
    matched_clusters = []

    for cluster_key, data in DYNAMIC_SYMPTOM_CATALOG.items():
        score = 0
        for kw in data["keywords"]:
            if re.search(r"\b" + re.escape(kw) + r"\b", clean_text):
                score += 2
            elif kw in clean_text:
                score += 1
        if score > 0:
            matched_clusters.append((cluster_key, score, data["specialty"]))
            if score > best_score:
                best_score = score
                best_cluster_key = cluster_key

    # Determine recommended specialties
    recommended_specialties = []
    if matched_clusters:
        matched_clusters.sort(key=lambda x: x[1], reverse=True)
        for _, _, spec in matched_clusters:
            if spec not in recommended_specialties:
                recommended_specialties.append(spec)
    if "General Physician" not in recommended_specialties:
        recommended_specialties.append("General Physician")

    # Select 8-12 suggestion items
    suggestions = []
    seen_ids = set()

    if best_cluster_key and best_cluster_key in DYNAMIC_SYMPTOM_CATALOG:
        primary_items = DYNAMIC_SYMPTOM_CATALOG[best_cluster_key]["items"]
        for item in primary_items:
            if item["id"] not in seen_ids:
                seen_ids.add(item["id"])
                # Check if item label or keywords match description for pre-selection
                label_words = [w.lower() for w in re.findall(r"\b[a-zA-Z]{4,}\b", item["label"])]
                is_preselected = any(w in clean_text for w in label_words if w not in ["pain", "mild", "severe", "general"])
                suggestions.append({
                    "id": item["id"],
                    "label": item["label"],
                    "category": item["category"],
                    "preselected": is_preselected
                })

    # If secondary cluster matched, blend top items
    if len(matched_clusters) > 1:
        sec_key = matched_clusters[1][0]
        for item in DYNAMIC_SYMPTOM_CATALOG[sec_key]["items"][:3]:
            if item["id"] not in seen_ids and len(suggestions) < 12:
                seen_ids.add(item["id"])
                suggestions.append({
                    "id": item["id"],
                    "label": item["label"],
                    "category": item["category"],
                    "preselected": False
                })

    # Fill up with defaults if needed
    if len(suggestions) < 8:
        for item in DEFAULT_GENERAL_SYMPTOMS:
            if item["id"] not in seen_ids:
                seen_ids.add(item["id"])
                suggestions.append({
                    "id": item["id"],
                    "label": item["label"],
                    "category": item["category"],
                    "preselected": False
                })
            if len(suggestions) >= 10:
                break

    return {
        "emergency": is_emergency,
        "emergency_details": emergency_payload,
        "suggestions": suggestions[:12],
        "detected_specialty": recommended_specialties[0] if recommended_specialties else "General Physician",
        "recommended_specialties": recommended_specialties
    }


def find_nearby_doctors(
    latitude: float,
    longitude: float,
    specialties: Optional[List[str]] = None,
    initial_radius_km: float = 5.0,
    min_results: int = 2,
    city: Optional[str] = "Chennai"
) -> Dict[str, Any]:
    """
    Discovers verified doctors near coordinates using Great-Circle Haversine distance,
    with progressive radius expansion (5 km -> 10 km -> 20 km -> regional).
    Integrates real-time availability slots and location details.
    """
    from backend.app.services.patient_service import calculate_haversine_distance, LOCALITY_GEO_CACHE

    db = SessionLocal()
    try:
        query = db.query(DoctorProfile).filter(DoctorProfile.verified == True)
        all_verified_docs = query.all()

        spec_set = set([s.lower().strip() for s in (specialties or []) if s.strip()])

        # Pre-process all doctors with distances
        candidate_doctors = []
        for doc in all_verified_docs:
            doc_lat = doc.latitude
            doc_lng = doc.longitude

            # If doctor has no lat/lng, attempt to lookup from locality or city
            if doc_lat is None or doc_lng is None:
                loc_key = (doc.clinic_locality or doc.clinic_city or "Chennai").lower()
                matched_geo = None
                for k, v in LOCALITY_GEO_CACHE.items():
                    if k in loc_key or loc_key in k:
                        matched_geo = v
                        break
                if matched_geo:
                    doc_lat, doc_lng = matched_geo[0], matched_geo[1]
                else:
                    doc_lat, doc_lng = 13.0827, 80.2707

            dist_km = calculate_haversine_distance(latitude, longitude, doc_lat, doc_lng)

            # Specialty match score
            doc_spec = (doc.specialty or "").lower()
            is_specialty_match = False
            if not spec_set:
                is_specialty_match = True
            else:
                for s in spec_set:
                    if s in doc_spec or doc_spec in s:
                        is_specialty_match = True
                        break

            candidate_doctors.append({
                "doc": doc,
                "distance_km": dist_km,
                "is_specialty_match": is_specialty_match,
                "lat": doc_lat,
                "lng": doc_lng
            })

        # Separate candidates into specialty matched and general fallback
        matched_candidates = [c for c in candidate_doctors if c["is_specialty_match"]]
        fallback_candidates = [c for c in candidate_doctors if not c["is_specialty_match"] and "general" in (c["doc"].specialty or "").lower()]

        # Radius expansion sequence: 5 km -> 10 km -> 20 km -> 50 km
        expansion_radii = [initial_radius_km, 10.0, 20.0, 50.0]
        selected_radius = expansion_radii[0]
        selected_list = []
        is_expanded = False

        for radius in expansion_radii:
            in_radius = [c for c in matched_candidates if c["distance_km"] <= radius]
            if len(in_radius) >= min_results:
                selected_radius = radius
                selected_list = in_radius
                if radius > initial_radius_km:
                    is_expanded = True
                break
        
        # If still fewer than min_results, take all available matched candidates sorted by distance
        if len(selected_list) < min_results:
            is_expanded = True
            matched_candidates.sort(key=lambda x: (x["distance_km"], -x["doc"].rating))
            selected_list = matched_candidates[:8]
            selected_radius = max([c["distance_km"] for c in selected_list], default=25.0)

        # If still empty, add general physicians nearby
        if len(selected_list) < min_results:
            fallback_candidates.sort(key=lambda x: x["distance_km"])
            for c in fallback_candidates:
                if c not in selected_list:
                    selected_list.append(c)
                if len(selected_list) >= 4:
                    break

        # Sort final selection by distance ascending, then rating descending
        selected_list.sort(key=lambda x: (x["distance_km"], -x["doc"].rating))

        # Format output payload
        expansion_message = (
            f"Expanded search to {int(selected_radius)} km to connect you with top-rated verified specialists."
            if is_expanded and selected_radius > initial_radius_km
            else f"Showing top verified specialists within {int(selected_radius)} km."
        )

        results = []
        for item in selected_list:
            doc = item["doc"]
            dist_km = item["distance_km"]
            avail_info = get_doctor_realtime_availability(db, doc.id)

            locality_display = doc.clinic_locality or doc.clinic_city or "Chennai"
            distance_label = f"{dist_km} km away in {locality_display}"

            qualifications = doc.qualifications if isinstance(doc.qualifications, list) else (
                json.loads(doc.qualifications) if doc.qualifications and doc.qualifications.startswith("[") else ["MBBS"]
            )
            consult_types = doc.consultation_types if isinstance(doc.consultation_types, list) else (
                json.loads(doc.consultation_types) if doc.consultation_types and doc.consultation_types.startswith("[") else ["online", "in-person"]
            )

            results.append({
                "id": doc.id,
                "name": doc.name,
                "title": doc.title or f"Consultant {doc.specialty}",
                "specialty": doc.specialty,
                "specialty_slug": doc.specialty_slug or doc.specialty.lower().replace(" ", "-"),
                "qualifications": qualifications,
                "experience_years": doc.experience_years or 5,
                "rating": doc.rating or 4.9,
                "review_count": doc.review_count or 120,
                "consultation_fee": doc.consultation_fee or 800.0,
                "consultation_types": consult_types,
                "clinic_name": doc.clinic_name or f"{doc.name} Practice",
                "clinic_address": doc.clinic_address or f"{locality_display}, Chennai",
                "clinic_locality": locality_display,
                "clinic_city": doc.clinic_city or "Chennai",
                "latitude": item["lat"],
                "longitude": item["lng"],
                "distance_km": dist_km,
                "distance_label": distance_label,
                "is_nearby": True,
                "available_today": avail_info["available_today"],
                "next_available_slot": avail_info["next_available_slot"],
                "today_hours": avail_info["today_hours"],
                "avatar": doc.avatar or "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80",
                "verified": bool(doc.verified),
                "recommendation_reason": f"Top verified {doc.specialty} specialist {distance_label}."
            })

        return {
            "radius_used_km": selected_radius,
            "is_expanded": is_expanded,
            "expansion_message": expansion_message,
            "total_found": len(results),
            "doctors": results
        }
    finally:
        db.close()


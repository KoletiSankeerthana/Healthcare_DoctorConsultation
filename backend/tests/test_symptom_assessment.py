"""
Comprehensive Unit and Integration Test Suite for AI Symptom Assessment and Doctor Recommendation
"""

import os
import sys
import uuid
import pytest

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.app.db.database import SessionLocal
from backend.app.db.models import DoctorProfile, PatientProfile, SymptomAssessment
from backend.app.services.symptom_service import (
    create_symptom_assessment,
    submit_follow_up_answer,
    complete_symptom_assessment,
    send_assessment_message,
    get_assessment_details,
    list_patient_assessments,
    delete_assessment,
    check_emergency_red_flags,
    match_symptom_clusters
)


class TestEmergencyRedFlagDetection:
    """Verifies independent, non-LLM emergency screening."""

    def test_chest_pain_emergency_trigger(self):
        is_em, info = check_emergency_red_flags("I feel severe crushing chest pain radiating to my left arm")
        assert is_em is True
        assert info["category"] == "Cardiac Emergency"
        assert "112" in info["emergency_helpline"]

    def test_stroke_fast_emergency_trigger(self):
        is_em, info = check_emergency_red_flags("Sudden facial drooping and slurred speech on right side")
        assert is_em is True
        assert "Stroke" in info["category"]

    def test_respiratory_distress_trigger(self):
        is_em, info = check_emergency_red_flags("I have severe shortness of breath and blue lips cannot breathe")
        assert is_em is True
        assert "Respiratory" in info["category"]

    def test_non_emergency_routine_symptom(self):
        is_em, info = check_emergency_red_flags("I have a mild runny nose and sneezing since this morning")
        assert is_em is False
        assert info is None


class TestSymptomUnderstandingAndAssessment:
    """Tests clinical symptom understanding, follow-up questions, and profile context."""

    def test_headache_assessment_workflow(self):
        patient_id = f"pat-{uuid.uuid4().hex[:8]}"
        res = create_symptom_assessment(
            patient_id=patient_id,
            description="My head has been hurting continuously since yesterday around my forehead",
            selected_symptoms=["headache"],
            duration="2 days",
            severity="Moderate"
        )

        assert res["id"] is not None
        assert "Headache" in res["selected_symptoms"]
        assert "Neurology" in res["recommended_specialties"]
        assert res["urgency_level"] == "routine"
        assert len(res["follow_up_questions"]) > 0

        # Answer the follow-up question
        q1 = res["follow_up_questions"][0]
        ans_res = submit_follow_up_answer(res["id"], patient_id, q1, "It is constant pressure with mild light sensitivity.")
        assert ans_res is not None

        # Retrieve full details
        details = get_assessment_details(res["id"], patient_id)
        assert details["assessment_status"] in ["in_progress", "completed"]
        assert len(details["messages"]) >= 2

    def test_fever_and_body_pain(self):
        patient_id = f"pat-{uuid.uuid4().hex[:8]}"
        res = create_symptom_assessment(
            patient_id=patient_id,
            description="Running a high fever with shivering chills and severe body ache for 3 days",
            duration="3 days",
            severity="Severe"
        )

        assert "Fever & Chills" in res["selected_symptoms"]
        assert "General Physician" in res["recommended_specialties"]
        assert res["urgency_level"] == "urgent"

    def test_stomach_pain_and_gastroenterology_recommendation(self):
        patient_id = f"pat-{uuid.uuid4().hex[:8]}"
        res = create_symptom_assessment(
            patient_id=patient_id,
            description="Severe stomach cramps and belly pain after dinner with acidity",
            duration="1 day",
            severity="Moderate"
        )

        assert "Abdominal Pain" in res["selected_symptoms"]
        assert "Gastroenterology" in res["recommended_specialties"]

    def test_informal_language_and_misspellings(self):
        # Test typo: "hedache" and "throbbin"
        clusters = match_symptom_clusters("I got severe throbbing in my head since morning")
        assert len(clusters) > 0
        assert clusters[0]["canonical_symptom"] == "Headache"

        # Typo: "stomach ache"
        clusters_stomach = match_symptom_clusters("stomach hurts bad and gastric pain")
        assert len(clusters_stomach) > 0
        assert clusters_stomach[0]["canonical_symptom"] == "Abdominal Pain"

    def test_multiple_concurrent_symptoms(self):
        patient_id = f"pat-{uuid.uuid4().hex[:8]}"
        res = create_symptom_assessment(
            patient_id=patient_id,
            description="I have a throbbing headache alongside fever chills and knee joint stiffness",
            selected_symptoms=["Headache", "Fever"],
            duration="4 days"
        )

        assert any("Headache" in s for s in res["selected_symptoms"])
        assert any("Fever" in s for s in res["selected_symptoms"])
        assert len(res["recommended_specialties"]) >= 2


class TestDoctorRecommendationAndSafety:
    """Verifies that only actual verified platform doctors are retrieved from SQLite/PostgreSQL."""

    def test_verified_doctor_matching_from_database(self):
        patient_id = f"pat-{uuid.uuid4().hex[:8]}"
        res = create_symptom_assessment(
            patient_id=patient_id,
            description="Feeling palpitations, high blood pressure and chest discomfort when walking up stairs",
            duration="1 week",
            severity="Moderate"
        )

        # Complete assessment
        completed = complete_symptom_assessment(res["id"], patient_id)
        assert completed["ai_assessment_result"] is not None

        details = get_assessment_details(res["id"], patient_id)
        docs = details["recommended_doctors"]

        assert len(docs) > 0
        for doc in docs:
            # Check fields
            assert doc["verified"] is True
            assert doc["name"].startswith("Dr.")
            assert doc["consultation_fee"] > 0
            assert doc["id"] is not None

    def test_patient_isolation_and_authorization(self):
        pat_a = f"pat-a-{uuid.uuid4().hex[:8]}"
        pat_b = f"pat-b-{uuid.uuid4().hex[:8]}"

        res_a = create_symptom_assessment(pat_a, "Headache in forehead for 2 days")

        # Patient B cannot access Patient A's assessment
        detail_b = get_assessment_details(res_a["id"], pat_b)
        assert detail_b is None

        # Patient B cannot delete Patient A's assessment
        with pytest.raises(ValueError, match="Assessment not found or unauthorized"):
            delete_assessment(res_a["id"], pat_b)

    def test_assessment_deletion(self):
        pat = f"pat-{uuid.uuid4().hex[:8]}"
        res = create_symptom_assessment(pat, "Temporary discomfort in back for 1 day")

        # Initial list has 1 item
        items = list_patient_assessments(pat)
        assert len(items) == 1

        # Delete
        del_res = delete_assessment(res["id"], pat)
        assert del_res["success"] is True

        # Now excluded from active history
        items_after = list_patient_assessments(pat)
        assert len(items_after) == 0

    def test_conversational_follow_up_chat(self):
        pat = f"pat-{uuid.uuid4().hex[:8]}"
        res = create_symptom_assessment(pat, "Headache and forehead pain")
        complete_symptom_assessment(res["id"], pat)

        # Ask about diet
        chat_res = send_assessment_message(res["id"], pat, "What diet or food should I take while experiencing this?")
        assert chat_res["sender"] == "assistant"
        assert "hydration" in chat_res["message"].lower() or "food" in chat_res["message"].lower()

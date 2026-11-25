"""
FastAPI Router: AI Symptom Assessment & Clinical Triage
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from backend.app.services.symptom_service import (
    generate_dynamic_symptom_suggestions,
    create_symptom_assessment,
    get_assessment_details,
    list_patient_assessments,
    submit_follow_up_answer,
    send_assessment_message,
    find_nearby_doctors,
    delete_assessment
)

router = APIRouter(prefix="/symptom-assessments", tags=["AI Symptom Assessment"])

class DynamicSymptomsRequest(BaseModel):
    description: str
    patient_context: Optional[Dict[str, Any]] = None

class AssessmentCreateRequest(BaseModel):
    patient_id: Optional[str] = "pat-101"
    primary_concern: str
    description: str
    selected_symptoms: List[str] = []
    duration: str = "2-3 days"
    severity: str = "Moderate"
    progression: str = "unchanged"
    started_at: str = "Gradual onset"
    patient_latitude: Optional[float] = 12.9815
    patient_longitude: Optional[float] = 80.2180
    patient_locality: Optional[str] = "Velachery"
    patient_city: Optional[str] = "Chennai"

class FollowupAnswerRequest(BaseModel):
    question: str
    answer: str

class ChatMessageRequest(BaseModel):
    message: str

@router.post("/suggest-symptoms")
def suggest_dynamic_symptoms(payload: DynamicSymptomsRequest):
    """Extract clinical symptom suggestions from patient's natural language health concern."""
    return generate_dynamic_symptom_suggestions(payload.description, payload.patient_context or {})

@router.post("")
def create_assessment(payload: AssessmentCreateRequest):
    """Initiate a full clinical symptom assessment and generate guidance and precautions."""
    return create_symptom_assessment(payload.model_dump())

@router.get("")
def list_assessments(patient_id: str = Query("pat-101", description="Patient identifier")):
    """List historical clinical assessments for the patient."""
    return list_patient_assessments(patient_id)

@router.get("/{assessment_id}")
def get_assessment(assessment_id: str, patient_id: str = Query("pat-101")):
    """Retrieve full clinical assessment details, questions, answers, and guidance."""
    result = get_assessment_details(assessment_id, patient_id)
    if not result:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return result

@router.post("/{assessment_id}/answers")
def answer_followup(assessment_id: str, payload: FollowupAnswerRequest, patient_id: str = Query("pat-101")):
    """Submit an answer to an AI clarifying follow-up question."""
    res = submit_follow_up_answer(assessment_id, patient_id, payload.question, payload.answer)
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to submit answer"))
    return res

@router.post("/{assessment_id}/messages")
def send_chat_message(assessment_id: str, payload: ChatMessageRequest, patient_id: str = Query("pat-101")):
    """Send an interactive follow-up question within the active assessment session."""
    return send_assessment_message(assessment_id, patient_id, payload.message)

@router.get("/{assessment_id}/doctors")
def get_assessment_recommended_doctors(
    assessment_id: str,
    lat: float = Query(12.9815, description="Patient GPS latitude"),
    lng: float = Query(80.2180, description="Patient GPS longitude"),
    specialties: Optional[str] = Query(None, description="Comma-separated specialty filters")
):
    """Find verified nearby doctors based on the assessment's clinical recommendations."""
    specs = [s.strip() for s in specialties.split(",")] if specialties else []
    return find_nearby_doctors(lat=lat, lng=lng, recommended_specialties=specs)

@router.delete("/{assessment_id}")
def remove_assessment(assessment_id: str, patient_id: str = Query("pat-101")):
    """Remove a historical assessment from patient records."""
    res = delete_assessment(assessment_id, patient_id)
    if not res.get("success"):
        raise HTTPException(status_code=404, detail=res.get("error", "Assessment not found"))
    return res

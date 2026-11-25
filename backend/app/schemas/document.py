from __future__ import annotations
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

# --- Laboratory & Prescription Item Schemas ---

class LaboratoryResultSchema(BaseModel):
    id: str
    parameter_name: str
    normalized_name: str
    result_value: str
    numeric_value: Optional[float] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    ref_low: Optional[float] = None
    ref_high: Optional[float] = None
    flag: str = "unspecified" # "normal", "low", "high", "abnormal", "unspecified"
    specimen: Optional[str] = None
    page_number: int = 1
    original_text_snippet: Optional[str] = None
    confidence: float = 1.0
    requires_verification: bool = False
    user_corrected: Optional[bool] = False

    class Config:
        from_attributes = True


class PrescriptionItemSchema(BaseModel):
    id: str
    medication_name: str
    generic_name: Optional[str] = None
    strength: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    route: str = "Oral"
    special_instructions: Optional[str] = None
    prescribing_doctor: Optional[str] = None
    page_number: int = 1
    confidence: float = 1.0
    requires_verification: bool = False
    user_corrected: Optional[bool] = False

    class Config:
        from_attributes = True


# --- Document Analysis Schemas ---

class ParameterExplanation(BaseModel):
    parameter: str
    value: str
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    status: str # "Within Normal Range", "Below Reference Range", "Above Reference Range", "Attention Required"
    what_it_measures: str
    clinical_context: str
    what_it_cannot_establish: str


class MedicalTermGlossary(BaseModel):
    term: str
    simple_explanation: str


class ReportObservation(BaseModel):
    type: str # "abnormal_value", "critical_finding", "information_gap", "positive_indicator"
    observation: str
    severity: str # "info", "attention", "notable"


class DocumentAnalysisSchema(BaseModel):
    id: str
    document_id: str
    simple_summary: str
    important_findings: List[str]
    parameter_explanations: List[ParameterExplanation] = []
    medical_terminology: List[MedicalTermGlossary] = []
    report_observations: List[ReportObservation] = []
    what_patient_should_understand: str
    questions_for_doctor: List[str]
    suggested_next_steps: List[str]
    emergency_warning: Optional[str] = None
    disclaimer: str
    language: Optional[str] = "en"
    model_used: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Document Extraction Response ---

class ExtractedDataSchema(BaseModel):
    document_id: str
    raw_text: str
    page_count: int
    extraction_method: str
    extraction_confidence: float
    uncertain_fields_count: int
    laboratory_results: List[LaboratoryResultSchema] = []
    prescription_items: List[PrescriptionItemSchema] = []
    pages: List[DocumentPageSchema] = []
    tables: List[ExtractedTableSchema] = []
    verification: Optional[ExtractionVerificationSchema] = None
    radiology: Optional[RadiologyReportSchema] = None
    discharge_summary: Optional[DischargeSummarySchema] = None

    class Config:
        from_attributes = True


# --- Document Core Schemas ---

class DocumentSummarySchema(BaseModel):
    id: str
    patient_id: str
    title: str
    original_filename: str
    document_category: str
    sub_classification: Optional[str] = None
    classification_confidence: float = 0.0
    issuing_facility: Optional[str] = None
    report_date: Optional[str] = None
    page_count: int = 1
    file_size_bytes: int
    mime_type: str
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentDetailSchema(DocumentSummarySchema):
    classification_reasoning: Optional[str] = None
    patient_name_in_doc: Optional[str] = None
    patient_age_value: Optional[str] = None
    patient_age_unit: Optional[str] = None
    patient_dob: Optional[str] = None
    patient_gender: Optional[str] = None
    patient_uhid: Optional[str] = None
    referring_doctor: Optional[str] = None
    sample_collection_date: Optional[str] = None
    specimen_type: Optional[str] = None
    demographics_json: Optional[Dict[str, Any]] = None
    is_encrypted: bool = False
    laboratory_results: List[LaboratoryResultSchema] = []
    prescription_items: List[PrescriptionItemSchema] = []
    pages: List[DocumentPageSchema] = []
    tables: List[ExtractedTableSchema] = []
    verification: Optional[ExtractionVerificationSchema] = None
    radiology: Optional[RadiologyReportSchema] = None
    discharge_summary: Optional[DischargeSummarySchema] = None
    analysis: Optional[DocumentAnalysisSchema] = None

    class Config:
        from_attributes = True


class DocumentCorrectionRequest(BaseModel):
    field_type: str # "lab_result", "prescription", "metadata", "category"
    target_id: Optional[str] = None
    field_name: str
    corrected_value: str
    reason: Optional[str] = None


class DocumentCorrectionResponse(BaseModel):
    id: str
    document_id: str
    field_name: str
    original_value: Optional[str]
    corrected_value: str
    created_at: datetime


# --- Multiple Report Comparison Schemas ---

class ParameterDataPoint(BaseModel):
    date: str
    document_id: str
    document_title: str
    value: str
    numeric_value: Optional[float] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    status: str # "normal", "low", "high"


class ParameterTrend(BaseModel):
    parameter_name: str
    normalized_name: str
    unit: Optional[str] = None
    trend_direction: str # "stable", "increasing", "decreasing", "fluctuating", "insufficient_data"
    datapoints: List[ParameterDataPoint]
    clinical_note: str


class ReportComparisonRequest(BaseModel):
    document_ids: List[str]


class ReportComparisonResponse(BaseModel):
    compared_document_ids: List[str]
    document_summaries: List[DocumentSummarySchema]
    matching_parameters: List[ParameterTrend]
    summary_of_trends: str
    clinical_disclaimer: str


# --- Multi-Page, Table, and Block Extraction Schemas ---

class ExtractedTextBlockSchema(BaseModel):
    id: str
    page_number: int
    block_index: int
    bbox_x0: float = 0.0
    bbox_y0: float = 0.0
    bbox_x1: float = 0.0
    bbox_y1: float = 0.0
    text: str
    block_type: str = "paragraph"
    confidence: float = 1.0

    class Config:
        from_attributes = True


class ExtractedTableSchema(BaseModel):
    id: str
    page_number: int
    table_index: int = 0
    headers: Optional[List[str]] = None
    row_count: int = 0
    col_count: int = 0
    table_data: Optional[List[List[Any]]] = None
    bbox: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class DocumentPageSchema(BaseModel):
    id: str
    page_number: int
    is_scanned: bool = False
    ocr_applied: bool = False
    text_content: str = ""
    char_count: int = 0
    page_status: str = "processed"
    confidence: float = 1.0
    error_message: Optional[str] = None
    blocks: List[ExtractedTextBlockSchema] = []
    tables: List[ExtractedTableSchema] = []

    class Config:
        from_attributes = True


class ExtractionVerificationSchema(BaseModel):
    total_pages: int = 1
    processed_pages: int = 1
    failed_pages: List[int] = []
    uncertain_fields_count: int = 0
    verification_status: str = "verified"
    accuracy_score: float = 1.0
    notes: Optional[str] = None

    class Config:
        from_attributes = True


# --- Specialized Clinical Schemas ---

class RadiologyReportSchema(BaseModel):
    modality: str
    body_part: str
    clinical_indication: Optional[str] = None
    technique: Optional[str] = None
    findings: str
    impression: str
    recommendations: Optional[str] = None
    radiologist_info: Optional[str] = None

    class Config:
        from_attributes = True


class DischargeSummarySchema(BaseModel):
    hospital_name: Optional[str] = None
    admission_date: Optional[str] = None
    discharge_date: Optional[str] = None
    diagnoses: List[str] = []
    procedures: List[str] = []
    treatments: List[str] = []
    discharge_instructions: List[str] = []
    follow_up_recommendations: List[str] = []

    class Config:
        from_attributes = True


# --- Document-Grounded Q&A Schemas ---

class DocumentQARequest(BaseModel):
    question: str
    conversation_history: Optional[List[Dict[str, str]]] = []


class DocumentQAResponse(BaseModel):
    question: str
    answer: str
    intent: Optional[str] = None
    source_citations: List[Dict[str, Any]] = []
    confidence: float = 1.0
    found_in_document: bool = True
    suggested_followups: Optional[List[str]] = []
    recommended_specialties: Optional[List[str]] = []


# --- Intelligent Doctor Recommendation Schemas ---

class RecommendedDoctorSchema(BaseModel):
    id: str
    name: str
    title: str
    specialty: str
    specialty_slug: Optional[str] = None
    qualifications: List[str] = []
    experience_years: int = 5
    rating: float = 4.8
    review_count: int = 100
    consultation_fee: float = 800.0
    consultation_types: List[str] = ["online", "in-person"]
    city: Optional[str] = "Available Online"
    avatar: Optional[str] = None
    relevance_reason: str
    availability_summary: Optional[str] = "Available Today"
    verified: bool = True

    class Config:
        from_attributes = True


class DoctorRecommendationResponse(BaseModel):
    document_id: str
    findings_summary: str
    primary_specialty: str
    secondary_specialties: List[str] = []
    clinical_rationale: str
    recommended_doctors: List[RecommendedDoctorSchema] = []
    urgent_care_needed: bool = False
    urgent_warning: Optional[str] = None

    class Config:
        from_attributes = True


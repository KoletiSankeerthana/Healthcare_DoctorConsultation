from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class DoctorPersonalInfoSchema(BaseModel):
    full_name: str
    email: str
    phone: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    residential_address: Optional[str] = None
    photo_url: Optional[str] = None

class DoctorProfessionalInfoSchema(BaseModel):
    specialty: str
    highest_qualification: str
    university: str
    graduation_year: int
    experience_years: int = 1
    current_hospital: Optional[str] = None
    previous_experience: Optional[str] = None
    consultation_modes: List[str] = ["online", "in-person"]
    languages: List[str] = ["English"]
    consultation_fee: float = 800.0
    biography: Optional[str] = None

class DoctorRegistrationInfoSchema(BaseModel):
    registration_number: str
    issuing_council: str # e.g. "National Medical Commission", "State Medical Council"
    state_council: str # e.g. "Karnataka Medical Council", "Delhi Medical Council"
    registration_date: Optional[str] = None
    validity_details: Optional[str] = None
    primary_qualification: str # "MBBS"
    specialization_qualification: Optional[str] = None # "MD", "MS", "DNB"

class DoctorEligibilityChecklistSchema(BaseModel):
    mandatory_info_completed: bool = False
    required_docs_uploaded: bool = False
    registration_provided: bool = False
    qualifications_documented: bool = False
    specialization_evidence: bool = False
    files_readable: bool = True

class DoctorRegisterRequest(BaseModel):
    personal_info: DoctorPersonalInfoSchema
    professional_info: DoctorProfessionalInfoSchema
    registration_info: DoctorRegistrationInfoSchema
    password: str
    eligibility_checklist: Optional[DoctorEligibilityChecklistSchema] = None

class DoctorCredentialDocumentSchema(BaseModel):
    id: str
    application_id: str
    document_type: str
    document_name: str
    original_filename: str
    secure_storage_key: str
    mime_type: str
    file_size: int
    is_mandatory: bool
    uploaded_at: datetime
    review_status: str
    reviewer_id: Optional[str] = None
    reviewer_comments: Optional[str] = None
    reviewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class DoctorVerificationReviewSchema(BaseModel):
    id: str
    application_id: str
    admin_id: str
    action: str
    reason_category: Optional[str] = None
    justification: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class DoctorVerificationHistorySchema(BaseModel):
    id: str
    application_id: str
    previous_status: str
    new_status: str
    changed_by: str
    reason: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class DoctorVerificationApplicationSummarySchema(BaseModel):
    id: str
    doctor_id: str
    application_reference: str
    doctor_name: str
    doctor_email: str
    specialty: str
    registration_number: str
    issuing_council: str
    highest_qualification: str
    experience_years: int
    status: str
    submitted_at: Optional[datetime] = None
    created_at: datetime
    documents_count: int = 0
    mandatory_documents_verified: bool = False

    class Config:
        from_attributes = True

class DoctorVerificationApplicationDetailSchema(BaseModel):
    id: str
    doctor_id: str
    application_reference: str
    status: str
    personal_info: Dict[str, Any]
    professional_info: Dict[str, Any]
    registration_info: Dict[str, Any]
    eligibility_checklist: Optional[Dict[str, Any]] = None
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    assigned_admin_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    documents: List[DoctorCredentialDocumentSchema] = []
    reviews: List[DoctorVerificationReviewSchema] = []
    history: List[DoctorVerificationHistorySchema] = []

    class Config:
        from_attributes = True

class DoctorDocumentReviewRequest(BaseModel):
    review_status: str # "verified", "invalid", "replacement_requested", "flagged_manual"
    reviewer_comments: Optional[str] = None

class DoctorDecisionRequest(BaseModel):
    action: str # "approve", "reject", "request_additional_documents", "return_for_correction"
    reason_category: Optional[str] = None # required if reject
    justification: Optional[str] = None # required if reject or request_additional_documents
    admin_id: str = "admin-gov-1"

class DoctorVerificationStatsSchema(BaseModel):
    total_applications: int = 0
    pending_review: int = 0
    under_review: int = 0
    additional_documents_required: int = 0
    resubmission_required: int = 0
    approved: int = 0
    rejected: int = 0
    suspended: int = 0

class DoctorNotificationSchema(BaseModel):
    id: str
    doctor_id: str
    title: str
    message: str
    type: str
    action_url: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

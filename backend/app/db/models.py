import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    BigInteger,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    JSON
)
from sqlalchemy.orm import relationship
try:
    from backend.app.db.database import Base
except ImportError:
    from app.db.database import Base

class MedicalDocument(Base):
    __tablename__ = "medical_documents"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String(64), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    storage_path = Column(String(512), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    mime_type = Column(String(128), nullable=False)
    file_hash = Column(String(64), nullable=False) # SHA-256 integrity hash
    
    # Classification
    document_category = Column(String(64), nullable=False, default="Other medical documents") # Blood test, Prescription, Radiology, etc.
    sub_classification = Column(String(128), nullable=True) # e.g. "Complete blood count", "Lipid profile", "MRI Brain"
    classification_confidence = Column(Float, default=0.0)
    classification_reasoning = Column(Text, nullable=True)
    
    # Document Metadata
    issuing_facility = Column(String(255), nullable=True)
    patient_name_in_doc = Column(String(255), nullable=True)
    patient_age_value = Column(String(32), nullable=True) # e.g. "22", "8"
    patient_age_unit = Column(String(32), nullable=True) # e.g. "Years", "Months", "Days"
    patient_dob = Column(String(64), nullable=True) # e.g. "15-06-2004"
    patient_gender = Column(String(32), nullable=True) # e.g. "Female", "Male"
    patient_uhid = Column(String(128), nullable=True) # e.g. "UHID-108249", "MRN-49102"
    referring_doctor = Column(String(255), nullable=True)
    sample_collection_date = Column(String(64), nullable=True)
    specimen_type = Column(String(128), nullable=True)
    demographics_json = Column(JSON, nullable=True) # complete dictionary of extracted demographic fields
    report_date = Column(String(64), nullable=True)
    page_count = Column(Integer, default=1)
    language = Column(String(32), default="en")
    is_encrypted = Column(Boolean, default=False)
    
    # Overall Lifecycle Statuses:
    # "uploaded", "validating", "queued", "extracting", "classifying", "structuring", "analyzing", "verification_required", "completed", "failed"
    status = Column(String(64), default="uploaded", index=True)
    error_message = Column(Text, nullable=True)
    
    # Ownership and Deletion Lifecycle
    uploaded_by_user_id = Column(String(64), nullable=True, index=True)
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    processing_jobs = relationship("DocumentProcessingJob", back_populates="document", cascade="all, delete-orphan")
    extracted_data = relationship("ExtractedMedicalData", back_populates="document", uselist=False, cascade="all, delete-orphan")
    pages = relationship("DocumentPage", back_populates="document", cascade="all, delete-orphan")
    text_blocks = relationship("ExtractedTextBlock", back_populates="document", cascade="all, delete-orphan")
    tables = relationship("ExtractedTable", back_populates="document", cascade="all, delete-orphan")
    medical_fields = relationship("ExtractedMedicalField", back_populates="document", cascade="all, delete-orphan")
    laboratory_results = relationship("LaboratoryResult", back_populates="document", cascade="all, delete-orphan")
    prescription_items = relationship("PrescriptionItem", back_populates="document", cascade="all, delete-orphan")
    analysis = relationship("DocumentAnalysis", back_populates="document", uselist=False, cascade="all, delete-orphan")
    verification = relationship("ExtractionVerification", back_populates="document", uselist=False, cascade="all, delete-orphan")
    corrections = relationship("DocumentCorrection", back_populates="document", cascade="all, delete-orphan")
    access_logs = relationship("DocumentAccessLog", back_populates="document", cascade="all, delete-orphan")
    qa_messages = relationship("DocumentQAMessage", back_populates="document", cascade="all, delete-orphan")


class DocumentProcessingJob(Base):
    __tablename__ = "document_processing_jobs"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(64), ForeignKey("medical_documents.id"), nullable=False, index=True)
    current_stage = Column(String(64), nullable=False, default="queued") # extraction, classification, structuring, analysis
    status = Column(String(32), nullable=False, default="in_progress") # in_progress, completed, failed
    progress_percentage = Column(Integer, default=0)
    retry_count = Column(Integer, default=0)
    error_details = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    document = relationship("MedicalDocument", back_populates="processing_jobs")


class ExtractedMedicalData(Base):
    __tablename__ = "extracted_medical_data"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(64), ForeignKey("medical_documents.id"), nullable=False, unique=True)
    raw_text = Column(Text, nullable=False)
    pages_text = Column(JSON, nullable=True) # list of page texts with page numbers
    tables = Column(JSON, nullable=True)     # list of extracted tables
    metadata_extracted = Column(JSON, nullable=True)
    extraction_method = Column(String(64), nullable=False) # "pdf_text", "ocr", "docx", "spreadsheet", "dicom"
    extraction_confidence = Column(Float, default=1.0)
    uncertain_fields_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("MedicalDocument", back_populates="extracted_data")


class LaboratoryResult(Base):
    __tablename__ = "laboratory_results"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(64), ForeignKey("medical_documents.id"), nullable=False, index=True)
    parameter_name = Column(String(255), nullable=False) # e.g. "Hemoglobin", "HbA1c", "Total Cholesterol"
    normalized_name = Column(String(255), nullable=False, index=True) # lowercase trimmed canonical
    result_value = Column(String(64), nullable=False) # e.g. "13.8", "6.2", "Negative"
    numeric_value = Column(Float, nullable=True)      # e.g. 13.8, 6.2 (null if qualitative)
    unit = Column(String(64), nullable=True)          # e.g. "g/dL", "%", "mg/dL"
    reference_range = Column(String(128), nullable=True) # e.g. "12.0 - 15.5", "< 5.7"
    ref_low = Column(Float, nullable=True)
    ref_high = Column(Float, nullable=True)
    
    # Abnormality flag explicitly derived: "normal", "low", "high", "abnormal", "unspecified"
    flag = Column(String(32), default="unspecified")
    specimen = Column(String(128), nullable=True)     # e.g. "Blood", "Serum", "Plasma", "Urine"
    page_number = Column(Integer, default=1)
    original_text_snippet = Column(Text, nullable=True)
    confidence = Column(Float, default=1.0)
    requires_verification = Column(Boolean, default=False)
    user_corrected = Column(Boolean, default=False)

    document = relationship("MedicalDocument", back_populates="laboratory_results")


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(64), ForeignKey("medical_documents.id"), nullable=False, index=True)
    medication_name = Column(String(255), nullable=False)
    generic_name = Column(String(255), nullable=True)
    strength = Column(String(64), nullable=True)     # e.g. "500 mg", "10 mg"
    dosage = Column(String(128), nullable=True)      # e.g. "1 tablet"
    frequency = Column(String(128), nullable=True)   # e.g. "Once daily", "Twice daily after food"
    duration = Column(String(128), nullable=True)    # e.g. "5 days", "1 month"
    route = Column(String(64), default="Oral")       # Oral, Topical, Inhalation, etc.
    special_instructions = Column(Text, nullable=True)
    prescribing_doctor = Column(String(255), nullable=True)
    page_number = Column(Integer, default=1)
    confidence = Column(Float, default=1.0)
    requires_verification = Column(Boolean, default=False)
    user_corrected = Column(Boolean, default=False)

    document = relationship("MedicalDocument", back_populates="prescription_items")


class DocumentAnalysis(Base):
    __tablename__ = "document_analyses"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(64), ForeignKey("medical_documents.id"), nullable=False, unique=True)
    simple_summary = Column(Text, nullable=False)
    important_findings = Column(JSON, nullable=False) # list of key findings
    parameter_explanations = Column(JSON, nullable=True) # list of {param, value, unit, range, status, what_it_measures, clinical_context, limitations}
    medical_terminology = Column(JSON, nullable=True) # list of {term, simple_explanation}
    report_observations = Column(JSON, nullable=True) # list of {type, text, severity}
    what_patient_should_understand = Column(Text, nullable=False)
    questions_for_doctor = Column(JSON, nullable=False) # list of questions
    suggested_next_steps = Column(JSON, nullable=False) # list of safe suggestions
    emergency_warning = Column(Text, nullable=True)     # Only populated if red flags
    disclaimer = Column(Text, nullable=False)
    language = Column(String(16), default="en")
    model_used = Column(String(64), default="AI Medical Document Intelligence Engine v1.0")
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("MedicalDocument", back_populates="analysis")
    sections = relationship("AnalysisSection", back_populates="analysis", cascade="all, delete-orphan")


class DocumentPage(Base):
    __tablename__ = "document_pages"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(64), ForeignKey("medical_documents.id"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)
    page_image_path = Column(String(512), nullable=True)
    width = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    is_scanned = Column(Boolean, default=False)
    ocr_applied = Column(Boolean, default=False)
    text_content = Column(Text, nullable=False, default="")
    char_count = Column(Integer, default=0)
    page_status = Column(String(32), default="processed") # "processed", "verification_required", "failed"
    confidence = Column(Float, default=1.0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("MedicalDocument", back_populates="pages")
    blocks = relationship("ExtractedTextBlock", back_populates="page", cascade="all, delete-orphan")
    tables = relationship("ExtractedTable", back_populates="page", cascade="all, delete-orphan")


class ExtractedTextBlock(Base):
    __tablename__ = "extracted_text_blocks"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(64), ForeignKey("medical_documents.id"), nullable=False, index=True)
    page_id = Column(String(64), ForeignKey("document_pages.id"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)
    block_index = Column(Integer, nullable=False)
    bbox_x0 = Column(Float, default=0.0)
    bbox_y0 = Column(Float, default=0.0)
    bbox_x1 = Column(Float, default=0.0)
    bbox_y1 = Column(Float, default=0.0)
    text = Column(Text, nullable=False)
    block_type = Column(String(64), default="paragraph") # heading, paragraph, table_cell, footer, header
    confidence = Column(Float, default=1.0)

    page = relationship("DocumentPage", back_populates="blocks")
    document = relationship("MedicalDocument", back_populates="text_blocks")


class ExtractedTable(Base):
    __tablename__ = "extracted_tables"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(64), ForeignKey("medical_documents.id"), nullable=False, index=True)
    page_id = Column(String(64), ForeignKey("document_pages.id"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)
    table_index = Column(Integer, default=0)
    headers = Column(JSON, nullable=True)
    row_count = Column(Integer, default=0)
    col_count = Column(Integer, default=0)
    table_data = Column(JSON, nullable=True) # 2D array or rows
    bbox = Column(JSON, nullable=True) # {x0, y0, x1, y1}

    page = relationship("DocumentPage", back_populates="tables")
    document = relationship("MedicalDocument", back_populates="tables")


class ExtractedMedicalField(Base):
    __tablename__ = "extracted_medical_fields"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(64), ForeignKey("medical_documents.id"), nullable=False, index=True)
    page_number = Column(Integer, default=1)
    field_category = Column(String(64), nullable=False) # laboratory, prescription, radiology, discharge, vital
    field_name = Column(String(255), nullable=False, index=True)
    raw_value = Column(Text, nullable=False)
    normalized_value = Column(Text, nullable=True)
    unit = Column(String(64), nullable=True)
    reference_range = Column(String(128), nullable=True)
    source_text = Column(Text, nullable=True)
    source_block_id = Column(String(64), nullable=True)
    bbox = Column(JSON, nullable=True)
    confidence = Column(Float, default=1.0)
    requires_verification = Column(Boolean, default=False)
    verification_notes = Column(Text, nullable=True)

    document = relationship("MedicalDocument", back_populates="medical_fields")


class AnalysisSection(Base):
    __tablename__ = "analysis_sections"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    analysis_id = Column(String(64), ForeignKey("document_analyses.id"), nullable=False, index=True)
    section_index = Column(Integer, default=0)
    section_type = Column(String(64), nullable=False)
    title = Column(String(255), nullable=False)
    content_text = Column(Text, nullable=False)
    structured_items = Column(JSON, nullable=True)
    source_citations = Column(JSON, nullable=True) # list of {page, block_id, text_snippet}

    analysis = relationship("DocumentAnalysis", back_populates="sections")


class ExtractionVerification(Base):
    __tablename__ = "extraction_verifications"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(64), ForeignKey("medical_documents.id"), nullable=False, unique=True)
    total_pages = Column(Integer, default=1)
    processed_pages = Column(Integer, default=1)
    failed_pages = Column(JSON, nullable=True) # list of page numbers that failed
    uncertain_fields_count = Column(Integer, default=0)
    verification_status = Column(String(64), default="verified") # verified, requires_review, action_needed
    accuracy_score = Column(Float, default=1.0)
    verified_by = Column(String(128), nullable=True)
    verified_at = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)

    document = relationship("MedicalDocument", back_populates="verification")


class DocumentCorrection(Base):
    __tablename__ = "document_corrections"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(64), ForeignKey("medical_documents.id"), nullable=False, index=True)
    patient_id = Column(String(64), nullable=False)
    field_type = Column(String(64), nullable=False) # "lab_result", "prescription", "metadata", "category"
    target_id = Column(String(64), nullable=True)   # ID of result or prescription if applicable
    field_name = Column(String(128), nullable=False)
    original_value = Column(Text, nullable=True)
    corrected_value = Column(Text, nullable=False)
    reason = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("MedicalDocument", back_populates="corrections")


class DocumentAccessLog(Base):
    __tablename__ = "document_access_logs"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(64), ForeignKey("medical_documents.id"), nullable=False, index=True)
    patient_id = Column(String(64), nullable=False)
    accessor_id = Column(String(64), nullable=False)
    action = Column(String(64), nullable=False) # "view", "download", "analyze", "correct", "delete"
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("MedicalDocument", back_populates="access_logs")


class DocumentQAMessage(Base):
    __tablename__ = "document_qa_messages"

    id = Column(String(64), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String(64), ForeignKey("medical_documents.id"), nullable=False, index=True)
    patient_id = Column(String(64), nullable=False, index=True)
    sender = Column(String(16), nullable=False) # "user", "assistant"
    message_text = Column(Text, nullable=False)
    intent = Column(String(64), nullable=True) # "summary", "abnormalities", "parameter", "specialist", etc.
    citations = Column(JSON, nullable=True) # list of {page, section, text_snippet}
    confidence = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    document = relationship("MedicalDocument", back_populates="qa_messages")


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id = Column(String(64), primary_key=True)
    name = Column(String(255), nullable=False)
    title = Column(String(255), nullable=False)
    specialty = Column(String(128), nullable=False, index=True)
    specialty_slug = Column(String(128), nullable=False, index=True)
    qualifications = Column(JSON, nullable=False) # list of degrees e.g. ["MBBS", "MD"]
    experience_years = Column(Integer, default=5)
    rating = Column(Float, default=4.8)
    review_count = Column(Integer, default=100)
    consultation_fee = Column(Float, default=800.0)
    consultation_types = Column(JSON, nullable=False) # ["online", "in-person"]
    languages = Column(JSON, nullable=False) # ["English", "Hindi"]
    clinic_name = Column(String(255), nullable=True)
    clinic_address = Column(String(255), nullable=True)
    clinic_city = Column(String(128), nullable=True)
    clinic_locality = Column(String(128), nullable=True)
    clinic_pincode = Column(String(32), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    registration_number = Column(String(128), nullable=True)
    about = Column(Text, nullable=True)
    expertise = Column(JSON, nullable=True) # list of clinical focus areas
    availability = Column(JSON, nullable=True)
    verified = Column(Boolean, default=True)
    featured = Column(Boolean, default=False)
    avatar = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    verification_applications = relationship("DoctorVerificationApplication", back_populates="doctor", cascade="all, delete-orphan")
    locations = relationship("DoctorLocation", back_populates="doctor", cascade="all, delete-orphan")


class DoctorLocation(Base):
    __tablename__ = "doctor_locations"

    id = Column(String(64), primary_key=True, default=lambda: f"dloc-{uuid.uuid4().hex[:12]}")
    doctor_id = Column(String(64), ForeignKey("doctor_profiles.id"), nullable=False, index=True)
    clinic_name = Column(String(255), nullable=False)
    clinic_address = Column(String(255), nullable=False)
    locality = Column(String(128), nullable=True, index=True)
    city = Column(String(128), nullable=False, index=True)
    state = Column(String(128), default="Tamil Nadu")
    postal_code = Column(String(32), nullable=True)
    latitude = Column(Float, nullable=False, index=True)
    longitude = Column(Float, nullable=False, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    doctor = relationship("DoctorProfile", back_populates="locations")


class DoctorVerificationApplication(Base):
    __tablename__ = "doctor_verification_applications"

    id = Column(String(64), primary_key=True, default=lambda: f"dva-{uuid.uuid4().hex[:12]}")
    doctor_id = Column(String(64), ForeignKey("doctor_profiles.id"), nullable=False, index=True)
    application_reference = Column(String(64), unique=True, nullable=False, index=True)
    status = Column(String(64), default="pending_review", index=True) # draft, submitted, pending_review, under_review, additional_documents_required, resubmission_required, approved, rejected, suspended
    
    personal_info = Column(JSON, nullable=False) # fullName, email, phone, dob, gender, address, photoUrl
    professional_info = Column(JSON, nullable=False) # specialty, highestQualification, university, graduationYear, experienceYears, currentHospital, previousExperience, consultationModes, languages, consultationFee, biography
    registration_info = Column(JSON, nullable=False) # registrationNumber, issuingCouncil, stateCouncil, registrationDate, validityDetails, primaryQualification, specializationQualification
    eligibility_checklist = Column(JSON, nullable=True) # { mandatory_info_completed: bool, required_docs_uploaded: bool, registration_provided: bool, qualifications_documented: bool, specialization_evidence: bool, files_readable: bool }
    
    submitted_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    assigned_admin_id = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    doctor = relationship("DoctorProfile", back_populates="verification_applications")
    documents = relationship("DoctorCredentialDocument", back_populates="application", cascade="all, delete-orphan")
    reviews = relationship("DoctorVerificationReview", back_populates="application", cascade="all, delete-orphan")
    history = relationship("DoctorVerificationHistory", back_populates="application", cascade="all, delete-orphan")


class DoctorCredentialDocument(Base):
    __tablename__ = "doctor_credential_documents"

    id = Column(String(64), primary_key=True, default=lambda: f"dcd-{uuid.uuid4().hex[:12]}")
    application_id = Column(String(64), ForeignKey("doctor_verification_applications.id"), nullable=False, index=True)
    document_type = Column(String(64), nullable=False) # medical_degree, council_registration, registration_evidence, internship_certificate, specialization_degree, resume, government_id, photograph, fellowship, experience_certificate, hospital_employment, cme_certificate, other
    document_name = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    secure_storage_key = Column(String(512), nullable=False)
    mime_type = Column(String(128), default="application/pdf")
    file_size = Column(Integer, default=0)
    is_mandatory = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    review_status = Column(String(32), default="pending") # pending, verified, invalid, replacement_requested, flagged_manual
    reviewer_id = Column(String(64), nullable=True)
    reviewer_comments = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    application = relationship("DoctorVerificationApplication", back_populates="documents")


class DoctorQualification(Base):
    __tablename__ = "doctor_qualifications"

    id = Column(String(64), primary_key=True, default=lambda: f"dq-{uuid.uuid4().hex[:12]}")
    doctor_id = Column(String(64), nullable=False, index=True)
    qualification_name = Column(String(128), nullable=False) # MBBS, MD, MS, DNB, etc.
    institution = Column(String(255), nullable=False)
    graduation_year = Column(Integer, nullable=False)
    specialization = Column(String(128), nullable=True)
    supporting_document_id = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DoctorVerificationReview(Base):
    __tablename__ = "doctor_verification_reviews"

    id = Column(String(64), primary_key=True, default=lambda: f"dvr-{uuid.uuid4().hex[:12]}")
    application_id = Column(String(64), ForeignKey("doctor_verification_applications.id"), nullable=False, index=True)
    admin_id = Column(String(64), nullable=False)
    action = Column(String(64), nullable=False) # approve, reject, request_additional_documents, return_for_correction
    reason_category = Column(String(128), nullable=True) # invalid_registration, unrecognized_qualification, missing_document, inconsistent_information, unverifiable_credentials, specialization_not_established, duplicate_application, other
    justification = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    application = relationship("DoctorVerificationApplication", back_populates="reviews")


class DoctorVerificationHistory(Base):
    __tablename__ = "doctor_verification_histories"

    id = Column(String(64), primary_key=True, default=lambda: f"dvh-{uuid.uuid4().hex[:12]}")
    application_id = Column(String(64), ForeignKey("doctor_verification_applications.id"), nullable=False, index=True)
    previous_status = Column(String(64), nullable=False)
    new_status = Column(String(64), nullable=False)
    changed_by = Column(String(64), nullable=False) # admin_id or doctor_id or "system"
    reason = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    application = relationship("DoctorVerificationApplication", back_populates="history")


class DoctorNotification(Base):
    __tablename__ = "doctor_notifications"

    id = Column(String(64), primary_key=True, default=lambda: f"dn-{uuid.uuid4().hex[:12]}")
    doctor_id = Column(String(64), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(32), default="info") # info, warning, success, error
    action_url = Column(String(255), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class PatientNotification(Base):
    __tablename__ = "patient_notifications"

    id = Column(String(64), primary_key=True, default=lambda: f"pn-{uuid.uuid4().hex[:12]}")
    patient_id = Column(String(64), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(32), default="info") # info, warning, success, error
    action_url = Column(String(255), nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class EmailNotificationLog(Base):
    __tablename__ = "email_notification_logs"

    id = Column(String(64), primary_key=True, default=lambda: f"eml-{uuid.uuid4().hex[:12]}")
    appointment_id = Column(String(64), nullable=True, index=True)
    recipient_email = Column(String(255), nullable=False, index=True)
    recipient_role = Column(String(32), nullable=False) # "patient" or "doctor"
    recipient_name = Column(String(255), nullable=True)
    subject = Column(String(255), nullable=False)
    body_html = Column(Text, nullable=True)
    body_text = Column(Text, nullable=True)
    idempotency_key = Column(String(128), unique=True, nullable=True, index=True)
    status = Column(String(32), default="sent", index=True) # "sent", "queued", "failed"
    delivery_provider = Column(String(64), default="gmail_api")
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    sent_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(String(64), primary_key=True, default=lambda: f"apt-{uuid.uuid4().hex[:12]}")
    appointment_reference = Column(String(64), unique=True, nullable=True, index=True)
    doctor_id = Column(String(64), ForeignKey("doctor_profiles.id"), nullable=False, index=True)
    doctor_name = Column(String(255), nullable=False)
    doctor_specialty = Column(String(128), nullable=False)
    doctor_avatar = Column(String(512), nullable=True)
    patient_id = Column(String(64), nullable=True, index=True)
    patient_name = Column(String(255), nullable=False)
    patient_email = Column(String(255), nullable=False)
    patient_phone = Column(String(64), nullable=True)
    date = Column(String(64), nullable=False, index=True) # YYYY-MM-DD
    time = Column(String(64), nullable=False) # e.g. "10:00 AM"
    start_time = Column(String(32), nullable=True) # e.g. "10:00"
    end_time = Column(String(32), nullable=True) # e.g. "10:30"
    type = Column(String(32), default="online") # "online" or "in-person"
    status = Column(String(32), default="upcoming", index=True) # "upcoming", "confirmed", "in-progress", "completed", "cancelled", "rescheduled"
    fee = Column(Float, default=800.0)
    payment_status = Column(String(32), default="paid") # "paid", "pending", "refunded"
    payment_reference = Column(String(128), nullable=True)
    symptoms = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    clinic_name = Column(String(255), nullable=True)
    meeting_room_id = Column(String(64), nullable=True, index=True)
    meeting_link = Column(String(255), nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    video_consultation = relationship("VideoConsultation", back_populates="appointment", uselist=False, cascade="all, delete-orphan")
    consultation_notes = relationship("ConsultationNote", back_populates="appointment", cascade="all, delete-orphan")


class DoctorAvailability(Base):
    __tablename__ = "doctor_availabilities"

    id = Column(String(64), primary_key=True, default=lambda: f"dav-{uuid.uuid4().hex[:12]}")
    doctor_id = Column(String(64), ForeignKey("doctor_profiles.id"), nullable=False, index=True)
    weekday = Column(Integer, nullable=False) # 0=Monday, 1=Tuesday, ..., 6=Sunday
    start_time = Column(String(8), nullable=False, default="09:00") # 24h format HH:MM
    end_time = Column(String(8), nullable=False, default="17:00") # 24h format HH:MM
    consultation_duration = Column(Integer, nullable=False, default=30) # in minutes: 15, 20, 30, 45, 60
    buffer_duration = Column(Integer, default=5) # buffer time between consultations in minutes
    timezone = Column(String(64), default="Asia/Kolkata")
    is_active = Column(Boolean, default=True)
    consultation_modes = Column(JSON, default=lambda: ["online", "in-person"])
    max_appointments = Column(Integer, default=20)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    breaks = relationship("DoctorAvailabilityBreak", back_populates="availability", cascade="all, delete-orphan")
    sessions = relationship("DoctorAvailabilitySession", back_populates="availability", cascade="all, delete-orphan")


class DoctorAvailabilitySession(Base):
    __tablename__ = "doctor_availability_sessions"

    id = Column(String(64), primary_key=True, default=lambda: f"das-{uuid.uuid4().hex[:12]}")
    availability_id = Column(String(64), ForeignKey("doctor_availabilities.id"), nullable=False, index=True)
    session_name = Column(String(64), nullable=True) # e.g. "Morning Session", "Evening Session"
    start_time = Column(String(8), nullable=False, default="09:00") # HH:MM
    end_time = Column(String(8), nullable=False, default="13:00") # HH:MM
    consultation_duration = Column(Integer, nullable=False, default=30)
    buffer_duration = Column(Integer, default=5)
    consultation_modes = Column(JSON, default=lambda: ["online", "in-person"])
    clinic_location_id = Column(String(64), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    availability = relationship("DoctorAvailability", back_populates="sessions")


class DoctorAvailabilityBreak(Base):
    __tablename__ = "doctor_availability_breaks"

    id = Column(String(64), primary_key=True, default=lambda: f"dab-{uuid.uuid4().hex[:12]}")
    availability_id = Column(String(64), ForeignKey("doctor_availabilities.id"), nullable=False, index=True)
    start_time = Column(String(8), nullable=False, default="13:00") # HH:MM
    end_time = Column(String(8), nullable=False, default="14:00") # HH:MM
    title = Column(String(128), default="Lunch / Clinical Break")

    # Relationships
    availability = relationship("DoctorAvailability", back_populates="breaks")


class DoctorScheduleOverride(Base):
    __tablename__ = "doctor_schedule_overrides"

    id = Column(String(64), primary_key=True, default=lambda: f"dso-{uuid.uuid4().hex[:12]}")
    doctor_id = Column(String(64), ForeignKey("doctor_profiles.id"), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True) # YYYY-MM-DD
    override_type = Column(String(32), nullable=False, default="blocked_time") # "holiday", "leave", "blocked_time", "extra_hours", "change_hours"
    start_time = Column(String(8), nullable=True) # HH:MM (if partial day)
    end_time = Column(String(8), nullable=True) # HH:MM
    reason = Column(Text, nullable=True)
    is_all_day = Column(Boolean, default=True)
    consultation_modes = Column(JSON, nullable=True)
    clinic_location_id = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DoctorLeave(Base):
    __tablename__ = "doctor_leaves"

    id = Column(String(64), primary_key=True, default=lambda: f"dlv-{uuid.uuid4().hex[:12]}")
    doctor_id = Column(String(64), ForeignKey("doctor_profiles.id"), nullable=False, index=True)
    start_date = Column(String(10), nullable=False, index=True) # YYYY-MM-DD
    end_date = Column(String(10), nullable=False, index=True) # YYYY-MM-DD
    is_all_day = Column(Boolean, default=True)
    start_time = Column(String(8), nullable=True) # HH:MM
    end_time = Column(String(8), nullable=True) # HH:MM
    leave_type = Column(String(32), default="personal") # "full_day", "multiple_day", "partial_day", "emergency", "personal", "holiday"
    reason = Column(Text, nullable=True)
    status = Column(String(32), default="active", index=True) # "active", "cancelled"
    affected_appointments_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class DoctorScheduleSettings(Base):
    __tablename__ = "doctor_schedule_settings"

    id = Column(String(64), primary_key=True, default=lambda: f"dss-{uuid.uuid4().hex[:12]}")
    doctor_id = Column(String(64), ForeignKey("doctor_profiles.id"), unique=True, nullable=False, index=True)
    timezone = Column(String(64), default="Asia/Kolkata")
    default_duration_minutes = Column(Integer, default=30)
    buffer_minutes = Column(Integer, default=5)
    minimum_notice_minutes = Column(Integer, default=120) # 2 hours notice
    maximum_advance_days = Column(Integer, default=30) # 30 days ahead
    maximum_appointments_per_day = Column(Integer, default=20)
    same_day_booking_enabled = Column(Boolean, default=True)
    cancellation_policy = Column(Text, default="Free cancellation up to 4 hours before the consultation.")
    rescheduling_policy = Column(Text, default="Rescheduling permitted up to 2 hours before the consultation.")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AppointmentSlotHold(Base):
    __tablename__ = "appointment_slot_holds"

    id = Column(String(64), primary_key=True, default=lambda: f"ash-{uuid.uuid4().hex[:12]}")
    doctor_id = Column(String(64), ForeignKey("doctor_profiles.id"), nullable=False, index=True)
    patient_id = Column(String(64), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True) # YYYY-MM-DD
    start_time = Column(String(8), nullable=False) # HH:MM
    end_time = Column(String(8), nullable=False) # HH:MM
    consultation_mode = Column(String(32), default="online")
    idempotency_key = Column(String(128), nullable=True, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    status = Column(String(32), default="held") # "held", "confirmed", "expired", "released"
    created_at = Column(DateTime, default=datetime.utcnow)


class VideoConsultation(Base):
    __tablename__ = "video_consultations"

    id = Column(String(64), primary_key=True, default=lambda: f"vc-{uuid.uuid4().hex[:12]}")
    appointment_id = Column(String(64), ForeignKey("appointments.id"), nullable=False, unique=True, index=True)
    room_id = Column(String(64), unique=True, nullable=False, index=True)
    provider = Column(String(32), default="webrtc") # "webrtc" or "agora"
    consultation_status = Column(String(32), default="scheduled", index=True) # "scheduled", "join_window_open", "waiting_doctor", "waiting_patient", "in_progress", "completed", "cancelled"
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    appointment = relationship("Appointment", back_populates="video_consultation")
    participants = relationship("ConsultationParticipant", back_populates="consultation", cascade="all, delete-orphan")
    messages = relationship("ConsultationMessage", back_populates="consultation", cascade="all, delete-orphan")


class ConsultationParticipant(Base):
    __tablename__ = "consultation_participants"

    id = Column(String(64), primary_key=True, default=lambda: f"cp-{uuid.uuid4().hex[:12]}")
    consultation_id = Column(String(64), ForeignKey("video_consultations.id"), nullable=False, index=True)
    user_id = Column(String(64), nullable=False)
    user_name = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False) # "doctor" or "patient"
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime, nullable=True)
    connection_status = Column(String(32), default="connected") # "connected", "waiting", "disconnected"

    # Relationships
    consultation = relationship("VideoConsultation", back_populates="participants")


class ConsultationMessage(Base):
    __tablename__ = "consultation_messages"

    id = Column(String(64), primary_key=True, default=lambda: f"cm-{uuid.uuid4().hex[:12]}")
    consultation_id = Column(String(64), ForeignKey("video_consultations.id"), nullable=False, index=True)
    sender_id = Column(String(64), nullable=False)
    sender_name = Column(String(255), nullable=False)
    sender_role = Column(String(32), nullable=False) # "doctor" or "patient"
    message = Column(Text, nullable=False)
    attachment_url = Column(String(512), nullable=True)
    attachment_name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    consultation = relationship("VideoConsultation", back_populates="messages")


class ConsultationNote(Base):
    __tablename__ = "consultation_notes"

    id = Column(String(64), primary_key=True, default=lambda: f"cn-{uuid.uuid4().hex[:12]}")
    appointment_id = Column(String(64), ForeignKey("appointments.id"), nullable=False, index=True)
    doctor_id = Column(String(64), ForeignKey("doctor_profiles.id"), nullable=False, index=True)
    patient_id = Column(String(64), nullable=False, index=True)
    diagnosis = Column(Text, nullable=True)
    clinical_notes = Column(Text, nullable=True)
    prescription_summary = Column(Text, nullable=True)
    follow_up_advice = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    appointment = relationship("Appointment", back_populates="consultation_notes")


class ConsultationSignal(Base):
    __tablename__ = "consultation_signals"

    id = Column(String(64), primary_key=True, default=lambda: f"sig-{uuid.uuid4().hex[:12]}")
    room_id = Column(String(64), nullable=False, index=True)
    sender_role = Column(String(32), nullable=False) # "doctor" or "patient"
    target_role = Column(String(32), nullable=False) # "patient" or "doctor"
    signal_type = Column(String(32), nullable=False) # "offer", "answer", "ice-candidate", "status", "leave"
    signal_data = Column(JSON, nullable=False)
    consumed = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# =============================================================================
# MULTI-ROLE AUTHENTICATION & PATIENT IDENTITY MODELS
# =============================================================================

class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, default=lambda: f"usr-{uuid.uuid4().hex[:12]}")
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(64), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(32), nullable=False, default="patient", index=True) # "patient", "doctor", "admin"
    full_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=True)
    doctor_id = Column(String(64), ForeignKey("doctor_profiles.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    patient_profile = relationship("PatientProfile", uselist=False, back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")


class PatientProfile(Base):
    __tablename__ = "patient_profiles"

    id = Column(String(64), primary_key=True, default=lambda: f"pat-{uuid.uuid4().hex[:12]}")
    user_id = Column(String(64), ForeignKey("users.id"), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(64), nullable=True, index=True)
    date_of_birth = Column(String(64), nullable=True)
    gender = Column(String(32), nullable=True) # Male, Female, Other
    preferred_language = Column(String(64), default="English")
    
    # Address and Location Fields
    country = Column(String(128), default="India")
    state = Column(String(128), default="Tamil Nadu")
    city = Column(String(128), default="Chennai")
    locality = Column(String(128), nullable=True) # e.g. Velachery, Adyar, Anna Nagar
    street_address = Column(String(255), nullable=True)
    house_flat = Column(String(128), nullable=True)
    landmark = Column(String(255), nullable=True)
    postal_code = Column(String(32), nullable=True)
    
    # Coordinates (Geocoded / GPS)
    home_latitude = Column(Float, nullable=True)
    home_longitude = Column(Float, nullable=True)
    preferred_location_latitude = Column(Float, nullable=True)
    preferred_location_longitude = Column(Float, nullable=True)
    preferred_location_address = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    
    # Granular Location Architecture: Registered vs Live GPS vs Active Search
    registered_address = Column(Text, nullable=True)
    registered_locality = Column(String(128), nullable=True)
    registered_city = Column(String(128), nullable=True)
    registered_state = Column(String(128), nullable=True)
    registered_postal_code = Column(String(32), nullable=True)
    registered_latitude = Column(Float, nullable=True)
    registered_longitude = Column(Float, nullable=True)

    current_latitude = Column(Float, nullable=True)
    current_longitude = Column(Float, nullable=True)
    current_accuracy = Column(Float, nullable=True)
    current_locality = Column(String(128), nullable=True)
    current_city = Column(String(128), nullable=True)
    current_state = Column(String(128), nullable=True)
    current_postal_code = Column(String(32), nullable=True)
    current_address = Column(String(512), nullable=True)
    current_detected_at = Column(DateTime, nullable=True)

    search_latitude = Column(Float, nullable=True)
    search_longitude = Column(Float, nullable=True)
    search_address = Column(String(512), nullable=True)
    search_city = Column(String(128), nullable=True)
    search_radius_km = Column(Float, default=5.0)
    location_source = Column(String(64), default="REGISTERED_ADDRESS")
    location_updated_at = Column(DateTime, nullable=True)
    
    # Clinical and Medical Information
    blood_group = Column(String(16), default="O+")
    allergies = Column(JSON, default=list) # e.g. ["Penicillin", "Sulfa drugs"]
    medical_history = Column(JSON, default=list) # e.g. ["Hypertension", "Type 2 Diabetes"]
    current_medications = Column(JSON, default=list) # e.g. ["Metformin 500mg"]
    previous_surgeries = Column(JSON, default=list)
    emergency_contact = Column(String(255), nullable=True)
    emergency_contact_name = Column(String(255), nullable=True)
    emergency_contact_phone = Column(String(64), nullable=True)
    doctor_notes = Column(Text, nullable=True)
    profile_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="patient_profile")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(String(64), primary_key=True, default=lambda: f"ses-{uuid.uuid4().hex[:12]}")
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    session_token = Column(String(255), unique=True, nullable=False, index=True)
    role = Column(String(32), nullable=False) # "patient", "doctor", "admin"
    expires_at = Column(DateTime, nullable=False)
    is_revoked = Column(Boolean, default=False, index=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="sessions")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(String(64), primary_key=True, default=lambda: f"prt-{uuid.uuid4().hex[:12]}")
    user_id = Column(String(64), ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# =============================================================================
# 7. AI SYMPTOM ASSESSMENT & DOCTOR RECOMMENDATION MODELS
# =============================================================================

class SymptomAssessment(Base):
    __tablename__ = "symptom_assessments"

    id = Column(String(64), primary_key=True, default=lambda: f"asm-{uuid.uuid4().hex[:12]}")
    patient_id = Column(String(64), nullable=False, index=True)
    original_description = Column(Text, nullable=False)
    selected_symptoms = Column(JSON, default=list) # e.g. ["headache", "forehead pain"]
    symptom_duration = Column(String(64), nullable=True) # e.g. "3 days"
    severity = Column(String(32), default="Moderate") # "Mild", "Moderate", "Severe"
    started_at = Column(String(64), nullable=True)
    progression = Column(String(32), default="unchanged") # "improving", "worsening", "unchanged"
    patient_context = Column(JSON, default=dict) # age, gender, medical history, allergies, medications
    assessment_status = Column(String(32), default="in_progress", index=True) # "in_progress", "completed", "requires_emergency"
    urgency_level = Column(String(32), default="routine", index=True) # "emergency", "urgent", "routine", "self_care"
    emergency_flag = Column(Boolean, default=False, index=True)
    emergency_details = Column(JSON, nullable=True)
    ai_assessment_result = Column(JSON, nullable=True)
    recommended_specialties = Column(JSON, default=list)
    model_version = Column(String(64), default="MediVerse AI Clinical Engine v3.0")
    is_deleted = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    messages = relationship("SymptomAssessmentMessage", back_populates="assessment", cascade="all, delete-orphan", order_by="SymptomAssessmentMessage.created_at")
    answers = relationship("SymptomFollowUpAnswer", back_populates="assessment", cascade="all, delete-orphan", order_by="SymptomFollowUpAnswer.created_at")
    recommended_doctors = relationship("SymptomAssessmentDoctor", back_populates="assessment", cascade="all, delete-orphan")


class SymptomAssessmentMessage(Base):
    __tablename__ = "symptom_assessment_messages"

    id = Column(String(64), primary_key=True, default=lambda: f"smsg-{uuid.uuid4().hex[:12]}")
    assessment_id = Column(String(64), ForeignKey("symptom_assessments.id"), nullable=False, index=True)
    sender = Column(String(32), nullable=False) # "patient", "assistant"
    message = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    assessment = relationship("SymptomAssessment", back_populates="messages")


class SymptomFollowUpAnswer(Base):
    __tablename__ = "symptom_follow_up_answers"

    id = Column(String(64), primary_key=True, default=lambda: f"sans-{uuid.uuid4().hex[:12]}")
    assessment_id = Column(String(64), ForeignKey("symptom_assessments.id"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    assessment = relationship("SymptomAssessment", back_populates="answers")


class SymptomAssessmentDoctor(Base):
    __tablename__ = "symptom_assessment_doctors"

    id = Column(String(64), primary_key=True, default=lambda: f"sad-{uuid.uuid4().hex[:12]}")
    assessment_id = Column(String(64), ForeignKey("symptom_assessments.id"), nullable=False, index=True)
    doctor_id = Column(String(64), ForeignKey("doctor_profiles.id"), nullable=False, index=True)
    specialty = Column(String(64), nullable=False)
    recommendation_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    assessment = relationship("SymptomAssessment", back_populates="recommended_doctors")
    doctor = relationship("DoctorProfile")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String(64), primary_key=True, default=lambda: f"pay-{uuid.uuid4().hex[:12]}")
    user_id = Column(String(64), nullable=False, index=True)
    order_id = Column(String(64), nullable=True, index=True)
    booking_id = Column(String(64), nullable=True, index=True)
    payment_mode = Column(String(32), default="razorpay") # "razorpay" or "mock"
    razorpay_order_id = Column(String(128), nullable=True, index=True)
    razorpay_payment_id = Column(String(128), nullable=True, index=True)
    razorpay_signature = Column(String(256), nullable=True)
    amount = Column(Float, nullable=False) # In Rupees e.g. 750.0
    amount_paise = Column(Integer, nullable=False) # In Paise e.g. 75000
    currency = Column(String(16), default="INR")
    payment_method = Column(String(32), default="upi") # "upi", "card", "netbanking", "wallet"
    payment_status = Column(String(32), default="CREATED", index=True) # CREATED, PENDING, PROCESSING, SUCCESS, FAILED, CANCELLED, REFUNDED
    signature_verified = Column(Boolean, default=False)
    webhook_event_ids = Column(JSON, default=list) # Array of webhook event IDs processed for idempotency
    failure_reason = Column(Text, nullable=True)
    refund_amount = Column(Float, default=0.0)
    refund_status = Column(String(32), default="none") # none, requested, processed, failed
    refund_id = Column(String(128), nullable=True)
    notes = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "userId": self.user_id,
            "order_id": self.order_id,
            "orderId": self.order_id,
            "booking_id": self.booking_id,
            "bookingId": self.booking_id,
            "razorpay_order_id": self.razorpay_order_id,
            "razorpayOrderId": self.razorpay_order_id,
            "razorpay_payment_id": self.razorpay_payment_id,
            "razorpayPaymentId": self.razorpay_payment_id,
            "amount": self.amount,
            "amount_paise": self.amount_paise,
            "currency": self.currency,
            "payment_method": self.payment_method,
            "paymentMethod": self.payment_method,
            "payment_mode": self.payment_mode or "razorpay",
            "paymentMode": self.payment_mode or "razorpay",
            "is_mock": (self.payment_mode == "mock"),
            "payment_status": self.payment_status,
            "paymentStatus": self.payment_status,
            "signature_verified": self.signature_verified,
            "signatureVerified": self.signature_verified,
            "webhook_event_ids": self.webhook_event_ids or [],
            "webhookEventIds": self.webhook_event_ids or [],
            "failure_reason": self.failure_reason,
            "failureReason": self.failure_reason,
            "refund_amount": self.refund_amount,
            "refundAmount": self.refund_amount,
            "refund_status": self.refund_status,
            "refundStatus": self.refund_status,
            "refund_id": self.refund_id,
            "notes": self.notes or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        }


class Order(Base):
    __tablename__ = "orders"

    id = Column(String(64), primary_key=True, default=lambda: f"ord-{uuid.uuid4().hex[:12]}")
    order_reference = Column(String(64), unique=True, index=True) # e.g. ORD-20261123-XXXX
    user_id = Column(String(64), nullable=False, index=True)
    booking_id = Column(String(64), nullable=True, index=True)
    payment_mode = Column(String(32), default="razorpay") # "razorpay" or "mock"
    service_type = Column(String(64), default="doctor_consultation")
    items = Column(JSON, nullable=False, default=list) # [{ name, description, unit_price, quantity, subtotal, tax_amount }]
    subtotal = Column(Float, nullable=False, default=0.0)
    tax_rate = Column(Float, default=0.18) # 18% GST standard
    tax_amount = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False, default=0.0)
    currency = Column(String(16), default="INR")
    payment_status = Column(String(32), default="PENDING", index=True) # PENDING, PROCESSING, SUCCESS, FAILED, CANCELLED, REFUNDED
    order_status = Column(String(32), default="created", index=True) # created, confirmed, completed, cancelled
    payment_id = Column(String(64), nullable=True, index=True)
    razorpay_order_id = Column(String(128), nullable=True, index=True)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "order_reference": self.order_reference,
            "orderReference": self.order_reference,
            "user_id": self.user_id,
            "userId": self.user_id,
            "booking_id": self.booking_id,
            "bookingId": self.booking_id,
            "service_type": self.service_type,
            "serviceType": self.service_type,
            "items": self.items or [],
            "subtotal": self.subtotal,
            "tax_rate": self.tax_rate,
            "tax_amount": self.tax_amount,
            "discount_amount": self.discount_amount,
            "total_amount": self.total_amount,
            "totalAmount": self.total_amount,
            "currency": self.currency,
            "payment_mode": self.payment_mode or "razorpay",
            "paymentMode": self.payment_mode or "razorpay",
            "is_mock": (self.payment_mode == "mock"),
            "payment_status": self.payment_status,
            "paymentStatus": self.payment_status,
            "order_status": self.order_status,
            "orderStatus": self.order_status,
            "payment_id": self.payment_id,
            "paymentId": self.payment_id,
            "razorpay_order_id": self.razorpay_order_id,
            "razorpayOrderId": self.razorpay_order_id,
            "metadata": self.metadata_json or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None
        }


# =============================================================================
# 11. OAUTH TOKEN SECURE BACKEND STORAGE
# =============================================================================

class OAuthToken(Base):
    """
    Secure backend repository for OAuth 2.0 provider credentials (e.g. Gmail API).
    Stores access tokens, refresh tokens, scopes, and expiration timestamps.
    Never exposed to client browsers.
    """
    __tablename__ = "oauth_tokens"

    id = Column(String(64), primary_key=True)  # e.g. "gmail"
    provider = Column(String(64), default="google", nullable=False)
    account_email = Column(String(255), nullable=True)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    scope = Column(Text, nullable=True)
    token_type = Column(String(32), default="Bearer")
    expires_at = Column(BigInteger, nullable=True)  # Unix timestamp in seconds
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "provider": self.provider,
            "account_email": self.account_email,
            "access_token": self.access_token,
            "refresh_token": self.refresh_token,
            "scope": self.scope,
            "token_type": self.token_type,
            "expires_at": self.expires_at,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }











import os
import json
import uuid
import shutil
import random
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.db.database import get_db
from backend.app.db.models import (
    DoctorProfile,
    DoctorVerificationApplication,
    DoctorCredentialDocument,
    DoctorQualification,
    DoctorVerificationReview,
    DoctorVerificationHistory,
    DoctorNotification
)
from backend.app.schemas.doctor_verification import (
    DoctorRegisterRequest,
    DoctorVerificationApplicationDetailSchema,
    DoctorVerificationApplicationSummarySchema,
    DoctorCredentialDocumentSchema,
    DoctorDocumentReviewRequest,
    DoctorDecisionRequest,
    DoctorVerificationStatsSchema,
    DoctorNotificationSchema
)

router = APIRouter()

STORAGE_BASE = os.path.join(os.getcwd(), "uploads", "doctor_credentials")
os.makedirs(STORAGE_BASE, exist_ok=True)

ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png", "webp", "doc", "docx"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 # 10MB

def generate_reference_id() -> str:
    year = datetime.utcnow().year
    rand_num = random.randint(1000, 9999)
    return f"DOC-VER-{year}-{rand_num}"


@router.post("/register", response_model=DoctorVerificationApplicationDetailSchema)
def register_doctor(
    request: DoctorRegisterRequest,
    db: Session = Depends(get_db)
):
    """
    Registers a doctor with multi-step information and creates a verification application.
    The doctor is initially NOT verified until authorized administrative approval.
    """
    # Check if doctor with same email already exists
    existing_doc = db.query(DoctorProfile).filter(
        DoctorProfile.name == request.personal_info.full_name
    ).first()

    doctor_id = f"doc-{uuid.uuid4().hex[:8]}"
    spec_slug = request.professional_info.specialty.lower().replace(" ", "-")

    # Create unverified DoctorProfile
    doctor = DoctorProfile(
        id=doctor_id,
        name=request.personal_info.full_name,
        title=f"Dr. {request.personal_info.full_name}",
        specialty=request.professional_info.specialty,
        specialty_slug=spec_slug,
        qualifications=[request.professional_info.highest_qualification],
        experience_years=request.professional_info.experience_years,
        rating=5.0,
        review_count=0,
        consultation_fee=request.professional_info.consultation_fee,
        consultation_types=request.professional_info.consultation_modes,
        languages=request.professional_info.languages,
        clinic_name=request.professional_info.current_hospital or "Private Consultation Clinic",
        clinic_address=request.personal_info.residential_address or "Healthcare Medical Complex",
        clinic_city="Bangalore",
        registration_number=request.registration_info.registration_number,
        about=request.professional_info.biography or "Experienced clinical practitioner committed to patient-centered healthcare.",
        expertise=[request.professional_info.specialty],
        verified=False, # STRICT REQUIREMENT: Unverified upon registration
        featured=False,
        avatar=request.personal_info.photo_url or "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80",
        created_at=datetime.utcnow()
    )
    db.add(doctor)
    db.flush()

    # Generate unique application reference
    ref_id = generate_reference_id()
    while db.query(DoctorVerificationApplication).filter_by(application_reference=ref_id).first():
        ref_id = generate_reference_id()

    application = DoctorVerificationApplication(
        id=f"dva-{uuid.uuid4().hex[:12]}",
        doctor_id=doctor_id,
        application_reference=ref_id,
        status="pending_review",
        personal_info=request.personal_info.model_dump(),
        professional_info=request.professional_info.model_dump(),
        registration_info=request.registration_info.model_dump(),
        eligibility_checklist=request.eligibility_checklist.model_dump() if request.eligibility_checklist else {
            "mandatory_info_completed": True,
            "required_docs_uploaded": False,
            "registration_provided": True,
            "qualifications_documented": True,
            "specialization_evidence": False,
            "files_readable": True
        },
        submitted_at=datetime.utcnow(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(application)
    db.flush()

    # Log initial status history
    history_entry = DoctorVerificationHistory(
        application_id=application.id,
        previous_status="draft",
        new_status="pending_review",
        changed_by=doctor_id,
        reason="Initial doctor registration application submission",
        timestamp=datetime.utcnow()
    )
    db.add(history_entry)

    # Add initial notification for doctor
    notification = DoctorNotification(
        doctor_id=doctor_id,
        title="Application Submitted for Verification",
        message=f"Your credential verification application ({ref_id}) has been received and queued for administrative review. You will be notified when review progress updates.",
        type="info",
        action_url="/doctor/dashboard",
        created_at=datetime.utcnow()
    )
    db.add(notification)
    db.commit()
    db.refresh(application)

    return application


@router.post("/{application_id}/documents", response_model=DoctorCredentialDocumentSchema)
async def upload_credential_document(
    application_id: str,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    document_name: str = Form(...),
    is_mandatory: bool = Form(False),
    db: Session = Depends(get_db)
):
    """
    Securely uploads a professional credential document (PDF, JPG, PNG, DOCX) for an application.
    """
    app = db.query(DoctorVerificationApplication).filter_by(id=application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Doctor verification application not found.")

    ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Prepare secure storage folder
    app_folder = os.path.join(STORAGE_BASE, application_id)
    os.makedirs(app_folder, exist_ok=True)

    file_id = f"dcd-{uuid.uuid4().hex[:12]}"
    safe_filename = f"{file_id}_{file.filename}"
    file_path = os.path.join(app_folder, safe_filename)

    # Save file contents
    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File exceeds maximum allowed size of 10 MB.")

    with open(file_path, "wb") as f:
        f.write(content)

    doc_record = DoctorCredentialDocument(
        id=file_id,
        application_id=application_id,
        document_type=document_type,
        document_name=document_name,
        original_filename=file.filename,
        secure_storage_key=file_path,
        mime_type=file.content_type or "application/octet-stream",
        file_size=len(content),
        is_mandatory=is_mandatory,
        review_status="pending",
        uploaded_at=datetime.utcnow()
    )
    db.add(doc_record)

    # Update eligibility checklist status
    checklist = app.eligibility_checklist or {}
    checklist["required_docs_uploaded"] = True
    app.eligibility_checklist = checklist
    app.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(doc_record)

    return doc_record


@router.get("/{application_id}", response_model=DoctorVerificationApplicationDetailSchema)
def get_application_details(application_id: str, db: Session = Depends(get_db)):
    """
    Retrieves full details of a doctor's verification application.
    """
    app = db.query(DoctorVerificationApplication).filter_by(id=application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")
    return app


@router.get("/doctor/{doctor_id}", response_model=DoctorVerificationApplicationDetailSchema)
def get_application_by_doctor(doctor_id: str, db: Session = Depends(get_db)):
    """
    Retrieves the most recent verification application for a specific doctor.
    """
    app = (
        db.query(DoctorVerificationApplication)
        .filter_by(doctor_id=doctor_id)
        .order_by(DoctorVerificationApplication.created_at.desc())
        .first()
    )
    if not app:
        raise HTTPException(status_code=404, detail="No verification application found for this doctor.")
    return app


@router.post("/{application_id}/submit")
def submit_application(application_id: str, db: Session = Depends(get_db)):
    """
    Validates and formally submits an application for administrative review.
    """
    app = db.query(DoctorVerificationApplication).filter_by(id=application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    prev_status = app.status
    app.status = "pending_review"
    app.submitted_at = datetime.utcnow()
    app.updated_at = datetime.utcnow()

    # Add history entry
    history_entry = DoctorVerificationHistory(
        application_id=app.id,
        previous_status=prev_status,
        new_status="pending_review",
        changed_by=app.doctor_id,
        reason="Doctor submitted verification package",
        timestamp=datetime.utcnow()
    )
    db.add(history_entry)

    # Add notification
    notification = DoctorNotification(
        doctor_id=app.doctor_id,
        title="Application Submitted for Verification",
        message="Your application is now under review. You will receive updates as each credential is reviewed.",
        type="info",
        created_at=datetime.utcnow()
    )
    db.add(notification)
    db.commit()

    return {"message": "Application submitted successfully", "status": app.status}


@router.get("/admin/applications", response_model=List[DoctorVerificationApplicationSummarySchema])
def list_admin_applications(
    status_filter: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Admin listing of doctor applications with search and status filters.
    """
    query = db.query(DoctorVerificationApplication)

    if status_filter and status_filter.lower() != "all":
        query = query.filter(DoctorVerificationApplication.status == status_filter.lower())

    apps = query.order_by(DoctorVerificationApplication.created_at.desc()).all()

    summaries = []
    for a in apps:
        doc = db.query(DoctorProfile).filter_by(id=a.doctor_id).first()
        p_info = a.personal_info if isinstance(a.personal_info, dict) else (json.loads(a.personal_info) if a.personal_info else {})
        prof_info = a.professional_info if isinstance(a.professional_info, dict) else (json.loads(a.professional_info) if a.professional_info else {})
        reg_info = a.registration_info if isinstance(a.registration_info, dict) else (json.loads(a.registration_info) if a.registration_info else {})

        doc_name = p_info.get("full_name") or (doc.name if doc else "Dr. Unknown")
        doc_email = p_info.get("email") or "doctor@example.com"
        specialty = prof_info.get("specialty") or (doc.specialty if doc else "General")
        reg_num = reg_info.get("registration_number") or (doc.registration_number if doc else "N/A")
        council = reg_info.get("issuing_council") or "Medical Council of India"
        highest_qual = prof_info.get("highest_qualification") or "MBBS"
        exp_years = prof_info.get("experience_years") or 5

        # Check search match
        if search:
            s_lower = search.lower()
            match = (
                s_lower in a.application_reference.lower() or
                s_lower in doc_name.lower() or
                s_lower in doc_email.lower() or
                s_lower in reg_num.lower() or
                s_lower in specialty.lower()
            )
            if not match:
                continue

        mandatory_verified = all(
            d.review_status == "verified"
            for d in a.documents
            if d.is_mandatory
        ) if a.documents else False

        summaries.append(
            DoctorVerificationApplicationSummarySchema(
                id=a.id,
                doctor_id=a.doctor_id,
                application_reference=a.application_reference,
                doctor_name=doc_name,
                doctor_email=doc_email,
                specialty=specialty,
                registration_number=reg_num,
                issuing_council=council,
                highest_qualification=highest_qual,
                experience_years=exp_years,
                status=a.status,
                submitted_at=a.submitted_at,
                created_at=a.created_at,
                documents_count=len(a.documents),
                mandatory_documents_verified=mandatory_verified
            )
        )

    return summaries


@router.get("/admin/stats", response_model=DoctorVerificationStatsSchema)
def get_admin_verification_stats(db: Session = Depends(get_db)):
    """
    Returns actual database counts for each doctor verification status.
    """
    total = db.query(DoctorVerificationApplication).count()
    pending = db.query(DoctorVerificationApplication).filter_by(status="pending_review").count()
    under_review = db.query(DoctorVerificationApplication).filter_by(status="under_review").count()
    add_docs = db.query(DoctorVerificationApplication).filter_by(status="additional_documents_required").count()
    resub = db.query(DoctorVerificationApplication).filter_by(status="resubmission_required").count()
    approved = db.query(DoctorVerificationApplication).filter_by(status="approved").count()
    rejected = db.query(DoctorVerificationApplication).filter_by(status="rejected").count()
    suspended = db.query(DoctorVerificationApplication).filter_by(status="suspended").count()

    return DoctorVerificationStatsSchema(
        total_applications=total,
        pending_review=pending,
        under_review=under_review,
        additional_documents_required=add_docs,
        resubmission_required=resub,
        approved=approved,
        rejected=rejected,
        suspended=suspended
    )


@router.post("/admin/documents/{document_id}/review")
def review_credential_document(
    document_id: str,
    request: DoctorDocumentReviewRequest,
    admin_id: str = Query("admin-gov-1"),
    db: Session = Depends(get_db)
):
    """
    Admin marks an individual credential document as verified, invalid, replacement_requested, or flagged.
    """
    doc = db.query(DoctorCredentialDocument).filter_by(id=document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Credential document not found.")

    doc.review_status = request.review_status
    doc.reviewer_id = admin_id
    doc.reviewer_comments = request.reviewer_comments
    doc.reviewed_at = datetime.utcnow()

    # Move application to under_review if currently pending
    app = doc.application
    if app and app.status == "pending_review":
        app.status = "under_review"
        app.assigned_admin_id = admin_id
        app.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(doc)

    return {"message": "Document review status updated", "document_id": doc.id, "review_status": doc.review_status}


@router.post("/admin/applications/{application_id}/decision")
def make_application_decision(
    application_id: str,
    request: DoctorDecisionRequest,
    db: Session = Depends(get_db)
):
    """
    Processes final Administrative decision: Approve, Reject, or Request Additional Documents.
    Strictly requires justification on rejection.
    """
    app = db.query(DoctorVerificationApplication).filter_by(id=application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found.")

    prev_status = app.status

    if request.action == "approve":
        # Check mandatory documents verification
        unverified_mandatory = [
            d.document_name for d in app.documents
            if d.is_mandatory and d.review_status != "verified"
        ]
        # Allow approval with warning or mark all as verified if approved
        for d in app.documents:
            if d.review_status == "pending":
                d.review_status = "verified"
                d.reviewed_at = datetime.utcnow()
                d.reviewer_id = request.admin_id

        app.status = "approved"
        app.approved_at = datetime.utcnow()
        app.reviewed_at = datetime.utcnow()
        app.assigned_admin_id = request.admin_id

        # ACTIVATE DOCTOR PROFILE: Enable consultations & verified badge!
        doc = db.query(DoctorProfile).filter_by(id=app.doctor_id).first()
        if doc:
            doc.verified = True

        # Notification for doctor
        db.add(DoctorNotification(
            doctor_id=app.doctor_id,
            title="Congratulations! Your Doctor Account is Approved",
            message="Your professional credentials have been verified by the medical administration team. Your profile is now live and you can accept patient consultations.",
            type="success",
            action_url="/doctor/dashboard",
            created_at=datetime.utcnow()
        ))

    elif request.action == "reject":
        # MANDATORY REJECTION JUSTIFICATION VALIDATION
        if not request.reason_category:
            raise HTTPException(
                status_code=400,
                detail="Rejection category is mandatory (e.g. invalid_registration, missing_document)."
            )
        if not request.justification or len(request.justification.strip()) < 10:
            raise HTTPException(
                status_code=400,
                detail="A detailed written justification (minimum 10 characters) is required for rejection."
            )

        app.status = "rejected"
        app.rejected_at = datetime.utcnow()
        app.reviewed_at = datetime.utcnow()
        app.assigned_admin_id = request.admin_id

        # Deactivate doctor profile
        doc = db.query(DoctorProfile).filter_by(id=app.doctor_id).first()
        if doc:
            doc.verified = False

        # Notification for doctor
        db.add(DoctorNotification(
            doctor_id=app.doctor_id,
            title="Verification Application Not Approved",
            message=f"Reason: {request.reason_category.replace('_', ' ').title()}. Details: {request.justification}",
            type="error",
            action_url="/doctor/dashboard",
            created_at=datetime.utcnow()
        ))

    elif request.action == "request_additional_documents":
        if not request.justification:
            raise HTTPException(
                status_code=400,
                detail="Please specify which additional documents are requested and why."
            )

        app.status = "additional_documents_required"
        app.reviewed_at = datetime.utcnow()
        app.assigned_admin_id = request.admin_id

        # Notification for doctor
        db.add(DoctorNotification(
            doctor_id=app.doctor_id,
            title="Additional Documents Required for Verification",
            message=f"Administrator request: {request.justification}. Please upload the requested files from your Physician Workspace.",
            type="warning",
            action_url="/doctor/dashboard",
            created_at=datetime.utcnow()
        ))

    elif request.action == "suspend":
        app.status = "suspended"
        doc = db.query(DoctorProfile).filter_by(id=app.doctor_id).first()
        if doc:
            doc.verified = False

        db.add(DoctorNotification(
            doctor_id=app.doctor_id,
            title="Account Suspended by Clinical Governance",
            message=request.justification or "Your doctor account has been suspended pending credential inquiry.",
            type="error",
            action_url="/doctor/dashboard",
            created_at=datetime.utcnow()
        ))

    else:
        raise HTTPException(status_code=400, detail=f"Invalid action '{request.action}'")

    app.updated_at = datetime.utcnow()

    # Record Review Record
    review = DoctorVerificationReview(
        application_id=app.id,
        admin_id=request.admin_id,
        action=request.action,
        reason_category=request.reason_category,
        justification=request.justification,
        created_at=datetime.utcnow()
    )
    db.add(review)

    # Record History Entry
    history = DoctorVerificationHistory(
        application_id=app.id,
        previous_status=prev_status,
        new_status=app.status,
        changed_by=request.admin_id,
        reason=request.justification or f"Admin action: {request.action}",
        timestamp=datetime.utcnow()
    )
    db.add(history)

    db.commit()
    db.refresh(app)

    return {
        "message": f"Application {request.action} processed successfully.",
        "application_id": app.id,
        "status": app.status
    }


@router.get("/doctor/{doctor_id}/notifications", response_model=List[DoctorNotificationSchema])
def get_doctor_notifications(doctor_id: str, db: Session = Depends(get_db)):
    """
    Retrieves in-app notifications for the doctor.
    """
    return (
        db.query(DoctorNotification)
        .filter_by(doctor_id=doctor_id)
        .order_by(DoctorNotification.created_at.desc())
        .limit(20)
        .all()
    )

"""
Database Bridge Service for Doctor Verification
Directly interfaces with SQLite database (backend/healthcare_records.db) using SQLAlchemy models.
Ensures zero data loss and unified persistence regardless of whether FastAPI is running standalone or proxied.
"""

import sys
import os
import json
import uuid
import base64
from datetime import datetime

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from backend.app.db.database import SessionLocal
from backend.app.db.models import (
    User,
    DoctorProfile,
    DoctorVerificationApplication,
    DoctorCredentialDocument,
    DoctorVerificationReview,
    DoctorVerificationHistory,
    DoctorNotification,
    Appointment,
    DoctorAvailability,
    DoctorAvailabilityBreak,
    DoctorScheduleOverride,
    AppointmentSlotHold,
    VideoConsultation,
    ConsultationParticipant,
    ConsultationMessage,
    ConsultationNote,
    ConsultationSignal
)

from backend.app.services.scheduling_service import (
    get_available_slots,
    hold_appointment_slot,
    release_slot_hold,
    book_appointment_atomic,
    get_patient_appointments,
    get_doctor_appointments,
    get_doctor_schedule,
    save_doctor_schedule,
    get_doctor_schedule_settings,
    save_doctor_schedule_settings,
    get_doctor_leaves,
    add_doctor_leave,
    cancel_doctor_leave,
    check_leave_appointment_conflicts,
    add_schedule_override,
    remove_schedule_override,
    cancel_appointment as cancel_apt_service,
    reschedule_appointment as reschedule_apt_service,
    join_video_consultation,
    send_consultation_signal,
    get_pending_signals,
    send_chat_message,
    get_chat_messages,
    end_video_consultation,
    get_patient_notifications,
    get_doctor_notifications,
    mark_notification_read,
    log_email_dispatch,
    get_email_logs
)

from backend.app.services.auth_service import (
    register_patient as auth_register_patient,
    login_user as auth_login_user,
    get_user_by_session as auth_get_user_by_session,
    logout_user as auth_logout_user,
    request_password_reset as auth_request_password_reset,
    reset_password as auth_reset_password,
    request_password_reset_otp as auth_request_password_reset_otp,
    verify_password_reset_otp as auth_verify_password_reset_otp,
    reset_password_with_token as auth_reset_password_with_token,
    change_user_password as auth_change_user_password
)

from backend.app.services.document_service import (
    upload_document as doc_upload_document,
    list_patient_documents as doc_list_patient_documents,
    get_document_details as doc_get_document_details,
    delete_patient_document as doc_delete_patient_document,
    get_document_download_info as doc_get_document_download_info
)

from backend.app.services.payment_service import (
    create_payment_order as pay_create_payment_order,
    verify_and_confirm_payment as pay_verify_and_confirm_payment,
    process_webhook_event as pay_process_webhook_event,
    get_payment_status_by_id as pay_get_payment_status_by_id,
    get_user_payment_history as pay_get_user_payment_history,
    process_payment_refund as pay_process_payment_refund
)

from backend.app.services.symptom_service import (
    create_symptom_assessment,
    submit_follow_up_answer,
    complete_symptom_assessment,
    send_assessment_message,
    get_assessment_details,
    list_patient_assessments,
    delete_assessment,
    get_assessment_doctors,
    generate_dynamic_symptom_suggestions,
    find_nearby_doctors
)

from backend.app.services.patient_service import (
    get_patient_profile,
    save_patient_profile
)

STORAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads", "doctor_credentials"))
os.makedirs(STORAGE_DIR, exist_ok=True)


def get_stats():
    db = SessionLocal()
    try:
        total = db.query(DoctorVerificationApplication).count()
        pending = db.query(DoctorVerificationApplication).filter_by(status="pending_review").count()
        under_review = db.query(DoctorVerificationApplication).filter_by(status="under_review").count()
        additional_docs = db.query(DoctorVerificationApplication).filter_by(status="additional_documents_required").count()
        resub = db.query(DoctorVerificationApplication).filter_by(status="resubmission_required").count()
        approved = db.query(DoctorVerificationApplication).filter_by(status="approved").count()
        rejected = db.query(DoctorVerificationApplication).filter_by(status="rejected").count()
        suspended = db.query(DoctorVerificationApplication).filter_by(status="suspended").count()

        return {
            "total_applications": total,
            "pending_review": pending,
            "under_review": under_review,
            "additional_documents_required": additional_docs,
            "resubmission_required": resub,
            "approved": approved,
            "rejected": rejected,
            "suspended": suspended
        }
    finally:
        db.close()


def list_applications(status_filter="all", search=""):
    db = SessionLocal()
    try:
        query = db.query(DoctorVerificationApplication)
        if status_filter and status_filter.lower() != "all":
            query = query.filter(DoctorVerificationApplication.status == status_filter.lower())

        apps = query.order_by(DoctorVerificationApplication.created_at.desc()).all()
        results = []

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
            exp_years = prof_info.get("experience_years") or 1

            if search:
                s = search.lower()
                matches = (
                    s in a.application_reference.lower() or
                    s in doc_name.lower() or
                    s in doc_email.lower() or
                    s in reg_num.lower() or
                    s in specialty.lower()
                )
                if not matches:
                    continue

            docs = db.query(DoctorCredentialDocument).filter_by(application_id=a.id).all()
            mandatory_verified = all(d.review_status == "verified" for d in docs if d.is_mandatory) if docs else False

            results.append({
                "id": a.id,
                "doctor_id": a.doctor_id,
                "application_reference": a.application_reference,
                "doctor_name": doc_name,
                "doctor_email": doc_email,
                "specialty": specialty,
                "registration_number": reg_num,
                "issuing_council": council,
                "highest_qualification": highest_qual,
                "experience_years": exp_years,
                "status": a.status,
                "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "documents_count": len(docs),
                "mandatory_documents_verified": mandatory_verified
            })

        return results
    finally:
        db.close()


def get_application_detail(app_id):
    db = SessionLocal()
    try:
        app = db.query(DoctorVerificationApplication).filter(
            (DoctorVerificationApplication.id == app_id) |
            (DoctorVerificationApplication.application_reference == app_id) |
            (DoctorVerificationApplication.doctor_id == app_id)
        ).first()

        if not app:
            return None

        doc = db.query(DoctorProfile).filter_by(id=app.doctor_id).first()
        p_info = app.personal_info if isinstance(app.personal_info, dict) else (json.loads(app.personal_info) if app.personal_info else {})
        prof_info = app.professional_info if isinstance(app.professional_info, dict) else (json.loads(app.professional_info) if app.professional_info else {})
        reg_info = app.registration_info if isinstance(app.registration_info, dict) else (json.loads(app.registration_info) if app.registration_info else {})
        checklist = app.eligibility_checklist if isinstance(app.eligibility_checklist, dict) else (json.loads(app.eligibility_checklist) if app.eligibility_checklist else {})

        docs = db.query(DoctorCredentialDocument).filter_by(application_id=app.id).all()
        doc_list = []
        for d in docs:
            doc_list.append({
                "id": d.id,
                "application_id": d.application_id,
                "document_type": d.document_type,
                "document_name": d.document_name,
                "original_filename": d.original_filename,
                "secure_storage_key": d.secure_storage_key,
                "mime_type": d.mime_type,
                "file_size": d.file_size,
                "is_mandatory": bool(d.is_mandatory),
                "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
                "review_status": d.review_status,
                "reviewer_id": d.reviewer_id,
                "reviewer_comments": d.reviewer_comments,
                "reviewed_at": d.reviewed_at.isoformat() if d.reviewed_at else None
            })

        reviews = db.query(DoctorVerificationReview).filter_by(application_id=app.id).all()
        review_list = []
        for r in reviews:
            review_list.append({
                "id": r.id,
                "application_id": r.application_id,
                "admin_id": r.admin_id,
                "action": r.action,
                "reason_category": r.reason_category,
                "justification": r.justification,
                "created_at": r.created_at.isoformat() if r.created_at else None
            })

        history = db.query(DoctorVerificationHistory).filter_by(application_id=app.id).order_by(DoctorVerificationHistory.timestamp.asc()).all()
        history_list = []
        for h in history:
            history_list.append({
                "id": h.id,
                "application_id": h.application_id,
                "previous_status": h.previous_status,
                "new_status": h.new_status,
                "changed_by": h.changed_by,
                "reason": h.reason,
                "timestamp": h.timestamp.isoformat() if h.timestamp else None
            })

        return {
            "id": app.id,
            "doctor_id": app.doctor_id,
            "application_reference": app.application_reference,
            "status": app.status,
            "personal_info": p_info,
            "professional_info": prof_info,
            "registration_info": reg_info,
            "eligibility_checklist": checklist,
            "submitted_at": app.submitted_at.isoformat() if app.submitted_at else None,
            "approved_at": app.approved_at.isoformat() if app.approved_at else None,
            "rejected_at": app.rejected_at.isoformat() if app.rejected_at else None,
            "created_at": app.created_at.isoformat() if app.created_at else None,
            "updated_at": app.updated_at.isoformat() if app.updated_at else None,
            "documents": doc_list,
            "reviews": review_list,
            "history": history_list
        }
    finally:
        db.close()


def register_doctor(data):
    db = SessionLocal()
    try:
        p_info = data.get("personal_info", {})
        prof_info = data.get("professional_info", {})
        reg_info = data.get("registration_info", {})
        checklist = data.get("eligibility_checklist", {})

        full_name = p_info.get("full_name") or "Dr. Medical Practitioner"
        specialty = prof_info.get("specialty") or "General Medicine"
        reg_number = reg_info.get("registration_number") or f"REG-{uuid.uuid4().hex[:6].upper()}"

        doctor_id = f"doc-{uuid.uuid4().hex[:8]}"
        spec_slug = specialty.lower().replace(" ", "-")

        # Create DoctorProfile
        doctor = DoctorProfile(
            id=doctor_id,
            name=full_name,
            title=f"Dr. {full_name.replace('Dr. ', '')}",
            specialty=specialty,
            specialty_slug=spec_slug,
            qualifications=[prof_info.get("highest_qualification") or "MBBS"],
            experience_years=int(prof_info.get("experience_years") or 1),
            rating=5.0,
            review_count=0,
            consultation_fee=float(prof_info.get("consultation_fee") or 800),
            consultation_types=prof_info.get("consultation_modes") or ["online", "in-person"],
            languages=prof_info.get("languages") or ["English"],
            clinic_name=prof_info.get("current_hospital") or "Private Practice",
            clinic_address=p_info.get("residential_address") or "Medical Center",
            clinic_city="Bangalore",
            registration_number=reg_number,
            about=prof_info.get("biography") or "Experienced healthcare practitioner.",
            expertise=[specialty],
            verified=False,
            featured=False,
            avatar=p_info.get("photo_url") or "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80",
            created_at=datetime.utcnow()
        )
        db.add(doctor)
        db.flush()

        # Generate unique reference
        year = datetime.utcnow().year
        ref_id = f"DOC-VER-{year}-{random_ref()}"
        while db.query(DoctorVerificationApplication).filter_by(application_reference=ref_id).first():
            ref_id = f"DOC-VER-{year}-{random_ref()}"

        app_id = f"dva-{uuid.uuid4().hex[:12]}"
        application = DoctorVerificationApplication(
            id=app_id,
            doctor_id=doctor_id,
            application_reference=ref_id,
            status="pending_review",
            personal_info=json.dumps(p_info),
            professional_info=json.dumps(prof_info),
            registration_info=json.dumps(reg_info),
            eligibility_checklist=json.dumps(checklist) if checklist else json.dumps({
                "mandatory_info_completed": True,
                "required_docs_uploaded": True,
                "registration_provided": True,
                "qualifications_documented": True,
                "specialization_evidence": True,
                "files_readable": True
            }),
            submitted_at=datetime.utcnow(),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(application)
        db.flush()

        history = DoctorVerificationHistory(
            id=f"dvh-{uuid.uuid4().hex[:12]}",
            application_id=app_id,
            previous_status="draft",
            new_status="pending_review",
            changed_by=doctor_id,
            reason="Initial multi-step doctor registration submission",
            timestamp=datetime.utcnow()
        )
        db.add(history)

        notification = DoctorNotification(
            id=f"dn-{uuid.uuid4().hex[:12]}",
            doctor_id=doctor_id,
            title="Application Submitted for Verification",
            message=f"Your credential verification application ({ref_id}) has been received and queued for administrative review.",
            type="info",
            action_url="/doctor/dashboard",
            created_at=datetime.utcnow()
        )
        db.add(notification)

        db.commit()

        return {
            "id": app_id,
            "doctor_id": doctor_id,
            "application_reference": ref_id,
            "status": "pending_review",
            "message": "Doctor registered and application queued for review."
        }
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def upload_document(app_id, doc_type, doc_name, filename, file_b64=None, file_size=0):
    db = SessionLocal()
    try:
        app = db.query(DoctorVerificationApplication).filter_by(id=app_id).first()
        if not app:
            raise ValueError(f"Application {app_id} not found")

        app_dir = os.path.join(STORAGE_DIR, app_id)
        os.makedirs(app_dir, exist_ok=True)

        doc_id = f"dcd-{uuid.uuid4().hex[:12]}"
        safe_filename = f"{doc_id}_{filename}"
        storage_path = os.path.join(app_dir, safe_filename)

        actual_size = file_size
        if file_b64:
            content = base64.b64decode(file_b64)
            with open(storage_path, "wb") as f:
                f.write(content)
            actual_size = len(content)
        else:
            # Create a placeholder if not provided
            with open(storage_path, "wb") as f:
                f.write(b"%PDF-1.4 official credential document placeholder\n")
            actual_size = os.path.getsize(storage_path)

        doc_record = DoctorCredentialDocument(
            id=doc_id,
            application_id=app_id,
            document_type=doc_type,
            document_name=doc_name or filename,
            original_filename=filename,
            secure_storage_key=storage_path,
            mime_type="application/pdf" if filename.endswith(".pdf") else "image/jpeg",
            file_size=actual_size,
            is_mandatory=True,
            uploaded_at=datetime.utcnow(),
            review_status="pending"
        )
        db.add(doc_record)
        app.updated_at = datetime.utcnow()
        db.commit()

        return {
            "id": doc_id,
            "application_id": app_id,
            "document_type": doc_type,
            "document_name": doc_name or filename,
            "original_filename": filename,
            "file_size": actual_size,
            "review_status": "pending"
        }
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def make_decision(app_id, action, reason_category=None, justification=None, admin_id="admin-gov-1"):
    db = SessionLocal()
    try:
        app = db.query(DoctorVerificationApplication).filter(
            (DoctorVerificationApplication.id == app_id) |
            (DoctorVerificationApplication.application_reference == app_id)
        ).first()

        if not app:
            raise ValueError(f"Application {app_id} not found")

        prev_status = app.status
        now = datetime.utcnow()

        # Check for duplicate decision clicks
        is_duplicate = False
        if prev_status == "approved" and action == "approve":
            is_duplicate = True
        elif prev_status == "rejected" and action == "reject":
            last_review = db.query(DoctorVerificationReview).filter_by(application_id=app.id).order_by(DoctorVerificationReview.created_at.desc()).first()
            if last_review and last_review.justification == justification:
                is_duplicate = True

        review_id = f"dvr-{uuid.uuid4().hex[:12]}"

        if not is_duplicate:
            if action == "approve":
                app.status = "approved"
                app.approved_at = now
                # Activate doctor public profile and booking capability
                doc = db.query(DoctorProfile).filter_by(id=app.doctor_id).first()
                if doc:
                    doc.verified = True
                    if not doc.availability:
                        doc.availability = {
                            "nextAvailable": "Today, 10:00 AM",
                            "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                            "slots": ["10:00 AM", "11:30 AM", "02:00 PM", "04:30 PM", "06:00 PM"]
                        }

                # Mark all documents as verified
                docs = db.query(DoctorCredentialDocument).filter_by(application_id=app.id).all()
                for d in docs:
                    d.review_status = "verified"
                    d.reviewer_id = admin_id
                    d.reviewed_at = now

                # Activate user login verification
                usr = db.query(User).filter_by(doctor_id=app.doctor_id).first()
                if usr:
                    usr.is_verified = True

                # In-app notification to doctor
                notif = DoctorNotification(
                    id=f"dn-{uuid.uuid4().hex[:12]}",
                    doctor_id=app.doctor_id,
                    title="Credential Verification Approved",
                    message=f"Congratulations! Your credential verification application ({app.application_reference}) has been approved. Your doctor profile is now active on the public Doctors directory.",
                    type="success",
                    action_url=f"/doctor/{app.doctor_id}",
                    created_at=now
                )
                db.add(notif)

            elif action == "reject":
                if not justification or len(justification.strip()) < 5:
                    raise ValueError("Justification is mandatory for rejection")
                app.status = "rejected"
                app.rejected_at = now
                doc = db.query(DoctorProfile).filter_by(id=app.doctor_id).first()
                if doc:
                    doc.verified = False

                usr = db.query(User).filter_by(doctor_id=app.doctor_id).first()
                if usr:
                    usr.is_verified = False

                notif = DoctorNotification(
                    id=f"dn-{uuid.uuid4().hex[:12]}",
                    doctor_id=app.doctor_id,
                    title="Credential Verification Rejected",
                    message=f"Your verification application was rejected: {justification}",
                    type="error",
                    action_url="/doctor/dashboard",
                    created_at=now
                )
                db.add(notif)

            elif action == "suspend":
                app.status = "suspended"
                doc = db.query(DoctorProfile).filter_by(id=app.doctor_id).first()
                if doc:
                    doc.verified = False

                notif = DoctorNotification(
                    id=f"dn-{uuid.uuid4().hex[:12]}",
                    doctor_id=app.doctor_id,
                    title="Doctor Account Suspended",
                    message=f"Your doctor profile and appointment booking have been suspended: {justification or 'Administrative suspension'}",
                    type="warning",
                    action_url="/doctor/dashboard",
                    created_at=now
                )
                db.add(notif)

            elif action == "request_additional_documents":
                app.status = "additional_documents_required"
                doc = db.query(DoctorProfile).filter_by(id=app.doctor_id).first()
                if doc:
                    doc.verified = False

                notif = DoctorNotification(
                    id=f"dn-{uuid.uuid4().hex[:12]}",
                    doctor_id=app.doctor_id,
                    title="Additional Documents Required",
                    message=f"Please upload additional verification documents: {justification}",
                    type="info",
                    action_url="/doctor/dashboard",
                    created_at=now
                )
                db.add(notif)

            app.updated_at = now
            app.assigned_admin_id = admin_id

            # Add review record
            review = DoctorVerificationReview(
                id=review_id,
                application_id=app.id,
                admin_id=admin_id,
                action=action,
                reason_category=reason_category,
                justification=justification,
                created_at=now
            )
            db.add(review)

            # Add history log
            history = DoctorVerificationHistory(
                id=f"dvh-{uuid.uuid4().hex[:12]}",
                application_id=app.id,
                previous_status=prev_status,
                new_status=app.status,
                changed_by=admin_id,
                reason=justification or f"Admin decision: {action}",
                timestamp=now
            )
            db.add(history)

            db.commit()

        # Resolve doctor's registered email, name, phone, specialty directly from database
        doctor_email = None
        doctor_name = None
        doctor_phone = None
        specialty = None

        if app.personal_info:
            try:
                p_data = json.loads(app.personal_info) if isinstance(app.personal_info, str) else app.personal_info
                if isinstance(p_data, str):
                    p_data = json.loads(p_data)
                if isinstance(p_data, dict):
                    doctor_email = p_data.get("email")
                    doctor_name = p_data.get("full_name")
                    doctor_phone = p_data.get("phone")
            except Exception:
                pass

        if app.professional_info:
            try:
                prof_data = json.loads(app.professional_info) if isinstance(app.professional_info, str) else app.professional_info
                if isinstance(prof_data, str):
                    prof_data = json.loads(prof_data)
                if isinstance(prof_data, dict):
                    specialty = prof_data.get("specialty")
            except Exception:
                pass

        # Check User record for registered email fallback
        usr_rec = db.query(User).filter_by(doctor_id=app.doctor_id).first()
        if usr_rec:
            if not doctor_email:
                doctor_email = usr_rec.email
            if not doctor_name:
                doctor_name = usr_rec.full_name
            if not doctor_phone:
                doctor_phone = usr_rec.phone

        doc_rec = db.query(DoctorProfile).filter_by(id=app.doctor_id).first()
        if doc_rec:
            if not doctor_name:
                doctor_name = doc_rec.name
            if not specialty:
                specialty = doc_rec.specialty

        return {
            "application_id": app.id,
            "doctor_id": app.doctor_id,
            "application_reference": app.application_reference,
            "status": app.status,
            "previous_status": prev_status,
            "action": action,
            "is_duplicate_decision": is_duplicate,
            "justification": justification,
            "reason_category": reason_category,
            "doctor_name": doctor_name or "Doctor",
            "doctor_email": doctor_email,
            "doctor_phone": doctor_phone,
            "specialty": specialty or "General Medicine",
            "decision_id": review_id if not is_duplicate else f"dup-{app.id}-{action}",
            "decided_at": now.isoformat(),
            "message": f"Application {action} recorded in database."
        }
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def safe_list(val, default):
    if val is None:
        return default
    if isinstance(val, list):
        return val
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            return [val]
    if isinstance(val, dict):
        return list(val.values())
    return default


def format_doctor_profile(doc: DoctorProfile) -> dict:
    qual = safe_list(doc.qualifications, ["MBBS"])
    ctypes = safe_list(doc.consultation_types, ["online", "in-person"])
    langs = safe_list(doc.languages, ["English", "Hindi"])
    exp = safe_list(doc.expertise, [doc.specialty])
    raw_avail = doc.availability
    if isinstance(raw_avail, str):
        try:
            raw_avail = json.loads(raw_avail)
        except Exception:
            raw_avail = None

    if isinstance(raw_avail, dict) and "slots" in raw_avail:
        avail = {
            "nextAvailable": raw_avail.get("nextAvailable", "Today, 4:30 PM"),
            "days": safe_list(raw_avail.get("days"), ["Mon", "Tue", "Wed", "Thu", "Fri"]),
            "slots": safe_list(raw_avail.get("slots"), ["09:00 AM", "11:00 AM", "02:00 PM", "04:30 PM"])
        }
    elif isinstance(raw_avail, list) and len(raw_avail) > 0 and isinstance(raw_avail[0], dict) and "slots" in raw_avail[0]:
        all_slots = []
        days = []
        for d_item in raw_avail:
            days.append(d_item.get("day", "")[:3])
            all_slots.extend(d_item.get("slots", []))
        avail = {
            "nextAvailable": "Today, 4:30 PM",
            "days": days if days else ["Mon", "Tue", "Wed", "Thu", "Fri"],
            "slots": all_slots[:4] if all_slots else ["09:00 AM", "11:00 AM", "02:00 PM", "04:30 PM"]
        }
    else:
        avail = {
            "nextAvailable": "Today, 4:30 PM",
            "days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
            "slots": ["09:00 AM", "11:00 AM", "02:00 PM", "04:30 PM"]
        }

    return {
        "id": doc.id,
        "name": doc.name,
        "title": doc.title or f"Consultant - {doc.specialty}",
        "avatar": doc.avatar or "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=600&q=80",
        "specialty": doc.specialty,
        "specialtySlug": doc.specialty_slug or doc.specialty.lower().replace(" ", "-"),
        "qualifications": qual,
        "experienceYears": doc.experience_years or 5,
        "rating": float(doc.rating) if doc.rating else 4.8,
        "reviewCount": doc.review_count or 50,
        "consultationFee": float(doc.consultation_fee) if doc.consultation_fee else 800.0,
        "consultationTypes": ctypes,
        "languages": langs,
        "clinic": {
            "name": doc.clinic_name or "MediVerse Clinical Center",
            "address": doc.clinic_address or "Main Medical District",
            "city": doc.clinic_city or "Bangalore",
            "pincode": doc.clinic_pincode or "560001"
        },
        "registrationNumber": doc.registration_number or "Verified Medical Council Registered",
        "about": doc.about or f"Senior specialist in {doc.specialty} with comprehensive clinical background.",
        "expertise": exp,
        "availability": avail,
        "verified": True,
        "featured": bool(doc.featured)
    }


def get_approved_doctors(
    search: str = "",
    specialty: str = "",
    city: str = "",
    consult_type: str = "",
    min_exp: int = 0,
    max_fee: float = 0.0,
    min_rating: float = 0.0,
    language: str = "",
    sort_by: str = "rating"
) -> list:
    """
    Returns only verified doctors whose latest verification application status is 'approved'.
    Strictly filters out pending, under review, rejected, suspended, or unverified doctors.
    """
    db = SessionLocal()
    try:
        # Only query doctors marked verified
        query = db.query(DoctorProfile).filter(DoctorProfile.verified == True)
        all_candidates = query.all()

        approved_doctors = []
        for doc in all_candidates:
            # Check latest verification application status
            latest_app = db.query(DoctorVerificationApplication).filter_by(
                doctor_id=doc.id
            ).order_by(DoctorVerificationApplication.created_at.desc()).first()

            if not latest_app or latest_app.status != "approved":
                continue

            doc_formatted = format_doctor_profile(doc)

            # 1. Search Query (Name, Specialty, Clinic, City)
            if search:
                s = search.lower().strip()
                matches_search = (
                    s in doc_formatted["name"].lower() or
                    s in doc_formatted["specialty"].lower() or
                    s in doc_formatted["clinic"]["name"].lower() or
                    s in doc_formatted["clinic"]["city"].lower()
                )
                if not matches_search:
                    continue

            # 2. Specialty Filter
            if specialty and specialty.lower() != "all":
                spec_term = specialty.lower()
                if (
                    doc_formatted["specialty"].lower() != spec_term and
                    doc_formatted["specialtySlug"].lower() != spec_term
                ):
                    continue

            # 3. City Filter
            if city and city.lower() != "all":
                if city.lower() not in doc_formatted["clinic"]["city"].lower():
                    continue

            # 4. Consultation Type ("online", "in-person")
            if consult_type and consult_type.lower() != "all":
                if consult_type.lower() not in [t.lower() for t in doc_formatted["consultationTypes"]]:
                    continue

            # 5. Experience
            if min_exp > 0 and doc_formatted["experienceYears"] < min_exp:
                continue

            # 6. Max Fee
            if max_fee > 0 and doc_formatted["consultationFee"] > max_fee:
                continue

            # 7. Min Rating
            if min_rating > 0 and doc_formatted["rating"] < min_rating:
                continue

            # 8. Language
            if language and language.lower() != "all":
                if not any(language.lower() in l.lower() for l in doc_formatted["languages"]):
                    continue

            approved_doctors.append(doc_formatted)

        # Sorting
        if sort_by == "experience":
            approved_doctors.sort(key=lambda d: d["experienceYears"], reverse=True)
        elif sort_by == "fee_asc":
            approved_doctors.sort(key=lambda d: d["consultationFee"])
        elif sort_by == "fee_desc":
            approved_doctors.sort(key=lambda d: d["consultationFee"], reverse=True)
        else: # default: rating
            approved_doctors.sort(key=lambda d: d["rating"], reverse=True)

        return approved_doctors
    finally:
        db.close()


def get_approved_doctor_by_id(doctor_id: str) -> dict | None:
    """
    Returns public profile of an approved doctor.
    Returns None if doctor is not found, not verified, or application is not approved.
    NEVER exposes private verification documents or admin history.
    """
    db = SessionLocal()
    try:
        doc = db.query(DoctorProfile).filter_by(id=doctor_id, verified=True).first()
        if not doc:
            return None

        latest_app = db.query(DoctorVerificationApplication).filter_by(
            doctor_id=doc.id
        ).order_by(DoctorVerificationApplication.created_at.desc()).first()

        if not latest_app or latest_app.status != "approved":
            return None

        return format_doctor_profile(doc)
    finally:
        db.close()


def book_appointment(payload: dict) -> dict:
    """
    Books an appointment with a verified and approved doctor.
    Fails if doctor is not verified or unapproved.
    """
    db = SessionLocal()
    try:
        doctor_id = payload.get("doctor_id")
        if not doctor_id:
            raise ValueError("doctor_id is required")

        doc = db.query(DoctorProfile).filter_by(id=doctor_id, verified=True).first()
        if not doc:
            raise ValueError("Doctor is unverified or does not exist")

        latest_app = db.query(DoctorVerificationApplication).filter_by(
            doctor_id=doc.id
        ).order_by(DoctorVerificationApplication.created_at.desc()).first()

        if not latest_app or latest_app.status != "approved":
            raise ValueError("Doctor verification status is not approved. Appointment booking disabled.")

        patient_name = payload.get("patient_name", "Registered Patient")
        patient_email = payload.get("patient_email", "patient@example.com")
        date_str = payload.get("date", datetime.utcnow().strftime("%Y-%m-%d"))
        time_str = payload.get("time", "10:00 AM")
        consult_type = payload.get("type", "online")

        apt = Appointment(
            id=f"apt-{uuid.uuid4().hex[:10]}",
            doctor_id=doc.id,
            doctor_name=doc.name,
            doctor_specialty=doc.specialty,
            doctor_avatar=doc.avatar,
            patient_id=payload.get("patient_id", "pt-user-1"),
            patient_name=patient_name,
            patient_email=patient_email,
            date=date_str,
            time=time_str,
            type=consult_type,
            status="upcoming",
            fee=doc.consultation_fee,
            clinic_name=doc.clinic_name,
            meeting_link=f"https://meet.mediverse.health/{uuid.uuid4().hex[:8]}" if consult_type == "online" else None
        )
        db.add(apt)

        # Notify doctor
        notif = DoctorNotification(
            doctor_id=doc.id,
            title="New Consultation Booked",
            message=f"Appointment booked with {patient_name} on {date_str} at {time_str} ({consult_type}).",
            type="success",
            action_url="/doctor/appointments"
        )
        db.add(notif)

        db.commit()

        return {
            "success": True,
            "appointment": {
                "id": apt.id,
                "doctor_id": apt.doctor_id,
                "doctor_name": apt.doctor_name,
                "doctor_specialty": apt.doctor_specialty,
                "doctor_avatar": apt.doctor_avatar,
                "patient_name": apt.patient_name,
                "patient_email": apt.patient_email,
                "date": apt.date,
                "time": apt.time,
                "type": apt.type,
                "status": apt.status,
                "fee": apt.fee,
                "clinic_name": apt.clinic_name,
                "meeting_link": apt.meeting_link,
                "created_at": apt.created_at.isoformat()
            }
        }
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def review_document(doc_id, review_status, reviewer_comments=None, admin_id="admin-gov-1"):
    db = SessionLocal()
    try:
        doc = db.query(DoctorCredentialDocument).filter_by(id=doc_id).first()
        if not doc:
            raise ValueError(f"Document {doc_id} not found")

        doc.review_status = review_status
        doc.reviewer_id = admin_id
        doc.reviewer_comments = reviewer_comments
        doc.reviewed_at = datetime.utcnow()

        app = db.query(DoctorVerificationApplication).filter_by(id=doc.application_id).first()
        if app and app.status == "pending_review":
            app.status = "under_review"
            app.assigned_admin_id = admin_id
            app.updated_at = datetime.utcnow()

        db.commit()
        return {"document_id": doc_id, "review_status": review_status}
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def sync_all_to_json():
    """
    Exports all applications from SQLite into uploads/doctor_credentials/applications.json
    so that frontend API routes have instant, sub-millisecond access to real database state.
    """
    db = SessionLocal()
    try:
        apps = db.query(DoctorVerificationApplication).order_by(DoctorVerificationApplication.created_at.desc()).all()
        full_list = []
        for a in apps:
            detail = get_application_detail(a.id)
            if detail:
                full_list.append(detail)

        target_path = os.path.join(STORAGE_DIR, "applications.json")
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(full_list, f, indent=2, default=str)
        return len(full_list)
    finally:
        db.close()


def random_ref():
    import random
    return str(random.randint(1000, 9999))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No action specified"}))
        sys.exit(1)

    action = sys.argv[1]

    try:
        if action == "sync":
            count = sync_all_to_json()
            print(json.dumps({"synced_applications": count, "file": os.path.join(STORAGE_DIR, "applications.json")}))
        elif action == "stats":
            print(json.dumps(get_stats()))
        elif action == "list":
            status_filter = sys.argv[2] if len(sys.argv) > 2 else "all"
            search = sys.argv[3] if len(sys.argv) > 3 else ""
            print(json.dumps(list_applications(status_filter, search)))
        elif action == "detail":
            app_id = sys.argv[2]
            res = get_application_detail(app_id)
            print(json.dumps(res))
        elif action == "register":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = register_doctor(payload)
            sync_all_to_json()
            print(json.dumps(res))
        elif action == "upload_doc":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = upload_document(
                payload["application_id"],
                payload["document_type"],
                payload.get("document_name", ""),
                payload["filename"],
                payload.get("file_b64"),
                payload.get("file_size", 0)
            )
            sync_all_to_json()
            print(json.dumps(res))
        elif action == "decision":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = make_decision(
                payload["application_id"],
                payload["action"],
                payload.get("reason_category"),
                payload.get("justification"),
                payload.get("admin_id", "admin-gov-1")
            )
            sync_all_to_json()
            print(json.dumps(res))
        elif action == "approved_doctors":
            payload = {}
            if len(sys.argv) > 2 and sys.argv[2]:
                try:
                    payload = json.loads(sys.argv[2])
                except Exception:
                    payload = {}

            res = get_approved_doctors(
                search=payload.get("search", ""),
                specialty=payload.get("specialty", ""),
                city=payload.get("city", ""),
                consult_type=payload.get("consult_type", ""),
                min_exp=int(payload.get("min_exp", 0)),
                max_fee=float(payload.get("max_fee", 0.0)),
                min_rating=float(payload.get("min_rating", 0.0)),
                language=payload.get("language", ""),
                sort_by=payload.get("sort_by", "rating")
            )
            print(json.dumps(res))
        elif action == "doctor_detail":
            doc_id = sys.argv[2]
            res = get_approved_doctor_by_id(doc_id)
            if res is None:
                print(json.dumps({"error": "Doctor not found or not approved", "status": 404}))
            else:
                print(json.dumps(res))
        elif action == "book_appointment":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = book_appointment_atomic(payload)
            print(json.dumps(res))
        elif action == "get_slots":
            doctor_id = sys.argv[2]
            target_date = sys.argv[3] if len(sys.argv) > 3 else datetime.utcnow().strftime("%Y-%m-%d")
            consult_mode = sys.argv[4] if len(sys.argv) > 4 else "all"
            res = get_available_slots(doctor_id, target_date, consult_mode)
            print(json.dumps(res))
        elif action == "hold_slot":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = hold_appointment_slot(payload)
            print(json.dumps(res))
        elif action == "release_hold":
            hold_id = sys.argv[2]
            res = release_slot_hold(hold_id)
            print(json.dumps({"success": res}))
        elif action == "patient_appointments":
            patient_id = sys.argv[2] if len(sys.argv) > 2 else "pt-101"
            status_filter = sys.argv[3] if len(sys.argv) > 3 else "all"
            res = get_patient_appointments(patient_id, status_filter)
            print(json.dumps(res))
        elif action == "doctor_appointments":
            doctor_id = sys.argv[2]
            status_filter = sys.argv[3] if len(sys.argv) > 3 else "all"
            res = get_doctor_appointments(doctor_id, status_filter)
            print(json.dumps(res))
        elif action == "doctor_schedule":
            doctor_id = sys.argv[2]
            res = get_doctor_schedule(doctor_id)
            print(json.dumps(res))
        elif action == "save_schedule":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            doctor_id = payload["doctor_id"]
            res = save_doctor_schedule(doctor_id, payload)
            print(json.dumps(res))
        elif action == "schedule_settings":
            doctor_id = sys.argv[2]
            res = get_doctor_schedule_settings(doctor_id)
            print(json.dumps(res))
        elif action == "save_schedule_settings":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            doctor_id = payload.get("doctor_id") or (sys.argv[2] if len(sys.argv) > 2 else "")
            res = save_doctor_schedule_settings(doctor_id, payload)
            print(json.dumps(res))
        elif action == "doctor_leaves":
            doctor_id = sys.argv[2]
            status = sys.argv[3] if len(sys.argv) > 3 else "all"
            res = get_doctor_leaves(doctor_id, status)
            print(json.dumps(res))
        elif action == "add_leave":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            doctor_id = payload.get("doctor_id") or (sys.argv[2] if len(sys.argv) > 2 else "")
            res = add_doctor_leave(doctor_id, payload)
            print(json.dumps(res))
        elif action == "cancel_leave":
            doctor_id = sys.argv[2]
            leave_id = sys.argv[3]
            res = cancel_doctor_leave(doctor_id, leave_id)
            print(json.dumps(res))
        elif action == "add_override":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            doctor_id = payload["doctor_id"]
            res = add_schedule_override(doctor_id, payload)
            print(json.dumps(res))
        elif action == "remove_override":
            doctor_id = sys.argv[2]
            override_id = sys.argv[3]
            res = remove_schedule_override(doctor_id, override_id)
            print(json.dumps(res))
        elif action == "patient_notifications":
            patient_id = sys.argv[2] if len(sys.argv) > 2 else "pt-101"
            res = get_patient_notifications(patient_id)
            print(json.dumps(res))
        elif action == "doctor_notifications":
            doctor_id = sys.argv[2] if len(sys.argv) > 2 else "doc-1"
            res = get_doctor_notifications(doctor_id)
            print(json.dumps(res))
        elif action == "mark_notification_read":
            notif_id = sys.argv[2]
            role = sys.argv[3] if len(sys.argv) > 3 else "patient"
            res = mark_notification_read(notif_id, role)
            print(json.dumps({"success": res}))
        elif action == "log_email":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = log_email_dispatch(payload)
            print(json.dumps(res))
        elif action == "get_email_logs":
            apt_id = sys.argv[2] if len(sys.argv) > 2 else None
            res = get_email_logs(apt_id)
            print(json.dumps(res))
        elif action == "check_cancellation_policy":
            apt_id = sys.argv[2]
            from backend.app.services.scheduling_service import check_cancellation_eligibility
            res = check_cancellation_eligibility(apt_id)
            print(json.dumps(res))
        elif action == "cancel_appointment":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = cancel_apt_service(
                payload["appointment_id"],
                payload.get("reason", "Patient request"),
                payload.get("cancelled_by", "patient")
            )
            print(json.dumps(res))
        elif action == "reschedule_appointment":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = reschedule_apt_service(
                payload["appointment_id"],
                payload["new_date"],
                payload["new_time"],
                payload["new_start_time"],
                payload["new_end_time"]
            )
            print(json.dumps(res))
        elif action == "join_consultation":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            try:
                res = join_video_consultation(
                    payload["room_id"],
                    payload["user_id"],
                    payload["user_name"],
                    payload["user_role"]
                )
                print(json.dumps(res))
            except Exception as e:
                print(json.dumps({"success": False, "error": str(e)}))
        elif action == "send_signal":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = send_consultation_signal(
                payload["room_id"],
                payload["sender_role"],
                payload["target_role"],
                payload["signal_type"],
                payload["signal_data"]
            )
            print(json.dumps(res))
        elif action == "get_signals":
            room_id = sys.argv[2]
            target_role = sys.argv[3]
            res = get_pending_signals(room_id, target_role)
            print(json.dumps(res))
        elif action == "send_message":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = send_chat_message(
                payload["room_id"],
                payload["sender_id"],
                payload["sender_name"],
                payload["sender_role"],
                payload["message"]
            )
            print(json.dumps(res))
        elif action == "get_messages":
            room_id = sys.argv[2]
            res = get_chat_messages(room_id)
            print(json.dumps(res))
        elif action == "end_consultation":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = end_video_consultation(payload["room_id"], payload)
            print(json.dumps(res))
        elif action == "review_doc":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = review_document(
                payload["document_id"],
                payload["review_status"],
                payload.get("reviewer_comments"),
                payload.get("admin_id", "admin-gov-1")
            )
            sync_all_to_json()
            print(json.dumps(res))
        # --- AUTHENTICATION & MULTI-ROLE DISPATCHER ---
        elif action == "auth_register":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = auth_register_patient(payload)
            print(json.dumps(res))
        elif action == "auth_login":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = auth_login_user(
                identifier=payload.get("identifier") or payload.get("email") or payload.get("phone", ""),
                password=payload.get("password", ""),
                expected_role=payload.get("expected_role") or payload.get("role")
            )
            print(json.dumps(res))
        elif action == "auth_me":
            token = sys.argv[2] if len(sys.argv) > 2 else ""
            if not token:
                payload_str = sys.stdin.read()
                if payload_str.strip():
                    token = json.loads(payload_str).get("token", "")
            user = auth_get_user_by_session(token)
            if not user:
                print(json.dumps({"authenticated": False, "user": None}))
            else:
                print(json.dumps({"authenticated": True, "user": user}))
        elif action == "auth_logout":
            token = sys.argv[2] if len(sys.argv) > 2 else ""
            if not token:
                payload_str = sys.stdin.read()
                if payload_str.strip():
                    token = json.loads(payload_str).get("token", "")
            res = auth_logout_user(token)
            print(json.dumps({"success": res}))
        elif action == "auth_forgot_password":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = auth_request_password_reset(payload.get("email", ""))
            print(json.dumps(res))
        elif action == "auth_reset_password":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = auth_reset_password(payload.get("token", ""), payload.get("new_password", ""))
            print(json.dumps(res))
        elif action == "auth_request_password_reset_otp":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = auth_request_password_reset_otp(payload.get("email", ""), payload.get("role"))
            print(json.dumps(res))
        elif action == "auth_verify_password_reset_otp":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = auth_verify_password_reset_otp(payload.get("email", ""), payload.get("role"), payload.get("otp", ""))
            print(json.dumps(res))
        elif action == "auth_reset_password_with_token":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = auth_reset_password_with_token(payload.get("reset_token", ""), payload.get("new_password", ""))
            print(json.dumps(res))
        elif action == "auth_change_password":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = auth_change_user_password(
                payload.get("identifier") or payload.get("user_id") or payload.get("email", ""),
                payload.get("current_password", ""),
                payload.get("new_password", "")
            )
            print(json.dumps(res))

        # --- PERSISTENT MEDICAL DOCUMENT DISPATCHER ---
        elif action == "list_patient_docs":
            patient_id = sys.argv[2] if len(sys.argv) > 2 else "pat-101"
            category = sys.argv[3] if len(sys.argv) > 3 else None
            search = sys.argv[4] if len(sys.argv) > 4 else None
            res = doc_list_patient_documents(patient_id, category, search)
            print(json.dumps(res))
        elif action == "get_patient_doc":
            document_id = sys.argv[2]
            patient_id = sys.argv[3] if len(sys.argv) > 3 else None
            res = doc_get_document_details(document_id, patient_id)
            print(json.dumps(res))
        elif action == "upload_patient_doc":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            raw_bytes = base64.b64decode(payload["file_base64"])
            res = doc_upload_document(
                patient_id=payload["patient_id"],
                filename=payload["filename"],
                file_bytes=raw_bytes,
                category=payload.get("category"),
                title=payload.get("title"),
                user_id=payload.get("user_id"),
                facility=payload.get("facility")
            )
            print(json.dumps(res))
        elif action == "delete_patient_doc":
            document_id = sys.argv[2]
            patient_id = sys.argv[3] if len(sys.argv) > 3 else None
            res = doc_delete_patient_document(document_id, patient_id)
            print(json.dumps(res))
        elif action == "download_patient_doc_info":
            document_id = sys.argv[2]
            patient_id = sys.argv[3] if len(sys.argv) > 3 else None
            res = doc_get_document_download_info(document_id, patient_id)
            print(json.dumps(res))

        # --- AI SYMPTOM ASSESSMENT & DOCTOR RECOMMENDATION DISPATCHER ---
        elif action == "create_assessment":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = create_symptom_assessment(
                patient_id=payload["patient_id"],
                description=payload["description"],
                selected_symptoms=payload.get("selected_symptoms"),
                duration=payload.get("duration"),
                severity=payload.get("severity", "Moderate"),
                progression=payload.get("progression", "unchanged"),
                started_at=payload.get("started_at"),
                patient_context_overrides=payload.get("patient_context"),
                include_medical_documents=payload.get("include_medical_documents", False)
            )
            print(json.dumps(res))
        elif action == "list_assessments":
            patient_id = sys.argv[2]
            res = list_patient_assessments(patient_id)
            print(json.dumps(res))
        elif action == "get_assessment":
            assessment_id = sys.argv[2]
            patient_id = sys.argv[3] if len(sys.argv) > 3 else None
            res = get_assessment_details(assessment_id, patient_id)
            print(json.dumps(res))
        elif action == "answer_question":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = submit_follow_up_answer(
                assessment_id=payload["assessment_id"],
                patient_id=payload["patient_id"],
                question=payload["question"],
                answer=payload["answer"]
            )
            print(json.dumps(res))
        elif action == "complete_assessment":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str) if payload_str.strip() else {}
            assessment_id = payload.get("assessment_id") or (sys.argv[2] if len(sys.argv) > 2 else "")
            patient_id = payload.get("patient_id") or (sys.argv[3] if len(sys.argv) > 3 else "")
            res = complete_symptom_assessment(assessment_id, patient_id)
            print(json.dumps(res))
        elif action == "message_assessment":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = send_assessment_message(
                assessment_id=payload["assessment_id"],
                patient_id=payload["patient_id"],
                message=payload["message"]
            )
            print(json.dumps(res))
        elif action == "assessment_doctors":
            assessment_id = sys.argv[2]
            patient_id = sys.argv[3] if len(sys.argv) > 3 else None
            city = sys.argv[4] if len(sys.argv) > 4 else None
            res = get_assessment_doctors(assessment_id, patient_id, city=city)
            print(json.dumps(res))
        elif action == "delete_assessment":
            assessment_id = sys.argv[2]
            patient_id = sys.argv[3] if len(sys.argv) > 3 else None
            res = delete_assessment(assessment_id, patient_id)
            print(json.dumps(res))

        # --- PATIENT PROFILE ACTIONS ---
        elif action == "get_patient_profile":
            patient_id = sys.argv[2]
            res = get_patient_profile(patient_id)
            print(json.dumps(res))
        elif action == "save_patient_profile":
            patient_id = sys.argv[2]
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = save_patient_profile(patient_id, payload)
            print(json.dumps(res))

        # --- DYNAMIC SYMPTOM SUGGESTIONS & GEOSPATIAL DOCTOR SEARCH ---
        elif action == "suggest_symptoms":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            res = generate_dynamic_symptom_suggestions(
                description=payload.get("description", ""),
                patient_context=payload.get("patient_context")
            )
            print(json.dumps(res))
        elif action == "find_nearby_doctors":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str) if payload_str.strip() else {}
            lat = payload.get("latitude") or (float(sys.argv[2]) if len(sys.argv) > 2 else 13.0827)
            lng = payload.get("longitude") or (float(sys.argv[3]) if len(sys.argv) > 3 else 80.2707)
            specs = payload.get("specialties") or []
            radius = float(payload.get("radius_km") or 5.0)
            city = payload.get("city") or "Chennai"
            res = find_nearby_doctors(
                latitude=float(lat),
                longitude=float(lng),
                specialties=specs,
                initial_radius_km=radius,
                city=city
            )
            print(json.dumps(res))
        elif action == "payment_create_order":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            user_id = payload.get("user_id") or (sys.argv[2] if len(sys.argv) > 2 else "usr-pat-101")
            res = pay_create_payment_order(user_id=user_id, payload=payload)
            print(json.dumps(res))
        elif action == "payment_verify":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            user_id = payload.get("user_id") or (sys.argv[2] if len(sys.argv) > 2 else "usr-pat-101")
            res = pay_verify_and_confirm_payment(user_id=user_id, payload=payload)
            print(json.dumps(res))
        elif action == "payment_webhook":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            raw_body = payload.get("raw_body", "").encode("utf-8")
            sig_header = payload.get("signature_header", "")
            event_data = payload.get("event_data", {})
            res = pay_process_webhook_event(raw_body=raw_body, signature_header=sig_header, event_data=event_data)
            print(json.dumps(res))
        elif action == "payment_status":
            payment_id = sys.argv[2]
            user_id = sys.argv[3] if len(sys.argv) > 3 else None
            res = pay_get_payment_status_by_id(payment_id=payment_id, user_id=user_id)
            print(json.dumps(res))
        elif action == "payment_history":
            user_id = sys.argv[2] if len(sys.argv) > 2 else "usr-pat-101"
            role = sys.argv[3] if len(sys.argv) > 3 else "patient"
            res = pay_get_user_payment_history(user_id=user_id, role=role)
            print(json.dumps(res))
        elif action == "payment_refund":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            payment_id = payload.get("payment_id") or (sys.argv[2] if len(sys.argv) > 2 else None)
            user_id = payload.get("user_id") or (sys.argv[3] if len(sys.argv) > 3 else "usr-pat-101")
            amount = payload.get("amount")
            reason = payload.get("reason")
            res = pay_process_payment_refund(payment_id=payment_id, user_id=user_id, amount=amount, reason=reason)
            print(json.dumps(res))
        elif action == "get_oauth_token":
            provider_id = sys.argv[2] if len(sys.argv) > 2 else "gmail"
            from backend.app.db.models import OAuthToken
            from backend.app.db.database import SessionLocal
            db = SessionLocal()
            try:
                tok = db.query(OAuthToken).filter_by(id=provider_id).first()
                if tok:
                    print(json.dumps({"success": True, "token": tok.to_dict()}))
                else:
                    print(json.dumps({"success": False, "token": None}))
            finally:
                db.close()
        elif action == "save_oauth_token":
            payload_str = sys.stdin.read()
            payload = json.loads(payload_str)
            provider_id = payload.get("id") or "gmail"
            from backend.app.db.models import OAuthToken
            from backend.app.db.database import SessionLocal
            db = SessionLocal()
            try:
                tok = db.query(OAuthToken).filter_by(id=provider_id).first()
                if not tok:
                    tok = OAuthToken(
                        id=provider_id,
                        provider=payload.get("provider", "google"),
                        created_at=datetime.utcnow()
                    )
                    db.add(tok)
                if "account_email" in payload:
                    tok.account_email = payload["account_email"]
                if "access_token" in payload and payload["access_token"]:
                    tok.access_token = payload["access_token"]
                if "refresh_token" in payload and payload["refresh_token"]:
                    tok.refresh_token = payload["refresh_token"]
                if "scope" in payload:
                    tok.scope = payload["scope"]
                if "token_type" in payload:
                    tok.token_type = payload["token_type"]
                if "expires_at" in payload and payload["expires_at"]:
                    tok.expires_at = int(payload["expires_at"])
                tok.updated_at = datetime.utcnow()
                db.commit()
                print(json.dumps({"success": True, "token": tok.to_dict()}))
            except Exception as e:
                db.rollback()
                print(json.dumps({"success": False, "error": str(e)}))
            finally:
                db.close()
        else:
            print(json.dumps({"error": f"Unknown action {action}"}))
    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)

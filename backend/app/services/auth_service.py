"""
Production Multi-Role Authentication & Session Management Service for MediVerse
Roles: Patient, Doctor, Admin
Secure Bcrypt password hashing, session tokens, and server-side role resolution.
"""

import os
import sys
import re
import uuid
import secrets
import bcrypt
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from backend.app.db.database import SessionLocal
from backend.app.db.models import (
    User,
    PatientProfile,
    DoctorProfile,
    DoctorVerificationApplication,
    UserSession,
    PasswordResetToken
)

SESSION_DURATION_DAYS = 7
RESET_TOKEN_DURATION_HOURS = 2


def hash_password(password: str) -> str:
    """Securely hash password using bcrypt with salt."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Verify plaintext password against bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def validate_password_strength(password: str) -> Tuple[bool, Optional[str]]:
    """Enforces minimum 8 characters."""
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters in length."
    return True, None


def normalize_email(email: str) -> str:
    return email.strip().lower()


def normalize_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    cleaned = re.sub(r"[^\d+]", "", phone.strip())
    return cleaned if len(cleaned) >= 10 else phone.strip()


# =============================================================================
# 1. PATIENT REGISTRATION
# =============================================================================

def register_patient(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Registers a new patient account:
    - Validates personal details
    - Hashes password with bcrypt
    - Persists User (role='patient') and linked PatientProfile
    - Generates 7-day authenticated session
    """
    full_name = payload.get("full_name") or payload.get("fullName") or ""
    email = normalize_email(payload.get("email", ""))
    phone = normalize_phone(payload.get("phone") or payload.get("mobile"))
    password = payload.get("password", "")
    dob = payload.get("dob") or payload.get("date_of_birth")
    gender = payload.get("gender", "Unspecified")
    address = payload.get("address")
    blood_group = payload.get("blood_group", "O+")
    emergency_contact = payload.get("emergency_contact")

    if not full_name.strip() or len(full_name.strip()) < 3:
        raise ValueError("Please provide your full legal name (minimum 3 characters).")

    if not email or "@" not in email:
        raise ValueError("Please provide a valid email address.")

    valid_pw, pw_err = validate_password_strength(password)
    if not valid_pw:
        raise ValueError(pw_err)

    db = SessionLocal()
    try:
        # Prevent duplicate email
        existing_email = db.query(User).filter_by(email=email).first()
        if existing_email:
            raise ValueError(f"An account with email '{email}' is already registered. Please sign in.")

        # Prevent duplicate phone
        if phone:
            existing_phone = db.query(User).filter_by(phone=phone).first()
            if existing_phone:
                raise ValueError(f"An account with mobile number '{phone}' is already registered. Please sign in.")

        # Hash password
        pw_hash = hash_password(password)

        user_id = f"usr-pat-{uuid.uuid4().hex[:10]}"
        patient_id = f"pat-{uuid.uuid4().hex[:10]}"

        # Create user account
        user = User(
            id=user_id,
            email=email,
            phone=phone,
            password_hash=pw_hash,
            role="patient",
            full_name=full_name.strip(),
            is_active=True,
            is_verified=True,
            created_at=datetime.utcnow()
        )
        db.add(user)
        db.flush()

        # Create linked patient profile
        profile = PatientProfile(
            id=patient_id,
            user_id=user_id,
            full_name=full_name.strip(),
            email=email,
            phone=phone,
            date_of_birth=dob,
            gender=gender,
            address=address,
            blood_group=blood_group,
            allergies=payload.get("allergies", []),
            emergency_contact=emergency_contact,
            created_at=datetime.utcnow()
        )
        db.add(profile)
        db.flush()

        # Create session
        token = secrets.token_hex(32)
        session = UserSession(
            id=f"ses-{uuid.uuid4().hex[:10]}",
            user_id=user_id,
            session_token=token,
            role="patient",
            expires_at=datetime.utcnow() + timedelta(days=SESSION_DURATION_DAYS),
            created_at=datetime.utcnow()
        )
        db.add(session)
        db.commit()

        return {
            "success": True,
            "message": "Patient registration successful.",
            "session_token": token,
            "redirect_url": "/patient/dashboard",
            "user": {
                "id": user.id,
                "email": user.email,
                "phone": user.phone,
                "full_name": user.full_name,
                "role": user.role,
                "patient_id": profile.id
            }
        }
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


# =============================================================================
# 2. DOCTOR REGISTRATION INTEGRATION
# =============================================================================

def register_doctor_account(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Creates doctor account and links to doctor verification workflow.
    Doctor status is initialized to 'pending_review' until approved by admin.
    """
    full_name = payload.get("full_name") or payload.get("fullName") or ""
    email = normalize_email(payload.get("email", ""))
    phone = normalize_phone(payload.get("phone") or payload.get("mobile"))
    password = payload.get("password", "")
    doctor_id = payload.get("doctor_id") or f"doc-{uuid.uuid4().hex[:10]}"

    if not email or "@" not in email:
        raise ValueError("Please provide a valid official email address.")

    valid_pw, pw_err = validate_password_strength(password)
    if not valid_pw:
        raise ValueError(pw_err)

    db = SessionLocal()
    try:
        existing = db.query(User).filter_by(email=email).first()
        if existing:
            # If user already registered as doctor, reuse account
            user_id = existing.id
            token = secrets.token_hex(32)
            session = UserSession(
                id=f"ses-{uuid.uuid4().hex[:10]}",
                user_id=user_id,
                session_token=token,
                role="doctor",
                expires_at=datetime.utcnow() + timedelta(days=SESSION_DURATION_DAYS),
                created_at=datetime.utcnow()
            )
            db.add(session)
            db.commit()
            return {
                "success": True,
                "session_token": token,
                "user": {
                    "id": existing.id,
                    "email": existing.email,
                    "full_name": existing.full_name,
                    "role": "doctor",
                    "doctor_id": doctor_id
                }
            }

        pw_hash = hash_password(password)
        user_id = f"usr-doc-{uuid.uuid4().hex[:10]}"

        user = User(
            id=user_id,
            email=email,
            phone=phone,
            password_hash=pw_hash,
            role="doctor",
            full_name=full_name.strip(),
            is_active=True,
            is_verified=False, # Verified when admin approves
            doctor_id=doctor_id,
            created_at=datetime.utcnow()
        )
        db.add(user)

        token = secrets.token_hex(32)
        session = UserSession(
            id=f"ses-{uuid.uuid4().hex[:10]}",
            user_id=user_id,
            session_token=token,
            role="doctor",
            expires_at=datetime.utcnow() + timedelta(days=SESSION_DURATION_DAYS),
            created_at=datetime.utcnow()
        )
        db.add(session)
        db.commit()

        return {
            "success": True,
            "session_token": token,
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "doctor_id": doctor_id
            }
        }
    finally:
        db.close()


# =============================================================================
# 3. UNIFIED LOGIN (EMAIL OR PHONE + PASSWORD)
# =============================================================================

def login_user(identifier: str, password: str, expected_role: Optional[str] = None) -> Dict[str, Any]:
    """
    Authenticates a user via email or mobile number.
    Determines true role from backend database record.
    Returns user payload, role, profile references, and session token.
    """
    clean_id = identifier.strip()
    if not clean_id:
        raise ValueError("Please provide your email address or mobile number.")

    if not password:
        raise ValueError("Please enter your account password.")

    db = SessionLocal()
    try:
        user = None
        if "@" in clean_id:
            user = db.query(User).filter_by(email=clean_id.lower()).first()
        else:
            norm_phone = normalize_phone(clean_id)
            user = db.query(User).filter((User.phone == clean_id) | (User.phone == norm_phone)).first()

        if not user:
            raise ValueError("No account found matching the provided credentials.")

        if not user.is_active:
            raise ValueError("This account has been deactivated. Please contact hospital support.")

        if not verify_password(password, user.password_hash):
            raise ValueError("Incorrect password. Please verify your credentials and retry.")

        # Determine profile IDs
        patient_id = None
        doctor_id = user.doctor_id

        if user.role == "patient":
            patient_profile = db.query(PatientProfile).filter_by(user_id=user.id).first()
            if patient_profile:
                patient_id = patient_profile.id
            else:
                # Create profile if not yet created
                patient_id = f"pat-{user.id[-8:]}"
                p = PatientProfile(
                    id=patient_id,
                    user_id=user.id,
                    full_name=user.full_name,
                    email=user.email,
                    phone=user.phone,
                    created_at=datetime.utcnow()
                )
                db.add(p)
                db.flush()

        # Check doctor verification status if doctor
        doctor_verification_status = None
        if user.role == "doctor" and doctor_id:
            latest_app = db.query(DoctorVerificationApplication).filter_by(
                doctor_id=doctor_id
            ).order_by(DoctorVerificationApplication.created_at.desc()).first()
            if latest_app:
                doctor_verification_status = latest_app.status

        # Issue 7-day session token
        token = secrets.token_hex(32)
        session = UserSession(
            id=f"ses-{uuid.uuid4().hex[:10]}",
            user_id=user.id,
            session_token=token,
            role=user.role,
            expires_at=datetime.utcnow() + timedelta(days=SESSION_DURATION_DAYS),
            created_at=datetime.utcnow()
        )
        db.add(session)
        db.commit()

        # Route target determination
        redirect_url = "/patient/dashboard"
        if user.role == "doctor":
            redirect_url = "/doctor/dashboard"
        elif user.role == "admin":
            redirect_url = "/admin/dashboard"

        return {
            "success": True,
            "session_token": token,
            "redirect_url": redirect_url,
            "user": {
                "id": user.id,
                "email": user.email,
                "phone": user.phone,
                "full_name": user.full_name,
                "role": user.role,
                "patient_id": patient_id,
                "doctor_id": doctor_id,
                "doctor_verification_status": doctor_verification_status
            }
        }
    finally:
        db.close()


# =============================================================================
# 4. SESSION VERIFICATION & LOGOUT
# =============================================================================

def get_user_by_session(token: str) -> Optional[Dict[str, Any]]:
    """Validates session token and returns current authenticated user payload."""
    if not token:
        return None

    db = SessionLocal()
    try:
        now = datetime.utcnow()
        session = db.query(UserSession).filter(
            UserSession.session_token == token,
            UserSession.is_revoked == False,
            UserSession.expires_at > now
        ).first()

        if not session:
            return None

        user = db.query(User).filter_by(id=session.user_id).first()
        if not user or not user.is_active:
            return None

        patient_id = None
        if user.role == "patient":
            prof = db.query(PatientProfile).filter_by(user_id=user.id).first()
            if prof:
                patient_id = prof.id
            else:
                patient_id = "pat-101"

        return {
            "id": user.id,
            "email": user.email,
            "phone": user.phone,
            "full_name": user.full_name,
            "role": user.role,
            "patient_id": patient_id,
            "doctor_id": user.doctor_id,
            "session_id": session.id,
            "expires_at": session.expires_at.isoformat()
        }
    finally:
        db.close()


def logout_user(token: str) -> bool:
    """Revokes active session."""
    if not token:
        return False

    db = SessionLocal()
    try:
        session = db.query(UserSession).filter_by(session_token=token).first()
        if session:
            session.is_revoked = True
            db.commit()
            return True
        return False
    finally:
        db.close()


# =============================================================================
# 5. PASSWORD RESET WORKFLOW
# =============================================================================

def request_password_reset(email: str) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        clean_email = normalize_email(email)
        user = db.query(User).filter_by(email=clean_email).first()
        if not user:
            # Don't leak user existence
            return {"success": True, "message": "If an account exists with this email, password reset instructions have been dispatched."}

        token = secrets.token_urlsafe(32)
        prt = PasswordResetToken(
            id=f"prt-{uuid.uuid4().hex[:10]}",
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(hours=RESET_TOKEN_DURATION_HOURS),
            used=False,
            created_at=datetime.utcnow()
        )
        db.add(prt)
        db.commit()

        return {
            "success": True,
            "message": "Password reset token generated.",
            "reset_token": token,
            "email": user.email
        }
    finally:
        db.close()


def reset_password(token: str, new_password: str) -> Dict[str, Any]:
    valid_pw, pw_err = validate_password_strength(new_password)
    if not valid_pw:
        raise ValueError(pw_err)

    db = SessionLocal()
    try:
        now = datetime.utcnow()
        prt = db.query(PasswordResetToken).filter(
            PasswordResetToken.token == token,
            PasswordResetToken.used == False,
            PasswordResetToken.expires_at > now
        ).first()

        if not prt:
            raise ValueError("The password reset token is invalid or has expired.")

        user = db.query(User).filter_by(id=prt.user_id).first()
        if not user:
            raise ValueError("User account not found.")

        user.password_hash = hash_password(new_password)
        prt.used = True

        # Invalidate all existing sessions for security
        db.query(UserSession).filter_by(user_id=user.id).update({"is_revoked": True})
        db.commit()

        return {"success": True, "message": "Password has been successfully reset. Please sign in with your new password."}
    finally:
        db.close()


def request_password_reset_otp(email: str, role: Optional[str] = None) -> Dict[str, Any]:
    """
    Generates a 6-digit numeric OTP for password recovery with 10-minute expiry.
    Enforces account and role matching for strict patient/doctor account isolation.
    """
    clean_email = normalize_email(email)
    if not clean_email or "@" not in clean_email:
        return {"success": False, "error": "Please enter a valid email address."}

    db = SessionLocal()
    try:
        query = db.query(User).filter_by(email=clean_email)
        if role:
            query = query.filter_by(role=role.lower())
        user = query.first()

        if not user:
            role_label = f" {role.lower()}" if role else ""
            return {
                "success": False,
                "error": f"No registered{role_label} account found matching '{clean_email}'. Please check your email or account role."
            }

        # Generate cryptographically secure 6-digit numeric OTP
        otp = f"{secrets.randbelow(900000) + 100000}"

        # Invalidate previous unused reset tokens for this user
        db.query(PasswordResetToken).filter_by(user_id=user.id, used=False).update({"used": True})

        # Save new OTP valid for 10 minutes
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        prt = PasswordResetToken(
            id=f"prt-{uuid.uuid4().hex[:12]}",
            user_id=user.id,
            token=f"otp:{otp}",
            expires_at=expires_at,
            used=False,
            created_at=datetime.utcnow()
        )
        db.add(prt)
        db.commit()

        return {
            "success": True,
            "otp": otp,
            "email": user.email,
            "user_name": user.full_name,
            "role": user.role,
            "expires_in_minutes": 10
        }
    finally:
        db.close()


def verify_password_reset_otp(email: str, role: Optional[str], otp: str) -> Dict[str, Any]:
    """
    Verifies the 6-digit OTP code against the database.
    If valid, marks the OTP as used and issues an authenticated one-time reset token.
    """
    clean_email = normalize_email(email)
    clean_otp = (otp or "").strip()

    if not clean_otp or len(clean_otp) != 6:
        return {"success": False, "error": "Please enter a valid 6-digit verification code."}

    db = SessionLocal()
    try:
        query = db.query(User).filter_by(email=clean_email)
        if role:
            query = query.filter_by(role=role.lower())
        user = query.first()

        if not user:
            return {"success": False, "error": "Account not found for verification."}

        now = datetime.utcnow()
        prt = db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.token.in_([f"otp:{clean_otp}", clean_otp]),
            PasswordResetToken.used == False,
            PasswordResetToken.expires_at > now
        ).order_by(PasswordResetToken.created_at.desc()).first()

        if not prt:
            return {"success": False, "error": "Invalid or expired verification code. Please check your code or request a new one."}

        # Mark OTP token as consumed
        prt.used = True

        # Issue secure one-time reset token valid for 15 minutes
        reset_token = secrets.token_urlsafe(32)
        reset_prt = PasswordResetToken(
            id=f"prt-{uuid.uuid4().hex[:12]}",
            user_id=user.id,
            token=reset_token,
            expires_at=datetime.utcnow() + timedelta(minutes=15),
            used=False,
            created_at=datetime.utcnow()
        )
        db.add(reset_prt)
        db.commit()

        return {
            "success": True,
            "reset_token": reset_token,
            "email": user.email,
            "user_name": user.full_name,
            "role": user.role
        }
    finally:
        db.close()


def reset_password_with_token(reset_token: str, new_password: str) -> Dict[str, Any]:
    """
    Validates password strength, consumes reset token, hashes password, and revokes active sessions.
    """
    valid_pw, pw_err = validate_password_strength(new_password)
    if not valid_pw:
        return {"success": False, "error": pw_err}

    db = SessionLocal()
    try:
        now = datetime.utcnow()
        prt = db.query(PasswordResetToken).filter(
            PasswordResetToken.token == reset_token,
            PasswordResetToken.used == False,
            PasswordResetToken.expires_at > now
        ).first()

        if not prt:
            return {"success": False, "error": "Your password reset session has expired or is invalid. Please request a new verification code."}

        user = db.query(User).filter_by(id=prt.user_id).first()
        if not user:
            return {"success": False, "error": "User account not found."}

        # Update password hash
        user.password_hash = hash_password(new_password)
        prt.used = True

        # Invalidate all existing user sessions for security
        db.query(UserSession).filter_by(user_id=user.id).update({"is_revoked": True})
        db.commit()

        return {
            "success": True,
            "message": "Your password has been successfully reset. You can now log in.",
            "role": user.role,
            "email": user.email
        }
    finally:
        db.close()


def change_user_password(identifier: str, current_password: str, new_password: str) -> Dict[str, Any]:
    """
    Changes a logged-in user's password after verifying their current password.
    Identifier can be user_id or email address.
    Enforces minimum 8 characters, hashes with bcrypt, and updates user credentials.
    """
    clean_id = (identifier or "").strip()
    if not clean_id:
        return {"success": False, "error": "User identifier is required."}

    if not current_password:
        return {"success": False, "error": "Please enter your current password."}

    valid_pw, pw_err = validate_password_strength(new_password)
    if not valid_pw:
        return {"success": False, "error": pw_err}

    db = SessionLocal()
    try:
        user = None
        if clean_id.startswith("usr-"):
            user = db.query(User).filter_by(id=clean_id).first()
        if not user:
            user = db.query(User).filter_by(email=clean_id.lower()).first()

        if not user:
            return {"success": False, "error": "Account not found."}

        # Verify current password
        if not verify_password(current_password, user.password_hash):
            return {"success": False, "error": "Your current password is incorrect. Please verify and retry."}

        # Prevent reusing exact same password
        if verify_password(new_password, user.password_hash):
            return {"success": False, "error": "New password cannot be identical to your current password."}

        # Update password hash
        user.password_hash = hash_password(new_password)
        db.commit()

        return {
            "success": True,
            "message": "Your password has been changed successfully.",
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role
        }
    finally:
        db.close()


# =============================================================================
# 6. SEED ESSENTIAL ACCOUNTS (ADMIN, SAMPLE DOCTOR, SAMPLE PATIENT)
# =============================================================================

def seed_default_accounts():
    """
    Ensures baseline Administrator, Doctor, and Patient accounts exist in the database.
    Admin account is STRICTLY provisioned here and CANNOT be registered publicly.
    """
    db = SessionLocal()
    try:
        # 1. Administrator Account
        admin_email = "admin@mediverse.org"
        admin_user = db.query(User).filter_by(email=admin_email).first()
        if not admin_user:
            admin_user = User(
                id="usr-admin-001",
                email=admin_email,
                phone="+919900000001",
                password_hash=hash_password("AdminPassword@123"),
                role="admin",
                full_name="MediVerse System Administrator",
                is_active=True,
                is_verified=True,
                created_at=datetime.utcnow()
            )
            db.add(admin_user)

        # 2. Sample Doctor (Dr. Arvind Swaminathan)
        doc_email = "dr.arvind@apexheart.in"
        doc_user = db.query(User).filter_by(email=doc_email).first()
        if not doc_user:
            doc_user = User(
                id="usr-doc-001",
                email=doc_email,
                phone="+919845012345",
                password_hash=hash_password("DoctorPassword@123"),
                role="doctor",
                full_name="Dr. Arvind Swaminathan",
                doctor_id="doc-1",
                is_active=True,
                is_verified=True,
                created_at=datetime.utcnow()
            )
            db.add(doc_user)

        # 3. Sample Patient (Keerthana / pat-101)
        patient_email = "sankeerthana2905@gmail.com"
        pat_user = db.query(User).filter_by(email=patient_email).first()
        if not pat_user:
            pat_user = User(
                id="usr-pat-101",
                email=patient_email,
                phone="+919876543210",
                password_hash=hash_password("PatientPassword@123"),
                role="patient",
                full_name="Keerthana",
                is_active=True,
                is_verified=True,
                created_at=datetime.utcnow()
            )
            db.add(pat_user)
            db.flush()

            pat_profile = db.query(PatientProfile).filter_by(id="pat-101").first()
            if not pat_profile:
                pat_profile = PatientProfile(
                    id="pat-101",
                    user_id=pat_user.id,
                    full_name="Keerthana",
                    email=patient_email,
                    phone="+919876543210",
                    date_of_birth="1988-05-14",
                    gender="Female",
                    address="42 Green Glen Layout, Bellandur, Bengaluru",
                    blood_group="O+",
                    allergies=["Penicillin"],
                    emergency_contact="+91 98451 98765",
                    created_at=datetime.utcnow()
                )
                db.add(pat_profile)

        db.commit()
        return {"success": True, "message": "Default accounts verified."}
    finally:
        db.close()


if __name__ == "__main__":
    seed_default_accounts()
    print("Seed accounts provisioned successfully.")

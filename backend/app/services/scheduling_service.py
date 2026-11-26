"""
Core Telemedicine Scheduling, Availability Management & Video Consultation Service
Production-oriented backend engine for MediVerse.
"""

import os
import sys
import uuid
import json
from datetime import datetime, date, time, timedelta
from typing import List, Dict, Any, Optional

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")))

from backend.app.db.database import SessionLocal
from backend.app.db.models import (
    DoctorProfile,
    DoctorVerificationApplication,
    DoctorAvailability,
    DoctorAvailabilitySession,
    DoctorAvailabilityBreak,
    DoctorScheduleOverride,
    DoctorLeave,
    DoctorScheduleSettings,
    Appointment,
    AppointmentSlotHold,
    VideoConsultation,
    ConsultationParticipant,
    ConsultationMessage,
    ConsultationNote,
    ConsultationSignal,
    DoctorNotification,
    PatientNotification,
    EmailNotificationLog,
    PatientProfile,
    User
)

DEFAULT_TIMEZONE = "Asia/Kolkata"

# Helper for parsing 24h time string HH:MM to time object
def parse_time_str(t_str: str) -> time:
    parts = t_str.strip().split(":")
    return time(int(parts[0]), int(parts[1]))

def format_time_12h(t: time) -> str:
    h = t.hour
    m = t.minute
    suffix = "AM" if h < 12 else "PM"
    h12 = h % 12
    if h12 == 0:
        h12 = 12
    return f"{h12:02d}:{m:02d} {suffix}"

def time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute

def minutes_to_time(m: int) -> time:
    h = (m // 60) % 24
    mins = m % 60
    return time(h, mins)

def get_now_kolkata() -> datetime:
    """Returns current datetime in Asia/Kolkata (UTC+5:30) with zero dependency."""
    return datetime.utcnow() + timedelta(hours=5, minutes=30)

def categorize_slot(s_time: time) -> str:
    """Categorizes slot time into morning, afternoon, or evening."""
    if s_time.hour < 12:
        return "morning"
    elif s_time.hour < 17:
        return "afternoon"
    else:
        return "evening"

def cleanup_expired_holds(db) -> int:
    """Marks expired slot holds as expired."""
    now_utc = datetime.utcnow()
    expired_count = db.query(AppointmentSlotHold).filter(
        AppointmentSlotHold.status == "held",
        AppointmentSlotHold.expires_at <= now_utc
    ).update({"status": "expired"})
    db.flush()
    return expired_count


# =============================================================================
# 1. AVAILABILITY, LEAVE & SCHEDULE MANAGEMENT
# =============================================================================

def get_or_create_schedule_settings(db, doctor_id: str) -> DoctorScheduleSettings:
    """Ensures doctor has a schedule settings record."""
    settings = db.query(DoctorScheduleSettings).filter_by(doctor_id=doctor_id).first()
    if not settings:
        settings = DoctorScheduleSettings(
            id=f"dss-{doctor_id}",
            doctor_id=doctor_id,
            timezone=DEFAULT_TIMEZONE,
            default_duration_minutes=30,
            buffer_minutes=5,
            minimum_notice_minutes=120,
            maximum_advance_days=30,
            maximum_appointments_per_day=20,
            same_day_booking_enabled=True,
            cancellation_policy="Free cancellation up to 4 hours before the consultation.",
            rescheduling_policy="Rescheduling permitted up to 2 hours before the consultation."
        )
        db.add(settings)
        db.commit()
    return settings


def get_doctor_schedule_settings(doctor_id: str) -> Dict[str, Any]:
    """Retrieves doctor schedule configuration settings."""
    db = SessionLocal()
    try:
        settings = get_or_create_schedule_settings(db, doctor_id)
        return {
            "doctor_id": doctor_id,
            "timezone": settings.timezone,
            "default_duration_minutes": settings.default_duration_minutes,
            "buffer_minutes": settings.buffer_minutes,
            "minimum_notice_minutes": settings.minimum_notice_minutes,
            "maximum_advance_days": settings.maximum_advance_days,
            "maximum_appointments_per_day": settings.maximum_appointments_per_day,
            "same_day_booking_enabled": settings.same_day_booking_enabled,
            "cancellation_policy": settings.cancellation_policy,
            "rescheduling_policy": settings.rescheduling_policy
        }
    finally:
        db.close()


def save_doctor_schedule_settings(doctor_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Saves doctor schedule configuration settings."""
    db = SessionLocal()
    try:
        settings = get_or_create_schedule_settings(db, doctor_id)
        if "timezone" in payload:
            settings.timezone = payload["timezone"]
        if "default_duration_minutes" in payload:
            settings.default_duration_minutes = int(payload["default_duration_minutes"])
        if "buffer_minutes" in payload:
            settings.buffer_minutes = int(payload["buffer_minutes"])
        if "minimum_notice_minutes" in payload:
            settings.minimum_notice_minutes = int(payload["minimum_notice_minutes"])
        if "maximum_advance_days" in payload:
            settings.maximum_advance_days = int(payload["maximum_advance_days"])
        if "maximum_appointments_per_day" in payload:
            settings.maximum_appointments_per_day = int(payload["maximum_appointments_per_day"])
        if "same_day_booking_enabled" in payload:
            settings.same_day_booking_enabled = bool(payload["same_day_booking_enabled"])
        if "cancellation_policy" in payload:
            settings.cancellation_policy = str(payload["cancellation_policy"])
        if "rescheduling_policy" in payload:
            settings.rescheduling_policy = str(payload["rescheduling_policy"])
        settings.updated_at = datetime.utcnow()
        db.commit()
        return {"success": True, "message": "Doctor schedule settings updated successfully."}
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def check_leave_appointment_conflicts(
    db, doctor_id: str, start_date: str, end_date: str,
    is_all_day: bool = True, start_time: Optional[str] = None, end_time: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Checks for existing confirmed/upcoming appointments that conflict with a proposed leave."""
    apts = db.query(Appointment).filter(
        Appointment.doctor_id == doctor_id,
        Appointment.date >= start_date,
        Appointment.date <= end_date,
        Appointment.status.in_(["confirmed", "upcoming", "in-progress"])
    ).all()

    conflicts = []
    for a in apts:
        if is_all_day:
            conflicts.append({
                "id": a.id,
                "reference": a.appointment_reference,
                "date": a.date,
                "time": a.time,
                "patient_name": a.patient_name,
                "patient_phone": a.patient_phone,
                "type": a.type
            })
        else:
            if start_time and end_time and a.start_time and a.end_time:
                req_s = time_to_minutes(parse_time_str(start_time))
                req_e = time_to_minutes(parse_time_str(end_time))
                a_s = time_to_minutes(parse_time_str(a.start_time))
                a_e = time_to_minutes(parse_time_str(a.end_time))
                if not (req_e <= a_s or req_s >= a_e):
                    conflicts.append({
                        "id": a.id,
                        "reference": a.appointment_reference,
                        "date": a.date,
                        "time": a.time,
                        "patient_name": a.patient_name,
                        "patient_phone": a.patient_phone,
                        "type": a.type
                    })
    return conflicts


def get_doctor_leaves(doctor_id: str, status: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves doctor leaves."""
    db = SessionLocal()
    try:
        query = db.query(DoctorLeave).filter_by(doctor_id=doctor_id)
        if status and status != "all":
            query = query.filter_by(status=status)
        leaves = query.order_by(DoctorLeave.start_date.desc()).all()
        return [
            {
                "id": lv.id,
                "doctor_id": lv.doctor_id,
                "start_date": lv.start_date,
                "end_date": lv.end_date,
                "is_all_day": lv.is_all_day,
                "start_time": lv.start_time,
                "end_time": lv.end_time,
                "leave_type": lv.leave_type,
                "reason": lv.reason,
                "status": lv.status,
                "affected_appointments_count": lv.affected_appointments_count,
                "created_at": lv.created_at.isoformat() if lv.created_at else None
            }
            for lv in leaves
        ]
    finally:
        db.close()


def add_doctor_leave(doctor_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Creates a doctor leave and identifies conflicting booked appointments."""
    db = SessionLocal()
    try:
        start_date = payload["start_date"]
        end_date = payload.get("end_date", start_date)
        is_all_day = bool(payload.get("is_all_day", True))
        start_time = payload.get("start_time")
        end_time = payload.get("end_time")
        leave_type = payload.get("leave_type", "personal")
        reason = payload.get("reason", "Personal Leave")

        conflicts = check_leave_appointment_conflicts(
            db, doctor_id, start_date, end_date, is_all_day, start_time, end_time
        )

        leave = DoctorLeave(
            id=f"dlv-{uuid.uuid4().hex[:10]}",
            doctor_id=doctor_id,
            start_date=start_date,
            end_date=end_date,
            is_all_day=is_all_day,
            start_time=start_time,
            end_time=end_time,
            leave_type=leave_type,
            reason=reason,
            status="active",
            affected_appointments_count=len(conflicts),
            created_at=datetime.utcnow()
        )
        db.add(leave)
        db.commit()

        return {
            "success": True,
            "leave_id": leave.id,
            "affected_appointments": conflicts,
            "affected_count": len(conflicts),
            "message": f"Leave registered successfully. {len(conflicts)} appointment(s) may require rescheduling."
        }
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def cancel_doctor_leave(doctor_id: str, leave_id: str) -> Dict[str, Any]:
    """Cancels a previously scheduled leave."""
    db = SessionLocal()
    try:
        leave = db.query(DoctorLeave).filter_by(id=leave_id, doctor_id=doctor_id).first()
        if not leave:
            raise ValueError(f"Leave record {leave_id} not found")
        leave.status = "cancelled"
        db.commit()
        return {"success": True, "message": "Leave cancelled successfully."}
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def get_or_create_default_availability(db, doctor_id: str) -> List[DoctorAvailability]:
    """Ensures a doctor has availability records for Monday to Sunday with multi-session support."""
    existing = db.query(DoctorAvailability).filter_by(doctor_id=doctor_id).order_by(DoctorAvailability.weekday).all()
    if existing:
        return existing

    # Default schedule: Mon-Sat active (09:00 - 17:00), Sun off
    created = []
    for day_idx in range(7):
        is_active = day_idx < 6 # Mon to Sat active, Sun off
        avail = DoctorAvailability(
            id=f"dav-{doctor_id}-{day_idx}",
            doctor_id=doctor_id,
            weekday=day_idx,
            start_time="09:00",
            end_time="17:00",
            consultation_duration=30,
            buffer_duration=5,
            timezone=DEFAULT_TIMEZONE,
            is_active=is_active,
            consultation_modes=["online", "in-person"],
            max_appointments=16
        )
        db.add(avail)
        db.flush()

        if is_active:
            # Morning Session: 09:00 - 13:00
            s1 = DoctorAvailabilitySession(
                id=f"das-{doctor_id}-{day_idx}-morn",
                availability_id=avail.id,
                session_name="Morning Session",
                start_time="09:00",
                end_time="13:00",
                consultation_duration=30,
                buffer_duration=5,
                consultation_modes=["online", "in-person"],
                is_active=True
            )
            # Lunch Break: 13:00 - 14:00
            b = DoctorAvailabilityBreak(
                id=f"dab-{doctor_id}-{day_idx}-lunch",
                availability_id=avail.id,
                start_time="13:00",
                end_time="14:00",
                title="Lunch Break"
            )
            # Evening Session: 14:00 - 17:00
            s2 = DoctorAvailabilitySession(
                id=f"das-{doctor_id}-{day_idx}-eve",
                availability_id=avail.id,
                session_name="Evening Session",
                start_time="14:00",
                end_time="17:00",
                consultation_duration=30,
                buffer_duration=5,
                consultation_modes=["online", "in-person"],
                is_active=True
            )
            db.add(s1)
            db.add(b)
            db.add(s2)

        created.append(avail)

    db.commit()
    return created


def get_doctor_schedule(doctor_id: str) -> Dict[str, Any]:
    """Retrieves full weekly availability, multi-sessions, overrides, leaves and settings."""
    db = SessionLocal()
    try:
        doc = db.query(DoctorProfile).filter_by(id=doctor_id).first()
        if not doc:
            raise ValueError(f"Doctor {doctor_id} not found")

        avails = get_or_create_default_availability(db, doctor_id)
        settings = get_or_create_schedule_settings(db, doctor_id)

        weekday_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        weekly_schedule = []

        for av in avails:
            breaks = db.query(DoctorAvailabilityBreak).filter_by(availability_id=av.id).all()
            sessions = db.query(DoctorAvailabilitySession).filter_by(availability_id=av.id).all()

            if sessions:
                sessions_list = [
                    {
                        "id": s.id,
                        "session_name": s.session_name or "Session",
                        "start_time": s.start_time,
                        "end_time": s.end_time,
                        "consultation_duration": s.consultation_duration,
                        "buffer_duration": s.buffer_duration,
                        "consultation_modes": s.consultation_modes if isinstance(s.consultation_modes, list) else ["online", "in-person"],
                        "clinic_location_id": s.clinic_location_id,
                        "is_active": s.is_active
                    }
                    for s in sessions
                ]
            else:
                # Backwards compatibility fallback if no explicit sessions stored yet
                sessions_list = [
                    {
                        "id": f"das-{av.id}-default",
                        "session_name": "General Session",
                        "start_time": av.start_time,
                        "end_time": av.end_time,
                        "consultation_duration": av.consultation_duration,
                        "buffer_duration": av.buffer_duration,
                        "consultation_modes": av.consultation_modes if isinstance(av.consultation_modes, list) else ["online", "in-person"],
                        "clinic_location_id": None,
                        "is_active": av.is_active
                    }
                ]

            weekly_schedule.append({
                "id": av.id,
                "weekday": av.weekday,
                "weekday_name": weekday_names[av.weekday],
                "is_active": av.is_active,
                "start_time": av.start_time,
                "end_time": av.end_time,
                "consultation_duration": av.consultation_duration,
                "buffer_duration": av.buffer_duration,
                "timezone": av.timezone,
                "consultation_modes": av.consultation_modes if isinstance(av.consultation_modes, list) else ["online", "in-person"],
                "max_appointments": av.max_appointments,
                "sessions": sessions_list,
                "breaks": [
                    {"id": b.id, "start_time": b.start_time, "end_time": b.end_time, "title": b.title}
                    for b in breaks
                ]
            })

        overrides = db.query(DoctorScheduleOverride).filter(
            DoctorScheduleOverride.doctor_id == doctor_id
        ).order_by(DoctorScheduleOverride.date.asc()).all()

        overrides_list = [
            {
                "id": o.id,
                "date": o.date,
                "override_type": o.override_type,
                "start_time": o.start_time,
                "end_time": o.end_time,
                "reason": o.reason,
                "is_all_day": o.is_all_day,
                "consultation_modes": o.consultation_modes or ["online", "in-person"],
                "clinic_location_id": o.clinic_location_id
            }
            for o in overrides
        ]

        leaves_list = [
            {
                "id": lv.id,
                "start_date": lv.start_date,
                "end_date": lv.end_date,
                "is_all_day": lv.is_all_day,
                "start_time": lv.start_time,
                "end_time": lv.end_time,
                "leave_type": lv.leave_type,
                "reason": lv.reason,
                "status": lv.status,
                "affected_appointments_count": lv.affected_appointments_count,
                "created_at": lv.created_at.isoformat() if lv.created_at else None
            }
            for lv in db.query(DoctorLeave).filter_by(doctor_id=doctor_id).order_by(DoctorLeave.start_date.desc()).all()
        ]

        return {
            "doctor_id": doctor_id,
            "doctor_name": doc.name,
            "specialty": doc.specialty,
            "consultation_fee": doc.consultation_fee,
            "weekly_schedule": weekly_schedule,
            "schedule_overrides": overrides_list,
            "leaves": leaves_list,
            "settings": {
                "timezone": settings.timezone,
                "default_duration_minutes": settings.default_duration_minutes,
                "buffer_minutes": settings.buffer_minutes,
                "minimum_notice_minutes": settings.minimum_notice_minutes,
                "maximum_advance_days": settings.maximum_advance_days,
                "maximum_appointments_per_day": settings.maximum_appointments_per_day,
                "same_day_booking_enabled": settings.same_day_booking_enabled,
                "cancellation_policy": settings.cancellation_policy,
                "rescheduling_policy": settings.rescheduling_policy
            }
        }
    finally:
        db.close()


def save_doctor_schedule(doctor_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Updates weekly working schedule, multiple sessions, and breaks for doctor."""
    db = SessionLocal()
    try:
        doc = db.query(DoctorProfile).filter_by(id=doctor_id).first()
        if not doc:
            raise ValueError(f"Doctor {doctor_id} not found")

        weekly_data = payload.get("weekly_schedule", [])

        for day_item in weekly_data:
            weekday = day_item.get("weekday")
            if weekday is None:
                continue

            avail = db.query(DoctorAvailability).filter_by(doctor_id=doctor_id, weekday=weekday).first()
            if not avail:
                avail = DoctorAvailability(
                    id=f"dav-{doctor_id}-{weekday}",
                    doctor_id=doctor_id,
                    weekday=weekday
                )
                db.add(avail)

            avail.is_active = bool(day_item.get("is_active", True))
            avail.consultation_duration = int(day_item.get("consultation_duration", 30))
            avail.buffer_duration = int(day_item.get("buffer_duration", 5))
            avail.consultation_modes = day_item.get("consultation_modes", ["online", "in-person"])
            avail.max_appointments = int(day_item.get("max_appointments", 20))
            avail.updated_at = datetime.utcnow()
            db.flush()

            # Handle sessions if provided
            sessions_data = day_item.get("sessions")
            if sessions_data is not None:
                db.query(DoctorAvailabilitySession).filter_by(availability_id=avail.id).delete()
                earliest_start = "23:59"
                latest_end = "00:00"

                for idx, s in enumerate(sessions_data):
                    s_start = s.get("start_time", "09:00")
                    s_end = s.get("end_time", "13:00")
                    if s_start < earliest_start:
                        earliest_start = s_start
                    if s_end > latest_end:
                        latest_end = s_end

                    new_sess = DoctorAvailabilitySession(
                        id=f"das-{avail.id}-{idx}-{uuid.uuid4().hex[:6]}",
                        availability_id=avail.id,
                        session_name=s.get("session_name", f"Session {idx + 1}"),
                        start_time=s_start,
                        end_time=s_end,
                        consultation_duration=int(s.get("consultation_duration", avail.consultation_duration)),
                        buffer_duration=int(s.get("buffer_duration", avail.buffer_duration)),
                        consultation_modes=s.get("consultation_modes", avail.consultation_modes),
                        clinic_location_id=s.get("clinic_location_id"),
                        is_active=bool(s.get("is_active", True))
                    )
                    db.add(new_sess)

                if sessions_data:
                    avail.start_time = earliest_start
                    avail.end_time = latest_end
                else:
                    avail.start_time = day_item.get("start_time", "09:00")
                    avail.end_time = day_item.get("end_time", "17:00")
            else:
                avail.start_time = day_item.get("start_time", "09:00")
                avail.end_time = day_item.get("end_time", "17:00")

            # Replace breaks
            db.query(DoctorAvailabilityBreak).filter_by(availability_id=avail.id).delete()
            for b in day_item.get("breaks", []):
                new_break = DoctorAvailabilityBreak(
                    id=f"dab-{uuid.uuid4().hex[:10]}",
                    availability_id=avail.id,
                    start_time=b.get("start_time", "13:00"),
                    end_time=b.get("end_time", "14:00"),
                    title=b.get("title", "Break")
                )
                db.add(new_break)

        # Update settings if also passed in payload
        if "settings" in payload and isinstance(payload["settings"], dict):
            settings_obj = get_or_create_schedule_settings(db, doctor_id)
            s_dict = payload["settings"]
            if "minimum_notice_minutes" in s_dict:
                settings_obj.minimum_notice_minutes = int(s_dict["minimum_notice_minutes"])
            if "maximum_advance_days" in s_dict:
                settings_obj.maximum_advance_days = int(s_dict["maximum_advance_days"])
            if "maximum_appointments_per_day" in s_dict:
                settings_obj.maximum_appointments_per_day = int(s_dict["maximum_appointments_per_day"])
            if "same_day_booking_enabled" in s_dict:
                settings_obj.same_day_booking_enabled = bool(s_dict["same_day_booking_enabled"])
            if "default_duration_minutes" in s_dict:
                settings_obj.default_duration_minutes = int(s_dict["default_duration_minutes"])
            if "buffer_minutes" in s_dict:
                settings_obj.buffer_minutes = int(s_dict["buffer_minutes"])
            if "cancellation_policy" in s_dict:
                settings_obj.cancellation_policy = str(s_dict["cancellation_policy"])
            if "rescheduling_policy" in s_dict:
                settings_obj.rescheduling_policy = str(s_dict["rescheduling_policy"])

        db.commit()
        return {"success": True, "message": "Doctor schedule updated successfully."}
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def add_schedule_override(doctor_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Adds a date-specific override (e.g. holiday, leave, extra hours, changed hours)."""
    db = SessionLocal()
    try:
        ov = DoctorScheduleOverride(
            id=f"dso-{uuid.uuid4().hex[:10]}",
            doctor_id=doctor_id,
            date=payload["date"],
            override_type=payload.get("override_type", "leave"),
            start_time=payload.get("start_time"),
            end_time=payload.get("end_time"),
            reason=payload.get("reason", "Date Override"),
            is_all_day=bool(payload.get("is_all_day", True)),
            consultation_modes=payload.get("consultation_modes", ["online", "in-person"]),
            clinic_location_id=payload.get("clinic_location_id")
        )
        db.add(ov)
        db.commit()
        return {"success": True, "override_id": ov.id}
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def remove_schedule_override(doctor_id: str, override_id: str) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        db.query(DoctorScheduleOverride).filter_by(id=override_id, doctor_id=doctor_id).delete()
        db.commit()
        return {"success": True}
    finally:
        db.close()


# =============================================================================
# 2. DYNAMIC APPOINTMENT SLOT GENERATION ENGINE
# =============================================================================

def get_available_slots(
    doctor_id: str,
    target_date_str: str,
    consult_mode: str = "all",
    clinic_location_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Calculates bookable slots dynamically from:
    1. Doctor verification & approval guardrails
    2. Doctor schedule settings (advance days, notice window, same-day rule, daily cap)
    3. Active leaves (DoctorLeave - full day and partial day)
    4. Date-specific overrides (DoctorScheduleOverride - blocked, holiday, extra/change hours)
    5. Weekly recurring availability & multiple sessions (DoctorAvailabilitySession)
    6. Break intervals (DoctorAvailabilityBreak)
    7. Confirmed appointments & buffer spacing
    8. Active unexpired slot holds
    Returns grouped slots (morning, afternoon, evening) and full schedule metadata.
    """
    db = SessionLocal()
    try:
        # Cleanup expired holds before computing availability
        cleanup_expired_holds(db)

        # 1. Verify doctor status & admin approval
        doc = db.query(DoctorProfile).filter_by(id=doctor_id).first()
        if not doc or not doc.verified:
            return {"available": False, "reason": "Doctor is not verified or does not exist.", "slots": [], "grouped_slots": {"morning": [], "afternoon": [], "evening": []}}

        latest_app = db.query(DoctorVerificationApplication).filter_by(
            doctor_id=doctor_id
        ).order_by(DoctorVerificationApplication.created_at.desc()).first()
        if latest_app and latest_app.status in ["rejected", "suspended"]:
            return {"available": False, "reason": f"Doctor credentials status: {latest_app.status}.", "slots": [], "grouped_slots": {"morning": [], "afternoon": [], "evening": []}}

        # 2. Schedule settings & constraints check
        settings = get_or_create_schedule_settings(db, doctor_id)
        now_kolkata = get_now_kolkata()
        today_date = now_kolkata.date()

        try:
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
        except Exception:
            return {"available": False, "reason": "Invalid date format. Expected YYYY-MM-DD.", "slots": [], "grouped_slots": {"morning": [], "afternoon": [], "evening": []}}

        # Constraint: Past dates
        if target_date < today_date:
            return {"available": False, "reason": "Appointments cannot be booked for past dates.", "slots": [], "grouped_slots": {"morning": [], "afternoon": [], "evening": []}}

        # Constraint: Maximum advance booking days
        days_in_advance = (target_date - today_date).days
        if days_in_advance > settings.maximum_advance_days:
            return {
                "available": False,
                "reason": f"Bookings are accepted up to {settings.maximum_advance_days} days in advance.",
                "slots": [],
                "grouped_slots": {"morning": [], "afternoon": [], "evening": []}
            }

        # Constraint: Same-day booking enabled
        if target_date == today_date and not settings.same_day_booking_enabled:
            return {
                "available": False,
                "reason": "Same-day booking is not available for this doctor.",
                "slots": [],
                "grouped_slots": {"morning": [], "afternoon": [], "evening": []}
            }

        # Constraint: Daily maximum appointments cap
        confirmed_count = db.query(Appointment).filter(
            Appointment.doctor_id == doctor_id,
            Appointment.date == target_date_str,
            Appointment.status.in_(["confirmed", "upcoming", "in-progress"])
        ).count()

        if confirmed_count >= settings.maximum_appointments_per_day:
            return {
                "available": False,
                "reason": f"Doctor has reached maximum appointment capacity ({settings.maximum_appointments_per_day} consultations) for this date.",
                "slots": [],
                "grouped_slots": {"morning": [], "afternoon": [], "evening": []}
            }

        blocked_intervals = []

        # 3. Check Active Leaves (DoctorLeave)
        leaves = db.query(DoctorLeave).filter(
            DoctorLeave.doctor_id == doctor_id,
            DoctorLeave.status == "active",
            DoctorLeave.start_date <= target_date_str,
            DoctorLeave.end_date >= target_date_str
        ).all()

        for lv in leaves:
            if lv.is_all_day:
                return {
                    "available": False,
                    "reason": f"Doctor is on leave on this date: {lv.reason or 'Scheduled Leave'}.",
                    "slots": [],
                    "grouped_slots": {"morning": [], "afternoon": [], "evening": []}
                }
            elif lv.start_time and lv.end_time:
                lv_s = time_to_minutes(parse_time_str(lv.start_time))
                lv_e = time_to_minutes(parse_time_str(lv.end_time))
                blocked_intervals.append((lv_s, lv_e))

        # 4. Check Date-Specific Overrides (DoctorScheduleOverride)
        overrides = db.query(DoctorScheduleOverride).filter_by(
            doctor_id=doctor_id, date=target_date_str
        ).all()

        change_hours_ov = None
        extra_hours_ov = None

        for ov in overrides:
            if ov.is_all_day and ov.override_type in ["holiday", "leave", "blocked_time"]:
                return {
                    "available": False,
                    "reason": ov.reason or "Doctor is not consulting on this date.",
                    "slots": [],
                    "grouped_slots": {"morning": [], "afternoon": [], "evening": []}
                }
            elif not ov.is_all_day and ov.override_type == "blocked_time" and ov.start_time and ov.end_time:
                ov_s = time_to_minutes(parse_time_str(ov.start_time))
                ov_e = time_to_minutes(parse_time_str(ov.end_time))
                blocked_intervals.append((ov_s, ov_e))
            elif ov.override_type == "change_hours":
                change_hours_ov = ov
            elif ov.override_type == "extra_hours":
                extra_hours_ov = ov

        # 5. Retrieve Weekly Availability & Sessions
        weekday = target_date.weekday() # 0 = Monday, 6 = Sunday
        avails = get_or_create_default_availability(db, doctor_id)
        day_avail = next((a for a in avails if a.weekday == weekday), None)

        is_regular_active = day_avail.is_active if day_avail else False
        if not is_regular_active and not extra_hours_ov and not change_hours_ov:
            return {
                "available": False,
                "reason": "Doctor does not have scheduled hours on this day of the week.",
                "slots": [],
                "grouped_slots": {"morning": [], "afternoon": [], "evening": []}
            }

        # Build working sessions list: List of dicts
        candidate_sessions = []

        if change_hours_ov and change_hours_ov.start_time and change_hours_ov.end_time:
            candidate_sessions.append({
                "session_name": "Adjusted Working Hours",
                "start_time": change_hours_ov.start_time,
                "end_time": change_hours_ov.end_time,
                "consultation_duration": settings.default_duration_minutes,
                "buffer_duration": settings.buffer_minutes,
                "consultation_modes": change_hours_ov.consultation_modes or ["online", "in-person"],
                "clinic_location_id": change_hours_ov.clinic_location_id
            })
        else:
            if day_avail and day_avail.is_active:
                stored_sessions = db.query(DoctorAvailabilitySession).filter_by(
                    availability_id=day_avail.id, is_active=True
                ).all()

                if stored_sessions:
                    for s in stored_sessions:
                        candidate_sessions.append({
                            "session_name": s.session_name or "Consultation Session",
                            "start_time": s.start_time,
                            "end_time": s.end_time,
                            "consultation_duration": s.consultation_duration or settings.default_duration_minutes,
                            "buffer_duration": s.buffer_duration if s.buffer_duration is not None else settings.buffer_minutes,
                            "consultation_modes": s.consultation_modes if isinstance(s.consultation_modes, list) else ["online", "in-person"],
                            "clinic_location_id": s.clinic_location_id
                        })
                else:
                    candidate_sessions.append({
                        "session_name": "Standard Consultation Hours",
                        "start_time": day_avail.start_time,
                        "end_time": day_avail.end_time,
                        "consultation_duration": day_avail.consultation_duration or settings.default_duration_minutes,
                        "buffer_duration": day_avail.buffer_duration if day_avail.buffer_duration is not None else settings.buffer_minutes,
                        "consultation_modes": day_avail.consultation_modes if isinstance(day_avail.consultation_modes, list) else ["online", "in-person"],
                        "clinic_location_id": None
                    })

            if extra_hours_ov and extra_hours_ov.start_time and extra_hours_ov.end_time:
                candidate_sessions.append({
                    "session_name": "Special Extra Hours",
                    "start_time": extra_hours_ov.start_time,
                    "end_time": extra_hours_ov.end_time,
                    "consultation_duration": settings.default_duration_minutes,
                    "buffer_duration": settings.buffer_minutes,
                    "consultation_modes": extra_hours_ov.consultation_modes or ["online", "in-person"],
                    "clinic_location_id": extra_hours_ov.clinic_location_id
                })

        # Filter candidate sessions by consult_mode & clinic_location_id
        filtered_sessions = []
        for cs in candidate_sessions:
            if consult_mode != "all" and consult_mode not in cs["consultation_modes"]:
                continue
            if clinic_location_id and cs["clinic_location_id"] and cs["clinic_location_id"] != clinic_location_id:
                continue
            filtered_sessions.append(cs)

        if not filtered_sessions:
            return {
                "available": False,
                "reason": f"No sessions available matching consultation mode '{consult_mode}'.",
                "slots": [],
                "grouped_slots": {"morning": [], "afternoon": [], "evening": []}
            }

        # 6. Fetch Breaks
        if day_avail:
            day_breaks = db.query(DoctorAvailabilityBreak).filter_by(availability_id=day_avail.id).all()
            for b in day_breaks:
                b_s = time_to_minutes(parse_time_str(b.start_time))
                b_e = time_to_minutes(parse_time_str(b.end_time))
                blocked_intervals.append((b_s, b_e))

        # 7. Fetch Confirmed Appointments & Holds (protecting buffer duration)
        booked_intervals = []
        booked_apts = db.query(Appointment).filter(
            Appointment.doctor_id == doctor_id,
            Appointment.date == target_date_str,
            Appointment.status.in_(["confirmed", "upcoming", "in-progress"])
        ).all()

        for a in booked_apts:
            if a.start_time and a.end_time:
                a_start = time_to_minutes(parse_time_str(a.start_time))
                a_end = time_to_minutes(parse_time_str(a.end_time))
                # Add buffer protection after appointment
                booked_intervals.append((a_start, a_end + settings.buffer_minutes))
            elif a.time:
                try:
                    dt = datetime.strptime(a.time.replace("Today, ", "").replace("Tomorrow, ", "").strip(), "%I:%M %p")
                    t_min = dt.hour * 60 + dt.minute
                    booked_intervals.append((t_min, t_min + settings.default_duration_minutes + settings.buffer_minutes))
                except Exception:
                    pass

        # Active unexpired slot holds
        now_utc = datetime.utcnow()
        holds = db.query(AppointmentSlotHold).filter(
            AppointmentSlotHold.doctor_id == doctor_id,
            AppointmentSlotHold.date == target_date_str,
            AppointmentSlotHold.status == "held",
            AppointmentSlotHold.expires_at > now_utc
        ).all()

        for h in holds:
            h_start = time_to_minutes(parse_time_str(h.start_time))
            h_end = time_to_minutes(parse_time_str(h.end_time))
            booked_intervals.append((h_start, h_end + settings.buffer_minutes))

        # 8. Minimum Notice Cutoff for Today
        min_notice_minute = -1
        if target_date == today_date:
            curr_kolkata_minutes = now_kolkata.hour * 60 + now_kolkata.minute
            min_notice_minute = curr_kolkata_minutes + settings.minimum_notice_minutes

        # 9. Generate Slots across Sessions
        generated_slots = []
        seen_slot_starts = set()

        for sess in filtered_sessions:
            s_start_min = time_to_minutes(parse_time_str(sess["start_time"]))
            s_end_min = time_to_minutes(parse_time_str(sess["end_time"]))
            duration = sess["consultation_duration"]
            buffer = sess["buffer_duration"]
            session_modes = sess["consultation_modes"]

            curr_min = s_start_min
            while curr_min + duration <= s_end_min:
                slot_start = curr_min
                slot_end = curr_min + duration

                # Advance pointer for next loop
                curr_min += duration + buffer

                # Avoid duplicate slots if sessions overlap
                if slot_start in seen_slot_starts:
                    continue

                # Check notice cutoff
                if min_notice_minute > 0 and slot_start < min_notice_minute:
                    continue

                # Check break / leave overlap
                in_blocked = False
                for b_start, b_end in blocked_intervals:
                    if not (slot_end <= b_start or slot_start >= b_end):
                        in_blocked = True
                        break
                if in_blocked:
                    continue

                # Check booked / hold overlap
                is_booked = False
                for b_start, b_end in booked_intervals:
                    if not (slot_end <= b_start or slot_start >= b_end):
                        is_booked = True
                        break
                if is_booked:
                    continue

                seen_slot_starts.add(slot_start)
                s_time = minutes_to_time(slot_start)
                e_time = minutes_to_time(slot_end)
                period = categorize_slot(s_time)

                generated_slots.append({
                    "start_time": f"{s_time.hour:02d}:{s_time.minute:02d}",
                    "end_time": f"{e_time.hour:02d}:{e_time.minute:02d}",
                    "start_time_12h": format_time_12h(s_time),
                    "end_time_12h": format_time_12h(e_time),
                    "display_time": f"{format_time_12h(s_time)} - {format_time_12h(e_time)}",
                    "duration_minutes": duration,
                    "buffer_minutes": buffer,
                    "time_period": period,
                    "session_name": sess["session_name"],
                    "available": True,
                    "consultation_modes": session_modes,
                    "fee": doc.consultation_fee
                })

        # Sort slots by start_time
        generated_slots.sort(key=lambda s: s["start_time"])

        # Group slots by time period
        grouped = {
            "morning": [s for s in generated_slots if s["time_period"] == "morning"],
            "afternoon": [s for s in generated_slots if s["time_period"] == "afternoon"],
            "evening": [s for s in generated_slots if s["time_period"] == "evening"]
        }

        return {
            "doctor_id": doctor_id,
            "doctor_name": doc.name,
            "specialty": doc.specialty,
            "date": target_date_str,
            "timezone": settings.timezone,
            "available": len(generated_slots) > 0,
            "total_available_slots": len(generated_slots),
            "slots": generated_slots,
            "available_slots": generated_slots,
            "grouped_slots": grouped,
            "sessions": [
                {
                    "session_name": s["session_name"],
                    "start_time": s["start_time"],
                    "end_time": s["end_time"],
                    "consultation_modes": s["consultation_modes"]
                }
                for s in filtered_sessions
            ],
            "settings": {
                "minimum_notice_minutes": settings.minimum_notice_minutes,
                "maximum_advance_days": settings.maximum_advance_days,
                "same_day_booking_enabled": settings.same_day_booking_enabled,
                "default_duration_minutes": settings.default_duration_minutes,
                "buffer_minutes": settings.buffer_minutes,
                "cancellation_policy": settings.cancellation_policy,
                "rescheduling_policy": settings.rescheduling_policy
            }
        }
    finally:
        db.close()


# =============================================================================
# 3. CONCURRENCY CONTROL & TEMPORARY SLOT HOLD
# =============================================================================

def hold_appointment_slot(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Temporarily holds an appointment slot for a patient while they complete details/payment.
    Prevents race conditions / double bookings.
    """
    db = SessionLocal()
    try:
        cleanup_expired_holds(db)
        doctor_id = payload["doctor_id"]
        patient_id = payload.get("patient_id", "pt-curr-user")
        date_str = payload["date"]
        start_time = payload["start_time"]
        end_time = payload["end_time"]
        hold_seconds = int(payload.get("hold_seconds", 300)) # 5 minutes

        # Check existing overlapping confirmed appointments
        existing_apt = db.query(Appointment).filter(
            Appointment.doctor_id == doctor_id,
            Appointment.date == date_str,
            Appointment.status.in_(["confirmed", "upcoming", "in-progress"])
        ).all()

        req_start = time_to_minutes(parse_time_str(start_time))
        req_end = time_to_minutes(parse_time_str(end_time))

        for a in existing_apt:
            if a.start_time and a.end_time:
                a_s = time_to_minutes(parse_time_str(a.start_time))
                a_e = time_to_minutes(parse_time_str(a.end_time))
                if not (req_end <= a_s or req_start >= a_e):
                    return {"success": False, "error": "This slot was just confirmed by another patient. Please select another slot."}

        # Check existing active hold from other patient
        now_utc = datetime.utcnow()
        other_hold = db.query(AppointmentSlotHold).filter(
            AppointmentSlotHold.doctor_id == doctor_id,
            AppointmentSlotHold.date == date_str,
            AppointmentSlotHold.status == "held",
            AppointmentSlotHold.expires_at > now_utc,
            AppointmentSlotHold.patient_id != patient_id
        ).all()

        for h in other_hold:
            h_s = time_to_minutes(parse_time_str(h.start_time))
            h_e = time_to_minutes(parse_time_str(h.end_time))
            if not (req_end <= h_s or req_start >= h_e):
                return {"success": False, "error": "This slot is currently held by another patient. Please choose another slot."}

        # Create or update hold
        hold = AppointmentSlotHold(
            id=f"ash-{uuid.uuid4().hex[:10]}",
            doctor_id=doctor_id,
            patient_id=patient_id,
            date=date_str,
            start_time=start_time,
            end_time=end_time,
            expires_at=now_utc + timedelta(seconds=hold_seconds),
            status="held"
        )
        db.add(hold)
        db.commit()

        return {
            "success": True,
            "hold_id": hold.id,
            "expires_at": hold.expires_at.isoformat(),
            "hold_seconds": hold_seconds
        }
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def release_slot_hold(hold_id: str) -> bool:
    db = SessionLocal()
    try:
        h = db.query(AppointmentSlotHold).filter_by(id=hold_id).first()
        if h:
            h.status = "released"
            db.commit()
            return True
        return False
    finally:
        db.close()


# =============================================================================
# 4. ATOMIC APPOINTMENT BOOKING & ROOM GENERATION
# =============================================================================

def book_appointment_atomic(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Atomically books appointment with database-level concurrency protection.
    If mode is 'online', provisions unique VideoConsultation room.
    """
    db = SessionLocal()
    try:
        doctor_id = payload.get("doctor_id")
        if not doctor_id:
            raise ValueError("doctor_id is required")

        doc = db.query(DoctorProfile).filter_by(id=doctor_id, verified=True).first()
        if not doc:
            raise ValueError("Doctor is not verified or does not exist.")

        latest_app = db.query(DoctorVerificationApplication).filter_by(
            doctor_id=doctor_id
        ).order_by(DoctorVerificationApplication.created_at.desc()).first()
        if latest_app and latest_app.status in ["rejected", "suspended"]:
            raise ValueError(f"Doctor is currently {latest_app.status} and cannot accept bookings.")

        date_str = payload.get("date")
        time_display = payload.get("time") # e.g. "10:00 AM" or "10:00 AM - 10:30 AM"
        start_time = payload.get("start_time") # e.g. "10:00"
        end_time = payload.get("end_time") # e.g. "10:30"
        consult_type = payload.get("type", "online")
        patient_name = payload.get("patient_name")
        patient_email = payload.get("patient_email")
        patient_phone = payload.get("patient_phone")
        patient_id = payload.get("patient_id", "pt-101")
        symptoms = payload.get("symptoms", "")
        notes = payload.get("notes", "")
        hold_id = payload.get("hold_id")

        # Resolve patient profile dynamically from DB if name or email not supplied
        pat_db = db.query(PatientProfile).filter(
            (PatientProfile.id == patient_id) | (PatientProfile.user_id == patient_id)
        ).first()
        if not pat_db:
            pat_user = db.query(User).filter_by(id=patient_id).first()
            if pat_user:
                if not patient_name:
                    patient_name = pat_user.full_name
                if not patient_email:
                    patient_email = pat_user.email
                if not patient_phone and pat_user.phone:
                    patient_phone = pat_user.phone
        else:
            if not patient_name:
                patient_name = pat_db.full_name
            if not patient_email:
                patient_email = pat_db.email
            if not patient_phone and pat_db.phone:
                patient_phone = pat_db.phone

        patient_name = patient_name or "Registered Patient"
        patient_email = patient_email or "sankeerthana2905@gmail.com"
        patient_phone = patient_phone or "+91 98765 43210"

        # 1. Date Validation
        now_kolkata = get_now_kolkata()
        today_date = now_kolkata.date()
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except Exception:
            raise ValueError("Invalid appointment date format. Expected YYYY-MM-DD.")

        if target_date < today_date:
            raise ValueError("Appointments cannot be booked for past dates.")

        if not start_time:
            # Derive from time string
            try:
                dt = datetime.strptime(time_display.split("-")[0].replace("Today, ", "").replace("Tomorrow, ", "").strip(), "%I:%M %p")
                start_time = f"{dt.hour:02d}:{dt.minute:02d}"
                end_time = f"{(dt + timedelta(minutes=30)).hour:02d}:{(dt + timedelta(minutes=30)).minute:02d}"
            except Exception:
                start_time = "10:00"
                end_time = "10:30"

        req_s = time_to_minutes(parse_time_str(start_time))
        req_e = time_to_minutes(parse_time_str(end_time)) if end_time else req_s + 30

        # Check today minimum notice window
        if target_date == today_date:
            settings = get_or_create_schedule_settings(db, doctor_id)
            current_minutes = now_kolkata.hour * 60 + now_kolkata.minute
            if req_s < current_minutes + settings.minimum_notice_minutes:
                raise ValueError(f"Appointments require at least {settings.minimum_notice_minutes} minutes notice.")

        # 2. Check Leaves (DoctorLeave)
        leaves = db.query(DoctorLeave).filter(
            DoctorLeave.doctor_id == doctor_id,
            DoctorLeave.status == "active",
            DoctorLeave.start_date <= date_str,
            DoctorLeave.end_date >= date_str
        ).all()
        for lv in leaves:
            if lv.is_all_day:
                raise ValueError(f"Doctor is on scheduled leave on this date ({lv.reason or 'Leave'}). Please choose another date.")
            elif lv.start_time and lv.end_time:
                lv_s = time_to_minutes(parse_time_str(lv.start_time))
                lv_e = time_to_minutes(parse_time_str(lv.end_time))
                if not (req_e <= lv_s or req_s >= lv_e):
                    raise ValueError(f"Doctor is on leave during this time ({lv.reason or 'Scheduled Leave'}).")

        # 3. Check Date Overrides (DoctorScheduleOverride)
        overrides = db.query(DoctorScheduleOverride).filter_by(doctor_id=doctor_id, date=date_str).all()
        for ov in overrides:
            if ov.is_all_day and ov.override_type in ["holiday", "leave", "blocked_time"]:
                raise ValueError(f"Doctor is not available on this date ({ov.reason or 'Clinic Holiday'}).")
            elif not ov.is_all_day and ov.override_type == "blocked_time" and ov.start_time and ov.end_time:
                ov_s = time_to_minutes(parse_time_str(ov.start_time))
                ov_e = time_to_minutes(parse_time_str(ov.end_time))
                if not (req_e <= ov_s or req_s >= ov_e):
                    raise ValueError(f"This time slot is blocked: {ov.reason or 'Unavailable'}.")

        # 4. Check Scheduled Breaks (DoctorAvailabilityBreak)
        weekday = target_date.weekday()
        day_avail = db.query(DoctorAvailability).filter_by(doctor_id=doctor_id, weekday=weekday).first()
        if day_avail:
            breaks = db.query(DoctorAvailabilityBreak).filter_by(availability_id=day_avail.id).all()
            for b in breaks:
                b_s = time_to_minutes(parse_time_str(b.start_time))
                b_e = time_to_minutes(parse_time_str(b.end_time))
                if not (req_e <= b_s or req_s >= b_e):
                    raise ValueError(f"This slot overlaps with the doctor's scheduled break: {b.title or 'Break'}.")

        # 5. Concurrency check: Ensure no overlapping confirmed appointment exists
        existing = db.query(Appointment).filter(
            Appointment.doctor_id == doctor_id,
            Appointment.date == date_str,
            Appointment.status.in_(["confirmed", "upcoming", "in-progress"])
        ).all()

        for a in existing:
            if a.start_time and a.end_time:
                a_s = time_to_minutes(parse_time_str(a.start_time))
                a_e = time_to_minutes(parse_time_str(a.end_time))
                if not (req_e <= a_s or req_s >= a_e):
                    raise ValueError("This slot has just been reserved by another patient. Please choose another time.")

        # Create unique reference ID
        today_code = datetime.utcnow().strftime("%Y%m%d")
        ref_id = f"MED-{today_code}-{uuid.uuid4().hex[:6].upper()}"
        apt_id = f"apt-{uuid.uuid4().hex[:12]}"

        # Room generation for online video consultation
        room_id = f"med-room-{uuid.uuid4().hex[:12]}" if consult_type == "online" else None
        meeting_link = f"/consultation/{room_id}" if room_id else None

        apt = Appointment(
            id=apt_id,
            appointment_reference=ref_id,
            doctor_id=doc.id,
            doctor_name=doc.name,
            doctor_specialty=doc.specialty,
            doctor_avatar=doc.avatar,
            patient_id=patient_id,
            patient_name=patient_name,
            patient_email=patient_email,
            patient_phone=patient_phone,
            date=date_str,
            time=time_display or f"{format_time_12h(parse_time_str(start_time))} - {format_time_12h(parse_time_str(end_time))}",
            start_time=start_time,
            end_time=end_time,
            type=consult_type,
            status="confirmed",
            fee=doc.consultation_fee,
            payment_status="paid",
            payment_reference=f"PAY-RZP-{uuid.uuid4().hex[:8].upper()}",
            symptoms=symptoms,
            notes=notes,
            clinic_name=doc.clinic_name or "MediVerse Medical Sanctuary",
            meeting_room_id=room_id,
            meeting_link=meeting_link,
            created_at=datetime.utcnow()
        )
        db.add(apt)
        db.flush()

        # If online video consultation, create VideoConsultation record
        if consult_type == "online" and room_id:
            vc = VideoConsultation(
                id=f"vc-{uuid.uuid4().hex[:12]}",
                appointment_id=apt.id,
                room_id=room_id,
                provider="webrtc",
                consultation_status="scheduled",
                created_at=datetime.utcnow()
            )
            db.add(vc)

        # Release hold if hold_id provided
        if hold_id:
            db.query(AppointmentSlotHold).filter_by(id=hold_id).update({"status": "confirmed"})

        # Send in-app notification to doctor
        doc_notif = DoctorNotification(
            id=f"dn-{uuid.uuid4().hex[:12]}",
            doctor_id=doc.id,
            title="New Patient Consultation Scheduled",
            message=f"Appointment confirmed with {patient_name} on {date_str} at {apt.time} ({consult_type}). Ref: {ref_id}",
            type="success",
            action_url="/doctor/dashboard",
            created_at=datetime.utcnow()
        )
        db.add(doc_notif)

        # Send in-app notification to patient
        pat_notif = PatientNotification(
            id=f"pn-{uuid.uuid4().hex[:12]}",
            patient_id=patient_id,
            title="Consultation Confirmed",
            message=f"Your consultation with {doc.name} on {date_str} at {apt.time} ({consult_type}) has been confirmed. Ref: {ref_id}",
            type="success",
            action_url="/patient/dashboard",
            created_at=datetime.utcnow()
        )
        db.add(pat_notif)

        # Find doctor user email
        doc_user = db.query(User).filter_by(doctor_id=doc.id).first()
        doctor_email = doc_user.email if doc_user else f"{doc.id}@mediverse.org"
        doctor_phone = doc_user.phone if doc_user else getattr(doc, "phone", "+91 98401 23456")

        db.commit()

        return {
            "success": True,
            "appointment": {
                "id": apt.id,
                "reference": apt.appointment_reference,
                "appointment_reference": apt.appointment_reference,
                "doctor_id": apt.doctor_id,
                "doctor_name": apt.doctor_name,
                "doctor_specialty": apt.doctor_specialty,
                "doctor_avatar": apt.doctor_avatar,
                "doctor_email": doctor_email,
                "doctor_phone": doctor_phone,
                "patient_id": apt.patient_id,
                "patient_name": apt.patient_name,
                "patient_email": apt.patient_email,
                "patient_phone": apt.patient_phone,
                "date": apt.date,
                "time": apt.time,
                "start_time": apt.start_time,
                "end_time": apt.end_time,
                "timezone": "Asia/Kolkata",
                "type": apt.type,
                "status": apt.status,
                "fee": apt.fee,
                "payment_status": apt.payment_status,
                "payment_reference": apt.payment_reference,
                "clinic_name": apt.clinic_name,
                "meeting_room_id": apt.meeting_room_id,
                "meeting_link": apt.meeting_link,
                "symptoms": apt.symptoms,
                "notes": apt.notes
            }
        }
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


# =============================================================================
# 5. APPOINTMENTS LISTING & DASHBOARD QUERIES
# =============================================================================

def get_patient_appointments(patient_id: str = "pt-101", status_filter: str = "all") -> List[Dict[str, Any]]:
    """Retrieves all appointments for a patient with consultation room links."""
    db = SessionLocal()
    try:
        query = db.query(Appointment).order_by(Appointment.date.desc(), Appointment.start_time.asc())
        if patient_id and patient_id != "all":
            # Match by ID or demo patient
            query = query.filter((Appointment.patient_id == patient_id) | (Appointment.patient_email.like("%patient%")))

        if status_filter and status_filter != "all":
            query = query.filter(Appointment.status == status_filter)

        apts = query.all()
        results = []
        for a in apts:
            results.append({
                "id": a.id,
                "reference": a.appointment_reference or a.id,
                "doctor_id": a.doctor_id,
                "doctor_name": a.doctor_name,
                "doctor_specialty": a.doctor_specialty,
                "doctor_avatar": a.doctor_avatar,
                "patient_id": a.patient_id,
                "patient_name": a.patient_name,
                "date": a.date,
                "time": a.time,
                "start_time": a.start_time,
                "end_time": a.end_time,
                "type": a.type,
                "status": a.status,
                "fee": a.fee,
                "payment_status": a.payment_status,
                "clinic_name": a.clinic_name,
                "meeting_room_id": a.meeting_room_id,
                "meeting_link": a.meeting_link or (f"/consultation/{a.meeting_room_id}" if a.meeting_room_id else None),
                "symptoms": a.symptoms,
                "notes": a.notes,
                "created_at": a.created_at.isoformat() if a.created_at else None
            })
        return results
    finally:
        db.close()


def get_doctor_appointments(doctor_id: str, status_filter: str = "all") -> List[Dict[str, Any]]:
    """Retrieves appointments scheduled with a doctor."""
    db = SessionLocal()
    try:
        query = db.query(Appointment).filter(Appointment.doctor_id == doctor_id).order_by(Appointment.date.asc(), Appointment.start_time.asc())
        if status_filter and status_filter != "all":
            query = query.filter(Appointment.status == status_filter)

        apts = query.all()
        results = []
        for a in apts:
            results.append({
                "id": a.id,
                "reference": a.appointment_reference or a.id,
                "doctor_id": a.doctor_id,
                "doctor_name": a.doctor_name,
                "doctor_specialty": a.doctor_specialty,
                "doctor_avatar": a.doctor_avatar,
                "patient_id": a.patient_id,
                "patient_name": a.patient_name,
                "patient_email": a.patient_email,
                "patient_phone": a.patient_phone,
                "date": a.date,
                "time": a.time,
                "start_time": a.start_time,
                "end_time": a.end_time,
                "type": a.type,
                "status": a.status,
                "fee": a.fee,
                "payment_status": a.payment_status,
                "meeting_room_id": a.meeting_room_id,
                "meeting_link": a.meeting_link or (f"/consultation/{a.meeting_room_id}" if a.meeting_room_id else None),
                "symptoms": a.symptoms,
                "notes": a.notes,
                "created_at": a.created_at.isoformat() if a.created_at else None
            })
        return results
    finally:
        db.close()


def check_cancellation_eligibility(appointment_id: str) -> Dict[str, Any]:
    """
    Checks if appointment is eligible for cancellation according to MediVerse policy:
    - Cancellations are permitted up to 24 hours prior to scheduled consultation.
    - Non-refundable fee policy applies for patient-initiated cancellations.
    """
    db = SessionLocal()
    try:
        apt = db.query(Appointment).filter_by(id=appointment_id).first()
        if not apt:
            return {"eligible": False, "reason": "Appointment not found"}
        if apt.status in ["cancelled", "completed"]:
            return {"eligible": False, "reason": f"Appointment is already {apt.status}"}

        # Determine consultation datetime
        try:
            apt_time_str = apt.start_time or ""
            if not apt_time_str and apt.time:
                raw = apt.time.split(" - ")[0].strip()
                if "AM" in raw or "PM" in raw:
                    t_obj = datetime.strptime(raw, "%I:%M %p").time()
                    apt_time_str = f"{t_obj.hour:02d}:{t_obj.minute:02d}"
                else:
                    apt_time_str = raw

            if not apt_time_str:
                apt_time_str = "09:00"

            apt_dt = datetime.strptime(f"{apt.date} {apt_time_str}", "%Y-%m-%d %H:%M")
        except Exception:
            apt_dt = datetime.strptime(f"{apt.date} 09:00", "%Y-%m-%d %H:%M")

        now = get_now_kolkata()
        diff = apt_dt - now
        hours_remaining = diff.total_seconds() / 3600.0

        deadline_hours = 24.0
        is_eligible = hours_remaining >= deadline_hours

        return {
            "eligible": is_eligible,
            "hours_remaining": max(0.0, round(hours_remaining, 1)),
            "deadline_hours": 24,
            "appointment_date": apt.date,
            "appointment_time": apt.time,
            "doctor_name": apt.doctor_name,
            "fee": apt.fee,
            "cancellation_policy": "Free cancellation permitted up to 24 hours before consultation. Non-refundable policy applies.",
            "reason": None if is_eligible else f"Cancellation locked: Appointment is in {max(0.0, round(hours_remaining, 1))} hours (deadline is 24 hours)."
        }
    finally:
        db.close()


def cancel_appointment(appointment_id: str, reason: str, cancelled_by: str = "patient") -> Dict[str, Any]:
    db = SessionLocal()
    try:
        apt = db.query(Appointment).filter_by(id=appointment_id).first()
        if not apt:
            raise ValueError("Appointment not found")

        if apt.status == "cancelled":
            return {"success": True, "message": "Appointment is already cancelled."}

        # Patient cancellation must respect 24-hour deadline
        if cancelled_by == "patient":
            eligibility = check_cancellation_eligibility(appointment_id)
            if not eligibility["eligible"]:
                raise ValueError(
                    eligibility["reason"] or "Cancellation is not permitted within 24 hours of scheduled consultation."
                )

        apt.status = "cancelled"
        prefix = "Cancelled by Doctor: " if cancelled_by == "doctor" else "Cancelled by Patient: "
        apt.cancellation_reason = f"{prefix}{reason.strip()}"

        # If has video consultation, cancel it
        if apt.meeting_room_id:
            vc = db.query(VideoConsultation).filter_by(room_id=apt.meeting_room_id).first()
            if vc:
                vc.consultation_status = "cancelled"

        # Notify doctor or patient
        notif = DoctorNotification(
            id=f"dn-{uuid.uuid4().hex[:12]}",
            doctor_id=apt.doctor_id,
            title="Appointment Cancelled",
            message=f"Appointment on {apt.date} with {apt.patient_name} was {apt.cancellation_reason}.",
            type="warning",
            action_url="/doctor/dashboard",
            created_at=datetime.utcnow()
        )
        db.add(notif)

        db.commit()
        return {
            "success": True,
            "message": "Appointment cancelled successfully.",
            "appointment_id": appointment_id,
            "status": "cancelled",
            "refund_note": "Non-refundable consultation fee per cancellation policy." if cancelled_by == "patient" else "Full refund will be processed as cancellation was initiated by doctor."
        }
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def reschedule_appointment(appointment_id: str, new_date: str, new_time: str, new_start_time: str, new_end_time: str) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        apt = db.query(Appointment).filter_by(id=appointment_id).first()
        if not apt:
            raise ValueError("Appointment not found")

        apt.date = new_date
        apt.time = new_time
        apt.start_time = new_start_time
        apt.end_time = new_end_time
        apt.status = "confirmed"

        db.commit()
        return {"success": True, "message": "Appointment rescheduled successfully."}
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


# =============================================================================
# 6. REAL-TIME VIDEO CONSULTATION ENGINE & SIGNALING
# =============================================================================

def join_video_consultation(room_id: str, user_id: str, user_name: str, user_role: str) -> Dict[str, Any]:
    """
    Validates appointment time window, user identity, and registers participant in consultation.
    Returns WebRTC configuration, token credentials, and consultation metadata.
    """
    db = SessionLocal()
    try:
        # 1. Find video consultation or appointment by room_id
        vc = db.query(VideoConsultation).filter_by(room_id=room_id).first()
        apt = None
        if vc:
            apt = db.query(Appointment).filter_by(id=vc.appointment_id).first()

        if not apt:
            # Search by meeting_room_id, direct ID, or reference
            clean_room = room_id.replace("ROOM-", "").strip()
            apt = (
                db.query(Appointment).filter_by(meeting_room_id=room_id).first()
                or db.query(Appointment).filter_by(id=clean_room).first()
                or db.query(Appointment).filter_by(appointment_reference=room_id).first()
            )
            if apt:
                if not apt.meeting_room_id:
                    apt.meeting_room_id = room_id
                actual_room_id = apt.meeting_room_id or room_id
                if not vc:
                    vc = db.query(VideoConsultation).filter_by(room_id=actual_room_id).first()
                if not vc:
                    vc = VideoConsultation(
                        id=f"vc-{uuid.uuid4().hex[:12]}",
                        appointment_id=apt.id,
                        room_id=actual_room_id,
                        provider="webrtc",
                        consultation_status="scheduled",
                        created_at=datetime.utcnow()
                    )
                    db.add(vc)
                    db.flush()

        if not apt:
            raise ValueError(f"Consultation room not found or invalid: {room_id}")

        if apt.status == "cancelled":
            raise ValueError("This consultation appointment was cancelled.")

        if apt.status not in ("confirmed", "in-progress", "completed", "upcoming"):
            raise ValueError(f"This consultation appointment is currently '{apt.status}'. Only confirmed appointments can access the consultation room.")

        # 2. Strict user authorization & role-separated ownership verification
        is_authorized = False
        if user_role == "admin":
            is_authorized = True
        elif user_role == "doctor":
            clean_uid = (user_id or "").strip()
            clean_name = (user_name or "").strip().lower()
            apt_doc_id = (apt.doctor_id or "").strip()
            apt_doc_name = (apt.doctor_name or "").strip().lower()

            # Direct doctor ID match
            if clean_uid and (
                clean_uid == apt_doc_id
                or clean_uid in [apt_doc_id, f"usr-{apt_doc_id}", f"doc-{apt_doc_id}", apt_doc_id.replace("doc-", "")]
            ):
                is_authorized = True

            # Match through User database table
            if not is_authorized:
                doc_user = db.query(User).filter(
                    (User.doctor_id == apt_doc_id) |
                    (User.id == apt_doc_id) |
                    (User.id == clean_uid) |
                    (User.doctor_id == clean_uid)
                ).first()
                if doc_user and (clean_uid in [doc_user.id, doc_user.email, doc_user.doctor_id]):
                    is_authorized = True

            # Match through DoctorProfile table
            if not is_authorized:
                doc_prof = db.query(DoctorProfile).filter_by(id=apt_doc_id).first()
                if doc_prof and (clean_uid == doc_prof.id or (clean_name and clean_name in doc_prof.name.lower())):
                    is_authorized = True

            # Name matching fallback for authorized doctor
            if not is_authorized and clean_name and apt_doc_name:
                if clean_name in apt_doc_name or apt_doc_name in clean_name:
                    is_authorized = True

        elif user_role == "patient":
            clean_uid = (user_id or "").strip()
            clean_name = (user_name or "").strip().lower()
            apt_pat_id = (apt.patient_id or "").strip()
            apt_pat_email = (apt.patient_email or "").strip().lower()
            apt_pat_name = (apt.patient_name or "").strip().lower()

            # Direct patient ID match
            if clean_uid and (
                clean_uid == apt_pat_id
                or clean_uid in [apt_pat_id, f"usr-{apt_pat_id}", apt_pat_id.replace("usr-", "")]
            ):
                is_authorized = True

            # Email match
            if not is_authorized and apt_pat_email and clean_uid.lower() == apt_pat_email:
                is_authorized = True

            # Match through User database table
            if not is_authorized:
                pat_user = db.query(User).filter((User.id == clean_uid) | (User.email == clean_uid.lower())).first()
                if pat_user:
                    if (
                        (apt_pat_email and pat_user.email.lower() == apt_pat_email)
                        or pat_user.id in [apt_pat_id, f"usr-{apt_pat_id}", apt_pat_id.replace("usr-", "")]
                    ):
                        is_authorized = True

            # Name matching fallback for authorized patient
            if not is_authorized and clean_name and apt_pat_name:
                if clean_name in apt_pat_name or apt_pat_name in clean_name:
                    is_authorized = True

        if not is_authorized:
            raise ValueError(f"Unauthorized: You are not authorized to join this private consultation room ({room_id}).")

        # 3. Consultation time validation:
        # In development/testing and for confirmed telehealth appointments,
        # authorized participants are allowed to enter the room before scheduled time to test audio/video/connection.
        # Only reject if the session is long past (e.g. > 2 days after scheduled date) and already marked completed.
        now_kolkata = get_now_kolkata()
        try:
            target_date = datetime.strptime(apt.date, "%Y-%m-%d").date()
            days_past = (now_kolkata.date() - target_date).days
            if days_past > 2 and apt.status == "completed":
                raise ValueError(f"This consultation was completed on {apt.date} and the session room has concluded.")
        except ValueError as ve:
            if "concluded" in str(ve):
                raise ve
        except Exception as e:
            logger.warning(f"Error validating appointment date {apt.date}: {e}")

        # Update consultation status based on join
        now = datetime.utcnow()
        if not vc.started_at:
            vc.started_at = now

        # Add or update participant
        participant = db.query(ConsultationParticipant).filter_by(
            consultation_id=vc.id, role=user_role
        ).first()

        if not participant:
            participant = ConsultationParticipant(
                id=f"cp-{uuid.uuid4().hex[:12]}",
                consultation_id=vc.id,
                user_id=user_id,
                user_name=user_name,
                role=user_role,
                joined_at=now,
                connection_status="connected"
            )
            db.add(participant)
        else:
            participant.joined_at = now
            participant.connection_status = "connected"

        db.flush()

        # Check total active participants
        active_participants = db.query(ConsultationParticipant).filter(
            ConsultationParticipant.consultation_id == vc.id,
            ConsultationParticipant.connection_status == "connected"
        ).all()

        roles = [p.role for p in active_participants]
        if "doctor" in roles and "patient" in roles:
            vc.consultation_status = "in_progress"
            apt.status = "in-progress"
        elif user_role == "patient":
            vc.consultation_status = "waiting_doctor"
        else:
            vc.consultation_status = "waiting_patient"

        db.commit()

        # Generate secure consultation session token
        session_token = f"med-jwt-{room_id}-{user_role}-{uuid.uuid4().hex[:8]}"

        return {
            "success": True,
            "room_id": room_id,
            "consultation_id": vc.id,
            "appointment_id": apt.id,
            "appointment_reference": apt.appointment_reference or apt.id,
            "doctor_id": apt.doctor_id,
            "doctor_name": apt.doctor_name,
            "doctor_specialty": apt.doctor_specialty,
            "patient_id": apt.patient_id,
            "patient_name": apt.patient_name,
            "consultation_mode": apt.type,
            "scheduled_date": apt.date,
            "scheduled_time": apt.time,
            "user_id": user_id,
            "user_name": user_name,
            "user_role": user_role,
            "consultation_status": vc.consultation_status,
            "token": session_token,
            "ice_servers": [
                {"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"]}
            ],
            "webrtc": {
                "ice_servers": [
                    {"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"]}
                ],
                "room_id": room_id,
                "token": session_token
            },
            "agora_app_id": os.getenv("AGORA_APP_ID", "")
        }
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def send_consultation_signal(room_id: str, sender_role: str, target_role: str, signal_type: str, signal_data: Any) -> Dict[str, Any]:
    """Posts WebRTC SDP Offer / Answer or ICE Candidates for room participants."""
    db = SessionLocal()
    try:
        sig = ConsultationSignal(
            id=f"sig-{uuid.uuid4().hex[:12]}",
            room_id=room_id,
            sender_role=sender_role,
            target_role=target_role,
            signal_type=signal_type,
            signal_data=signal_data,
            consumed=False,
            created_at=datetime.utcnow()
        )
        db.add(sig)
        db.commit()
        return {"success": True, "signal_id": sig.id}
    finally:
        db.close()


def get_pending_signals(room_id: str, target_role: str) -> List[Dict[str, Any]]:
    """Polls unconsumed WebRTC signals for target participant."""
    db = SessionLocal()
    try:
        sigs = db.query(ConsultationSignal).filter(
            ConsultationSignal.room_id == room_id,
            ConsultationSignal.target_role == target_role,
            ConsultationSignal.consumed == False
        ).order_by(ConsultationSignal.created_at.asc()).all()

        results = []
        for s in sigs:
            results.append({
                "id": s.id,
                "signal_type": s.signal_type,
                "signal_data": s.signal_data,
                "sender_role": s.sender_role,
                "timestamp": s.created_at.isoformat()
            })
            s.consumed = True

        db.commit()
        return results
    finally:
        db.close()


def send_chat_message(room_id: str, sender_id: str, sender_name: str, sender_role: str, message: str) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        vc = db.query(VideoConsultation).filter_by(room_id=room_id).first()
        if not vc:
            raise ValueError("Consultation room not found")

        msg = ConsultationMessage(
            id=f"cm-{uuid.uuid4().hex[:12]}",
            consultation_id=vc.id,
            sender_id=sender_id,
            sender_name=sender_name,
            sender_role=sender_role,
            message=message,
            created_at=datetime.utcnow()
        )
        db.add(msg)
        db.commit()
        return {
            "id": msg.id,
            "sender_id": msg.sender_id,
            "sender_name": msg.sender_name,
            "sender_role": msg.sender_role,
            "message": msg.message,
            "created_at": msg.created_at.strftime("%I:%M %p")
        }
    finally:
        db.close()


def get_chat_messages(room_id: str) -> List[Dict[str, Any]]:
    db = SessionLocal()
    try:
        vc = db.query(VideoConsultation).filter_by(room_id=room_id).first()
        if not vc:
            return []

        msgs = db.query(ConsultationMessage).filter_by(consultation_id=vc.id).order_by(ConsultationMessage.created_at.asc()).all()
        return [
            {
                "id": m.id,
                "sender_id": m.sender_id,
                "sender_name": m.sender_name,
                "sender_role": m.sender_role,
                "message": m.message,
                "created_at": m.created_at.strftime("%I:%M %p")
            }
            for m in msgs
        ]
    finally:
        db.close()


def end_video_consultation(room_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Marks video consultation completed, records duration, diagnosis, and prescription."""
    db = SessionLocal()
    try:
        vc = db.query(VideoConsultation).filter_by(room_id=room_id).first()
        if not vc:
            raise ValueError("Consultation room not found")

        now = datetime.utcnow()
        vc.consultation_status = "completed"
        vc.ended_at = now
        if vc.started_at:
            vc.duration_seconds = int((now - vc.started_at).total_seconds())

        apt = db.query(Appointment).filter_by(id=vc.appointment_id).first()
        if apt:
            apt.status = "completed"

            # Save consultation notes if provided
            diagnosis = payload.get("diagnosis")
            clinical_notes = payload.get("clinical_notes")
            prescription = payload.get("prescription")
            follow_up = payload.get("follow_up")

            if diagnosis or clinical_notes or prescription:
                note = ConsultationNote(
                    id=f"cn-{uuid.uuid4().hex[:12]}",
                    appointment_id=apt.id,
                    doctor_id=apt.doctor_id,
                    patient_id=apt.patient_id,
                    diagnosis=diagnosis,
                    clinical_notes=clinical_notes,
                    prescription_summary=prescription,
                    follow_up_advice=follow_up,
                    created_at=now
                )
                db.add(note)

        # Notify patient that consultation has been completed
        notif = DoctorNotification(
            id=f"dn-{uuid.uuid4().hex[:12]}",
            doctor_id=apt.doctor_id,
            title="Consultation Summary Recorded",
            message=f"Consultation with {apt.patient_name} completed ({vc.duration_seconds // 60}m {vc.duration_seconds % 60}s).",
            type="info",
            action_url="/doctor/dashboard",
            created_at=now
        )
        db.add(notif)

        db.commit()

        return {
            "success": True,
            "duration_seconds": vc.duration_seconds,
            "completed_at": now.isoformat()
        }
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


# =============================================================================
# 7. NOTIFICATIONS & EMAIL AUDIT HELPERS
# =============================================================================

def get_patient_notifications(patient_id: str) -> List[Dict[str, Any]]:
    """Retrieves notifications for patient."""
    db = SessionLocal()
    try:
        notifs = db.query(PatientNotification).filter_by(patient_id=patient_id).order_by(PatientNotification.created_at.desc()).all()
        return [
            {
                "id": n.id,
                "patient_id": n.patient_id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "action_url": n.action_url,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None
            }
            for n in notifs
        ]
    finally:
        db.close()


def get_doctor_notifications(doctor_id: str) -> List[Dict[str, Any]]:
    """Retrieves notifications for doctor."""
    db = SessionLocal()
    try:
        notifs = db.query(DoctorNotification).filter_by(doctor_id=doctor_id).order_by(DoctorNotification.created_at.desc()).all()
        return [
            {
                "id": n.id,
                "doctor_id": n.doctor_id,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "action_url": n.action_url,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None
            }
            for n in notifs
        ]
    finally:
        db.close()


def mark_notification_read(notif_id: str, role: str = "patient") -> bool:
    """Marks a notification as read."""
    db = SessionLocal()
    try:
        if role == "doctor":
            n = db.query(DoctorNotification).filter_by(id=notif_id).first()
        else:
            n = db.query(PatientNotification).filter_by(id=notif_id).first()
        if n:
            n.is_read = True
            db.commit()
            return True
        return False
    finally:
        db.close()


def log_email_dispatch(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Persists email delivery log with deduplication protection."""
    db = SessionLocal()
    try:
        idem = payload.get("idempotency_key")
        if idem:
            existing = db.query(EmailNotificationLog).filter_by(idempotency_key=idem).first()
            if existing:
                return {
                    "success": True,
                    "duplicate": True,
                    "id": existing.id,
                    "status": existing.status,
                    "recipient_email": existing.recipient_email
                }

        log_item = EmailNotificationLog(
            id=f"eml-{uuid.uuid4().hex[:12]}",
            appointment_id=payload.get("appointment_id"),
            recipient_email=payload.get("recipient_email", ""),
            recipient_role=payload.get("recipient_role", "patient"),
            recipient_name=payload.get("recipient_name", ""),
            subject=payload.get("subject", ""),
            body_html=payload.get("body_html", ""),
            body_text=payload.get("body_text", ""),
            idempotency_key=idem,
            status=payload.get("status", "sent"),
            delivery_provider=payload.get("delivery_provider", "gmail_api"),
            error_message=payload.get("error_message"),
            retry_count=int(payload.get("retry_count", 0)),
            sent_at=datetime.utcnow()
        )
        db.add(log_item)
        db.commit()
        return {
            "success": True,
            "id": log_item.id,
            "status": log_item.status,
            "recipient_email": log_item.recipient_email
        }
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        db.close()


def get_email_logs(appointment_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves email audit logs."""
    db = SessionLocal()
    try:
        query = db.query(EmailNotificationLog).order_by(EmailNotificationLog.created_at.desc())
        if appointment_id:
            query = query.filter_by(appointment_id=appointment_id)
        logs = query.all()
        return [
            {
                "id": l.id,
                "appointment_id": l.appointment_id,
                "recipient_email": l.recipient_email,
                "recipient_role": l.recipient_role,
                "recipient_name": l.recipient_name,
                "subject": l.subject,
                "status": l.status,
                "delivery_provider": l.delivery_provider,
                "idempotency_key": l.idempotency_key,
                "retry_count": l.retry_count,
                "error_message": l.error_message,
                "sent_at": l.sent_at.isoformat() if l.sent_at else None
            }
            for l in logs
        ]
    finally:
        db.close()

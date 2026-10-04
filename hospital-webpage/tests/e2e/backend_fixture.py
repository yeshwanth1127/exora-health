"""Independent database oracle/seed for the loopback-only disposable E2E runner.

This file is not part of the API image and exposes no application routes.
"""
import json
import os
import sys
from datetime import datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

directory = Path(os.environ["HMS_E2E_DIRECTORY"]).resolve()
database = directory / "clinic.db"
if not directory.name.startswith("hms-e2e-") or os.environ["DATABASE_URL"] != f"sqlite:///{database}":
    raise RuntimeError("E2E operations require the runner's disposable SQLite database")
sys.path.insert(0, os.environ["HMS_E2E_BACKEND_PATH"])

from sqlalchemy import select, func, delete
from app.db import Base, SessionLocal
from app.models import (Appointment, Branch, ClientModule, Doctor, OutboxEvent,
                        ReminderJob, Reservation, ScheduleException, ScheduleRule,
                        StaffUser, WebBookingSession, utcnow)
from app.seed import seed_catalogue
from app.staff_auth import password_hash

command = sys.argv[1]
data = json.loads(sys.stdin.read() or "{}")
with SessionLocal() as db:
    if command == "reset":
        # The runner owns this new database, never a clinic/preview database.
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(delete(table))
        db.commit()
        seed_catalogue(db)
        doctor = db.scalar(select(Doctor).where(Doctor.slug == "doc-1"))
        branch = db.scalar(select(Branch).where(Branch.slug == "indiranagar"))
        day = datetime.now(ZoneInfo("Asia/Kolkata")).date() + timedelta(days=3)
        db.execute(delete(ScheduleRule).where(ScheduleRule.doctor_id == doctor.id))
        for offset in (0, 1):
            visit_day = day + timedelta(days=offset)
            db.add(ScheduleRule(doctor_id=doctor.id, branch_id=branch.id,
                consultation_type="in_person", schedule_date=visit_day,
                weekday=visit_day.weekday(), effective_from=visit_day,
                effective_until=visit_day, starts_at_local=time(9),
                ends_at_local=time(12), slot_minutes=30))
        db.add(StaffUser(username="e2e.reception", display_name="E2E Reception",
                        role="staff", password_hash=password_hash("fictional-e2e-password")))
        db.add(StaffUser(username="e2e.admin", display_name="E2E Admin",
                        role="admin", password_hash=password_hash("fictional-e2e-password")))
        db.commit()
        result = {"doctor": doctor.id, "doctor_name": doctor.name,
                  "branch": branch.id, "branch_slug": branch.slug,
                  "day": str(day), "next_day": str(day + timedelta(days=1)),
                  "fee": doctor.consultation_fee}
    elif command == "snapshot":
        result = {"appointments": [{"id": a.id, "code": a.confirmation_code,
            "name": a.patient_name, "status": a.status,
            "source": a.acquisition_source, "channel": a.origin_channel,
            "reservation_status": a.reservation.status,
            "starts_at": a.reservation.starts_at.isoformat(),
            "doctor": a.reservation.doctor_id, "branch": a.reservation.branch_id,
            "events": db.scalar(select(func.count()).select_from(OutboxEvent).where(
                OutboxEvent.aggregate_id == a.id, OutboxEvent.event_type == "appointment.confirmed")),
            "reminders": db.scalar(select(func.count()).select_from(ReminderJob).where(ReminderJob.appointment_id == a.id))}
            for a in db.scalars(select(Appointment))],
            "holds": [{"id": r.id, "status": r.status} for r in db.scalars(select(Reservation))]}
    elif command == "expire-holds":
        for item in db.scalars(select(Reservation).where(Reservation.status == "active")):
            item.expires_at = utcnow() - timedelta(minutes=1)
        db.commit()
        result = {"ok": True}
    elif command == "expire-sessions":
        for item in db.scalars(select(WebBookingSession)):
            item.expires_at = utcnow() - timedelta(minutes=1)
        db.commit()
        result = {"ok": True}
    elif command == "fee":
        db.get(Doctor, data["doctor"]).consultation_fee = data["fee"]
        db.commit()
        result = {"ok": True}
    elif command == "block":
        hold = db.scalar(select(Reservation).where(Reservation.status == "active"))
        db.add(ScheduleException(doctor_id=hold.doctor_id, branch_id=hold.branch_id,
            starts_at=hold.starts_at, ends_at=hold.ends_at, reason="Fictional test absence"))
        db.commit()
        result = {"ok": True}
    elif command == "disable-whatsapp":
        db.merge(ClientModule(key="whatsapp", enabled=False))
        db.commit()
        result = {"ok": True}
    elif command == "duplicate-name":
        original = db.get(Doctor, data["doctor"])
        db.add(Doctor(slug="e2e-same-name", name=original.name,
            title=original.title, bio=original.bio,
            experience_years=original.experience_years,
            consultation_fee=original.consultation_fee,
            branches=list(original.branches), departments=list(original.departments)))
        db.commit()
        result = {"ok": True}
    else:
        raise RuntimeError("Unknown fixture command")
    print(json.dumps(result))

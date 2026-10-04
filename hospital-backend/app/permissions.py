"""Tenant-scoped permissions for hospital staff."""
import secrets

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import audit
from .auth import Actor, optional_actor, require_roles
from .config import settings
from .db import get_db
from .models import Hospital, StaffPermission
from .services import DomainError

CAPABILITIES = {
    "appointments.manage": True,
    "doctors.manage": True,
    "schedules.manage": True,
    "media.manage": True,
    "cases.manage": True,
}


def capability_allowed(db: Session, actor: Actor, key: str) -> bool:
    if actor.role == "hospital_admin":
        return True
    if actor.role != "hospital_staff" or key not in CAPABILITIES:
        return False
    configured = db.get(StaffPermission, (actor.hospital_id, key))
    return configured.allowed if configured else CAPABILITIES[key]


def require_capability(key: str):
    def dependency(actor: Actor | None = Depends(optional_actor),
                   x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
                   db: Session = Depends(get_db)) -> Actor:
        if actor is None and settings.app_env != "production" and x_admin_key and secrets.compare_digest(
                x_admin_key, settings.admin_api_key):
            hospital = db.scalar(select(Hospital).order_by(Hospital.created_at).limit(1))
            if hospital:
                actor = Actor("break-glass-admin", "break-glass", hospital.id, "hospital_admin",
                              "Break-glass administrator")
                audit.actor("staff", actor.user_id, actor.display_name, actor.hospital_id)
        if actor is None:
            raise DomainError("AUTH_REQUIRED", "Please sign in to continue.", 401)
        if not capability_allowed(db, actor, key):
            raise DomainError("FORBIDDEN", "You do not have permission to perform this action.", 403)
        return actor
    return dependency


class PermissionUpdate(BaseModel):
    allowed: bool


router = APIRouter(prefix="/api/v1/admin/permissions", tags=["permissions"])


@router.get("")
def list_permissions(actor: Actor = Depends(require_roles("hospital_admin", "hospital_staff")),
                     db: Session = Depends(get_db)):
    configured = {item.key: item.allowed for item in db.scalars(select(StaffPermission).where(
        StaffPermission.hospital_id == actor.hospital_id)).all()}
    return [{"key": key, "allowed": configured.get(key, default), "editable": actor.role == "hospital_admin"}
            for key, default in CAPABILITIES.items()]


@router.put("/{key}")
def update_permission(key: str, body: PermissionUpdate,
                      actor: Actor = Depends(require_roles("hospital_admin")),
                      db: Session = Depends(get_db)):
    if key not in CAPABILITIES:
        raise DomainError("PERMISSION_NOT_FOUND", "Unknown staff permission.", 404)
    item = db.get(StaffPermission, (actor.hospital_id, key))
    previous = item.allowed if item else CAPABILITIES[key]
    if item:
        item.allowed = body.allowed
    else:
        item = StaffPermission(hospital_id=actor.hospital_id, key=key, allowed=body.allowed)
        db.add(item)
    db.commit()
    audit.note(target_type="staff_permission", target_id=key, target_text=key,
               changes={"allowed": {"from": previous, "to": body.allowed}})
    return {"key": key, "allowed": item.allowed}

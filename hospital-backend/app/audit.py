"""Request-scoped, best-effort audit logging for mutating API calls."""
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime
import csv
import io

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .auth import Actor, require_roles
from .db import SessionLocal, get_db
from .models import AuditEvent


@dataclass
class AuditContext:
    actor_type: str = "anonymous"
    actor_id: str | None = None
    actor_label: str | None = None
    hospital_id: str | None = None
    target_type: str | None = None
    target_id: str | None = None
    target_text: str | None = None
    changes: dict = field(default_factory=dict)


_context: ContextVar[AuditContext | None] = ContextVar("audit_context", default=None)


def begin() -> AuditContext:
    value = AuditContext()
    _context.set(value)
    return value


def actor(kind: str, ident: str | None, label: str | None = None, hospital_id: str | None = None) -> None:
    value = _context.get()
    if value:
        value.actor_type, value.actor_id, value.actor_label = kind, ident, label
        value.hospital_id = hospital_id


def note(*, target_type: str | None = None, target_id: str | None = None,
         target_text: str | None = None, changes: dict | None = None) -> None:
    value = _context.get()
    if value:
        value.target_type = target_type or value.target_type
        value.target_id = target_id or value.target_id
        value.target_text = target_text or value.target_text
        if changes:
            value.changes.update(changes)


def record(request: Request, status_code: int) -> None:
    value = _context.get()
    if not value:
        return
    try:
        with SessionLocal() as db:
            db.add(AuditEvent(
                hospital_id=value.hospital_id, actor_type=value.actor_type,
                actor_id=value.actor_id, actor_label=value.actor_label,
                action=f"{request.method} {request.url.path}", target_type=value.target_type,
                target_id=value.target_id, target_text=value.target_text,
                changes_json=value.changes, status_code=status_code,
                request_id=getattr(request.state, "request_id", None),
                ip_address=request.client.host if request.client else None,
            ))
            db.commit()
    except Exception:
        # Auditing must never turn a successful clinical operation into a failure.
        return


router = APIRouter(prefix="/api/v1/admin/audit", tags=["audit"])


def _statement(actor_value: Actor, query: str | None, action: str | None,
               date_from: datetime | None, date_to: datetime | None):
    statement = select(AuditEvent).where(AuditEvent.hospital_id == actor_value.hospital_id)
    if query:
        pattern = f"%{query.strip()}%"
        statement = statement.where(or_(AuditEvent.actor_label.ilike(pattern),
                                        AuditEvent.target_text.ilike(pattern),
                                        AuditEvent.action.ilike(pattern)))
    if action:
        statement = statement.where(AuditEvent.action == action)
    if date_from:
        statement = statement.where(AuditEvent.created_at >= date_from)
    if date_to:
        statement = statement.where(AuditEvent.created_at <= date_to)
    return statement.order_by(AuditEvent.created_at.desc())


@router.get("")
def list_audit(query: str | None = None, action: str | None = None,
               date_from: datetime | None = None, date_to: datetime | None = None,
               limit: int = Query(200, ge=1, le=1000),
               actor_value: Actor = Depends(require_roles("hospital_admin")),
               db: Session = Depends(get_db)):
    items = db.scalars(_statement(actor_value, query, action, date_from, date_to).limit(limit)).all()
    return [{"id": item.id, "actor_type": item.actor_type, "actor_id": item.actor_id,
             "actor_label": item.actor_label, "action": item.action,
             "target_type": item.target_type, "target_id": item.target_id,
             "target_text": item.target_text, "changes": item.changes_json,
             "status_code": item.status_code, "request_id": item.request_id,
             "created_at": item.created_at} for item in items]


@router.get(".csv")
def export_audit(query: str | None = None, action: str | None = None,
                 date_from: datetime | None = None, date_to: datetime | None = None,
                 actor_value: Actor = Depends(require_roles("hospital_admin")),
                 db: Session = Depends(get_db)):
    items = db.scalars(_statement(actor_value, query, action, date_from, date_to).limit(10000)).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["created_at", "actor", "action", "target", "status", "request_id"])
    for item in items:
        writer.writerow([item.created_at.isoformat(), item.actor_label or item.actor_id,
                         item.action, item.target_text or item.target_id, item.status_code, item.request_id])
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=audit.csv"})

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.auth import hash_password
from app.db import SessionLocal
from app.main import app
from app.models import Hospital, HospitalMembership, User


def _login(client: TestClient, email: str, password: str):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text


def test_admin_change_is_audited_and_staff_permissions_are_enforced():
    with TestClient(app) as admin:
        _login(admin, "admin@example.com", "change-me-in-production")
        doctor = admin.get("/api/v1/admin/doctors").json()[0]
        changed = admin.patch(f"/api/v1/admin/doctors/{doctor['id']}",
                              json={"accepts_virtual": not doctor["accepts_virtual"]})
        assert changed.status_code == 200, changed.text
        events = admin.get("/api/v1/admin/audit").json()
        assert any(item["target_id"] == doctor["id"] and item["status_code"] == 200 for item in events)

        with SessionLocal() as db:
            hospital = db.scalar(select(Hospital).limit(1))
            user = User(email="staff-permissions@example.com", display_name="Operations Staff",
                        password_hash=hash_password("staff-password"))
            db.add(user)
            db.flush()
            db.add(HospitalMembership(hospital_id=hospital.id, user_id=user.id,
                                      role="hospital_staff", status="active"))
            db.commit()

        disabled = admin.put("/api/v1/admin/permissions/doctors.manage", json={"allowed": False})
        assert disabled.status_code == 200

    with TestClient(app) as staff:
        _login(staff, "staff-permissions@example.com", "staff-password")
        assert staff.get("/api/v1/admin/doctors").status_code == 200
        denied = staff.patch(f"/api/v1/admin/doctors/{doctor['id']}", json={"accepts_virtual": True})
        assert denied.status_code == 403

    with TestClient(app) as admin:
        _login(admin, "admin@example.com", "change-me-in-production")
        assert admin.put("/api/v1/admin/permissions/doctors.manage", json={"allowed": True}).status_code == 200

    with TestClient(app) as staff:
        _login(staff, "staff-permissions@example.com", "staff-password")
        fee = staff.patch(f"/api/v1/admin/doctors/{doctor['id']}", json={"consultation_fee": 999})
        assert fee.status_code == 403
        assert fee.json()["error"]["code"] == "FEE_ADMIN_ONLY"

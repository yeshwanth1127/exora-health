"""tenant audit trail and staff permissions

Revision ID: 0007_audit_permissions
Revises: 0006_patient_accounts
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_audit_permissions"
down_revision = "0006_patient_accounts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("hospital_id", sa.String(36), sa.ForeignKey("hospitals.id"), nullable=True),
        sa.Column("actor_type", sa.String(32), nullable=False),
        sa.Column("actor_id", sa.String(160), nullable=True),
        sa.Column("actor_label", sa.String(160), nullable=True),
        sa.Column("action", sa.String(160), nullable=False),
        sa.Column("target_type", sa.String(80), nullable=True),
        sa.Column("target_id", sa.String(160), nullable=True),
        sa.Column("target_text", sa.String(320), nullable=True),
        sa.Column("changes_json", sa.JSON(), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("request_id", sa.String(80), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for column in ("hospital_id", "actor_type", "actor_id", "action", "target_text", "created_at"):
        op.create_index(f"ix_audit_events_{column}", "audit_events", [column])
    op.create_table(
        "staff_permissions",
        sa.Column("hospital_id", sa.String(36), sa.ForeignKey("hospitals.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("key", sa.String(80), primary_key=True),
        sa.Column("allowed", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("staff_permissions")
    for column in reversed(("hospital_id", "actor_type", "actor_id", "action", "target_text", "created_at")):
        op.drop_index(f"ix_audit_events_{column}", table_name="audit_events")
    op.drop_table("audit_events")

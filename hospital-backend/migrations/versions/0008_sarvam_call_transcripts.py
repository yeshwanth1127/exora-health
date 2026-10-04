"""store Sarvam call metadata and transcripts

Revision ID: 0008_sarvam_transcripts
Revises: 0007_audit_permissions
"""
from alembic import op
import sqlalchemy as sa

revision = "0008_sarvam_transcripts"
down_revision = "0007_audit_permissions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for name, column_type in (
        ("provider_app_id", sa.String(100)),
        ("deployment_id", sa.String(120)),
        ("caller_phone", sa.String(32)),
        ("agent_phone", sa.String(32)),
        ("call_summary", sa.Text()),
        ("call_disposition", sa.String(80)),
    ):
        op.add_column("voice_sessions", sa.Column(name, column_type, nullable=True))
    op.add_column("voice_sessions", sa.Column("provider_app_version", sa.Integer(), nullable=True))
    op.add_column("voice_sessions", sa.Column("duration_seconds", sa.Float(), nullable=True))
    op.create_index("ix_voice_sessions_call_disposition", "voice_sessions", ["call_disposition"])
    op.create_table(
        "voice_transcript_turns",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("voice_session_id", sa.String(36), sa.ForeignKey("voice_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("turn_index", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("english_text", sa.Text(), nullable=False),
        sa.Column("original_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("voice_session_id", "turn_index", name="uq_voice_transcript_turn"),
    )
    op.create_index("ix_voice_transcript_turns_voice_session_id", "voice_transcript_turns", ["voice_session_id"])


def downgrade() -> None:
    op.drop_index("ix_voice_transcript_turns_voice_session_id", table_name="voice_transcript_turns")
    op.drop_table("voice_transcript_turns")
    op.drop_index("ix_voice_sessions_call_disposition", table_name="voice_sessions")
    for name in reversed(("provider_app_id", "deployment_id", "caller_phone", "agent_phone",
                          "call_summary", "call_disposition", "provider_app_version", "duration_seconds")):
        op.drop_column("voice_sessions", name)

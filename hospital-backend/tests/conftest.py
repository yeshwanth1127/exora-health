import os
from pathlib import Path

DB_PATH = Path("/tmp/avocado-health-tests.db")
if DB_PATH.exists():
    DB_PATH.unlink()
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = f"sqlite:///{DB_PATH}"
os.environ["RATE_LIMITS_ENABLED"] = "false"
os.environ["SARVAM_WEBHOOK_SECRET"] = "test-sarvam-webhook-secret-123456"

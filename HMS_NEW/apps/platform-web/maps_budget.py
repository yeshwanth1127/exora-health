"""Persist request counts only. Never store searches, profile data or credentials.

Daily caps are deliberately below the smallest applicable global monthly free
allowance, including abandoned autocomplete sessions. Google Cloud quotas remain
the outer project guard; this SQLite guard survives app restarts and workers.
"""
from datetime import datetime
import os
from pathlib import Path
import sqlite3
from zoneinfo import ZoneInfo
from lookup_errors import LookupError

LIMITS = {"autocomplete": (250, 7750), "details": (25, 775), "search": (125, 3875), "map": (25, 775)}


def reserve(kind, count=1, *, database=None, now=None):
    if kind not in LIMITS or not isinstance(count, int) or count < 1:
        raise ValueError("Unknown request budget")
    local = (now or datetime.now(ZoneInfo("America/Los_Angeles"))).astimezone(ZoneInfo("America/Los_Angeles"))
    day, month = local.strftime("%Y-%m-%d"), local.strftime("%Y-%m")
    path = Path(database or os.environ.get("CAPTURE_USAGE_DB", Path(__file__).with_name(".state") / "maps-usage.sqlite3"))
    connection = None
    try:
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        connection = sqlite3.connect(path, timeout=3, isolation_level=None)
        connection.execute("CREATE TABLE IF NOT EXISTS usage (kind TEXT, period TEXT, count INTEGER NOT NULL, PRIMARY KEY(kind, period))")
        connection.execute("BEGIN IMMEDIATE")
        for period, limit in zip((day, month), LIMITS[kind]):
            row = connection.execute("SELECT count FROM usage WHERE kind=? AND period=?", (kind, period)).fetchone()
            if (row[0] if row else 0) + count > limit:
                raise LookupError("FREE_TIER_LIMIT", "The protected free-tier allowance for this lookup has been used. Daily limits reset at midnight Pacific time; monthly limits reset next month.", 429)
        for period in (day, month):
            connection.execute("INSERT INTO usage VALUES (?, ?, ?) ON CONFLICT(kind,period) DO UPDATE SET count=count+excluded.count", (kind, period, count))
        connection.execute("COMMIT")
    except LookupError:
        raise
    except (OSError, sqlite3.Error):
        raise LookupError("BUDGET_GUARD_UNAVAILABLE", "Lookup is paused because its spending guard is unavailable. Please try again later.") from None
    finally:
        if connection is not None:
            connection.close()

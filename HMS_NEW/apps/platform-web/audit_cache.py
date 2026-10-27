"""Shared seven-day cache for independently fetched website findings only.

Google Places content is deliberately not an allowed cache source. City scans
can use this store only after a source with explicit retention rights is added.
The same file can be mounted on a single application host across workers.
"""
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import time

ALLOWED_SOURCES = frozenset({'website_audit'})
TTL_SECONDS = 7 * 24 * 60 * 60


def cache_key(parameters):
    return hashlib.sha256(json.dumps(parameters, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def connect():
    path = Path(os.environ.get('CAPTURE_AUDIT_CACHE_DB', Path(__file__).with_name('.state') / 'audit-cache.sqlite3'))
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=3, isolation_level=None)
    connection.execute('CREATE TABLE IF NOT EXISTS snapshots (source TEXT, key TEXT, payload TEXT NOT NULL, expires REAL NOT NULL, PRIMARY KEY(source,key))')
    connection.execute('CREATE TABLE IF NOT EXISTS leases (source TEXT, key TEXT, expires REAL NOT NULL, PRIMARY KEY(source,key))')
    return connection


def allowed(source):
    if source not in ALLOWED_SOURCES:
        raise ValueError('This data source has no approved cache retention policy')


def read(source, key, *, now=None):
    allowed(source)
    connection = connect()
    try:
        row = connection.execute('SELECT payload, expires FROM snapshots WHERE source=? AND key=?', (source,key)).fetchone()
        if row and row[1] > (now if now is not None else time.time()):
            return json.loads(row[0])
        return None
    finally:
        connection.close()


def claim(source, key, *, now=None):
    allowed(source)
    stamp = now if now is not None else time.time()
    connection = connect()
    try:
        connection.execute('BEGIN IMMEDIATE')
        connection.execute('DELETE FROM leases WHERE source=? AND key=? AND expires<=?', (source,key,stamp))
        try:
            connection.execute('INSERT INTO leases VALUES (?,?,?)', (source,key,stamp+90))
        except sqlite3.IntegrityError:
            connection.execute('ROLLBACK')
            return False
        connection.execute('COMMIT')
        return True
    finally:
        connection.close()


def publish(source, key, payload, *, now=None):
    allowed(source)
    stamp = now if now is not None else time.time()
    connection = connect()
    try:
        connection.execute('INSERT INTO snapshots VALUES (?,?,?,?) ON CONFLICT(source,key) DO UPDATE SET payload=excluded.payload, expires=excluded.expires', (source,key,json.dumps(payload),stamp+TTL_SECONDS))
        connection.execute('DELETE FROM snapshots WHERE expires<?', (stamp-TTL_SECONDS,))
    finally:
        connection.close()


def release(source, key):
    allowed(source)
    connection = connect()
    try:
        connection.execute('DELETE FROM leases WHERE source=? AND key=?',(source,key))
    finally:
        connection.close()

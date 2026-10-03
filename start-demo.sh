#!/bin/sh
set -eu

mkdir -p /data
cd /app/backend
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cleanup() {
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT
nginx -g 'daemon off;'

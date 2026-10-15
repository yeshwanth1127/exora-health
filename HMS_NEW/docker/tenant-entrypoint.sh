#!/bin/sh
set -eu

if [ "${SKIP_DB_BOOTSTRAP:-0}" != "1" ]; then
  node db/scripts/bootstrap-runtime.mjs
fi

node_modules/.bin/tsx --env-file-if-exists=.env apps/worker/src/main.ts &
worker_pid=$!

stop() {
  kill "$worker_pid" 2>/dev/null || true
}
trap stop INT TERM EXIT

node_modules/.bin/tsx --env-file-if-exists=.env apps/api/src/main.ts

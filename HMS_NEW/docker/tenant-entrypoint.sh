#!/bin/bash
set -euo pipefail

node scripts/check-runtime-auth.mjs
if [ "${SKIP_DB_BOOTSTRAP:-0}" != "1" ]; then
  node db/scripts/bootstrap-runtime.mjs
fi

node_modules/.bin/tsx --env-file-if-exists=.env apps/worker/src/main.ts &
worker_pid=$!
node_modules/.bin/tsx --env-file-if-exists=.env apps/api/src/main.ts &
api_pid=$!

stop() {
  kill "$worker_pid" "$api_pid" 2>/dev/null || true
}
trap stop EXIT
trap 'exit 0' INT TERM
# A failed worker must restart the runtime instead of leaving an apparently healthy dashboard
# with stalled reminders, scheduled posts and booking conversations.
set +e
wait -n "$worker_pid" "$api_pid"
status=$?
stop
wait "$worker_pid" "$api_pid" 2>/dev/null
if [ "$status" -eq 0 ]; then status=1; fi
exit "$status"

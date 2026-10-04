#!/usr/bin/env bash
set -Eeuo pipefail

release_tag="${1:?usage: remote-deploy.sh <image-tag>}"
app_dir="${EXORA_DEPLOY_DIR:-/opt/exora-health}"
compose_file="${EXORA_COMPOSE_FILE:-$app_dir/compose.production.yml}"
env_file="$app_dir/.env"
backup_dir="$app_dir/backups"
lock_file="$app_dir/deploy.lock"

require_file() {
  [[ -f "$1" ]] || { echo "missing required file: $1" >&2; exit 1; }
}

require_file "$compose_file"
require_file "$env_file"
mkdir -p "$backup_dir"
exec 9>"$lock_file"
flock -n 9 || { echo "another deployment is already running" >&2; exit 1; }

cd "$app_dir"
compose=(docker-compose --env-file "$env_file" -f "$compose_file")
previous_tag="$(sed -n 's/^IMAGE_TAG=//p' "$env_file" | tail -1)"
candidate_env="$(mktemp "$app_dir/.env.next.XXXXXX")"
trap 'rm -f "$candidate_env"' EXIT
sed '/^IMAGE_TAG=/d' "$env_file" > "$candidate_env"
printf 'IMAGE_TAG=%s\n' "$release_tag" >> "$candidate_env"

if "${compose[@]}" ps -q postgres >/dev/null 2>&1 && [[ -n "$("${compose[@]}" ps -q postgres)" ]]; then
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  echo "Backing up PostgreSQL to $backup_dir/$timestamp.sql.gz"
  "${compose[@]}" exec -T postgres sh -c \
    'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip -9 > "$backup_dir/$timestamp.sql.gz"
fi

echo "Pulling images for $release_tag"
IMAGE_TAG="$release_tag" "${compose[@]}" pull backend webpage voice

echo "Applying database migrations"
IMAGE_TAG="$release_tag" "${compose[@]}" up -d postgres redis ollama
IMAGE_TAG="$release_tag" "${compose[@]}" run --rm backend alembic upgrade head

echo "Starting release $release_tag"
IMAGE_TAG="$release_tag" "${compose[@]}" up -d --remove-orphans backend webpage voice

healthy=0
for _ in $(seq 1 36); do
  if curl -fsS -H 'Host: avocado.exora.solutions' http://10.0.0.1:18004/api/health/live >/dev/null \
      && curl -fsS -H 'Host: avocado.exora.solutions' http://10.0.0.1:15567/healthz >/dev/null \
      && curl -fsS -H 'Host: avocado.exora.solutions' http://10.0.0.1:18765/api/health/live >/dev/null; then
    healthy=1
    break
  fi
  sleep 5
done

if [[ "$healthy" != 1 ]]; then
  echo "Release failed health checks" >&2
  "${compose[@]}" ps >&2 || true
  if [[ -n "$previous_tag" && "$previous_tag" != "$release_tag" ]]; then
    echo "Rolling application containers back to $previous_tag" >&2
    IMAGE_TAG="$previous_tag" "${compose[@]}" up -d backend webpage voice || true
  fi
  exit 1
fi

install -m 0600 "$candidate_env" "$env_file"
find "$backup_dir" -type f -name '*.sql.gz' -mtime +14 -delete
echo "Release $release_tag is healthy"

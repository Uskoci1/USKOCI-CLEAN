#!/usr/bin/env bash
# Only a newly created, unnetworked Docker container. No DB_URL, ports or cloud credentials.
set -euo pipefail
umask 077
ROOT=supabase/proofs/messages_inbox
export INBOX_PROOF_ARTIFACT_DIR="${INBOX_PROOF_ARTIFACT_DIR:-/tmp/messages-inbox-sql-proof}"
mkdir -p "$INBOX_PROOF_ARTIFACT_DIR"
CONTAINER="uskoci-inbox-${GITHUB_RUN_ID:-local}-$$"
created=0
finish() {
  local code=$? cleanup_code=0
  trap - EXIT
  if [[ "$created" = 1 ]]; then
    docker exec -i "$CONTAINER" psql -X -qAt -U postgres -d postgres -c "select coalesce(jsonb_agg(name order by name),'[]'::jsonb) from proof.results" > "$INBOX_PROOF_ARTIFACT_DIR/checks.json" 2>/dev/null || true
    docker rm -f "$CONTAINER" > /dev/null 2>&1 || cleanup_code=$?
  fi
  if [[ "$cleanup_code" != 0 ]]; then code=1; fi
  printf 'container_removed=%s\nproof_exit=%s\n' "$((created == 0 || cleanup_code == 0))" "$code" > "$INBOX_PROOF_ARTIFACT_DIR/status.txt"
  node "$ROOT/bind.mjs" report "$code" || code=1
  exit "$code"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
node "$ROOT/bind.mjs"
git rev-parse HEAD 'HEAD^{tree}' > "$INBOX_PROOF_ARTIFACT_DIR/git-source.txt"
# Same PostgreSQL major as the existing focused B24 disposable harness. Record resolved image, never fall back to latest.
docker run -d --name "$CONTAINER" --label uskoci.proof=messages-inbox --network none \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,size=256m \
  -e POSTGRES_PASSWORD=synthetic-local-proof-only -e PGPASSWORD=synthetic-local-proof-only postgres:17 > /dev/null
created=1
docker inspect --format '{{.Image}}' "$CONTAINER" > "$INBOX_PROOF_ARTIFACT_DIR/image-id.txt"
ready=0
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -h 127.0.0.1 -U postgres > /dev/null 2>&1; then ready=1;break;fi
  sleep 1
done
[[ "$ready" = 1 ]] || { printf 'FAIL DATABASE_STARTUP\n';exit 1; }
psql_proof() { docker exec -i "$CONTAINER" psql -X -qAt -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
psql_proof -c 'show server_version' > "$INBOX_PROOF_ARTIFACT_DIR/postgres-version.txt"
psql_proof < "$ROOT/fixture.sql" > "$INBOX_PROOF_ARTIFACT_DIR/fixture.log" 2>&1
psql_proof < "$INBOX_PROOF_ARTIFACT_DIR/helpers.sql" > "$INBOX_PROOF_ARTIFACT_DIR/helpers.log" 2>&1
psql_proof < "$INBOX_PROOF_ARTIFACT_DIR/verify-helper-bodies.sql" >> "$INBOX_PROOF_ARTIFACT_DIR/helpers.log" 2>&1
psql_proof < "$INBOX_PROOF_ARTIFACT_DIR/install.sql" > "$INBOX_PROOF_ARTIFACT_DIR/install.log" 2>&1
psql_proof < "$ROOT/assertions.sql" > "$INBOX_PROOF_ARTIFACT_DIR/assertions.log" 2>&1
printf 'PASS SQL_READER_ASSERTIONS_COMPLETED\n'

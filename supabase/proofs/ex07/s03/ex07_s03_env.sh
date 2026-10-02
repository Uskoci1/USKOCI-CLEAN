#!/usr/bin/env bash
# EX-07 S03: bring up a DISPOSABLE Supabase Auth stack (GoTrue + Postgres + Mailpit) with e-mail CONFIRMATIONS ENABLED and both
# app redirects allowlisted. This is NOT a replay of the marketplace database and NOT the hosted project: no project is linked,
# no business migration is applied, nothing leaves the runner. Extends the idea of supabase/proofs/auth/w01_recovery_env.sh
# (frozen) as a NEW file: W01 allowlists only the recovery redirects and sets enable_confirmations = false.
#
# Usage: bash ex07_s03_env.sh <artifact-dir>      (writes only public facts: the config, the CLI and image versions)
set -euo pipefail
: "${GITHUB_ENV:?CI environment file required}"
: "${GITHUB_WORKSPACE:?Repository workspace required}"
ARTIFACT_DIR="${1:?artifact directory required}"
PROJECT_ID="uskoci-ex07-s03-auth-proof"
PROOF_DIR="$(mktemp -d /tmp/uskoci-ex07-s03-XXXXXX)"
printf 'EX07_PROOF_DIR=%s\n' "$PROOF_DIR" >> "$GITHUB_ENV"
printf 'EX07_PROJECT_ID=%s\n' "$PROJECT_ID" >> "$GITHUB_ENV"
cd "$PROOF_DIR"
supabase init >/dev/null
cat > supabase/config.toml <<'TOML'
project_id = "uskoci-ex07-s03-auth-proof"
[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000
[db]
port = 54322
shadow_port = 54320
major_version = 17
[db.seed]
enabled = false
sql_paths = []
[realtime]
enabled = false
[studio]
enabled = false
port = 54323
[inbucket]
enabled = true
port = 54324
[storage]
enabled = false
[auth]
enabled = true
site_url = "http://127.0.0.1:4173"
additional_redirect_urls = ["uskociapp://auth?form=login", "uskociapp://oporavak"]
jwt_expiry = 3600
enable_signup = true
minimum_password_length = 6
[auth.rate_limit]
email_sent = 1000
sms_sent = 30
anonymous_users = 30
token_refresh = 1000
sign_in_sign_ups = 1000
token_verifications = 1000
[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = true
secure_password_change = true
max_frequency = "10s"
otp_expiry = 60
[auth.sms]
enable_signup = false
enable_confirmations = false
[edge_runtime]
enabled = false
[analytics]
enabled = false
TOML
test ! -e supabase/.temp/project-ref
mkdir -p "$GITHUB_WORKSPACE/$ARTIFACT_DIR"
if ! supabase start > "$PROOF_DIR/start-private.log" 2>&1; then
  python3 - "$PROOF_DIR/start-private.log" <<'PYTHON'
import pathlib, sys
# Startup diagnostics only; omit every line that could carry a credential.
for line in pathlib.Path(sys.argv[1]).read_text(errors='replace').splitlines()[-100:]:
    if not any(word in line.lower() for word in ('key', 'secret', 'token', 'password', 'eyj')):
        print(line)
PYTHON
  exit 1
fi
supabase status -o env > "$PROOF_DIR/status-private.env" 2>/dev/null
python3 - "$PROOF_DIR/status-private.env" "$GITHUB_ENV" <<'PYTHON'
import pathlib, sys
values = {}
for line in pathlib.Path(sys.argv[1]).read_text().splitlines():
    key, sep, value = line.partition('=')
    if sep:
        values[key] = value.strip('"')
assert values.get('API_URL') == 'http://127.0.0.1:54321', 'Non-local Auth target refused'
assert values.get('ANON_KEY'), 'Disposable public anon key missing'
with open(sys.argv[2], 'a') as f:
    f.write('EX07_API_URL=http://127.0.0.1:54321\n')
    f.write('EX07_MAIL_URL=http://127.0.0.1:54324\n')
    f.write('EX07_ANON_KEY=' + values['ANON_KEY'] + '\n')
pathlib.Path(sys.argv[1]).unlink()
PYTHON
# The mail endpoint must answer before any proof starts (Mailpit comes up a moment after GoTrue).
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:54324/api/v1/messages >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:54324/api/v1/messages >/dev/null
IMAGE="$(docker inspect --format '{{.Config.Image}}' "supabase_auth_${PROJECT_ID}" 2>/dev/null || echo unknown)"
printf 'EX07_GOTRUE_IMAGE=%s\n' "$IMAGE" >> "$GITHUB_ENV"
printf 'EX07_SUPABASE_CLI=%s\n' "$(supabase --version)" >> "$GITHUB_ENV"
# Only version and configuration identity are retained; no local secret, no mailbox content.
cp supabase/config.toml "$GITHUB_WORKSPACE/$ARTIFACT_DIR/disposable-config.toml"
supabase --version > "$GITHUB_WORKSPACE/$ARTIFACT_DIR/cli-version.txt"
printf '%s\n' "$IMAGE" > "$GITHUB_WORKSPACE/$ARTIFACT_DIR/auth-image.txt"
echo 'PASS EX07_S03_DISPOSABLE_AUTH_READY_CONFIRMATIONS_ON_NO_MARKETPLACE_REPLAY'

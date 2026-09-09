#!/usr/bin/env bash
set -euo pipefail
: "${GITHUB_ENV:?CI environment file required}"
: "${GITHUB_WORKSPACE:?Repository workspace required}"
PROOF_DIR="$(mktemp -d /tmp/uskoci-w01-auth-XXXXXX)"
printf 'W01_PROOF_DIR=%s\n' "$PROOF_DIR" >> "$GITHUB_ENV"
cd "$PROOF_DIR"
supabase init >/dev/null
# This is a new disposable Auth instance, NOT a replay of the marketplace DB.
# No production project is linked and no business migration is applied.
cat > supabase/config.toml <<'TOML'
project_id = "uskoci-w01-auth-proof"
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
additional_redirect_urls = ["http://127.0.0.1:4173/oporavak", "uskociapp://oporavak"]
jwt_expiry = 3600
enable_signup = true
minimum_password_length = 6
[auth.email]
enable_signup = true
enable_confirmations = false
double_confirm_changes = true
secure_password_change = true
max_frequency = "1s"
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
mkdir -p "$GITHUB_WORKSPACE/artifacts/w01-auth-recovery"
if ! supabase start > "$PROOF_DIR/start-private.log" 2>&1; then
  python3 - "$PROOF_DIR/start-private.log" <<'PYTHON'
import pathlib,sys
# Startup diagnostics only; omit entire credential-bearing lines.
for line in pathlib.Path(sys.argv[1]).read_text().splitlines()[-100:]:
    if not any(word in line.lower() for word in ('key', 'secret', 'token', 'password', 'eyj')):
        print(line)
PYTHON
  exit 1
fi
supabase status -o env > "$PROOF_DIR/status-private.env" 2>/dev/null
python3 - "$PROOF_DIR/status-private.env" "$GITHUB_ENV" <<'PYTHON'
import pathlib,sys
values={}
for line in pathlib.Path(sys.argv[1]).read_text().splitlines():
    key,sep,value=line.partition('=')
    if sep: values[key]=value.strip('"')
assert values.get('API_URL') == 'http://127.0.0.1:54321', 'Non-local Auth target refused'
assert values.get('ANON_KEY'), 'Disposable public anon key missing'
with open(sys.argv[2], 'a') as f:
    f.write('EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\n')
    f.write('EXPO_PUBLIC_SUPABASE_ANON_KEY='+values['ANON_KEY']+'\n')
    f.write('EXPO_PUBLIC_AUTH_RECOVERY_REDIRECT_URL=http://127.0.0.1:4173/oporavak\n')
pathlib.Path(sys.argv[1]).unlink()
PYTHON
# Only version/config identity is retained; no local secret or mailbox contents.
cp supabase/config.toml "$GITHUB_WORKSPACE/artifacts/w01-auth-recovery/disposable-config.toml"
supabase --version > "$GITHUB_WORKSPACE/artifacts/w01-auth-recovery/cli-version.txt"
docker inspect --format '{{.Config.Image}}' supabase_auth_uskoci-w01-auth-proof > "$GITHUB_WORKSPACE/artifacts/w01-auth-recovery/auth-image.txt"
echo 'PASS W01_DISPOSABLE_AUTH_READY_NO_MARKETPLACE_REPLAY'

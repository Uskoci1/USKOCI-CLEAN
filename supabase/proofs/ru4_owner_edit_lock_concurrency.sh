#!/usr/bin/env bash
set -euo pipefail

: "${DB_URL:?DB_URL required}"

REQ="00000000-0000-4000-8000-00000000a401"
NEED_A="00000000-0000-4000-8000-00000000a411"
NEED_B="00000000-0000-4000-8000-00000000a412"
NEED_C="00000000-0000-4000-8000-00000000a413"

PROFILE="$(psql "$DB_URL" -Atv ON_ERROR_STOP=1 <<SQL
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('$REQ','authenticated','authenticated','ru4-concurrency@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 Concurrency Requester','city','Novi Sad'),statement_timestamp(),statement_timestamp())
on conflict (id) do nothing;
select id from public.app_profiles where account_id='$REQ' and kind='REQUESTER' limit 1;
SQL
)"

test -n "$PROFILE"

seed_need() {
  local need="$1"
  local title="$2"
  psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL >/dev/null
select set_config('uskoci.need_lifecycle','PUBLISH',false);
insert into public.needs(
  id,requester_account_id,requester_profile_id,status,title,description,category,
  approximate_city,approximate_area,schedule_kind,required_slots,mode,
  requester_price_rsd,required_skills,execution_location_mode,revision,published_at,response_deadline
) values (
  '$need','$REQ','$PROFILE','PUBLISHED','$title','Original concurrency terms','proof',
  'Novi Sad','Centar','FLEXIBLE',2,'MY_PRICE',5000,array['proof'],'REMOTE',1,
  statement_timestamp(),statement_timestamp()+interval '2 days'
);
select set_config('uskoci.need_lifecycle','',false);
SQL
}

call_edit() {
  local need="$1"
  local key="$2"
  local title="$3"
  local outfile="$4"
  local errfile="$5"
  local material
  material="{\"title\":\"$title\",\"description\":\"Changed concurrency terms\",\"category\":\"proof\",\"requiredSlots\":2,\"mode\":\"MY_PRICE\",\"requesterPriceRsd\":5500,\"requiredSkills\":[\"proof\"],\"requiredTools\":[],\"requiredVehicles\":[],\"requiredLicenses\":[],\"minimumExperienceYears\":0,\"verifiedIdentityRequired\":false,\"scheduleKind\":\"FLEXIBLE\",\"startsAt\":null,\"endsAt\":null,\"executionLocationMode\":\"REMOTE\",\"approximateLat\":null,\"approximateLng\":null,\"approximateCity\":\"Novi Sad\",\"approximateArea\":\"Centar\",\"publicPhotoPaths\":[],\"privateLocation\":null}"
  psql "$DB_URL" -X -v ON_ERROR_STOP=1 -v actor="$REQ" -v need="$need" -v reqkey="$key" -v material="$material" >"$outfile" 2>"$errfile" <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'actor', true);
select public.rpc_confirm_need_edit(:'need'::uuid,1,:'reqkey',:'material'::jsonb);
commit;
SQL
}

# A: two different request keys race on the same revision. Exactly one may create revision 2.
seed_need "$NEED_A" "RU4 concurrent different keys"
set +e
call_edit "$NEED_A" "ru4-concurrent-a-1" "RU4 winner A1" /tmp/ru4-a1.out /tmp/ru4-a1.err & p1=$!
call_edit "$NEED_A" "ru4-concurrent-a-2" "RU4 winner A2" /tmp/ru4-a2.out /tmp/ru4-a2.err & p2=$!
wait "$p1"; r1=$?
wait "$p2"; r2=$?
set -e
if ! { { [ "$r1" -eq 0 ] && [ "$r2" -ne 0 ]; } || { [ "$r2" -eq 0 ] && [ "$r1" -ne 0 ]; }; }; then
  echo "unexpected different-key race rc: $r1/$r2" >&2
  cat /tmp/ru4-a1.err /tmp/ru4-a2.err >&2 || true
  exit 1
fi
psql "$DB_URL" -Atv ON_ERROR_STOP=1 <<SQL | grep -Fx '2/1/1'
select revision::text || '/' ||
       (select count(*) from private.need_revision_events where need_id='$NEED_A')::text || '/' ||
       (select count(*) from private.need_edit_commands where result->>'needId'='$NEED_A')::text
from public.needs where id='$NEED_A';
SQL

# B: same key + same payload concurrently must converge to one authoritative result/revision.
seed_need "$NEED_B" "RU4 concurrent same key same payload"
set +e
call_edit "$NEED_B" "ru4-concurrent-b-same" "RU4 same result" /tmp/ru4-b1.out /tmp/ru4-b1.err & p1=$!
call_edit "$NEED_B" "ru4-concurrent-b-same" "RU4 same result" /tmp/ru4-b2.out /tmp/ru4-b2.err & p2=$!
wait "$p1"; r1=$?
wait "$p2"; r2=$?
set -e
if [ "$r1" -ne 0 ] || [ "$r2" -ne 0 ]; then
  echo "same-key same-payload race failed rc: $r1/$r2" >&2
  cat /tmp/ru4-b1.err /tmp/ru4-b2.err >&2 || true
  exit 1
fi
grep -q '"revision": 2' /tmp/ru4-b1.out
grep -q '"revision": 2' /tmp/ru4-b2.out
psql "$DB_URL" -Atv ON_ERROR_STOP=1 <<SQL | grep -Fx '2/1/1'
select revision::text || '/' ||
       (select count(*) from private.need_revision_events where need_id='$NEED_B')::text || '/' ||
       (select count(*) from private.need_edit_commands where result->>'needId'='$NEED_B')::text
from public.needs where id='$NEED_B';
SQL

# C: same key + different payload must never authorize both payloads.
seed_need "$NEED_C" "RU4 concurrent same key different payload"
set +e
call_edit "$NEED_C" "ru4-concurrent-c-same" "RU4 payload C1" /tmp/ru4-c1.out /tmp/ru4-c1.err & p1=$!
call_edit "$NEED_C" "ru4-concurrent-c-same" "RU4 payload C2" /tmp/ru4-c2.out /tmp/ru4-c2.err & p2=$!
wait "$p1"; r1=$?
wait "$p2"; r2=$?
set -e
if ! { { [ "$r1" -eq 0 ] && [ "$r2" -ne 0 ]; } || { [ "$r2" -eq 0 ] && [ "$r1" -ne 0 ]; }; }; then
  echo "unexpected same-key different-payload race rc: $r1/$r2" >&2
  cat /tmp/ru4-c1.err /tmp/ru4-c2.err >&2 || true
  exit 1
fi
cat /tmp/ru4-c1.err /tmp/ru4-c2.err | grep -q 'IDEMPOTENCY_KEY_REUSED'
psql "$DB_URL" -Atv ON_ERROR_STOP=1 <<SQL | grep -Fx '2/1/1'
select revision::text || '/' ||
       (select count(*) from private.need_revision_events where need_id='$NEED_C')::text || '/' ||
       (select count(*) from private.need_edit_commands where result->>'needId'='$NEED_C')::text
from public.needs where id='$NEED_C';
SQL

echo "PASS RU4_OWNER_EDIT_LOCK_CONCURRENCY different_keys_one_winner same_key_same_payload_replay same_key_different_payload_rejected"

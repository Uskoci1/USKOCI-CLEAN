#!/usr/bin/env bash
set -euo pipefail

: "${DB_URL:?DB_URL required}"

REQ="00000000-0000-4000-8000-00000000b401"
NEED_A="00000000-0000-4000-8000-00000000b411"
NEED_B="00000000-0000-4000-8000-00000000b412"

cleanup() {
  psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 <<SQL
begin;
delete from private.need_edit_commands where requester_account_id='$REQ';
delete from private.need_revision_events where created_by_account_id='$REQ';
delete from private.dispatch_schedule where need_id in ('$NEED_A','$NEED_B');
delete from public.ai_messages where account_id='$REQ';
delete from public.ai_structured_facts where account_id='$REQ';
delete from public.action_proposals where account_id='$REQ';
delete from public.ai_conversations where account_id='$REQ';
delete from public.need_sensitive where need_id in ('$NEED_A','$NEED_B');
delete from public.need_requirement_details where need_id in ('$NEED_A','$NEED_B');
delete from public.need_geography where need_id in ('$NEED_A','$NEED_B');
delete from public.needs where id in ('$NEED_A','$NEED_B');
delete from public.app_profiles where account_id='$REQ';
delete from auth.users where id='$REQ';
commit;
SQL
}
trap 'cleanup || true' EXIT
cleanup

psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 <<SQL
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('$REQ','authenticated','authenticated','ru4-ai-concurrency@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','RU4 AI Concurrency','city','Novi Sad'),statement_timestamp(),statement_timestamp());
SQL
PROFILE="$(psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -c "select id from public.app_profiles where account_id='$REQ' and kind='REQUESTER' limit 1;")"
test -n "$PROFILE"

seed_need_and_conversation() {
  local need="$1"
  local title="$2"
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -v need="$need" -v title="$title" -v req="$REQ" -v profile="$PROFILE" <<'SQL'
begin;
select set_config('uskoci.need_lifecycle','PUBLISH',true) as lifecycle \gset
insert into public.needs(
  id,requester_account_id,requester_profile_id,status,title,description,category,
  approximate_city,approximate_area,schedule_kind,required_slots,mode,requester_price_rsd,
  required_skills,required_tools,required_vehicles,required_licenses,minimum_experience_years,
  verified_identity_required,execution_location_mode,revision,published_at,response_deadline
) values (
  :'need'::uuid,:'req'::uuid,:'profile'::uuid,'PUBLISHED',:'title','Original AI concurrency terms','Selidbe',
  'Novi Sad','Centar','FLEXIBLE',1,'MY_PRICE',5000,
  array['prenošenje'],array[]::text[],array[]::text[],array[]::text[],0,false,'REMOTE',1,
  statement_timestamp(),statement_timestamp()+interval '2 days'
);
select set_config('uskoci.need_lifecycle','',true) as lifecycle \gset
set local role authenticated;
select set_config('request.jwt.claim.sub',:'req',true) as jwt_sub \gset
select (public.rpc_ai_open_need_edit_conversation_v2(:'need'::uuid)->>'conversationId')::uuid;
commit;
SQL
}

prepare_changed_fact() {
  local cid="$1"
  psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -v req="$REQ" -v cid="$cid" <<'SQL'
begin;
set local role service_role;
select public.rpc_ai_apply_interview_turn_v2_service(
  :'req'::uuid,:'cid'::uuid,
  'Promeni cenu na 5500 RSD.',
  'Cena je promenjena na 5500 RSD; ostalo ostaje isto.',
  'ALLOW',
  jsonb_build_array(jsonb_build_object(
    'key','need.price_rsd','value','5500'::jsonb,'displayValue','5.500 RSD',
    'evidence','Promeni cenu na 5500 RSD','confidence',1
  ))
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub',:'req',true);
select public.rpc_ai_confirm_fact(id)
from public.ai_structured_facts
where conversation_id=:'cid'::uuid
  and fact_key='need.price_rsd'
  and superseded_at is null
  and status<>'CONFIRMED';
commit;
SQL
}

call_confirm() {
  local need="$1"
  local cid="$2"
  local key="$3"
  local out="$4"
  local err="$5"
  psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -v req="$REQ" -v need="$need" -v cid="$cid" -v key="$key" >"$out" 2>"$err" <<'SQL'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub',:'req',true);
select public.rpc_confirm_need_edit_from_review_v2(:'need'::uuid,1,:'cid'::uuid,:'key');
commit;
SQL
}

# A: same idempotency key + same confirmed conversation/facts concurrently must converge.
CID_A="$(seed_need_and_conversation "$NEED_A" 'RU4 AI concurrent same key')"
prepare_changed_fact "$CID_A"
set +e
call_confirm "$NEED_A" "$CID_A" "ru4-ai-concurrent-same" /tmp/ru4-ai-a1.out /tmp/ru4-ai-a1.err & p1=$!
call_confirm "$NEED_A" "$CID_A" "ru4-ai-concurrent-same" /tmp/ru4-ai-a2.out /tmp/ru4-ai-a2.err & p2=$!
wait "$p1"; r1=$?
wait "$p2"; r2=$?
set -e
if [ "$r1" -ne 0 ] || [ "$r2" -ne 0 ]; then
  echo "AI same-key same-payload concurrency failed rc=$r1/$r2" >&2
  cat /tmp/ru4-ai-a1.err /tmp/ru4-ai-a2.err >&2 || true
  exit 1
fi
grep -q '"revision": 2' /tmp/ru4-ai-a1.out
grep -q '"revision": 2' /tmp/ru4-ai-a2.out
cat /tmp/ru4-ai-a1.out /tmp/ru4-ai-a2.out | grep -q '"idempotentReplay": true'
psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 <<SQL | grep -Fx '2/1/1/COMPLETED'
select n.revision::text || '/' ||
       (select count(*) from private.need_revision_events e where e.need_id=n.id)::text || '/' ||
       (select count(*) from private.need_edit_commands c where c.need_id=n.id)::text || '/' ||
       (select status from public.ai_conversations where id='$CID_A')
from public.needs n where n.id='$NEED_A';
SQL

# B: different idempotency keys race the same exact AI review; only one edit may commit.
CID_B="$(seed_need_and_conversation "$NEED_B" 'RU4 AI concurrent different keys')"
prepare_changed_fact "$CID_B"
set +e
call_confirm "$NEED_B" "$CID_B" "ru4-ai-concurrent-b-1" /tmp/ru4-ai-b1.out /tmp/ru4-ai-b1.err & p1=$!
call_confirm "$NEED_B" "$CID_B" "ru4-ai-concurrent-b-2" /tmp/ru4-ai-b2.out /tmp/ru4-ai-b2.err & p2=$!
wait "$p1"; r1=$?
wait "$p2"; r2=$?
set -e
if ! { { [ "$r1" -eq 0 ] && [ "$r2" -ne 0 ]; } || { [ "$r2" -eq 0 ] && [ "$r1" -ne 0 ]; }; }; then
  echo "AI different-key same-review concurrency unexpected rc=$r1/$r2" >&2
  cat /tmp/ru4-ai-b1.err /tmp/ru4-ai-b2.err >&2 || true
  exit 1
fi
cat /tmp/ru4-ai-b1.err /tmp/ru4-ai-b2.err | grep -Eq 'EDIT_CONVERSATION_NOT_CONFIRMABLE|STALE_REVIEW_REQUIRED|NEED_NOT_EDITABLE_PUBLIC_STATE'
psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 <<SQL | grep -Fx '2/1/1/COMPLETED'
select n.revision::text || '/' ||
       (select count(*) from private.need_revision_events e where e.need_id=n.id)::text || '/' ||
       (select count(*) from private.need_edit_commands c where c.need_id=n.id)::text || '/' ||
       (select status from public.ai_conversations where id='$CID_B')
from public.needs n where n.id='$NEED_B';
SQL

cleanup
trap - EXIT

echo "PASS RU4_AI_EDIT_CONCURRENCY same_key_same_review_converges different_keys_one_winner single_revision_single_receipt zero_residue"

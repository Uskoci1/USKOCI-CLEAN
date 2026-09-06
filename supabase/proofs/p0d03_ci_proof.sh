#!/usr/bin/env bash
set -euo pipefail

: "${GITHUB_WORKSPACE:?GITHUB_WORKSPACE required}"
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
PROOF_DIR=/tmp/uskoci-p0d03-proof

rm -rf "$PROOF_DIR"
mkdir -p "$PROOF_DIR"
cd "$PROOF_DIR"
supabase init
rm -rf supabase/migrations
mkdir -p supabase/migrations

cp "$GITHUB_WORKSPACE/supabase/proofs/ru2_predecessor_bootstrap.sql" \
   supabase/migrations/20260825000000_p0d03_live_bootstrap.sql

for f in "$GITHUB_WORKSPACE"/supabase/migrations/*.sql; do
  b="$(basename "$f")"
  case "$b" in
    20260903*|20260904*|20260905*|20260906*) ;;
    20260901105922_clean_completion_and_writer_authenticated_proof.sql|20260901113333_clean_ai_interview_turn_authenticated_proof.sql|20260901114029_clean_ai_fact_supersession_and_human_correction.sql) ;;
    *) cp "$f" "supabase/migrations/$b" ;;
  esac
done

cp "$GITHUB_WORKSPACE/supabase/proofs/ru2_replay_20260901105922_durable_effects.sql" \
   supabase/migrations/20260901105922_clean_completion_and_writer_authenticated_proof.sql
cp "$GITHUB_WORKSPACE/supabase/proofs/ru2_replay_20260901113333_durable_effects.sql" \
   supabase/migrations/20260901113333_clean_ai_interview_turn_authenticated_proof.sql

awk '/^-- Runtime proofs: no retained rows\.$/{exit} {print}' \
  "$GITHUB_WORKSPACE/supabase/migrations/20260901114029_clean_ai_fact_supersession_and_human_correction.sql" \
  > supabase/migrations/20260901114029_clean_ai_fact_supersession_and_human_correction.sql
cat >> supabase/migrations/20260901114029_clean_ai_fact_supersession_and_human_correction.sql <<'SQL'
comment on function public.rpc_ai_confirm_fact(uuid) is 'AUTHENTICATED_RUNTIME_PROVEN: human confirmation stamps confirmed_at and confirmed_by_user_id.';
comment on function public.rpc_ai_correct_fact(uuid,text) is 'AUTHENTICATED_RUNTIME_PROVEN: explicit correction atomically supersedes prior live fact and creates CONFIRMED EXPLICIT_USER_ANSWER provenance.';
comment on function public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb) is 'SERVICE_RUNTIME_PROVEN: repeated canonical keys preserve one-live-fact invariant by superseding before insert; replacement proof rolled back with zero residue.';
SQL

supabase db start
trap 'cd "$PROOF_DIR" && supabase stop --no-backup >/dev/null 2>&1 || true' EXIT
supabase db reset --local
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "delete from supabase_migrations.schema_migrations where version='20260825000000';"
test "$(psql "$DB_URL" -Atc "select count(*)::text || '/' || max(version) from supabase_migrations.schema_migrations;")" = "56/20260901114029"

apply_live_alias() {
  local source_file="$1" live_version="$2" live_name="$3"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$GITHUB_WORKSPACE/supabase/migrations/$source_file"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -c "insert into supabase_migrations.schema_migrations(version,name) values ('$live_version','$live_name');"
}

apply_live_alias 20260903130355_clean_ru0_authority_closure.sql 20260903160812 clean_ru0_authority_closure
apply_live_alias 20260903165700_clean_ru1_worker_readiness.sql 20260903184545 clean_ru1_worker_readiness
apply_live_alias 20260903190000_clean_ru2_need_v2_draft.sql 20260903222139 clean_ru2_need_v2_draft
apply_live_alias 20260903190100_clean_ru2_ai_fact_transition_guard.sql 20260903222333 clean_ru2_ai_fact_transition_guard
apply_live_alias 20260904090000_clean_ru3_policy_bundle_foundation.sql 20260904090147 clean_ru3_policy_bundle_foundation
apply_live_alias 20260904103000_clean_ru3_need_publication_decision.sql 20260904102429 clean_ru3_need_publication_decision
apply_live_alias 20260904111500_clean_ru3_canonical_publish.sql 20260904182402 clean_ru3_canonical_publish
apply_live_alias 20260904214500_clean_ru4_owner_edit_lock.sql 20260905052130 clean_ru4_owner_edit_lock
apply_live_alias 20260904223000_clean_ru4_close_remaining_search.sql 20260905052224 clean_ru4_close_remaining_search
apply_live_alias 20260904230000_clean_ru4_ai_edit_conversation.sql 20260905052336 clean_ru4_ai_edit_conversation
apply_live_alias 20260904230200_clean_ru4_ai_edit_conversation_live_transfer_reconcile.sql 20260905052651 clean_ru4_ai_edit_conversation_live_transfer_reconcile
apply_live_alias 20260904230500_clean_ru4_ai_edit_replay_boundary.sql 20260905052713 clean_ru4_ai_edit_replay_boundary
apply_live_alias 20260905060000_clean_ru4b_preselection_qa_foundation.sql 20260905070010 clean_ru4b_preselection_qa_foundation
apply_live_alias 20260905060100_clean_ru4b_service_boundary.sql 20260905070029 clean_ru4b_service_boundary
apply_live_alias 20260905060200_clean_ru4b_inbox_event_contract.sql 20260905070046 clean_ru4b_inbox_event_contract
apply_live_alias 20260905133000_clean_ru5_public_profile_projection.sql 20260905163927 clean_ru5_public_profile_projection
apply_live_alias 20260905190000_clean_ru5_atomic_application_submit.sql 20260905190040 clean_ru5_atomic_application_submit
apply_live_alias 20260905211500_clean_ru5_my_applications_projection.sql 20260905200133 clean_ru5_my_applications_projection
apply_live_alias 20260905223000_clean_ru5_candidate_projection.sql 20260905230326 clean_ru5_candidate_projection
apply_live_alias 20260906010000_clean_ru5_selection_eligibility_revalidation.sql 20260906065758 clean_ru5_selection_eligibility_revalidation
apply_live_alias 20260906080000_clean_p0d02_selection_semantic_idempotency.sql 20260906090451 clean_p0d02_selection_semantic_idempotency

actual="$(psql "$DB_URL" -Atc "select count(*)::text || '/' || max(version) from supabase_migrations.schema_migrations;")"
test "$actual" = "77/20260906090451"
predecessor_select_md5="$(psql "$DB_URL" -Atc "select md5(pg_get_functiondef('public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure));")"
echo "p0d02_disposable_select_md5=$predecessor_select_md5"
case "$predecessor_select_md5" in
  b1ca0a03ee075565c71b50f00d61dade|65785758985a1abac56dc55498678b22) ;;
  *) echo "unexpected P0D-02 predecessor MD5: $predecessor_select_md5" >&2; exit 1 ;;
esac
test "$(psql "$DB_URL" -Atc "select to_regclass('private.connection_activations') is null;")" = "t"
echo "PASS P0D03_PREDECESSOR live_77_p0d02"

# Seed one committed Agreement before P0D-03 to prove grandfather preservation/no backfill.
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
begin;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('f0d03000-0000-4000-8000-000000000001','authenticated','authenticated','p0d03-grandfather-requester@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','Grandfather Requester','city','Novi Sad'),statement_timestamp(),statement_timestamp()),
('f0d03000-0000-4000-8000-000000000002','authenticated','authenticated','p0d03-grandfather-worker@proof.invalid','{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name','Grandfather Worker','city','Novi Sad','skills',jsonb_build_array('Proof')),statement_timestamp(),statement_timestamp());
update public.app_profiles set display_name='Grandfather Worker',city='Novi Sad',skills=array['Proof'],team_capacity=1 where account_id='f0d03000-0000-4000-8000-000000000002'::uuid and kind='WORKER';
alter table public.app_profiles disable trigger guard_profile_write_trg;
update public.app_profiles set profile_status='ACTIVE' where account_id='f0d03000-0000-4000-8000-000000000002'::uuid and kind='WORKER';
alter table public.app_profiles enable trigger guard_profile_write_trg;
select set_config('uskoci.need_lifecycle','PUBLISH',true);
insert into public.needs(id,requester_account_id,requester_profile_id,status,title,description,category,approximate_city,approximate_area,mode,required_slots,response_deadline,published_at)
select 'f0d03000-0000-4000-8000-000000000101'::uuid,'f0d03000-0000-4000-8000-000000000001'::uuid,p.id,'PUBLISHED','P0D03 grandfather','proof','PROOF','Novi Sad','Liman','OFFERS',1,statement_timestamp()+interval '2 days',statement_timestamp()
from public.app_profiles p where p.account_id='f0d03000-0000-4000-8000-000000000001'::uuid and p.kind='REQUESTER';
select set_config('uskoci.need_lifecycle','',true);
insert into public.marketplace_responses(id,need_id,worker_account_id,worker_profile_id,response_kind,status,submitted_against_need_revision,current_version,covered_slots,price_rsd,scope_note,submitted_at)
select 'f0d03000-0000-4000-8000-000000000201'::uuid,'f0d03000-0000-4000-8000-000000000101'::uuid,'f0d03000-0000-4000-8000-000000000002'::uuid,p.id,'OFFER','SELECTED',1,1,1,3000,'grandfather',statement_timestamp()
from public.app_profiles p where p.account_id='f0d03000-0000-4000-8000-000000000002'::uuid and p.kind='WORKER';
insert into public.marketplace_response_versions(response_id,version,need_revision,covered_slots,price_rsd,scope_note,content_hash)
values('f0d03000-0000-4000-8000-000000000201'::uuid,1,1,1,3000,'grandfather',repeat('3',64));
insert into public.need_selections(id,need_id,need_revision,selected_by_account_id,client_request_id,covered_slots,response_id,worker_account_id,worker_profile_id,selection_mode,status)
select 'f0d03000-0000-4000-8000-000000000301'::uuid,'f0d03000-0000-4000-8000-000000000101'::uuid,1,'f0d03000-0000-4000-8000-000000000001'::uuid,'p0d03-grandfather-key',1,'f0d03000-0000-4000-8000-000000000201'::uuid,'f0d03000-0000-4000-8000-000000000002'::uuid,p.id,'REQUESTER_SELECTS','SELECTED'
from public.app_profiles p where p.account_id='f0d03000-0000-4000-8000-000000000002'::uuid and p.kind='WORKER';
insert into public.agreements(id,need_id,selection_id,selected_response_id,requester_account_id,requester_profile_id,worker_account_id,worker_profile_id,current_version,status)
select 'f0d03000-0000-4000-8000-000000000401'::uuid,'f0d03000-0000-4000-8000-000000000101'::uuid,'f0d03000-0000-4000-8000-000000000301'::uuid,'f0d03000-0000-4000-8000-000000000201'::uuid,'f0d03000-0000-4000-8000-000000000001'::uuid,rp.id,'f0d03000-0000-4000-8000-000000000002'::uuid,wp.id,1,'CONFIRMED'
from public.app_profiles rp, public.app_profiles wp
where rp.account_id='f0d03000-0000-4000-8000-000000000001'::uuid and rp.kind='REQUESTER'
  and wp.account_id='f0d03000-0000-4000-8000-000000000002'::uuid and wp.kind='WORKER';
insert into public.agreement_versions(agreement_id,version,status,terms,content_hash,created_by_account_id)
values('f0d03000-0000-4000-8000-000000000401'::uuid,1,'CONFIRMED',jsonb_build_object('price_rsd',3000,'covered_slots',1,'need_revision',1,'response_version',1),repeat('3',64),'f0d03000-0000-4000-8000-000000000001'::uuid);
insert into public.agreement_execution(agreement_id,agreement_version,mode,state)
values('f0d03000-0000-4000-8000-000000000401'::uuid,1,'PHYSICAL','CONFIRMED');
commit;
SQL

test "$(psql "$DB_URL" -Atc "select count(*) from public.agreements where id='f0d03000-0000-4000-8000-000000000401'::uuid;")" = "1"

candidate="$GITHUB_WORKSPACE/supabase/migrations/20260906100000_clean_p0d03_requester_connection_activation_v1.sql"
md5="$(md5sum "$candidate" | awk '{print $1}')"
bytes="$(wc -c < "$candidate" | tr -d ' ')"
printf 'md5=%s\nbytes=%s\n' "$md5" "$bytes" | tee /tmp/p0d03-checksum.txt
echo "P0D03_CANDIDATE_MD5=$md5 P0D03_CANDIDATE_BYTES=$bytes"

test "$(grep -Eic '^create table private.connection_policy_versions' "$candidate")" = "1"
test "$(grep -Eic '^create table private.connection_activations' "$candidate")" = "1"
test "$(grep -Eic '^create or replace function public.rpc_select_response' "$candidate")" = "1"
grep -F "PROMOTIONAL_FREE" "$candidate" >/dev/null
grep -F "agreements_require_connection_activation_trg" "$candidate" >/dev/null
if grep -Eiq '^create table public\.' "$candidate"; then echo 'P0D-03 must not create public tables' >&2; exit 1; fi
if grep -Eiq 'wallet_balance|checkout|payment_provider|worker_debit' "$candidate"; then echo 'P0D-03 scope widened into paid/Worker debit semantics' >&2; exit 1; fi

echo "PASS P0D03_NARROW_SCOPE"

before_candidates="$(psql "$DB_URL" -Atc "select md5(pg_get_functiondef('public.rpc_list_need_candidates(uuid)'::regprocedure));")"
before_submit="$(psql "$DB_URL" -Atc "select md5(pg_get_functiondef('public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)'::regprocedure));")"
before_select="$(psql "$DB_URL" -Atc "select md5(pg_get_functiondef('public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure));")"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$candidate"
after_candidates="$(psql "$DB_URL" -Atc "select md5(pg_get_functiondef('public.rpc_list_need_candidates(uuid)'::regprocedure));")"
after_submit="$(psql "$DB_URL" -Atc "select md5(pg_get_functiondef('public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamptz,timestamptz,text,text)'::regprocedure));")"
after_select="$(psql "$DB_URL" -Atc "select md5(pg_get_functiondef('public.rpc_select_response(uuid,integer,uuid,integer,text,text)'::regprocedure));")"
test "$before_candidates" = "$after_candidates"
test "$before_submit" = "$after_submit"
test "$before_select" != "$after_select"
test "$(psql "$DB_URL" -Atc "select count(*) from private.connection_policy_versions;")" = "1"
test "$(psql "$DB_URL" -Atc "select count(*) from private.connection_activations;")" = "0"
test "$(psql "$DB_URL" -Atc "select count(*) from public.agreements where id='f0d03000-0000-4000-8000-000000000401'::uuid;")" = "1"
echo "P0D03_SELECTION_BEFORE=$before_select P0D03_SELECTION_AFTER=$after_select"
echo "PASS P0D03_NO_HISTORICAL_BACKFILL grandfather_agreement_preserved activation_zero"

psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$GITHUB_WORKSPACE/supabase/proofs/p0d03_requester_connection_activation_v1_runtime_proof.sql" | tee /tmp/p0d03-proof.log
grep -F "PASS P0D03_REQUESTER_CONNECTION_ACTIVATION_V1 requester_beneficiary selection_reason headcount_units promotional_free zero_platform_cost task_price_separate same_key_same_receipt different_payload_rejected no_worker_debit private_immutable_ledger agreement_requires_activation rollback_only" /tmp/p0d03-proof.log
test "$(psql "$DB_URL" -Atc "select count(*) from auth.users where email like 'p0d03-%@proof.invalid';")" = "2"
test "$(psql "$DB_URL" -Atc "select count(*) from private.connection_activations;")" = "0"

# P0D-02 true-concurrency regression, now also asserting one activation per winner.
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$GITHUB_WORKSPACE/supabase/proofs/p0d02_selection_concurrency_seed.sql" >/tmp/p0d03-concurrency-seed.log
grep -F "PASS P0D02_CONCURRENCY_FIXTURES" /tmp/p0d03-concurrency-seed.log
requester="f0d02000-0000-4000-8000-000000000001"
same_need="f0d02000-0000-4000-8000-000000000101"
same_response="f0d02000-0000-4000-8000-000000000201"
diff_need="f0d02000-0000-4000-8000-000000000102"
diff_response="f0d02000-0000-4000-8000-000000000202"
run_select() {
  local need_id="$1" response_id="$2" hash="$3" request_id="$4" out="$5" err="$6"
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 \
    -c "begin; set local role authenticated; set local \"request.jwt.claim.sub\" = '$requester'; select public.rpc_select_response('$need_id'::uuid,1,'$response_id'::uuid,1,'$hash','$request_id'); commit;" >"$out" 2>"$err"
}

set +e
run_select "$same_need" "$same_response" "$(printf 'e%.0s' {1..64})" "p0d02-concurrent-same" /tmp/p0d03-same-1.out /tmp/p0d03-same-1.err & p1=$!
run_select "$same_need" "$same_response" "$(printf 'e%.0s' {1..64})" "p0d02-concurrent-same" /tmp/p0d03-same-2.out /tmp/p0d03-same-2.err & p2=$!
wait "$p1"; s1=$?; wait "$p2"; s2=$?
set -e
test "$s1" -eq 0; test "$s2" -eq 0
a1="$(grep -E '^[0-9a-f-]{36}$' /tmp/p0d03-same-1.out | tail -n1)"
a2="$(grep -E '^[0-9a-f-]{36}$' /tmp/p0d03-same-2.out | tail -n1)"
test -n "$a1"; test "$a1" = "$a2"
test "$(psql "$DB_URL" -Atc "select count(*) from private.connection_activations where need_id='$same_need'::uuid;")" = "1"

set +e
run_select "$diff_need" "$diff_response" "$(printf 'f%.0s' {1..64})" "p0d02-concurrent-a" /tmp/p0d03-diff-a.out /tmp/p0d03-diff-a.err & p3=$!
run_select "$diff_need" "$diff_response" "$(printf 'f%.0s' {1..64})" "p0d02-concurrent-b" /tmp/p0d03-diff-b.out /tmp/p0d03-diff-b.err & p4=$!
wait "$p3"; s3=$?; wait "$p4"; s4=$?
set -e
if { [ "$s3" -eq 0 ] && [ "$s4" -eq 0 ]; } || { [ "$s3" -ne 0 ] && [ "$s4" -ne 0 ]; }; then
  cat /tmp/p0d03-diff-a.err /tmp/p0d03-diff-b.err >&2
  exit 1
fi
test "$(psql "$DB_URL" -Atc "select count(*) from private.connection_activations where need_id='$diff_need'::uuid;")" = "1"
test "$(psql "$DB_URL" -Atc "select count(*) from private.connection_activations where need_id in ('$same_need'::uuid,'$diff_need'::uuid) and platform_cost_rsd=0 and beneficiary_account_id=requester_account_id;")" = "2"
echo "PASS P0D03_P0D02_TRUE_CONCURRENCY same_key_one_activation different_keys_one_winner one_activation_per_agreement"

# Remove only disposable concurrency fixtures. Immutable-ledger trigger is disabled solely for proof cleanup.
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
begin;
alter table private.connection_activations disable trigger connection_activations_immutable_trg;
delete from private.connection_activations where need_id in ('f0d02000-0000-4000-8000-000000000101'::uuid,'f0d02000-0000-4000-8000-000000000102'::uuid);
alter table private.connection_activations enable trigger connection_activations_immutable_trg;
delete from public.agreement_execution where agreement_id in (select id from public.agreements where need_id in ('f0d02000-0000-4000-8000-000000000101'::uuid,'f0d02000-0000-4000-8000-000000000102'::uuid));
delete from public.agreement_versions where agreement_id in (select id from public.agreements where need_id in ('f0d02000-0000-4000-8000-000000000101'::uuid,'f0d02000-0000-4000-8000-000000000102'::uuid));
delete from private.selection_commands where need_id in ('f0d02000-0000-4000-8000-000000000101'::uuid,'f0d02000-0000-4000-8000-000000000102'::uuid);
delete from public.agreements where need_id in ('f0d02000-0000-4000-8000-000000000101'::uuid,'f0d02000-0000-4000-8000-000000000102'::uuid);
delete from public.need_selections where need_id in ('f0d02000-0000-4000-8000-000000000101'::uuid,'f0d02000-0000-4000-8000-000000000102'::uuid);
delete from public.marketplace_response_versions where response_id in ('f0d02000-0000-4000-8000-000000000201'::uuid,'f0d02000-0000-4000-8000-000000000202'::uuid);
delete from public.marketplace_responses where id in ('f0d02000-0000-4000-8000-000000000201'::uuid,'f0d02000-0000-4000-8000-000000000202'::uuid);
alter table public.needs disable trigger user;
delete from public.needs where id in ('f0d02000-0000-4000-8000-000000000101'::uuid,'f0d02000-0000-4000-8000-000000000102'::uuid);
alter table public.needs enable trigger user;
alter table public.app_profiles disable trigger user;
delete from public.app_profiles where account_id in ('f0d02000-0000-4000-8000-000000000001'::uuid,'f0d02000-0000-4000-8000-000000000002'::uuid);
alter table public.app_profiles enable trigger user;
delete from auth.users where id in ('f0d02000-0000-4000-8000-000000000001'::uuid,'f0d02000-0000-4000-8000-000000000002'::uuid);
commit;
SQL

test "$(psql "$DB_URL" -Atc "select count(*) from private.connection_activations;")" = "0"
echo "PASS P0D03_TRUE_CONCURRENCY_ZERO_RESIDUE"

psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$GITHUB_WORKSPACE/supabase/proofs/ru5_selection_eligibility_revalidation_runtime_proof.sql" | tee /tmp/ru5-selection-regression.log
grep -F "PASS RU5_SELECTION_ELIGIBILITY_REVALIDATION unready_stale team_capacity_stale ready_selectable unready_denied team_capacity_denied zero_partial_writes exact_agreement_binding rollback_only" /tmp/ru5-selection-regression.log
test "$(psql "$DB_URL" -Atc "select count(*) from private.connection_activations;")" = "0"

test "$(psql "$DB_URL" -Atc "select md5(pg_get_functiondef('public.rpc_list_need_candidates(uuid)'::regprocedure));")" = "1978ce1d5852cef46f94e81468d37bba"
test "$(psql "$DB_URL" -Atc "select has_function_privilege('authenticated','public.rpc_select_response(uuid,integer,uuid,integer,text,text)','EXECUTE');")" = "t"
test "$(psql "$DB_URL" -Atc "select has_function_privilege('service_role','public.rpc_select_response(uuid,integer,uuid,integer,text,text)','EXECUTE');")" = "t"
test "$(psql "$DB_URL" -Atc "select has_function_privilege('anon','public.rpc_select_response(uuid,integer,uuid,integer,text,text)','EXECUTE');")" = "f"
test "$(psql "$DB_URL" -Atc "select has_table_privilege('authenticated','private.connection_activations','SELECT');")" = "f"
test "$(psql "$DB_URL" -Atc "select has_table_privilege('service_role','private.connection_activations','SELECT');")" = "f"
test "$(psql "$DB_URL" -Atc "select count(*) from private.publication_policy_bundles;")" = "0"
test "$(psql "$DB_URL" -Atc "select count(*) from private.preselection_qa_commands;")" = "0"
echo "PASS P0D03_UNRELATED_AUTHORITIES_UNCHANGED"

# Explicitly remove the grandfather proof fixtures before leaving the disposable stack.
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
begin;
delete from public.agreement_execution where agreement_id='f0d03000-0000-4000-8000-000000000401'::uuid;
delete from public.agreement_versions where agreement_id='f0d03000-0000-4000-8000-000000000401'::uuid;
delete from public.agreements where id='f0d03000-0000-4000-8000-000000000401'::uuid;
delete from public.need_selections where id='f0d03000-0000-4000-8000-000000000301'::uuid;
delete from public.marketplace_response_versions where response_id='f0d03000-0000-4000-8000-000000000201'::uuid;
delete from public.marketplace_responses where id='f0d03000-0000-4000-8000-000000000201'::uuid;
alter table public.needs disable trigger user;
delete from public.needs where id='f0d03000-0000-4000-8000-000000000101'::uuid;
alter table public.needs enable trigger user;
alter table public.app_profiles disable trigger user;
delete from public.app_profiles where account_id in ('f0d03000-0000-4000-8000-000000000001'::uuid,'f0d03000-0000-4000-8000-000000000002'::uuid);
alter table public.app_profiles enable trigger user;
delete from auth.users where id in ('f0d03000-0000-4000-8000-000000000001'::uuid,'f0d03000-0000-4000-8000-000000000002'::uuid);
commit;
SQL

test "$(psql "$DB_URL" -Atc "select count(*) from auth.users where email like 'p0d03-%@proof.invalid';")" = "0"
echo "PASS P0D03_DISPOSABLE_ZERO_RESIDUE"

cd "$PROOF_DIR"
supabase stop --no-backup
trap - EXIT

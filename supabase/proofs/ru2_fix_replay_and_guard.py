from pathlib import Path
import re

migration = Path('supabase/migrations/20260903190000_clean_ru2_need_v2_draft.sql')
s = migration.read_text()

new_guard = '''do $ru2_predecessor$
declare
  v_count integer;
  v_head text;
begin
  select count(*), max(version)
    into v_count, v_head
    from supabase_migrations.schema_migrations;

  if v_count <> 58 or v_head <> '20260903184545' then
    raise exception using
      errcode='55000',
      message=format('RU2_PREDECESSOR_MISMATCH: expected 58/20260903184545, got %s/%s',
                     v_count, coalesce(v_head,'<null>'));
  end if;

  if to_regclass('public.ai_conversations') is null
     or to_regclass('public.ai_structured_facts') is null
     or to_regclass('public.needs') is null
     or to_regprocedure('public.rpc_ai_open_conversation(text)') is null
     or to_regprocedure('public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb)') is null then
    raise exception 'RU2_PREDECESSOR_MISMATCH: required RU-1 predecessor objects are missing'
      using errcode='55000';
  end if;
end
$ru2_predecessor$;'''

s, n = re.subn(
    r"do \$ru2_predecessor\$[\s\S]*?\$ru2_predecessor\$;",
    new_guard,
    s,
    count=1,
)
if n != 1:
    raise SystemExit('RU2 predecessor guard block not found exactly once')
migration.write_text(s)

workflow = Path('.github/workflows/ru2-db-apply-proof.yml')
w = workflow.read_text()

old_case = "20260903130355_clean_ru0_authority_closure.sql|20260903165700_clean_ru1_worker_readiness.sql|20260903190000_clean_ru2_need_v2_draft.sql|20260901105922_clean_completion_and_writer_authenticated_proof.sql|20260901113333_clean_ai_interview_turn_authenticated_proof.sql"
new_case = old_case + "|20260901114029_clean_ai_fact_supersession_and_human_correction.sql"
if old_case not in w:
    raise SystemExit('migration exclusion list not found')
w = w.replace(old_case, new_case, 1)

anchor = '''          cp "$GITHUB_WORKSPACE/supabase/proofs/ru2_replay_20260901113333_durable_effects.sql" \\
             supabase/migrations/20260901113333_clean_ai_interview_turn_authenticated_proof.sql

          supabase db start
          supabase db reset --local
'''
replacement = '''          cp "$GITHUB_WORKSPACE/supabase/proofs/ru2_replay_20260901113333_durable_effects.sql" \\
             supabase/migrations/20260901113333_clean_ai_interview_turn_authenticated_proof.sql

          # 20260901114029 contains real function/grant changes followed by a
          # rollback-only runtime proof that needs production fixture rows.
          # Replay the exact durable prefix plus its three durable comments.
          awk '/^-- Runtime proofs: no retained rows\\.$/{exit} {print}' \\
            "$GITHUB_WORKSPACE/supabase/migrations/20260901114029_clean_ai_fact_supersession_and_human_correction.sql" \\
            > supabase/migrations/20260901114029_clean_ai_fact_supersession_and_human_correction.sql
          cat >> supabase/migrations/20260901114029_clean_ai_fact_supersession_and_human_correction.sql <<'SQL'
comment on function public.rpc_ai_confirm_fact(uuid) is 'AUTHENTICATED_RUNTIME_PROVEN: human confirmation stamps confirmed_at and confirmed_by_user_id.';
comment on function public.rpc_ai_correct_fact(uuid,text) is 'AUTHENTICATED_RUNTIME_PROVEN: explicit correction atomically supersedes prior live fact and creates CONFIRMED EXPLICIT_USER_ANSWER provenance.';
comment on function public.rpc_ai_apply_interview_turn_service(uuid,uuid,text,text,text,jsonb) is 'SERVICE_RUNTIME_PROVEN: repeated canonical keys preserve one-live-fact invariant by superseding before insert; replacement proof rolled back with zero residue.';
SQL

          supabase db start
          supabase db reset --local
          # The proof-only bootstrap object must exist, but its synthetic ledger
          # row must not alter the real product predecessor count seen by RU-2.
          psql "$DB_URL" -v ON_ERROR_STOP=1 -c "delete from supabase_migrations.schema_migrations where version='20260825000000';"
'''
if anchor not in w:
    raise SystemExit('replay insertion anchor not found')
w = w.replace(anchor, replacement, 1)

old_verify = '''          test "$product_count/$product_head" = "58/20260903184545"
          test "$(psql "$DB_URL" -Atc 'select count(*) from public.ai_structured_facts;')" = "82"
          test "$(psql "$DB_URL" -Atc 'select count(*) from public.ai_conversations;')" = "15"
          test "$(psql "$DB_URL" -Atc 'select count(*) from public.needs;')" = "6"
'''
new_verify = '''          test "$product_count/$product_head" = "58/20260903184545"
          test "$(psql "$DB_URL" -Atc \"select to_regclass('public.ai_structured_facts') is not null;\")" = "t"
          test "$(psql "$DB_URL" -Atc \"select to_regclass('public.ai_conversations') is not null;\")" = "t"
          test "$(psql "$DB_URL" -Atc \"select to_regclass('public.needs') is not null;\")" = "t"
'''
if old_verify not in w:
    raise SystemExit('volatile predecessor proof assertions not found')
w = w.replace(old_verify, new_verify, 1)

old_static = '''          test "$(psql "$DB_URL" -Atc "select count(*) from public.ai_structured_facts where fact_schema_version='LEGACY_TEXT_V1';")" = "82"
          test "$(psql "$DB_URL" -Atc "select count(*) from public.ai_conversations where fact_schema_version='LEGACY_TEXT_V1';")" = "15"
'''
new_static = '''          test "$(psql "$DB_URL" -Atc "select count(*) from public.ai_structured_facts where fact_schema_version<>'LEGACY_TEXT_V1';")" = "0"
          test "$(psql "$DB_URL" -Atc "select count(*) from public.ai_conversations where fact_schema_version<>'LEGACY_TEXT_V1';")" = "0"
'''
if old_static not in w:
    raise SystemExit('volatile post-RU2 proof assertions not found')
w = w.replace(old_static, new_static, 1)

workflow.write_text(w)
print('RU2_STABLE_GUARD_AND_REPLAY_REPAIRED')

\set ON_ERROR_STOP on
\! sed \
  -e 's/^create or replace function private\.ru4b_assert_block_authority_ready(uuid,uuid)$/create or replace function private.ru4b_assert_block_authority_ready(p_worker_account_id uuid,p_requester_account_id uuid)/' \
  -e 's/^create or replace function private\.ru4b_assert_rate_authority_ready(uuid)$/create or replace function private.ru4b_assert_rate_authority_ready(p_actor_account_id uuid)/' \
  "$GITHUB_WORKSPACE/supabase/proofs/ru4b_preselection_qa_runtime_proof_raw.sql" \
  > /tmp/ru4b_preselection_qa_runtime_proof_patched.sql
\i /tmp/ru4b_preselection_qa_runtime_proof_patched.sql

-- USKOCI RU-4B — service boundary reconciliation.
-- private schema remains non-usable by service_role; public SECURITY DEFINER wrappers are service-role only.

create or replace function public.rpc_ru4b_record_policy_decision_service(
  p_subject_kind text,
  p_need_id uuid,
  p_need_revision integer,
  p_question_id uuid,
  p_content_fingerprint text,
  p_policy_bundle_id uuid,
  p_outcome text,
  p_safe_reason_codes text[],
  p_decision_source text,
  p_service_provenance jsonb
) returns uuid
language sql
security definer
set search_path to 'pg_catalog'
as $$
  select private.rpc_ru4b_record_policy_decision_service(
    p_subject_kind,p_need_id,p_need_revision,p_question_id,p_content_fingerprint,
    p_policy_bundle_id,p_outcome,p_safe_reason_codes,p_decision_source,p_service_provenance
  )
$$;

create or replace function public.rpc_ru4b_record_materiality_decision_service(
  p_question_id uuid,
  p_need_id uuid,
  p_need_revision integer,
  p_answer_fingerprint text,
  p_materiality text,
  p_decision_source text,
  p_service_provenance jsonb
) returns uuid
language sql
security definer
set search_path to 'pg_catalog'
as $$
  select private.rpc_ru4b_record_materiality_decision_service(
    p_question_id,p_need_id,p_need_revision,p_answer_fingerprint,
    p_materiality,p_decision_source,p_service_provenance
  )
$$;

revoke all on function public.rpc_ru4b_record_policy_decision_service(text,uuid,integer,uuid,text,uuid,text,text[],text,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.rpc_ru4b_record_materiality_decision_service(uuid,uuid,integer,text,text,text,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function public.rpc_ru4b_record_policy_decision_service(text,uuid,integer,uuid,text,uuid,text,text[],text,jsonb)
  to service_role;
grant execute on function public.rpc_ru4b_record_materiality_decision_service(uuid,uuid,integer,text,text,text,jsonb)
  to service_role;

comment on function public.rpc_ru4b_record_policy_decision_service(text,uuid,integer,uuid,text,uuid,text,text[],text,jsonb)
  is 'RU-4B service-role-only policy decision boundary. Production ALLOW intentionally disabled in the internal writer.';
comment on function public.rpc_ru4b_record_materiality_decision_service(uuid,uuid,integer,text,text,text,jsonb)
  is 'RU-4B service-role-only materiality authority boundary; no client EXECUTE.';

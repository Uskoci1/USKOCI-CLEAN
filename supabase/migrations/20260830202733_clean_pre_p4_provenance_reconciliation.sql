-- PRE-P4 REPAIR 1: provenance reconciliation and fail-closed AI publish boundary.
-- Invariants:
-- 1. Accept only the two physically observed predecessor variants (PUBLISHED/COMPLETED).
-- 2. Do not mutate existing business rows.
-- 3. Preserve server ownership and authenticated-only execute access.
-- 4. Prevent the pre-P4 AI path from publishing a Need until Package 4 review/safety exists.

do $predecessor$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname = 'rpc_ai_publish_need'
     and pg_get_function_identity_arguments(p.oid) =
         'p_conversation_id uuid, p_profile_id uuid';

  if v_definition is null then
    raise exception 'PREDECESSOR_MISSING: public.rpc_ai_publish_need(uuid,uuid)'
      using errcode = 'P0001';
  end if;

  if position('insert into public.needs' in lower(v_definition)) = 0
     or position('update public.ai_conversations' in lower(v_definition)) = 0
     or (
       position('status = ''PUBLISHED''' in v_definition) = 0
       and position('status = ''COMPLETED''' in v_definition) = 0
     ) then
    raise exception 'PREDECESSOR_DRIFT: rpc_ai_publish_need is not an observed 191500 lineage variant'
      using errcode = 'P0001';
  end if;
end;
$predecessor$;

create or replace function public.rpc_ai_publish_need(
  p_conversation_id uuid,
  p_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_account_id uuid := auth.uid();
begin
  if v_account_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  raise exception 'PACKAGE_4_NOT_READY'
    using
      errcode = 'P0001',
      detail = 'AI publish is fail-closed during PRE-P4 integrity repair.',
      hint = 'Use the canonical non-AI Need flow until human review and safety validation are implemented.';
end;
$function$;

revoke all on function public.rpc_ai_publish_need(uuid, uuid) from public, anon;
grant execute on function public.rpc_ai_publish_need(uuid, uuid) to authenticated, service_role;

comment on function public.rpc_ai_publish_need(uuid, uuid) is
  'PRE-P4 Repair 1: authenticated fail-closed boundary; Package 4 must replace via a new forward migration.';

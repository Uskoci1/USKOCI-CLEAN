-- USKOČI RU-5 / P0C-03 — MY APPLICATIONS PROJECTION
--
-- Read-only Worker projection over existing Application/Need/Agreement authority.
-- This migration does not rewrite response rows, does not create new lifecycle
-- states, and does not alter rpc_withdraw_response or RU-4 stale resolution.

begin;

do $p0c03_preflight$
begin
  if to_regclass('public.marketplace_responses') is null
     or to_regclass('public.marketplace_response_versions') is null
     or to_regclass('public.needs') is null
     or to_regclass('public.agreements') is null then
    raise exception 'RU5_P0C03_PREDECESSOR_MISMATCH: application read tables missing';
  end if;

  if to_regprocedure('public.rpc_withdraw_response(uuid,integer,integer,text,text)') is null then
    raise exception 'RU5_P0C03_PREDECESSOR_MISMATCH: rpc_withdraw_response missing';
  end if;
end
$p0c03_preflight$;

create or replace function public.rpc_list_my_applications()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if v_actor is null then
    raise exception using errcode='42501', message='AUTH_REQUIRED';
  end if;

  with own_rows as (
    select
      r.id as application_id,
      r.need_id,
      n.revision as current_need_revision,
      r.submitted_against_need_revision,
      r.current_version,
      r.status as raw_response_status,
      r.price_rsd,
      r.covered_slots,
      r.scope_note,
      r.submitted_at,
      n.title,
      n.description,
      n.status as raw_need_status,
      n.approximate_city,
      n.approximate_area,
      n.starts_at,
      (
        select a.id
          from public.agreements a
         where a.selected_response_id = r.id
         order by a.created_at desc, a.id desc
         limit 1
      ) as agreement_id
    from public.marketplace_responses r
    join public.needs n on n.id = r.need_id
    where r.worker_account_id = v_actor
      and r.status <> 'DRAFT'
  ), mapped as (
    select
      o.*,
      case
        when o.agreement_id is not null or o.raw_response_status = 'SELECTED'
          then 'SELECTED'
        when o.raw_response_status = 'WITHDRAWN'
          then 'WITHDRAWN'
        when o.raw_response_status in ('STALE','STALE_REVIEW_REQUIRED')
             or o.submitted_against_need_revision is distinct from o.current_need_revision
          then 'STALE_REVIEW_REQUIRED'
        when o.raw_response_status in ('NOT_SELECTED','EXPIRED')
             or o.raw_need_status not in ('PUBLISHED','SELECTION')
          then 'CLOSED'
        when o.raw_response_status = 'VIEWED'
          then 'VIEWED'
        when o.raw_response_status = 'SHORTLISTED'
          then 'SHORTLISTED'
        when o.raw_response_status in ('SUBMITTED','DELIVERED')
          then 'SUBMITTED'
        else 'CLOSED'
      end as application_state
    from own_rows o
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'applicationId', m.application_id,
        'needId', m.need_id,
        'needRevision', m.current_need_revision,
        'submittedNeedRevision', m.submitted_against_need_revision,
        'version', m.current_version,
        'state', m.application_state,
        'title', m.title,
        'description', m.description,
        'approximateCity', nullif(btrim(m.approximate_city), ''),
        'approximateArea', nullif(btrim(m.approximate_area), ''),
        'startsAt', m.starts_at,
        'priceRsd', m.price_rsd,
        'coveredSlots', m.covered_slots,
        'scopeNote', coalesce(m.scope_note, ''),
        'agreementId', m.agreement_id,
        'requiresStaleReview', m.application_state = 'STALE_REVIEW_REQUIRED',
        'attentionRequired', m.application_state in ('STALE_REVIEW_REQUIRED','SELECTED'),
        'canWithdraw',
          m.application_state in ('SUBMITTED','VIEWED','SHORTLISTED')
          and m.raw_response_status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')
          and m.submitted_against_need_revision = m.current_need_revision
          and m.raw_need_status in ('PUBLISHED','SELECTION')
          and m.agreement_id is null,
        'submittedAt', m.submitted_at
      )
      order by
        case
          when m.application_state in ('STALE_REVIEW_REQUIRED','SELECTED') then 0
          when m.application_state in ('SUBMITTED','VIEWED','SHORTLISTED') then 1
          else 2
        end,
        m.submitted_at desc nulls last,
        m.application_id
    ),
    '[]'::jsonb
  )
  into v_result
  from mapped m;

  return v_result;
end;
$function$;

revoke all on function public.rpc_list_my_applications()
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_list_my_applications() to authenticated;

comment on function public.rpc_list_my_applications() is
  'RU-5 P0C-03 own-Worker Application lifecycle projection. Maps transport DELIVERED to product SUBMITTED, exposes stale/selected actions without account/private identity fields, and performs no response mutation. Standard withdrawal remains rpc_withdraw_response; RU-4 stale decisions remain rpc_resolve_stale_response_after_need_edit.';

do $p0c03_postconditions$
declare
  v_def text;
begin
  if not has_function_privilege('authenticated','public.rpc_list_my_applications()','EXECUTE')
     or has_function_privilege('anon','public.rpc_list_my_applications()','EXECUTE')
     or has_function_privilege('service_role','public.rpc_list_my_applications()','EXECUTE') then
    raise exception 'RU5_P0C03_POSTCONDITION_FAILED: projection grants';
  end if;

  v_def := pg_get_functiondef('public.rpc_list_my_applications()'::regprocedure);
  if position('worker_account_id = v_actor' in v_def) = 0
     or position('STALE_REVIEW_REQUIRED' in v_def) = 0
     or position('agreementId' in v_def) = 0
     or position('canWithdraw' in v_def) = 0 then
    raise exception 'RU5_P0C03_POSTCONDITION_FAILED: projection markers';
  end if;

  if has_table_privilege('authenticated','public.marketplace_responses','UPDATE')
     or has_table_privilege('authenticated','public.marketplace_responses','INSERT')
     or has_table_privilege('authenticated','public.marketplace_response_versions','INSERT') then
    raise exception 'RU5_P0C03_POSTCONDITION_FAILED: direct response write exposure';
  end if;
end
$p0c03_postconditions$;

commit;

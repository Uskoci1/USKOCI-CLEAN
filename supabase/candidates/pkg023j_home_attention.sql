-- PKG-023j candidate ONLY. No canonical DEV application is authorized.
-- Contract/proof: docs/implementation/v5-ai-first/pkg023/PKG023J_HOME_ATTENTION.md
-- Additive, read-only, no table/index/policy changes, no price or public-pin change.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg023j_predecessor(source_digest text) on commit drop;
do $pre$
declare expected record;
begin
  if to_regprocedure('public.rpc_home_attention()') is not null then
    raise exception 'PKG023J_ALREADY_APPLIED';
  end if;
  for expected in select * from (values
    ('public.rpc_list_my_applications()', '6ce809c2939714451e60876ab3885115'),
    ('private.my_application_state(text,integer,integer,text,boolean)', '236c6c9c9625e4fb92522c6c3a1bfe03'),
    ('public.rpc_list_my_agreements_page(text,integer,timestamptz,uuid)', 'f834365bd8dd43b1eac6c8213624e1dc'),
    ('public.rpc_list_my_needs_page(text,integer,timestamptz,uuid)', 'efb305257be41a978b6204b7d45e8793'),
    ('public.covered_slots(public.needs)', 'cbeb8f2a3da7d08965ef0386cfc437ba'),
    ('public.rpc_storage_account_open()', '7350621ef256678e209aa6a28c79b58b')
  ) pins(signature, digest) loop
    if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
        where oid = to_regprocedure(expected.signature)) is distinct from expected.digest then
      raise exception 'PKG023J_PREDECESSOR_DRIFT: %', expected.signature;
    end if;
  end loop;
  if not private.retention_ai_source_ready()
     or private.closure_source_digest_v5() is distinct from
       (select sha256 from private.closure_source_v5 where singleton) then
    raise exception 'PKG023J_CLOSURE_SOURCE_NOT_READY';
  end if;
  insert into pkg023j_predecessor values (private.closure_source_digest_v5());
end
$pre$;

create function public.rpc_home_attention() returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  -- Match the restrictive direct-read fence, including its denial for a closed account.
  -- Definer is required for own applications on non-public tasks, just like the existing readers.
  -- Never accept a caller-supplied account, and never grant private-schema access to the client.
  if not public.rpc_storage_account_open() then
    raise exception 'ACCOUNT_NOT_OPEN' using errcode = '42501';
  end if;

  with own_needs as materialized (
    select n.id, n.title, n.status, n.created_at,
      greatest(1, n.required_slots) - greatest(0, least(greatest(1, n.required_slots), public.covered_slots(n))) as remaining,
      -- Compatibility count: visible responses, NOT a claim that each is selectable (audit F02).
      -- An owner sees non-drafts; their own response is also visible under responses_worker_read.
      (select count(*) from public.marketplace_responses r where r.need_id = n.id
        and (r.status <> 'DRAFT' or r.worker_account_id = v_uid)) as application_count
    from public.needs n where n.requester_account_id = v_uid
      and n.status not in ('COMPLETED','CANCELLED','EXPIRED','ARCHIVED')
  ), own_applications as materialized (
    select r.id, r.need_id, n.title, r.submitted_at,
      private.my_application_state(r.status, r.submitted_against_need_revision, n.revision, n.status,
        exists(select 1 from public.agreements a where a.selected_response_id = r.id)) as state
    from public.marketplace_responses r join public.needs n on n.id = r.need_id
    where r.worker_account_id = v_uid and r.status <> 'DRAFT'
  ), flagged_applications as (
    select o.*, state = 'STALE_REVIEW_REQUIRED' as requires_stale_review,
      state in ('STALE_REVIEW_REQUIRED','SELECTED') as attention_required
    from own_applications o
  ), own_agreements as materialized (
    select a.id, a.need_id, n.title, a.created_at, a.requester_account_id,
      coalesce(ae.state, a.status) as state, ae.problem_opened_at is not null as problem_opened
    from public.agreements a
    join public.agreement_versions av on av.agreement_id = a.id and av.version = a.current_version
    join public.needs n on n.id = a.need_id
    join public.app_profiles rp on rp.id = a.requester_profile_id
    join public.app_profiles wp on wp.id = a.worker_profile_id
    left join public.agreement_execution ae on ae.agreement_id = a.id
    where v_uid in (a.requester_account_id, a.worker_account_id)
      and coalesce(ae.state, a.status) in ('CONFIRMED','AWAITING_REQUESTER')
  ), attention as materialized (
    select 1 as priority, 'AGREEMENT_CONFIRM_COMPLETION'::text as reason,
      a.id as subject_id, a.need_id as task_id, a.id as agreement_id, null::uuid as application_id,
      a.title as task_title, null::bigint as application_count, a.created_at as sort_at
    from own_agreements a where a.state = 'AWAITING_REQUESTER' and a.requester_account_id = v_uid
    union all
    select 2, 'AGREEMENT_OPEN_PROBLEM', a.id, a.need_id, a.id, null::uuid, a.title, null::bigint, a.created_at
    from own_agreements a where a.problem_opened
    union all
    select 3, case when a.state = 'STALE_REVIEW_REQUIRED' or a.requires_stale_review
        then 'APPLICATION_STALE' else 'APPLICATION_ATTENTION' end,
      a.id, a.need_id, null::uuid, a.id, a.title, null::bigint, a.submitted_at
    from flagged_applications a
    where a.state in ('SUBMITTED','VIEWED','SHORTLISTED','STALE_REVIEW_REQUIRED')
      and (a.state = 'STALE_REVIEW_REQUIRED' or a.requires_stale_review or a.attention_required)
    union all
    select 4, 'TASK_APPLICATIONS', n.id, n.id, null::uuid, null::uuid, n.title, n.application_count, n.created_at
    from own_needs n where n.status <> 'DRAFT' and n.remaining > 0 and n.application_count > 0
  ), preview as (
    select * from attention
    order by priority, sort_at desc nulls last,
      case when priority = 3 then subject_id end asc,
      case when priority <> 3 then subject_id end desc
    limit 3
  ), totals as (
    select (select count(*) from attention) as attention_count,
      (select count(*) from own_agreements) as agreement_count,
      (select count(*) from own_needs) as need_count,
      (select count(*) from own_applications where state in
        ('SUBMITTED','VIEWED','SHORTLISTED','STALE_REVIEW_REQUIRED')) as application_count
  )
  select jsonb_build_object(
    'schemaVersion', 1,
    'asOf', statement_timestamp(),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
      'reason', reason, 'subjectId', subject_id, 'taskId', task_id,
      'agreementId', agreement_id, 'applicationId', application_id,
      'taskTitle', task_title, 'applicationCount', application_count, 'sortAt', sort_at
    ) order by priority, sort_at desc nulls last,
      case when priority = 3 then subject_id end asc,
      case when priority <> 3 then subject_id end desc), '[]'::jsonb) from preview),
    'counts', jsonb_build_object(
      'attention', t.attention_count, 'attentionMore', greatest(0, t.attention_count - 3),
      'activeAgreements', t.agreement_count, 'agreementsMore', greatest(0, t.agreement_count - 2),
      'ownActiveTasks', t.need_count, 'activeApplications', t.application_count,
      'activities', t.need_count + t.application_count,
      'activitiesMore', greatest(0, t.need_count + t.application_count - 5))
  ) into v_result from totals t;
  return v_result;
end
$function$;

revoke all on function public.rpc_home_attention() from public, anon, authenticated, service_role;
grant execute on function public.rpc_home_attention() to authenticated;
comment on function public.rpc_home_attention() is
  'PKG-023j own-account Home attention: four existing predicates, top three reasons and complete Home counts. Facts only; no commands, private identity, price basis or eligibility redefinition.';

do $post$
begin
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
      where oid = 'public.rpc_home_attention()'::regprocedure) is distinct from '7371d4cddcebead2cb86d8f795d2ee01' then
    raise exception 'PKG023J_BODY_MISMATCH';
  end if;
  if (select source_digest from pkg023j_predecessor) is distinct from private.closure_source_digest_v5()
     or private.closure_source_digest_v5() is distinct from
        (select sha256 from private.closure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG023J_CHANGED_CLOSURE_SOURCE';
  end if;
  if has_function_privilege('anon','public.rpc_home_attention()','EXECUTE')
     or has_function_privilege('service_role','public.rpc_home_attention()','EXECUTE')
     or not has_function_privilege('authenticated','public.rpc_home_attention()','EXECUTE')
     or has_schema_privilege('authenticated','private','USAGE') then
    raise exception 'PKG023J_GRANTS_MISMATCH';
  end if;
end
$post$;
notify pgrst, 'reload schema';
commit;

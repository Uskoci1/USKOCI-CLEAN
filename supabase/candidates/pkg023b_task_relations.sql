-- PKG-023b: what I am to a task, read for the tasks on screen (V3 third slice, B).
--
-- NOT APPLIED ANYWHERE. A candidate for canonical DEV, proven only on a disposable database.
-- Requires pkg023a (private.my_application_state).
--
-- Today the client answers "is this task mine, did I apply to it" by reading the whole of my tasks
-- and the whole of my applications. This answers it for at most 100 task ids in one call. One task is
-- an array of one; a map or a list sends one call for the rows it shows.
--
-- The relation is an OVERLAY. It is never part of a public task result: the public marketplace reader
-- (pkg023d) returns the same rows to every viewer, and this function says, separately and only to the
-- caller, which of those rows are the caller's own.
--
-- It is not an oracle. Only tasks the caller owns or has applied to are listed. Every other id -
-- unrelated, not visible to the caller, or not existing at all - is simply absent, and the three
-- cases are indistinguishable. The client reads "absent" as NONE and a failed call as UNKNOWN, as
-- src/data/taskRelation.ts already does.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg023b_predecessor(source_digest text) on commit drop;

do $pre$
begin
  if to_regprocedure('private.my_application_state(text,integer,integer,text,boolean)') is null then
    raise exception 'PKG023B_REQUIRES_PKG023A';
  end if;
  if to_regprocedure('public.rpc_get_my_task_relations(uuid[])') is not null then
    raise exception 'PKG023B_ALREADY_APPLIED';
  end if;
  insert into pkg023b_predecessor values (private.closure_source_digest_v5());
end
$pre$;

create function public.rpc_get_my_task_relations(p_need_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog'
as $function$
declare
  v_uid uuid := auth.uid();
  v_items jsonb;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if p_need_ids is null or cardinality(p_need_ids) < 1 or cardinality(p_need_ids) > 100
     or array_position(p_need_ids, null) is not null then
    raise exception 'INVALID_INPUT' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(x.item order by x.need_id), '[]'::jsonb) into v_items
  from (
    select n.id as need_id, jsonb_build_object(
        'needId', n.id, 'relation', 'OWNER',
        'applicationId', null, 'applicationState', null, 'agreementId', null) as item
      from public.needs n
     where n.id = any(p_need_ids)
       and n.requester_account_id = v_uid
    union all
    -- The newest application that was ever sent; a DRAFT was never sent and is nobody's relation.
    select mine.need_id, jsonb_build_object(
        'needId', mine.need_id, 'relation', 'APPLIED',
        'applicationId', mine.application_id,
        'applicationState', private.my_application_state(
          mine.raw_status, mine.submitted_revision, mine.current_revision, mine.need_status, mine.agreement_id is not null),
        'agreementId', mine.agreement_id) as item
      from (
        select distinct on (r.need_id)
          r.need_id, r.id as application_id, r.status as raw_status,
          r.submitted_against_need_revision as submitted_revision,
          n.revision as current_revision, n.status as need_status,
          (select a.id from public.agreements a
            where a.selected_response_id = r.id
            order by a.created_at desc, a.id desc limit 1) as agreement_id
        from public.marketplace_responses r
        join public.needs n on n.id = r.need_id
        where r.need_id = any(p_need_ids)
          and r.worker_account_id = v_uid
          and r.status <> 'DRAFT'
          and n.requester_account_id <> v_uid
        order by r.need_id, r.created_at desc, r.id desc
      ) mine
  ) x;

  return jsonb_build_object('items', v_items, 'asOf', statement_timestamp());
end
$function$;

revoke all on function public.rpc_get_my_task_relations(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.rpc_get_my_task_relations(uuid[]) to authenticated;

do $post$
begin
  if (select source_digest from pkg023b_predecessor) is distinct from private.closure_source_digest_v5() then
    raise exception 'PKG023B_CHANGED_THE_CLOSURE_SOURCE_DIGEST';
  end if;
  if has_function_privilege('anon', 'public.rpc_get_my_task_relations(uuid[])', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.rpc_get_my_task_relations(uuid[])', 'EXECUTE') then
    raise exception 'PKG023B_GRANTS_NOT_EXACT';
  end if;
end
$post$;

notify pgrst, 'reload schema';
commit;

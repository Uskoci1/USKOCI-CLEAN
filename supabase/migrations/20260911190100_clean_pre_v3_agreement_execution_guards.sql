-- PRE-V3 Agreement invariants over the exact accepted M05 source.
-- No new Agreement engine; user-authorized finite input bounds and capability read.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $preflight$
begin
  if exists(select 1 from public.agreement_change_proposals p join public.agreement_execution ex on ex.agreement_id=p.agreement_id
    where p.status='PENDING' and (ex.worker_marked_done_at is not null or ex.state<>'CONFIRMED')) then
    raise exception 'PRE_V3_PENDING_AFTER_DONE_RECONCILIATION_REQUIRED';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)'::regprocedure) is distinct from '1f742b446dba8e2af4b40fc036ec2503' then raise exception 'PRE_V3_AGREEMENT_PREDECESSOR_CHANGED' using detail='public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)'; end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_respond_agreement_change(uuid,boolean)'::regprocedure) is distinct from '1396c096460bfd8efd2ccd0d9556f991' then raise exception 'PRE_V3_AGREEMENT_PREDECESSOR_CHANGED' using detail='public.rpc_respond_agreement_change(uuid,boolean)'; end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_mark_work_done(uuid)'::regprocedure) is distinct from '777687c2da4804d0708b383ab2506f1e' then raise exception 'PRE_V3_AGREEMENT_PREDECESSOR_CHANGED' using detail='public.rpc_mark_work_done(uuid)'; end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_confirm_completion(uuid)'::regprocedure) is distinct from 'ff55e327fafb0d4daa8bb0042332b5d8' then raise exception 'PRE_V3_AGREEMENT_PREDECESSOR_CHANGED' using detail='public.rpc_confirm_completion(uuid)'; end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_get_agreement_workspace(uuid)'::regprocedure) is distinct from '1956badab03ba8b02066cfb30eb8aaaf' then raise exception 'PRE_V3_AGREEMENT_PREDECESSOR_CHANGED' using detail='public.rpc_get_agreement_workspace(uuid)'; end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_tick_auto_completion()'::regprocedure) is distinct from 'b72c930e11c8db8646274c4067225fb0' then raise exception 'PRE_V3_AUTO_COMPLETION_PREDECESSOR_CHANGED'; end if;
end;
$preflight$;

-- Withdrawing is an explicit new terminal proposal state, not an invented
-- acceptance/rejection by the other party. Existing proposal history is preserved.
alter table public.agreement_change_proposals drop constraint agreement_change_proposals_status_check;
alter table public.agreement_change_proposals add constraint agreement_change_proposals_status_check
  check(status in ('PENDING','ACCEPTED','REJECTED','SUPERSEDED','WITHDRAWN'));

create function private.agreement_action_state(p_id uuid,p_actor uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog
as $caps$
 select jsonb_build_object('agreementId',a.id,'agreementVersion',a.current_version,'accountId',p_actor,'authoritative',true,
   'canProposeChange',a.status='CONFIRMED' and x.state='CONFIRMED' and x.worker_marked_done_at is null and not coalesce(p.has_pending,false),
   'canRespondChange',a.status='CONFIRMED' and x.state='CONFIRMED' and x.worker_marked_done_at is null and coalesce(p.can_respond,false),
   'canWithdrawChange',a.status='CONFIRMED' and x.state='CONFIRMED' and x.worker_marked_done_at is null and coalesce(p.can_withdraw,false),
   'canMarkWorkDone',p_actor=a.worker_account_id and a.status='CONFIRMED' and x.state='CONFIRMED' and x.worker_marked_done_at is null and not coalesce(p.has_pending,false),
   'canConfirmCompletion',p_actor=a.requester_account_id and a.status='CONFIRMED' and x.state in ('CONFIRMED','AWAITING_REQUESTER') and not coalesce(p.has_pending,false),
   'canCancel',a.status='CONFIRMED' and x.state in ('CONFIRMED','AWAITING_REQUESTER'),
   'pendingChanges',coalesce(p.items,'[]'::jsonb))
 from public.agreements a join public.agreement_execution x on x.agreement_id=a.id and x.agreement_version=a.current_version
 left join lateral(select bool_or(true) has_pending, bool_or(c.proposed_by_account_id<>p_actor) can_respond,
   bool_or(c.proposed_by_account_id=p_actor) can_withdraw,
   jsonb_agg(jsonb_build_object('id',c.id,'baseVersion',c.base_version,'proposedByAccountId',c.proposed_by_account_id,
     'createdAt',c.created_at,'proposedTerms',c.proposed_terms,'reason',c.reason) order by c.created_at,c.id) items
   from public.agreement_change_proposals c where c.agreement_id=a.id and c.status='PENDING') p on true
 where a.id=p_id and p_actor in (a.requester_account_id,a.worker_account_id);
$caps$;
revoke all on function private.agreement_action_state(uuid,uuid) from public,anon,authenticated,service_role;

create function public.rpc_withdraw_agreement_change(p_proposal_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $withdraw$
declare actor uuid:=auth.uid(); aid uuid; a public.agreements; p public.agreement_change_proposals;
begin
 if actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 select agreement_id into aid from public.agreement_change_proposals where id=p_proposal_id and proposed_by_account_id=actor;
 if not found then raise exception 'CHANGE_PROPOSAL_NOT_FOUND' using errcode='P0002'; end if;
 perform 1 from public.needs where id=(select need_id from public.agreements where id=aid) for update;
 select * into a from public.agreements where id=aid for update;
 if not found or actor not in(a.requester_account_id,a.worker_account_id) then raise exception 'NOT_PARTY' using errcode='42501'; end if;
 select * into p from public.agreement_change_proposals where id=p_proposal_id for update;
 if p.proposed_by_account_id<>actor then raise exception 'NOT_PROPOSER' using errcode='42501'; end if;
 if p.status='WITHDRAWN' then return jsonb_build_object('proposalId',p.id,'status','WITHDRAWN','idempotentReplay',true,'authoritative',true); end if;
 if p.status<>'PENDING' then raise exception 'PROPOSAL_NOT_PENDING' using errcode='P0001'; end if;
 if a.status<>'CONFIRMED' or not exists(select 1 from public.agreement_execution x where x.agreement_id=a.id
   and x.agreement_version=a.current_version and x.state='CONFIRMED' and x.worker_marked_done_at is null) then
   raise exception 'AGREEMENT_CHANGE_AFTER_WORK_DONE' using errcode='P0001'; end if;
 update public.agreement_change_proposals set status='WITHDRAWN',responded_by_account_id=actor,responded_at=statement_timestamp() where id=p.id;
 return jsonb_build_object('proposalId',p.id,'status','WITHDRAWN','idempotentReplay',false,'authoritative',true);
end;
$withdraw$;
revoke all on function public.rpc_withdraw_agreement_change(uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_withdraw_agreement_change(uuid) to authenticated;

do $rewrite$
declare definition text;
begin
 definition:=pg_get_functiondef('public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)'::regprocedure);
 if position($old$  select * into v_agreement from public.agreements where id=p_agreement_id for update;$old$ in definition)=0 then raise exception 'PRE_V3_AGREEMENT_ANCHOR_MISSING'; end if;
 definition:=replace(definition,$old$  select * into v_agreement from public.agreements where id=p_agreement_id for update;$old$,$new$  if char_length(p_client_request_id)>200 or char_length(coalesce(p_reason,''))>4000
    or octet_length(p_patch::text)>65536 then
    raise exception 'CHANGE_INPUT_TOO_LARGE' using errcode='22023';
  end if;
  if (p_patch?'proposed_start_at')<>(p_patch?'proposed_end_at') then
    raise exception 'AGREEMENT_CALENDAR_INTERVAL_INVALID' using errcode='22023';
  end if;
  perform 1 from public.needs where id=(select ag.need_id from public.agreements ag
    where ag.id=p_agreement_id and v_uid in (ag.requester_account_id,ag.worker_account_id)) for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND_OR_FORBIDDEN' using errcode='P0002'; end if;
  select * into v_agreement from public.agreements where id=p_agreement_id for update;$new$);
 if position($old$  select * into v_existing from public.agreement_change_proposals$old$ in definition)=0 then raise exception 'PRE_V3_AGREEMENT_ANCHOR_MISSING'; end if;
 definition:=replace(definition,$old$  select * into v_existing from public.agreement_change_proposals$old$,$new$  if not exists(select 1 from public.agreement_execution ex where ex.agreement_id=v_agreement.id
    and ex.agreement_version=v_agreement.current_version and ex.state='CONFIRMED' and ex.worker_marked_done_at is null) then
    raise exception 'AGREEMENT_CHANGE_AFTER_WORK_DONE' using errcode='P0001';
  end if;

  select * into v_existing from public.agreement_change_proposals$new$);
 if position($old$  if jsonb_typeof(v_terms->'scope_note') is distinct from 'string' then$old$ in definition)=0 then raise exception 'PRE_V3_AGREEMENT_ANCHOR_MISSING'; end if;
 definition:=replace(definition,$old$  if jsonb_typeof(v_terms->'scope_note') is distinct from 'string' then$old$,$new$  if (p_patch?'scope_note' and jsonb_typeof(p_patch->'scope_note') is distinct from 'string')
    or (coalesce(v_terms->'scope_note','null'::jsonb)<>'null'::jsonb and jsonb_typeof(v_terms->'scope_note') is distinct from 'string')
    or char_length(v_terms->>'scope_note')>4000 then$new$);
 if position($old$  v_hash := encode$old$ in definition)=0 then raise exception 'PRE_V3_AGREEMENT_ANCHOR_MISSING'; end if;
 definition:=replace(definition,$old$  v_hash := encode$old$,$new$  if exists(select 1 from public.agreement_change_proposals where agreement_id=v_agreement.id and status='PENDING') then
    raise exception 'AGREEMENT_CHANGE_PENDING' using errcode='P0001';
  end if;
  v_hash := encode$new$);
 execute definition;
 if (select md5(prosrc) from pg_proc where oid='public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)'::regprocedure) is distinct from '679c070f0ae58765a5468bb551100bd3' then raise exception 'PRE_V3_AGREEMENT_RESULT_MISMATCH'; end if;
end;
$rewrite$;

do $rewrite$
declare definition text;
begin
 definition:=pg_get_functiondef('public.rpc_respond_agreement_change(uuid,boolean)'::regprocedure);
 if position($old$  select * into v_agreement from public.agreements where id=v_agreement_id for update;$old$ in definition)=0 then raise exception 'PRE_V3_AGREEMENT_ANCHOR_MISSING'; end if;
 definition:=replace(definition,$old$  select * into v_agreement from public.agreements where id=v_agreement_id for update;$old$,$new$  perform 1 from public.needs where id=(select ag.need_id from public.agreements ag
    where ag.id=v_agreement_id and v_uid in (ag.requester_account_id,ag.worker_account_id)) for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND_OR_FORBIDDEN' using errcode='P0002'; end if;
  select * into v_agreement from public.agreements where id=v_agreement_id for update;$new$);
 if position($old$  if v_proposal.status = 'ACCEPTED' and p_accept then$old$ in definition)=0 then raise exception 'PRE_V3_AGREEMENT_ANCHOR_MISSING'; end if;
 definition:=replace(definition,$old$  if v_proposal.status = 'ACCEPTED' and p_accept then$old$,$new$  if not exists(select 1 from public.agreement_execution ex where ex.agreement_id=v_agreement.id
    and ex.agreement_version=v_agreement.current_version and ex.state='CONFIRMED' and ex.worker_marked_done_at is null) then
    raise exception 'AGREEMENT_CHANGE_AFTER_WORK_DONE' using errcode='P0001';
  end if;

  if v_proposal.status = 'ACCEPTED' and p_accept then$new$);
 if position($old$  if jsonb_typeof(v_terms->'scope_note') is distinct from 'string' then$old$ in definition)=0 then raise exception 'PRE_V3_AGREEMENT_ANCHOR_MISSING'; end if;
 definition:=replace(definition,$old$  if jsonb_typeof(v_terms->'scope_note') is distinct from 'string' then$old$,$new$  if (coalesce(v_terms->'scope_note','null'::jsonb)<>'null'::jsonb and jsonb_typeof(v_terms->'scope_note') is distinct from 'string')
    or char_length(v_terms->>'scope_note')>4000 then$new$);
 if position($old$  if jsonb_typeof(v_terms) is distinct from 'object' or$old$ in definition)=0 then raise exception 'PRE_V3_AGREEMENT_ANCHOR_MISSING'; end if;
 definition:=replace(definition,$old$  if jsonb_typeof(v_terms) is distinct from 'object' or$old$,$new$  if coalesce(v_terms->'scope_note','null'::jsonb)='null'::jsonb and coalesce(v_base_terms->'scope_note','null'::jsonb)<>'null'::jsonb then raise exception 'CHANGE_SCOPE_INVALID' using errcode='22023'; end if;
  if jsonb_typeof(v_terms) is distinct from 'object' or$new$);
 execute definition;
 if (select md5(prosrc) from pg_proc where oid='public.rpc_respond_agreement_change(uuid,boolean)'::regprocedure) is distinct from '9c07d46b9a07a458966961c74dfb14fa' then raise exception 'PRE_V3_AGREEMENT_RESULT_MISMATCH'; end if;
end;
$rewrite$;

do $rewrite$
declare definition text;
begin
 definition:=pg_get_functiondef('public.rpc_mark_work_done(uuid)'::regprocedure);
 if position($old$  deadline:=statement_timestamp()+interval '48 hours';$old$ in definition)=0 then raise exception 'PRE_V3_AGREEMENT_ANCHOR_MISSING'; end if;
 definition:=replace(definition,$old$  deadline:=statement_timestamp()+interval '48 hours';$old$,$new$  if exists(select 1 from public.agreement_change_proposals where agreement_id=a.id and status='PENDING') then
    raise exception 'AGREEMENT_CHANGE_PENDING' using errcode='P0001';
  end if;

  deadline:=statement_timestamp()+interval '48 hours';$new$);
 execute definition;
 if (select md5(prosrc) from pg_proc where oid='public.rpc_mark_work_done(uuid)'::regprocedure) is distinct from '955e0719a3c0a67b684ee0d28483300c' then raise exception 'PRE_V3_AGREEMENT_RESULT_MISMATCH'; end if;
end;
$rewrite$;

do $rewrite$
declare definition text;
begin
 definition:=pg_get_functiondef('public.rpc_confirm_completion(uuid)'::regprocedure);
 if position($old$  v_completed_at:=statement_timestamp();$old$ in definition)=0 then raise exception 'PRE_V3_AGREEMENT_ANCHOR_MISSING'; end if;
 definition:=replace(definition,$old$  v_completed_at:=statement_timestamp();$old$,$new$  if exists(select 1 from public.agreement_change_proposals where agreement_id=a.id and status='PENDING') then
    raise exception 'AGREEMENT_CHANGE_PENDING' using errcode='P0001';
  end if;

  v_completed_at:=statement_timestamp();$new$);
 execute definition;
 if (select md5(prosrc) from pg_proc where oid='public.rpc_confirm_completion(uuid)'::regprocedure) is distinct from '658006c318c3847ab7a9f80706ef3003' then raise exception 'PRE_V3_AGREEMENT_RESULT_MISMATCH'; end if;
end;
$rewrite$;

do $rewrite$
declare definition text;
begin
 definition:=pg_get_functiondef('public.rpc_get_agreement_workspace(uuid)'::regprocedure);
 if position($old$  return v_result;$old$ in definition)=0 then raise exception 'PRE_V3_AGREEMENT_ANCHOR_MISSING'; end if;
 definition:=replace(definition,$old$  return v_result;$old$,$new$  return v_result || jsonb_build_object('actionState', private.agreement_action_state(p_agreement_id,v_uid));$new$);
 execute definition;
 if (select md5(prosrc) from pg_proc where oid='public.rpc_get_agreement_workspace(uuid)'::regprocedure) is distinct from '287afdd70b8c027fba4d50f9e41245cd' then raise exception 'PRE_V3_AGREEMENT_RESULT_MISMATCH'; end if;
end;
$rewrite$;

-- Same canonical Need -> Agreement -> execution lock order, bounded work, and
-- fresh rechecks after lock acquisition. SKIP LOCKED avoids blocking interactive
-- cancellation/confirmation; a later tick picks the skipped due obligation.
create or replace function public.rpc_tick_auto_completion()
returns integer language plpgsql security definer set search_path=pg_catalog
as $tick$
declare candidate record; a public.agreements; x public.agreement_execution; done integer:=0; at_time timestamptz:=statement_timestamp();
begin
 for candidate in select ag.id,ag.need_id from public.agreements ag join public.agreement_execution ex on ex.agreement_id=ag.id
   where ag.status='CONFIRMED' and ex.state='AWAITING_REQUESTER' and ex.problem_opened_at is null
     and ex.requester_deadline_at is not null and ex.requester_deadline_at<=at_time
   order by ag.need_id,ag.id limit 100
 loop
   perform 1 from public.needs where id=candidate.need_id for update skip locked;
   if not found then continue; end if;
   select * into a from public.agreements where id=candidate.id for update skip locked;
   if not found or a.status<>'CONFIRMED' then continue; end if;
   select * into x from public.agreement_execution where agreement_id=a.id for update skip locked;
   if not found or x.state<>'AWAITING_REQUESTER' or x.agreement_version<>a.current_version
     or x.problem_opened_at is not null or x.requester_deadline_at is null or x.requester_deadline_at>at_time
     or exists(select 1 from public.agreement_change_proposals where agreement_id=a.id and status='PENDING') then continue; end if;
   update public.agreement_execution set state='COMPLETED',completed_at=at_time,requester_deadline_at=null,updated_at=at_time where agreement_id=a.id;
   update public.agreements set status='COMPLETED',updated_at=at_time where id=a.id;
   perform private.sync_need_completion(a.need_id);
   done:=done+1;
 end loop;
 return done;
end;
$tick$;
-- CREATE OR REPLACE preserves the service-only grants; verify, do not broaden.
do $grants$
begin
 if has_function_privilege('authenticated','public.rpc_tick_auto_completion()','execute')
   or has_function_privilege('anon','public.rpc_tick_auto_completion()','execute')
   or not has_function_privilege('service_role','public.rpc_tick_auto_completion()','execute') then
   raise exception 'PRE_V3_AUTO_COMPLETION_GRANT_CHANGED'; end if;
end;
$grants$;
notify pgrst,'reload schema';
commit;

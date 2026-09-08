-- P0E completion truth guards: replay-safe worker mark, terminal-safe requester
-- completion and single neutral problem record. Forward-only, three existing
-- owner RPCs. No schema, event-type, provider, writer or publish activation.
-- Approved rules: MASTER 06_DRAFT_EVIDENCE/P0_SQL_DRAFTS_V10/P0E 01/02/04 and
-- P0E_PROOF_MATRIX.csv, rebuilt against the exact live87 predecessor bodies.
-- Draft corrections applied here: need_id variable/column ambiguity resolved,
-- absent worker_calendar_commitments statement removed, return-type changes
-- performed through drop + recreate with explicit re-grant.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $precondition$
begin
  if (select md5(prosrc) from pg_proc where oid='public.rpc_mark_work_done(uuid)'::regprocedure) is distinct from '02c0d47fecd9a1a9d565f0b0f3c9c2e1' then
    raise exception 'P0E_PREDECESSOR_FUNCTION_MISMATCH' using detail='public.rpc_mark_work_done(uuid)';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_confirm_completion(uuid)'::regprocedure) is distinct from '39ff23fd1d3f4668dbb99a664bf963a9' then
    raise exception 'P0E_PREDECESSOR_FUNCTION_MISMATCH' using detail='public.rpc_confirm_completion(uuid)';
  end if;
  -- rpc_report_problem was last defined by 20260830191500, a recorded-statement
  -- reconstruction (exact_byte_mirror=false): live carries the recorded body,
  -- a canonical source replay carries the file body. Both are frozen here.
  if coalesce((select md5(prosrc) from pg_proc where oid='public.rpc_report_problem(uuid,text)'::regprocedure),'')
     not in ('d872dd1eaffdb67856ce6c47f4176f33','f4800952fc49316868e6b57c081e7f88') then
    raise exception 'P0E_PREDECESSOR_FUNCTION_MISMATCH' using detail='public.rpc_report_problem(uuid,text)';
  end if;
  if to_regprocedure('private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)') is null then
    raise exception 'P0E_PREDECESSOR_EVENT_WRITER_MISSING' using detail='private.emit_event';
  end if;
  if to_regprocedure('private.sync_need_completion(uuid)') is null then
    raise exception 'P0E_PREDECESSOR_NEED_COMPLETION_MISSING' using detail='private.sync_need_completion';
  end if;
  if to_regclass('public.worker_calendar_commitments') is not null then
    raise exception 'P0E_UNEXPECTED_CALENDAR_TABLE' using detail='public.worker_calendar_commitments';
  end if;
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid='public.user_activity_events'::regclass and c.contype='c'
      and pg_get_constraintdef(c.oid) like '%COMPLETION_REQUIRED%'
      and pg_get_constraintdef(c.oid) like '%EXECUTION_STATE_CHANGED%'
      and pg_get_constraintdef(c.oid) like '%RECOVERY_OPENED%'
  ) then
    raise exception 'P0E_EVENT_TYPES_NOT_ADMITTED' using detail='public.user_activity_events.event_type';
  end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_tick_auto_completion()'::regprocedure) is distinct from '5a0c010d6467dc7f56eb817de564601e' then
    raise exception 'P0E_PREDECESSOR_FUNCTION_MISMATCH' using detail='public.rpc_tick_auto_completion()';
  end if;
end
$precondition$;

-- P0E-01: worker completion proposal happens exactly once; replay while
-- AWAITING_REQUESTER returns the original deadline and never extends it.
-- Lock order aligns with cancel/selection: Need -> Agreement -> Execution.
create or replace function public.rpc_mark_work_done(p_agreement_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  uid uuid:=auth.uid();
  v_need_id uuid;
  n public.needs%rowtype;
  a public.agreements%rowtype;
  x public.agreement_execution%rowtype;
  deadline timestamptz;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  select ag.need_id into v_need_id from public.agreements ag where ag.id=p_agreement_id;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode='P0002'; end if;

  select * into n from public.needs nd where nd.id=v_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;

  select * into a from public.agreements ag where ag.id=p_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode='P0002'; end if;
  if a.need_id<>n.id then raise exception 'AGREEMENT_NEED_MISMATCH' using errcode='P0001'; end if;
  if a.worker_account_id<>uid then raise exception 'ONLY_WORKER_CAN_MARK_DONE' using errcode='42501'; end if;

  select * into x from public.agreement_execution ex where ex.agreement_id=a.id for update;
  if not found then raise exception 'EXECUTION_NOT_FOUND' using errcode='P0002'; end if;
  if x.agreement_version<>a.current_version then
    raise exception 'EXECUTION_VERSION_MISMATCH' using errcode='P0001';
  end if;

  if a.status='CANCELLED' or x.state='CANCELLED' then
    raise exception 'AGREEMENT_CANCELLED' using errcode='P0001';
  end if;
  if a.status='COMPLETED' or x.state='COMPLETED' then
    raise exception 'AGREEMENT_ALREADY_COMPLETED' using errcode='P0001';
  end if;
  if a.status<>'CONFIRMED' then
    raise exception 'AGREEMENT_NOT_ACTIVE' using errcode='P0001',detail=a.status;
  end if;

  if x.state='AWAITING_REQUESTER' then
    if x.requester_deadline_at is null or x.worker_marked_done_at is null then
      raise exception 'COMPLETION_STATE_CORRUPT' using errcode='P0001';
    end if;
    return x.requester_deadline_at; -- exact replay, no UPDATE, no new event
  end if;

  if x.state<>'CONFIRMED' then
    raise exception 'EXECUTION_NOT_MARKABLE_DONE' using errcode='P0001',detail=x.state;
  end if;

  deadline:=statement_timestamp()+interval '48 hours';

  update public.agreement_execution ex
     set state='AWAITING_REQUESTER',
         worker_marked_done_at=statement_timestamp(),
         requester_deadline_at=deadline,
         updated_at=statement_timestamp()
   where ex.agreement_id=a.id
     and ex.state='CONFIRMED'
  returning ex.* into x;

  if not found then
    raise exception 'COMPLETION_TRANSITION_RACE' using errcode='P0001';
  end if;

  perform private.emit_event(
    a.requester_account_id,'REQUESTER','COMPLETION_REQUIRED',
    'AGREEMENT',a.id,a.current_version,
    'Završetak čeka Vašu potvrdu',
    'Uskočer je označio Dogovor kao završen.',
    'completion-required:'||a.id::text||':'||a.current_version::text,
    'NORMAL',
    jsonb_build_object('requesterDeadlineAt',deadline),
    deadline
  );

  return deadline;
end;
$function$;

revoke all on function public.rpc_mark_work_done(uuid) from public,anon;
grant execute on function public.rpc_mark_work_done(uuid) to authenticated,service_role;

-- P0E-02: requester may explicitly confirm from CONFIRMED or AWAITING_REQUESTER.
-- COMPLETED replay is idempotent. CANCELLED can never resurrect. An open
-- problem blocks AUTO completion (tick), not explicit requester authority.
drop function public.rpc_confirm_completion(uuid);

create function public.rpc_confirm_completion(p_agreement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  uid uuid:=auth.uid();
  v_need_id uuid;
  n public.needs%rowtype;
  a public.agreements%rowtype;
  x public.agreement_execution%rowtype;
  v_completed_at timestamptz;
  need_completed boolean;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  select ag.need_id into v_need_id from public.agreements ag where ag.id=p_agreement_id;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode='P0002'; end if;

  select * into n from public.needs nd where nd.id=v_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;

  select * into a from public.agreements ag where ag.id=p_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode='P0002'; end if;
  if a.need_id<>n.id then raise exception 'AGREEMENT_NEED_MISMATCH' using errcode='P0001'; end if;
  if a.requester_account_id<>uid then
    raise exception 'ONLY_REQUESTER_CAN_CONFIRM_COMPLETION' using errcode='42501';
  end if;

  select * into x from public.agreement_execution ex where ex.agreement_id=a.id for update;
  if not found then raise exception 'EXECUTION_NOT_FOUND' using errcode='P0002'; end if;
  if x.agreement_version<>a.current_version then
    raise exception 'EXECUTION_VERSION_MISMATCH' using errcode='P0001';
  end if;

  if a.status='COMPLETED' and x.state='COMPLETED' then
    return jsonb_build_object(
      'agreementId',a.id,'state','COMPLETED',
      'completedAt',x.completed_at,
      'idempotentReplay',true,'authoritative',true
    );
  end if;

  if a.status='CANCELLED' or x.state='CANCELLED' then
    raise exception 'AGREEMENT_CANCELLED' using errcode='P0001';
  end if;

  if a.status<>'CONFIRMED'
     or x.state not in ('CONFIRMED','AWAITING_REQUESTER') then
    raise exception 'COMPLETION_NOT_CONFIRMABLE'
      using errcode='P0001',
            detail=jsonb_build_object('agreementStatus',a.status,'executionState',x.state)::text;
  end if;

  v_completed_at:=statement_timestamp();

  update public.agreement_execution ex
     set state='COMPLETED',
         completed_at=coalesce(ex.completed_at,v_completed_at),
         requester_deadline_at=null,
         updated_at=statement_timestamp()
   where ex.agreement_id=a.id
  returning ex.* into x;

  update public.agreements ag
     set status='COMPLETED',updated_at=statement_timestamp()
   where ag.id=a.id;

  need_completed:=private.sync_need_completion(n.id);

  perform private.emit_event(
    a.worker_account_id,'WORKER','EXECUTION_STATE_CHANGED',
    'AGREEMENT',a.id,a.current_version,
    'Dogovor je završen',
    'Naručilac je potvrdio završetak.',
    'completed:worker:'||a.id::text||':'||a.current_version::text,
    'NORMAL',
    jsonb_build_object('completedAt',x.completed_at),
    null
  );

  return jsonb_build_object(
    'agreementId',a.id,
    'state','COMPLETED',
    'completedAt',x.completed_at,
    'needCompleted',need_completed,
    'problemWasPreviouslyReported',x.problem_opened_at is not null,
    'idempotentReplay',false,
    'authoritative',true
  );
end;
$function$;

revoke all on function public.rpc_confirm_completion(uuid) from public,anon;
grant execute on function public.rpc_confirm_completion(uuid) to authenticated,service_role;

-- P0E-04: problem is neutral and can be reported only on a live Agreement.
-- The first narrative is preserved; repeat reports acknowledge without a
-- second system message or a second event. Problem != guilt, debt, refund
-- or automatic cancellation; it blocks auto-completion only.
drop function public.rpc_report_problem(uuid,text);

create function public.rpc_report_problem(p_agreement_id uuid, p_narrative text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  uid uuid:=auth.uid();
  v_need_id uuid;
  n public.needs%rowtype;
  a public.agreements%rowtype;
  x public.agreement_execution%rowtype;
  narrative text:=nullif(btrim(p_narrative),'');
  first_report boolean;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if narrative is null then raise exception 'NARRATIVE_REQUIRED' using errcode='22023'; end if;
  if length(narrative)>4000 then raise exception 'NARRATIVE_TOO_LONG' using errcode='22023'; end if;

  select ag.need_id into v_need_id from public.agreements ag where ag.id=p_agreement_id;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode='P0002'; end if;

  select * into n from public.needs nd where nd.id=v_need_id for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;

  select * into a from public.agreements ag where ag.id=p_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode='P0002'; end if;
  if uid<>a.requester_account_id and uid<>a.worker_account_id then
    raise exception 'NOT_PARTY' using errcode='42501';
  end if;
  if a.status<>'CONFIRMED' then
    raise exception 'AGREEMENT_NOT_REPORTABLE' using errcode='P0001',detail=a.status;
  end if;

  select * into x from public.agreement_execution ex where ex.agreement_id=a.id for update;
  if not found then raise exception 'EXECUTION_NOT_FOUND' using errcode='P0002'; end if;
  if x.state not in ('CONFIRMED','AWAITING_REQUESTER') then
    raise exception 'EXECUTION_NOT_REPORTABLE' using errcode='P0001',detail=x.state;
  end if;

  first_report:=x.problem_opened_at is null;

  update public.agreement_execution ex
     set problem_opened_at=coalesce(ex.problem_opened_at,statement_timestamp()),
         problem_narrative=coalesce(ex.problem_narrative,narrative),
         problem_opened_by=coalesce(ex.problem_opened_by,uid),
         updated_at=statement_timestamp()
   where ex.agreement_id=a.id
  returning ex.* into x;

  if first_report then
    insert into public.agreement_messages(agreement_id,agreement_version,sender_account_id,body)
    values (a.id,a.current_version,uid,'⚠️ Prijavljen problem: '||narrative);

    perform private.emit_event(
      case when uid=a.requester_account_id then a.worker_account_id else a.requester_account_id end,
      case when uid=a.requester_account_id then 'WORKER' else 'REQUESTER' end,
      'RECOVERY_OPENED',
      'AGREEMENT',a.id,a.current_version,
      'Prijavljen je problem',
      'Otvorite Dogovor da vidite prijavljeni problem.',
      'problem:'||a.id::text||':'||a.current_version::text,
      'NORMAL',
      jsonb_build_object('reportedByRole',
        case when uid=a.requester_account_id then 'REQUESTER' else 'WORKER' end),
      null
    );
  end if;

  return jsonb_build_object(
    'agreementId',a.id,
    'problemOpenedAt',x.problem_opened_at,
    'problemOpenedBy',x.problem_opened_by,
    'idempotentReplay',not first_report,
    'noAutomaticFaultOrDebt',true,
    'authoritative',true
  );
end;
$function$;

revoke all on function public.rpc_report_problem(uuid,text) from public,anon;
grant execute on function public.rpc_report_problem(uuid,text) to authenticated,service_role;

comment on function public.rpc_mark_work_done(uuid) is
  'P0E-01: one CONFIRMED->AWAITING_REQUESTER transition with a server 48h deadline; replay returns the original deadline without UPDATE or event.';
comment on function public.rpc_confirm_completion(uuid) is
  'P0E-02: requester explicit completion from CONFIRMED or AWAITING_REQUESTER; COMPLETED replay idempotent; CANCELLED never resurrects; open problem blocks auto only.';
comment on function public.rpc_report_problem(uuid,text) is
  'P0E-04: neutral problem record on a live Agreement only; first narrative preserved; repeat reports add no second message or event.';


-- rpc_tick_auto_completion: the live body selected due rows in a CTE and
-- updated by agreement_id only, so a tick that waited on a row locked by an
-- explicit rpc_confirm_completion re-applied COMPLETED to the already
-- completed row, overwriting completed_at and over-counting. The state,
-- problem and deadline predicates now live in the UPDATE itself, so the
-- re-check after the lock wait skips a row completed meanwhile. Grants
-- (service_role only) and the integer return are unchanged.
create or replace function public.rpc_tick_auto_completion()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $tick$
declare
  v_count integer := 0;
  v_need_ids uuid[];
  v_need_id uuid;
begin
  with zatvoreni as (
    update public.agreement_execution e
       set state = 'COMPLETED',
           completed_at = statement_timestamp(),
           requester_deadline_at = null,
           updated_at = statement_timestamp()
     where e.state = 'AWAITING_REQUESTER'
       and e.problem_opened_at is null
       and e.requester_deadline_at is not null
       and e.requester_deadline_at <= statement_timestamp()
    returning e.agreement_id
  ), zatvoreni_agreements as (
    update public.agreements a
       set status = 'COMPLETED', updated_at = statement_timestamp()
      from zatvoreni z
     where a.id = z.agreement_id
    returning a.need_id
  )
  select count(*)::integer, array_agg(distinct need_id)
    into v_count, v_need_ids
    from zatvoreni_agreements;

  if v_need_ids is not null then
    foreach v_need_id in array v_need_ids loop
      perform private.sync_need_completion(v_need_id);
    end loop;
  end if;

  return v_count;
end;
$tick$;

commit;

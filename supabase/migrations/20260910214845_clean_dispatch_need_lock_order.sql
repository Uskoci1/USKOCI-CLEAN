-- W02: scheduled dispatch and due-child expiry use the same parent Need lock
-- as owner commands. Eligibility, result contracts, retries and ACLs are retained.
begin;
set local search_path to pg_catalog;

do $guard$
declare expected record;
begin
  for expected in select * from (values
    ('private.dispatch_tick(integer,timestamptz)','6bbd8765aa833b3c27209c82da99e5e4'),
    ('private.expire_lifecycle(timestamptz)','fa0ae36b9d1c63ebe4b8f9a7c3b1e26d'),
    ('public.rpc_cancel_need(uuid,integer,text)','b6896803455751f0df87f5e778b1bd15'),
    ('private.enqueue_dispatch(uuid,timestamptz)','470ed6ab6501c69bf9ebbfe057ccd0fb'),
    ('private.enqueue_on_need_change()','6c0259533eb97a46244be256667ffac6'),
    ('private.dispatch_next_wave(uuid)','5f434a47486f73d3c107aa92c3ab321c')
  ) as p(signature,body_md5) loop
    if to_regprocedure(expected.signature) is null or
       (select md5(prosrc) from pg_proc where oid=to_regprocedure(expected.signature))
         is distinct from expected.body_md5 then
      raise exception 'DISPATCH_LOCK_PREDECESSOR_MISMATCH' using detail=expected.signature;
    end if;
  end loop;
end $guard$;
create temporary table dispatch_lock_original_functions on commit drop as
  select oid,to_jsonb(p)-'prosrc' as metadata from pg_proc p
  where oid in ('private.dispatch_tick(integer,timestamptz)'::regprocedure,
                'private.expire_lifecycle(timestamptz)'::regprocedure);

create or replace function private.dispatch_tick(
  p_batch integer default 25,
  p_at timestamptz default statement_timestamp())
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $$
declare
  claimed uuid[]; r record; candidate record; res jsonb;
  processed integer := 0; sent integer := 0; stopped integer := 0; failed integer := 0;
  reason text; next_at timestamptz;
begin
  if p_batch is null or p_batch < 1 or p_batch > 200 then p_batch := 25; end if;

  -- Claim each free Need and queue in a bounded successful-claim batch.
  -- locked_until je zastita od procesa koji padne usred obrade.
  -- Each attempt locks its Need before its queue. A skipped queue rolls back
  -- this small subtransaction, releasing that unsuccessful Need lock. Thus a
  -- queue-only holder cannot starve the next free item or accumulate held Needs.
  claimed := '{}'::uuid[];
  for candidate in
    select s.need_id from private.dispatch_schedule s
    where s.next_run_at <= p_at
      and (s.locked_until is null or s.locked_until < p_at)
    order by s.next_run_at, s.need_id
  loop
    begin
      perform 1 from public.needs n where n.id = candidate.need_id
        for update of n skip locked;
      if not found then continue; end if;
      perform 1 from private.dispatch_schedule s
        where s.need_id = candidate.need_id and s.next_run_at <= p_at
          and (s.locked_until is null or s.locked_until < p_at)
        for update of s skip locked;
      if not found then
        raise exception using errcode = 'UD108', message = 'DISPATCH_QUEUE_SKIPPED';
      end if;
      update private.dispatch_schedule s
        set locked_until = p_at + interval '2 minutes', updated_at = statement_timestamp()
        where s.need_id = candidate.need_id;
      claimed := array_append(claimed, candidate.need_id);
    exception when sqlstate 'UD108' then
      null;
    end;
    exit when cardinality(claimed) >= p_batch;
  end loop;

  for r in select unnest(claimed) as need_id loop
    processed := processed + 1;
    begin
      res := private.dispatch_next_wave(r.need_id);
      reason := coalesce(res->>'reason', res->>'status');

      if (res->>'status') = 'SENT' then
        sent := sent + 1;
        -- Sledeci talas tek kad se prozor ovog zatvori.
        next_at := coalesce((res->>'deadlineAt')::timestamptz, p_at + interval '15 minutes');
        update private.dispatch_schedule
           set next_run_at = next_at, locked_until = null, attempts = 0,
               last_status = 'SENT', last_reason = null, updated_at = statement_timestamp()
         where need_id = r.need_id;

      elsif reason in ('SLOTS_FILLED','NEED_NOT_OPEN','WAVES_EXHAUSTED',
                       'RESPONSE_TARGET_AND_COVERAGE_REACHED') then
        stopped := stopped + 1;
        delete from private.dispatch_schedule where need_id = r.need_id;

      else
        -- NO_ELIGIBLE_CANDIDATES i slicno: eksponencijalno odlaganje, odustajanje na 8.
        stopped := stopped + 1;
        update private.dispatch_schedule
           set attempts = attempts + 1,
               locked_until = null,
               next_run_at = p_at + make_interval(
                 mins => least(60, greatest(5, (2 ^ least(attempts, 6))::integer))),
               last_status = 'STOPPED', last_reason = reason,
               updated_at = statement_timestamp()
         where need_id = r.need_id;
        delete from private.dispatch_schedule where need_id = r.need_id and attempts >= 8;
      end if;

    exception when others then
      failed := failed + 1;
      update private.dispatch_schedule
         set attempts = attempts + 1, locked_until = null,
             next_run_at = p_at + interval '10 minutes',
             last_status = 'ERROR', last_reason = left(sqlerrm, 200),
             updated_at = statement_timestamp()
       where need_id = r.need_id;
    end;
  end loop;

  return jsonb_build_object('processed',processed,'sent',sent,'stopped',stopped,
                            'failed',failed,'batch',p_batch,'claimed',cardinality(claimed));
end;
$$;

create or replace function private.expire_lifecycle(
  p_at timestamptz default statement_timestamp()
) returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $$
declare
  d integer := 0;
  rr integer := 0;
  av integer := 0;
  ur integer := 0;
  ne integer := 0;
  re integer := 0;
  nd integer := 0;
  dq integer := 0;
  changed integer := 0;
  locked_needs uuid[];
begin
  perform set_config('uskoci.need_lifecycle', 'EXPIRE', true);

  -- Parent fencing also covers expired waves/deliveries on still-open Needs.
  -- Skip busy parents; their unchanged due rows remain eligible for a later tick.
  select coalesce(array_agg(locked.id), '{}'::uuid[]) into locked_needs
  from (
    select n.id from public.needs n
    where (
      n.status in ('PUBLISHED','SELECTION')
      and n.response_deadline is not null and n.response_deadline <= p_at
      and not exists (select 1 from public.need_selections s
        where s.need_id = n.id and s.status = 'SELECTED')
    ) or exists (
      select 1 from public.opportunity_deliveries o where o.need_id = n.id
        and o.status in ('READY','SEEN')
        and o.expires_at is not null and o.expires_at <= p_at
    ) or exists (
      select 1 from public.dispatch_rounds r where r.need_id = n.id
        and r.status = 'SENT'
        and r.deadline_at is not null and r.deadline_at <= p_at
    )
    order by n.id
    for update of n skip locked
  ) locked;

  with expired_needs as (
    update public.needs x
       set status = 'EXPIRED', urgent = false
     where x.id = any(locked_needs)
       and x.status in ('PUBLISHED','SELECTION')
       and x.response_deadline is not null
       and x.response_deadline <= p_at
       and not exists (
         select 1 from public.need_selections s
          where s.need_id = x.id and s.status = 'SELECTED'
    )
    returning x.id, x.revision
  ), expired_responses as (
    update public.marketplace_responses r
       set status = 'EXPIRED', selected_at = null
      from expired_needs i
     where r.need_id = i.id
       and r.status in ('DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','STALE')
    returning r.id
  ), expired_notifications as (
    update public.notification_deliveries d
       set state = 'EXPIRED'
      from public.user_activity_events e
     where d.event_id = e.id
       and d.state in ('CREATED','QUEUED','FAILED_RETRYABLE')
       and (
         (e.entity_type = 'NEED' and exists (
           select 1 from expired_needs i where i.id = e.entity_id
         ))
         or (e.entity_type = 'RESPONSE' and exists (
           select 1
             from public.marketplace_responses r
             join expired_needs i on i.id = r.need_id
            where r.id = e.entity_id
         ))
       )
    returning d.id
  ), stopped_rounds as (
    update public.dispatch_rounds r
       set status = 'STOPPED', stop_reason = 'NEED_EXPIRED'
      from expired_needs i
     where r.need_id = i.id and r.status in ('PLANNED','SENT')
    returning r.need_id
  ), expired_opportunities as (
    update public.opportunity_deliveries o set status = 'EXPIRED'
      from expired_needs i
     where o.need_id = i.id and o.status in ('READY','SEEN')
    returning o.need_id
  ), dequeued as (
    delete from private.dispatch_schedule s
     using expired_needs i where s.need_id = i.id
    returning s.need_id
  )
  select
    (select count(*)::integer from expired_needs),
    (select count(*)::integer from expired_responses),
    (select count(*)::integer from expired_notifications),
    (select count(*)::integer from stopped_rounds),
    (select count(*)::integer from expired_opportunities),
    (select count(*)::integer from dequeued)
  into ne, re, nd, rr, d, dq;

  update public.opportunity_deliveries
     set status = 'EXPIRED'
   where need_id = any(locked_needs)
     and status in ('READY','SEEN')
     and expires_at is not null and expires_at <= p_at;
  get diagnostics changed = row_count;
  d := d + changed;

  update public.dispatch_rounds
     set status = 'EXPIRED'
   where need_id = any(locked_needs)
     and status = 'SENT'
     and deadline_at is not null and deadline_at <= p_at;
  get diagnostics changed = row_count;
  rr := rr + changed;

  av := 0; -- Persistent owner intent has no automatic expiration.

  ur := private.expire_urgent(p_at);

  return jsonb_build_object(
    'needsExpired', ne,
    'responsesExpired', re,
    'notificationsExpired', nd,
    'schedulesDequeued', dq,
    'deliveriesExpired', d,
    'roundsExpired', rr,
    'availabilityExpired', av,
    'urgencyExpired', ur
  );
end;
$$;

do $post$
declare expected record;
begin
  if (select count(*) from dispatch_lock_original_functions) <> 2 or exists (
    select 1 from dispatch_lock_original_functions original
    left join pg_proc p on p.oid=original.oid
    where p.oid is null or (to_jsonb(p)-'prosrc') is distinct from original.metadata
  ) then raise exception 'DISPATCH_LOCK_METADATA_CHANGED'; end if;
  for expected in select * from (values
    ('private.dispatch_tick(integer,timestamptz)','d3ef4a0b0b63bcfaffd84547a2ad863b'),
    ('private.expire_lifecycle(timestamptz)','c9e69fe79781da56eb7bb3853e75c798')
  ) as p(signature,body_md5) loop
    if (select md5(prosrc) from pg_proc where oid=to_regprocedure(expected.signature))
       is distinct from expected.body_md5 then
      raise exception 'DISPATCH_LOCK_BODY_MISMATCH' using detail=expected.signature;
    end if;
  end loop;
end $post$;
commit;

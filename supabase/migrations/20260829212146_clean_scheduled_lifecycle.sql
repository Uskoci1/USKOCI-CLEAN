-- 18: planirani zivotni ciklus.
-- Vlasnik odluke: ograniceni claim/queue sa malim batch-evima i FOR UPDATE SKIP LOCKED.
-- Nema globalnog advisory lock-a — on je bio pravi plafon skaliranja, ne velicina talasa.

create table private.dispatch_schedule (
  need_id uuid primary key references public.needs(id) on delete cascade,
  next_run_at timestamptz not null default statement_timestamp(),
  locked_until timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_status text,
  last_reason text,
  updated_at timestamptz not null default statement_timestamp()
);
alter table private.dispatch_schedule enable row level security;

-- Jedini indeks koji claim cita. Predikat ne sme da sadrzi now() (nije immutable),
-- pa je selektivnost u vodecoj koloni.
create index dispatch_schedule_due_idx
  on private.dispatch_schedule (next_run_at, locked_until);

create or replace function private.enqueue_dispatch(p_need_id uuid, p_at timestamptz default statement_timestamp())
returns void language sql security definer set search_path to 'pg_catalog' as $$
  insert into private.dispatch_schedule (need_id, next_run_at)
  values (p_need_id, p_at)
  on conflict (need_id) do update
    set next_run_at = least(private.dispatch_schedule.next_run_at, excluded.next_run_at),
        updated_at = statement_timestamp();
$$;

create or replace function private.enqueue_on_need_change()
returns trigger language plpgsql security definer set search_path to 'pg_catalog' as $$
begin
  if new.status in ('PUBLISHED','SELECTION') then
    if tg_op = 'INSERT'
       or old.status is distinct from new.status
       or old.revision is distinct from new.revision then
      perform private.enqueue_dispatch(new.id, statement_timestamp());
    end if;
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    delete from private.dispatch_schedule where need_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists needs_enqueue_dispatch on public.needs;
create trigger needs_enqueue_dispatch
  after insert or update of status, revision on public.needs
  for each row execute function private.enqueue_on_need_change();

create or replace function private.dispatch_tick(
  p_batch integer default 25,
  p_at timestamptz default statement_timestamp())
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $$
declare
  claimed uuid[]; r record; res jsonb;
  processed integer := 0; sent integer := 0; stopped integer := 0; failed integer := 0;
  reason text; next_at timestamptz;
begin
  if p_batch is null or p_batch < 1 or p_batch > 200 then p_batch := 25; end if;

  -- Claim u jednoj naredbi. SKIP LOCKED znaci da paralelni tick uzima DRUGE redove.
  -- locked_until je zastita od procesa koji padne usred obrade.
  with due as (
    select s.need_id
    from private.dispatch_schedule s
    where s.next_run_at <= p_at
      and (s.locked_until is null or s.locked_until < p_at)
    order by s.next_run_at
    limit p_batch
    for update skip locked
  ), taken as (
    update private.dispatch_schedule s
       set locked_until = p_at + interval '2 minutes',
           updated_at = statement_timestamp()
      from due
     where s.need_id = due.need_id
    returning s.need_id
  )
  select coalesce(array_agg(need_id), '{}'::uuid[]) into claimed from taken;

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

create or replace function private.expire_lifecycle(p_at timestamptz default statement_timestamp())
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $$
declare d integer; rr integer; av integer; ur integer;
begin
  update public.opportunity_deliveries
     set status = 'EXPIRED'
   where status in ('READY','SEEN') and expires_at is not null and expires_at <= p_at;
  get diagnostics d = row_count;

  update public.dispatch_rounds
     set status = 'EXPIRED'
   where status = 'SENT' and deadline_at is not null and deadline_at <= p_at;
  get diagnostics rr = row_count;

  update public.app_profiles
     set available_now = false
   where available_now = true
     and available_now_expires_at is not null and available_now_expires_at <= p_at;
  get diagnostics av = row_count;

  ur := private.expire_urgent(p_at);

  return jsonb_build_object('deliveriesExpired',d,'roundsExpired',rr,
                            'availabilityExpired',av,'urgencyExpired',ur);
end;
$$;

-- Jedan orkestrator. Redosled je bitan: prvo se isteklo zatvori, pa se salje.
create or replace function private.marketplace_tick(
  p_batch integer default 25,
  p_at timestamptz default statement_timestamp())
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $$
declare expiry jsonb; dispatch jsonb; completion jsonb;
begin
  expiry := private.expire_lifecycle(p_at);
  dispatch := private.dispatch_tick(p_batch, p_at);
  completion := to_jsonb(public.rpc_tick_auto_completion());
  return jsonb_build_object('at',p_at,'expiry',expiry,'dispatch',dispatch,
                            'completion',completion,'authoritative',true);
end;
$$;

revoke all on function private.enqueue_dispatch(uuid,timestamptz) from public, anon, authenticated;
revoke all on function private.enqueue_on_need_change() from public, anon, authenticated;
revoke all on function private.dispatch_tick(integer,timestamptz) from public, anon, authenticated;
revoke all on function private.expire_lifecycle(timestamptz) from public, anon, authenticated;
revoke all on function private.marketplace_tick(integer,timestamptz) from public, anon, authenticated;

comment on table private.dispatch_schedule is
  'Red cekanja za isporuku prilika. Claim ide preko FOR UPDATE SKIP LOCKED, pa dva paralelna tick-a uzimaju disjunktne skupove: nijedna Potreba se ne preskace niti obradjuje dvaput.';

-- USKOČI RU-4 — close remaining search after first Dogovor without rewriting Zadatak terms.
-- PROOF CANDIDATE ONLY. No live apply until disposable proof is green.

alter table public.needs
  add column if not exists remaining_search_closed_at timestamptz,
  add column if not exists remaining_search_closed_by_account_id uuid references auth.users(id) on delete set null,
  add column if not exists remaining_search_close_reason text;

alter table public.needs
  drop constraint if exists needs_remaining_search_close_reason_length;
alter table public.needs
  add constraint needs_remaining_search_close_reason_length
  check (remaining_search_close_reason is null or char_length(remaining_search_close_reason) <= 500);

create table if not exists private.remaining_search_close_commands (
  requester_account_id uuid not null references auth.users(id) on delete restrict,
  client_request_id text not null,
  request_hash text not null,
  need_id uuid not null references public.needs(id) on delete restrict,
  need_revision integer not null,
  result jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  primary key (requester_account_id, client_request_id),
  constraint remaining_search_close_request_id_length check (char_length(btrim(client_request_id)) between 8 and 200),
  constraint remaining_search_close_hash_hex check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint remaining_search_close_revision_positive check (need_revision >= 1),
  constraint remaining_search_close_result_object check (jsonb_typeof(result) = 'object')
);

alter table private.remaining_search_close_commands enable row level security;
alter table private.remaining_search_close_commands force row level security;
revoke all on table private.remaining_search_close_commands from public, anon, authenticated, service_role;

create or replace function private.guard_remaining_search_close_fields()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
begin
  if new.remaining_search_closed_at is distinct from old.remaining_search_closed_at
     or new.remaining_search_closed_by_account_id is distinct from old.remaining_search_closed_by_account_id
     or new.remaining_search_close_reason is distinct from old.remaining_search_close_reason then
    if current_setting('uskoci.need_lifecycle', true) <> 'CLOSE_REMAINING_SEARCH' then
      raise exception 'REMAINING_SEARCH_STATE_IS_SERVER_OWNED' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_remaining_search_close_fields() from public, anon, authenticated, service_role;

drop trigger if exists guard_remaining_search_close_fields_trg on public.needs;
create trigger guard_remaining_search_close_fields_trg
before update of remaining_search_closed_at, remaining_search_closed_by_account_id, remaining_search_close_reason
on public.needs
for each row execute function private.guard_remaining_search_close_fields();

create or replace function private.guard_closed_remaining_search_response()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_closed timestamptz;
begin
  if new.status not in ('DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','SELECTED') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.submitted_against_need_revision is not distinct from old.submitted_against_need_revision
     and new.current_version is not distinct from old.current_version then
    return new;
  end if;

  select n.remaining_search_closed_at into v_closed
    from public.needs n
   where n.id = new.need_id;

  if v_closed is not null then
    raise exception 'NEED_REMAINING_SEARCH_CLOSED' using errcode='P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_closed_remaining_search_response() from public, anon, authenticated, service_role;

drop trigger if exists guard_closed_remaining_search_response_trg on public.marketplace_responses;
create trigger guard_closed_remaining_search_response_trg
before insert or update of status, submitted_against_need_revision, current_version
on public.marketplace_responses
for each row execute function private.guard_closed_remaining_search_response();

create or replace function private.guard_closed_remaining_search_delivery()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
begin
  if new.status in ('READY','SEEN')
     and exists (
       select 1 from public.needs n
        where n.id = new.need_id
          and n.remaining_search_closed_at is not null
     ) then
    raise exception 'NEED_REMAINING_SEARCH_CLOSED' using errcode='P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_closed_remaining_search_delivery() from public, anon, authenticated, service_role;

drop trigger if exists guard_closed_remaining_search_delivery_trg on public.opportunity_deliveries;
create trigger guard_closed_remaining_search_delivery_trg
before insert or update of status
on public.opportunity_deliveries
for each row execute function private.guard_closed_remaining_search_delivery();

create or replace function public.rpc_close_remaining_search(
  p_need_id uuid,
  p_expected_revision integer,
  p_client_request_id text,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  v_actor uuid := auth.uid();
  v_request_id text := btrim(coalesce(p_client_request_id,''));
  v_reason text := left(btrim(coalesce(p_reason,'')),500);
  v_request_hash text;
  v_existing private.remaining_search_close_commands%rowtype;
  v_need public.needs%rowtype;
  v_selected_slots integer := 0;
  v_remaining integer := 0;
  v_affected integer := 0;
  v_result jsonb;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_need_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'NEED_ID_REVISION_REQUIRED' using errcode='22023';
  end if;
  if char_length(v_request_id) not between 8 and 200 then
    raise exception 'CLIENT_REQUEST_ID_INVALID' using errcode='22023';
  end if;

  v_request_hash := encode(
    extensions.digest(
      convert_to(jsonb_build_object(
        'needId',p_need_id,
        'expectedRevision',p_expected_revision,
        'reason',v_reason
      )::text,'UTF8'),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || E'\n' || v_request_id, 4410));

  select * into v_existing
    from private.remaining_search_close_commands c
   where c.requester_account_id = v_actor
     and c.client_request_id = v_request_id
   for update;
  if found then
    if v_existing.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023';
    end if;
    return v_existing.result || jsonb_build_object('idempotentReplay',true);
  end if;

  select * into v_need
    from public.needs n
   where n.id = p_need_id
   for update;
  if not found then raise exception 'NEED_NOT_FOUND' using errcode='P0002'; end if;
  if v_need.requester_account_id <> v_actor then raise exception 'NEED_NOT_OWNED' using errcode='42501'; end if;
  if v_need.revision <> p_expected_revision then raise exception 'STALE_REVIEW_REQUIRED' using errcode='40001'; end if;

  if v_need.remaining_search_closed_at is not null then
    return jsonb_build_object(
      'needId',v_need.id,
      'revision',v_need.revision,
      'requiredSlots',v_need.required_slots,
      'remainingSearchClosed',true,
      'closedAt',v_need.remaining_search_closed_at,
      'idempotentReplay',true,
      'authoritative',true
    );
  end if;

  if not exists (select 1 from public.agreements a where a.need_id = v_need.id) then
    raise exception 'REMAINING_SEARCH_CLOSE_REQUIRES_DOGOVOR' using errcode='P0001';
  end if;

  if v_need.status not in ('PUBLISHED','SELECTION','ACTIVE') then
    raise exception 'NEED_REMAINING_SEARCH_NOT_OPEN' using errcode='P0001';
  end if;

  select coalesce(sum(s.covered_slots),0)::integer
    into v_selected_slots
    from public.need_selections s
   where s.need_id = v_need.id
     and s.status = 'SELECTED';

  v_remaining := greatest(v_need.required_slots - v_selected_slots,0);
  if v_selected_slots < 1 then
    raise exception 'REMAINING_SEARCH_CLOSE_REQUIRES_SELECTED_CAPACITY' using errcode='P0001';
  end if;
  if v_remaining < 1 then
    raise exception 'NO_REMAINING_SEARCH' using errcode='P0001';
  end if;

  perform set_config('uskoci.need_lifecycle','CLOSE_REMAINING_SEARCH',true);
  update public.needs
     set remaining_search_closed_at = statement_timestamp(),
         remaining_search_closed_by_account_id = v_actor,
         remaining_search_close_reason = nullif(v_reason,''),
         updated_at = statement_timestamp()
   where id = v_need.id;
  perform set_config('uskoci.need_lifecycle','',true);

  update public.dispatch_rounds
     set status = 'STOPPED', stop_reason = 'REMAINING_SEARCH_CLOSED'
   where need_id = v_need.id
     and status in ('PLANNED','SENT');

  update public.opportunity_deliveries
     set status = 'EXPIRED'
   where need_id = v_need.id
     and status in ('READY','SEEN');

  delete from private.dispatch_schedule where need_id = v_need.id;

  update public.marketplace_responses
     set status = 'EXPIRED'
   where need_id = v_need.id
     and status in ('DRAFT','SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','STALE','STALE_REVIEW_REQUIRED');
  get diagnostics v_affected = row_count;

  perform private.audit_marketplace(
    v_actor,
    'REMAINING_SEARCH_CLOSED',
    'NEED',
    v_need.id,
    v_need.revision,
    jsonb_build_object(
      'requiredSlots',v_need.required_slots,
      'selectedSlots',v_selected_slots,
      'closedRemainingSlots',v_remaining,
      'affectedResponses',v_affected,
      'reasonProvided',v_reason<>''
    )
  );

  select * into v_need from public.needs where id = v_need.id;

  v_result := jsonb_build_object(
    'needId',v_need.id,
    'revision',v_need.revision,
    'status',v_need.status,
    'requiredSlots',v_need.required_slots,
    'selectedSlots',v_selected_slots,
    'closedRemainingSlots',v_remaining,
    'affectedResponses',v_affected,
    'remainingSearchClosed',true,
    'closedAt',v_need.remaining_search_closed_at,
    'idempotentReplay',false,
    'authoritative',true
  );

  insert into private.remaining_search_close_commands(
    requester_account_id,client_request_id,request_hash,need_id,need_revision,result
  ) values (
    v_actor,v_request_id,v_request_hash,v_need.id,v_need.revision,v_result
  );

  return v_result;
end;
$$;

revoke all on function public.rpc_close_remaining_search(uuid,integer,text,text)
  from public, anon, authenticated, service_role;
grant execute on function public.rpc_close_remaining_search(uuid,integer,text,text)
  to authenticated;

comment on function public.rpc_close_remaining_search(uuid,integer,text,text) is
  'RU-4 owner lifecycle action: after first Dogovor, close only uncovered marketplace search. Never rewrites required_slots, revision, Zadatak terms or existing Dogovori.';

do $ru4_close_search_postconditions$
begin
  if has_table_privilege('authenticated','private.remaining_search_close_commands','SELECT') then
    raise exception 'RU4_CLOSE_SEARCH_POSTCONDITION_FAILED: private command ledger exposed';
  end if;
  if not has_function_privilege('authenticated','public.rpc_close_remaining_search(uuid,integer,text,text)','EXECUTE')
     or has_function_privilege('anon','public.rpc_close_remaining_search(uuid,integer,text,text)','EXECUTE')
     or has_function_privilege('service_role','public.rpc_close_remaining_search(uuid,integer,text,text)','EXECUTE') then
    raise exception 'RU4_CLOSE_SEARCH_POSTCONDITION_FAILED: command grants wrong';
  end if;
  if exists (select 1 from private.remaining_search_close_commands) then
    raise exception 'RU4_CLOSE_SEARCH_POSTCONDITION_FAILED: seeded command rows';
  end if;
end
$ru4_close_search_postconditions$;

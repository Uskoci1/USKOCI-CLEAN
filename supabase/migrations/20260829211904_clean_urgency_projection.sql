-- 17d (redosled 17b po planu vlasnika): jedan izvor istine o hitnosti.
-- CARD, DETAIL, lista, mapa i push citaju ISTU funkciju. Projekcija ne zavisi
-- od toga da li je cron stigao da odradi isticanje.
--
-- O-2: allowedCategories ostaje PRAZAN. Kanonski registar kategorija ne postoji
-- u ovom repozitorijumu — postoji samo sest vrednosti iz demo fixtura. Donor ima
-- isti prazan default, tako da ovo nije moja izmisljena politika nego zatecena.

insert into private.marketplace_config (key, value) values
('urgent_activation_policy', jsonb_build_object(
  'enabled', false,
  'policyVersion', 'CLEAN_URGENT_V1',
  'allowedCategories', jsonb_build_array(),
  'maxMinutesToStart', 360,
  'maxLifetimeMinutes', 60,
  'minChoice', 2,
  'chargesFee', false,
  '_note', 'O-2 blokada: bez kanonskog registra kategorija allowlist ostaje prazan i HITNO je ugaseno.'
))
on conflict (key) do nothing;

-- Jedina projekcija hitnosti. Vraca STVARNO stanje, ne upisano.
create or replace function public.fn_need_urgency(p_need_id uuid)
returns jsonb language sql stable security definer set search_path to 'pg_catalog' as $$
  select case when n.id is null then null else jsonb_build_object(
    'needId', n.id,
    'level', case when n.urgent and n.urgent_expires_at > statement_timestamp()
                  then 'HITNO' else 'NORMAL' end,
    'activatedAt', case when n.urgent and n.urgent_expires_at > statement_timestamp()
                        then n.urgent_activated_at end,
    'expiresAt', case when n.urgent and n.urgent_expires_at > statement_timestamp()
                      then n.urgent_expires_at end,
    'policyVersion', n.urgent_policy_version,
    'reasonCodes', case
      when n.urgent and n.urgent_expires_at > statement_timestamp()
        then jsonb_build_array('URGENT_ACTIVE')
      when n.urgent then jsonb_build_array('URGENT_WINDOW_EXPIRED')
      else jsonb_build_array('NOT_URGENT') end,
    'authoritative', true)
  end
  from public.needs n where n.id = p_need_id;
$$;

comment on function public.fn_need_urgency(uuid) is
  'Jedini vlasnik hitnosti za CARD/DETAIL/listu/mapu/push. Istekao prozor se cita kao NORMAL i pre nego sto cron obrise zastavicu.';

create or replace function private.urgent_activation_decision(
  nid uuid, actor uuid, at_time timestamptz default statement_timestamp())
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $$
declare
  n public.needs; cfg jsonb; reasons text[] := '{}';
  allowed_categories text[] := '{}';
  max_to_start integer; max_lifetime integer; min_choice integer;
  selected integer := 0; candidate_expiry timestamptz;
begin
  select * into n from public.needs where id = nid;
  if not found then return jsonb_build_object('allowed',false,'reasonCodes',jsonb_build_array('NEED_NOT_FOUND')); end if;
  if actor is null or n.requester_account_id <> actor then
    return jsonb_build_object('allowed',false,'reasonCodes',jsonb_build_array('FORBIDDEN'));
  end if;

  select value into cfg from private.marketplace_config where key = 'urgent_activation_policy';
  if cfg is null or not coalesce((cfg->>'enabled')::boolean,false) then
    reasons := array_append(reasons,'URGENT_POLICY_DISABLED');
  end if;
  if nullif(btrim(coalesce(cfg->>'policyVersion','')),'') is null then
    reasons := array_append(reasons,'URGENT_POLICY_VERSION_MISSING');
  end if;

  select coalesce(array_agg(lower(btrim(value))),'{}'::text[]) into allowed_categories
    from jsonb_array_elements_text(coalesce(cfg->'allowedCategories','[]'::jsonb)) x(value)
   where btrim(value) <> '';
  if cardinality(allowed_categories) = 0 then
    reasons := array_append(reasons,'URGENT_CATEGORIES_NOT_ADMITTED');
  elsif not lower(btrim(coalesce(n.category,''))) = any(allowed_categories) then
    reasons := array_append(reasons,'URGENT_CATEGORY_NOT_ADMITTED');
  end if;

  max_to_start := coalesce(nullif(cfg->>'maxMinutesToStart','')::integer, 360);
  max_lifetime := coalesce(nullif(cfg->>'maxLifetimeMinutes','')::integer, 60);
  min_choice   := coalesce(nullif(cfg->>'minChoice','')::integer, 2);
  if max_to_start < 15 or max_to_start > 1440
     or max_lifetime < 5 or max_lifetime > 240
     or min_choice < 2 or min_choice > 10 then
    reasons := array_append(reasons,'URGENT_POLICY_BOUNDS_INVALID');
  end if;

  if n.status not in ('PUBLISHED','SELECTION') then reasons := array_append(reasons,'NEED_NOT_OPEN'); end if;
  -- O-2: HITNO postoji samo za fizicke Potrebe.
  if n.execution_location_mode = 'REMOTE' then reasons := array_append(reasons,'URGENT_PHYSICAL_TASK_REQUIRED'); end if;
  if n.response_deadline is not null and n.response_deadline <= at_time then
    reasons := array_append(reasons,'NEED_RESPONSE_WINDOW_EXPIRED');
  end if;

  select coalesce(sum(s.covered_slots),0)::integer into selected
    from public.need_selections s where s.need_id = n.id and s.status = 'SELECTED';
  if selected >= n.required_slots then reasons := array_append(reasons,'NEED_ALREADY_FILLED'); end if;

  if n.starts_at is not null then
    if n.starts_at < at_time - interval '15 minutes' then
      reasons := array_append(reasons,'URGENT_START_ALREADY_PASSED');
    elsif n.starts_at > at_time + make_interval(mins => greatest(15, max_to_start)) then
      reasons := array_append(reasons,'URGENT_TOO_EARLY');
    end if;
  elsif n.schedule_kind <> 'TODAY_FLEXIBLE' then
    reasons := array_append(reasons,'URGENT_CURRENT_TIME_WINDOW_REQUIRED');
  end if;

  candidate_expiry := at_time + make_interval(mins => greatest(5, max_lifetime));
  if n.response_deadline is not null then candidate_expiry := least(candidate_expiry, n.response_deadline); end if;
  if n.starts_at is not null then
    candidate_expiry := least(candidate_expiry, greatest(at_time + interval '5 minutes', n.starts_at));
  end if;

  return jsonb_build_object(
    'allowed', cardinality(reasons) = 0,
    'alreadyUrgent', n.urgent,
    'reasonCodes', to_jsonb(reasons),
    'policyVersion', cfg->>'policyVersion',
    'maxMinutesToStart', max_to_start,
    'maxLifetimeMinutes', max_lifetime,
    'minChoice', min_choice,
    'chargesFee', coalesce((cfg->>'chargesFee')::boolean, false),
    'candidateExpiresAt', candidate_expiry,
    'authoritative', true);
end;
$$;

-- Anti-bypass. Ni INSERT ni obican UPDATE ne mogu da upale HITNO.
create or replace function private.guard_urgent_need()
returns trigger language plpgsql set search_path to 'pg_catalog' as $$
declare token text := current_setting('uskoci.urgent_activation_need', true);
begin
  if tg_op = 'INSERT' and new.urgent then
    raise exception using errcode='22023', message='URGENT_ACTIVATION_RPC_REQUIRED';
  end if;
  if tg_op = 'UPDATE' and not coalesce(old.urgent,false) and new.urgent then
    if token is distinct from new.id::text then
      raise exception using errcode='22023', message='URGENT_ACTIVATION_RPC_REQUIRED';
    end if;
    if new.urgent_activated_at is null or new.urgent_expires_at is null
       or new.urgent_expires_at <= new.urgent_activated_at
       or nullif(btrim(coalesce(new.urgent_policy_version,'')),'') is null then
      raise exception using errcode='22023', message='URGENT_ACTIVATION_METADATA_INVALID';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists needs_guard_urgent on public.needs;
create trigger needs_guard_urgent
  before insert or update of urgent on public.needs
  for each row execute function private.guard_urgent_need();

create or replace function public.rpc_urgent_activation_preview(p_need_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;
  return private.urgent_activation_decision(p_need_id, u, statement_timestamp());
end;
$$;

create or replace function public.rpc_activate_urgent(p_need_id uuid, p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $$
declare
  u uuid := auth.uid(); n public.needs; decision jsonb;
  expiry timestamptz; policy_version text; dispatch jsonb;
begin
  if u is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;
  select * into n from public.needs where id = p_need_id for update;
  if not found then raise exception using errcode='P0002', message='NEED_NOT_FOUND'; end if;
  if n.requester_account_id <> u then raise exception using errcode='42501', message='FORBIDDEN'; end if;
  if n.revision <> p_expected_revision then
    raise exception using errcode='40001', message='NEED_VERSION_MISMATCH';
  end if;

  if n.urgent and n.urgent_expires_at > statement_timestamp() then
    return jsonb_build_object('needId',n.id,'revision',n.revision,'urgent',true,
      'urgentExpiresAt',n.urgent_expires_at,'idempotentReplay',true,'authoritative',true);
  end if;

  decision := private.urgent_activation_decision(n.id, u, statement_timestamp());
  if not coalesce((decision->>'allowed')::boolean,false) then
    raise exception using errcode='55000', message='URGENT_ACTIVATION_NOT_ALLOWED',
      detail = (decision->'reasonCodes')::text;
  end if;
  expiry := (decision->>'candidateExpiresAt')::timestamptz;
  policy_version := decision->>'policyVersion';

  perform set_config('uskoci.urgent_activation_need', n.id::text, true);
  update public.needs set urgent = true,
      urgent_activated_at = statement_timestamp(),
      urgent_expires_at = expiry,
      urgent_policy_version = policy_version
   where id = n.id returning * into n;

  update public.dispatch_rounds set status='STOPPED', stop_reason='URGENT_ACTIVATED'
   where need_id = n.id and need_revision = n.revision and status in ('PLANNED','SENT');

  dispatch := private.dispatch_next_wave(n.id);

  return jsonb_build_object('needId',n.id,'revision',n.revision,'urgent',true,
    'urgentExpiresAt',expiry,'policyVersion',policy_version,'dispatch',dispatch,
    'idempotentReplay',false,'authoritative',true);
end;
$$;

create or replace function private.expire_urgent(at_time timestamptz default statement_timestamp())
returns integer language plpgsql security definer set search_path to 'pg_catalog' as $$
declare r record; expired_count integer := 0;
begin
  for r in
    select id, revision from public.needs
     where urgent = true and urgent_expires_at is not null and urgent_expires_at <= at_time
     for update skip locked
  loop
    update public.needs set urgent = false where id = r.id;
    update public.dispatch_rounds set status='STOPPED', stop_reason='URGENT_EXPIRED'
     where need_id = r.id and need_revision = r.revision
       and urgency = 'URGENT' and status in ('PLANNED','SENT');
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;

revoke all on function private.urgent_activation_decision(uuid,uuid,timestamptz) from public, anon, authenticated;
revoke all on function private.guard_urgent_need() from public, anon, authenticated;
revoke all on function private.expire_urgent(timestamptz) from public, anon, authenticated;
revoke all on function public.fn_need_urgency(uuid) from public, anon;
revoke all on function public.rpc_urgent_activation_preview(uuid) from public, anon;
revoke all on function public.rpc_activate_urgent(uuid,integer) from public, anon;
grant execute on function public.fn_need_urgency(uuid) to authenticated;
grant execute on function public.rpc_urgent_activation_preview(uuid) to authenticated;
grant execute on function public.rpc_activate_urgent(uuid,integer) to authenticated;

-- Nalazi A + D + E, sva tri potvrdjena protiv zive baze.
--
-- A: politika needs_owner_all[ALL] daje Naruciocu pun direktan write. Mogao je
--    sam da postavi status='PUBLISHED' i zaobidje svaki lifecycle.
-- D: materijalna polja su se menjala bez podizanja revizije, pa su stare prijave
--    ostajale "vazece" za izmenjenu Potrebu.
-- E: requester_profile_id nije bio vezan za requester_account_id — moglo se
--    upisati tudji profil.
--
-- Resenje je TRIGGER, ne suzavanje RLS-a: trigger vazi za SVAKI put pisanja,
-- pa ne moze da se zaobidje ni direktnim UPDATE-om ni buducim RPC-om.

create or replace function private.guard_need_write()
returns trigger language plpgsql security definer set search_path to 'pg_catalog' as $$
declare
  token text := current_setting('uskoci.need_lifecycle', true);
  materijalno boolean;
begin
  -- (E) Profil mora pripadati nalogu i biti REQUESTER profil.
  if not exists (select 1 from public.app_profiles p
                 where p.id = new.requester_profile_id
                   and p.account_id = new.requester_account_id
                   and p.kind = 'REQUESTER') then
    raise exception using errcode='42501', message='PROFILE_NOT_OWNED_BY_ACCOUNT';
  end if;

  if tg_op = 'INSERT' then
    -- (A) Potreba uvek nastaje kao nacrt. Objavljivanje ide kroz RPC.
    if new.status <> 'DRAFT' and token is distinct from 'PUBLISH' then
      raise exception using errcode='22023', message='NEED_MUST_START_AS_DRAFT';
    end if;
    return new;
  end if;

  -- (E) Vlasnistvo se ne prepisuje.
  if new.requester_account_id <> old.requester_account_id then
    raise exception using errcode='42501', message='NEED_OWNER_IMMUTABLE';
  end if;

  -- (A) Prelazi statusa idu kroz autoritativni put, ne direktnim UPDATE-om.
  if new.status is distinct from old.status and token is null then
    raise exception using errcode='22023', message='NEED_STATUS_TRANSITION_REQUIRES_RPC';
  end if;

  -- (D) Materijalna izmena OBAVEZNO podize reviziju.
  materijalno :=
       new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.category is distinct from old.category
    or new.required_slots is distinct from old.required_slots
    or new.mode is distinct from old.mode
    or new.requester_price_rsd is distinct from old.requester_price_rsd
    or new.required_skills is distinct from old.required_skills
    or new.required_tools is distinct from old.required_tools
    or new.required_vehicles is distinct from old.required_vehicles
    or new.required_licenses is distinct from old.required_licenses
    or new.minimum_experience_years is distinct from old.minimum_experience_years
    or new.verified_identity_required is distinct from old.verified_identity_required
    or new.schedule_kind is distinct from old.schedule_kind
    or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.execution_location_mode is distinct from old.execution_location_mode
    or new.approximate_lat is distinct from old.approximate_lat
    or new.approximate_lng is distinct from old.approximate_lng;

  if materijalno then
    if old.status in ('PUBLISHED','SELECTION') then
      -- Revizija se podize sama; bez toga bi stare prijave ostale "vazece".
      new.revision := old.revision + 1;
    end if;
  elsif new.revision is distinct from old.revision then
    raise exception using errcode='22023', message='REVISION_BUMP_WITHOUT_MATERIAL_CHANGE';
  end if;

  return new;
end;
$$;

-- Posle podizanja revizije stare prijave postaju STALE, a prilike isticu.
create or replace function private.after_need_revision()
returns trigger language plpgsql security definer set search_path to 'pg_catalog' as $$
begin
  if new.revision > old.revision then
    update public.marketplace_responses
       set status = 'STALE'
     where need_id = new.id
       and submitted_against_need_revision = old.revision
       and status in ('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED');

    update public.opportunity_deliveries
       set status = 'EXPIRED'
     where need_id = new.id and need_revision = old.revision
       and status in ('READY','SEEN');

    update public.dispatch_rounds
       set status = 'STOPPED', stop_reason = 'NEED_REVISED'
     where need_id = new.id and need_revision = old.revision
       and status in ('PLANNED','SENT');

    if new.status in ('PUBLISHED','SELECTION') then
      perform private.enqueue_dispatch(new.id, statement_timestamp());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists needs_guard_write on public.needs;
create trigger needs_guard_write
  before insert or update on public.needs
  for each row execute function private.guard_need_write();

drop trigger if exists needs_after_revision on public.needs;
create trigger needs_after_revision
  after update on public.needs
  for each row execute function private.after_need_revision();

-- Autoritativno objavljivanje. Jedini put iz DRAFT u PUBLISHED.
create or replace function public.rpc_publish_need(p_need_id uuid, p_response_deadline timestamptz default null)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $$
declare u uuid := auth.uid(); n public.needs;
begin
  if u is null then raise exception using errcode='42501', message='AUTH_REQUIRED'; end if;
  select * into n from public.needs where id = p_need_id for update;
  if not found then raise exception using errcode='P0002', message='NEED_NOT_FOUND'; end if;
  if n.requester_account_id <> u then raise exception using errcode='42501', message='FORBIDDEN'; end if;
  if n.status = 'PUBLISHED' then
    return jsonb_build_object('needId',n.id,'status',n.status,'idempotentReplay',true,'authoritative',true);
  end if;
  if n.status <> 'DRAFT' then
    raise exception using errcode='22023', message='NEED_NOT_DRAFT';
  end if;
  if p_response_deadline is not null and p_response_deadline <= statement_timestamp() then
    raise exception using errcode='22023', message='DEADLINE_IN_PAST';
  end if;

  perform set_config('uskoci.need_lifecycle','PUBLISH',true);
  update public.needs
     set status = 'PUBLISHED', published_at = statement_timestamp(),
         response_deadline = coalesce(p_response_deadline, response_deadline)
   where id = n.id returning * into n;

  return jsonb_build_object('needId',n.id,'status',n.status,'revision',n.revision,
    'responseDeadline',n.response_deadline,'idempotentReplay',false,'authoritative',true);
end;
$$;

revoke all on function private.guard_need_write() from public, anon, authenticated;
revoke all on function private.after_need_revision() from public, anon, authenticated;
revoke all on function public.rpc_publish_need(uuid,timestamptz) from public, anon;
grant execute on function public.rpc_publish_need(uuid,timestamptz) to authenticated;

comment on function private.guard_need_write() is
  'A+D+E: profil mora pripadati nalogu, Potreba nastaje kao DRAFT, prelaz statusa trazi autoritativni put, materijalna izmena sama podize reviziju.';

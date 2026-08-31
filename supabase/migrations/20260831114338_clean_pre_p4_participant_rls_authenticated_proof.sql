-- PRE-P4 Repair 2 final execution and exposure contract.
--
-- Keep the SECURITY DEFINER predicate outside every PostgREST-exposed schema,
-- bind it only to auth.uid(), and prove the effective authenticated RLS matrix
-- transactionally without creating or changing business rows.

create schema if not exists rls_private authorization postgres;

revoke all on schema rls_private from public, anon, authenticated;
grant usage on schema rls_private to authenticated;

create or replace function rls_private.need_participant_can_read(p_need_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog'
as $function$
  select auth.uid() is not null
     and (
       exists (
         select 1
           from public.agreements a
          where a.need_id = p_need_id
            and a.worker_account_id = auth.uid()
            and a.status in ('CONFIRMED', 'COMPLETED')
       )
       or exists (
         select 1
           from public.need_selections s
          where s.need_id = p_need_id
            and s.worker_account_id = auth.uid()
            and s.status = 'SELECTED'
       )
     );
$function$;

revoke all on function rls_private.need_participant_can_read(uuid)
  from public, anon, authenticated;
grant execute on function rls_private.need_participant_can_read(uuid)
  to authenticated;

drop policy if exists needs_participant_read on public.needs;

create policy needs_participant_read on public.needs
  for select to authenticated
  using (rls_private.need_participant_can_read(public.needs.id));

comment on function rls_private.need_participant_can_read(uuid) is
  'Non-exposed, caller-bound PRE-P4 RLS predicate. It accepts no account id and checks only whether auth.uid() participates in the supplied Need.';

comment on policy needs_participant_read on public.needs is
  'Allows only the selected or confirmed/completed Agreement worker to read the explicitly correlated outer public.needs.id.';

drop function public.fn_need_participant_can_read(uuid);

create index if not exists agreements_need_worker_participant_idx
  on public.agreements (need_id, worker_account_id)
  where status in ('CONFIRMED', 'COMPLETED');

create index if not exists need_selections_need_worker_selected_idx
  on public.need_selections (need_id, worker_account_id)
  where status = 'SELECTED';

do $proof_seed$
declare
  v_need_id uuid;
  v_requester_id uuid;
  v_worker_id uuid;
  v_unrelated_id uuid;
  v_discovery_count integer;
begin
  select n.id, n.requester_account_id, a.worker_account_id
    into v_need_id, v_requester_id, v_worker_id
    from public.needs n
    join public.agreements a on a.need_id = n.id
   where n.status = 'ACTIVE'
     and a.status in ('CONFIRMED', 'COMPLETED')
   order by n.id
   limit 1;

  loop
    v_unrelated_id := gen_random_uuid();
    exit when not exists (
      select 1 from auth.users u where u.id = v_unrelated_id
    )
    and not exists (
      select 1 from public.needs n where n.requester_account_id = v_unrelated_id
    )
    and not exists (
      select 1 from public.agreements a where a.worker_account_id = v_unrelated_id
    )
    and not exists (
      select 1 from public.need_selections s where s.worker_account_id = v_unrelated_id
    );
  end loop;

  select count(*)
    into v_discovery_count
    from public.needs n
   where n.status in ('PUBLISHED', 'SELECTION');

  perform set_config(
    'uskoci.pre_p4_rls_need_id',
    coalesce(v_need_id::text, ''),
    true
  );
  perform set_config(
    'uskoci.pre_p4_rls_requester_id',
    coalesce(v_requester_id::text, ''),
    true
  );
  perform set_config(
    'uskoci.pre_p4_rls_worker_id',
    coalesce(v_worker_id::text, ''),
    true
  );
  perform set_config(
    'uskoci.pre_p4_rls_unrelated_id',
    v_unrelated_id::text,
    true
  );
  perform set_config(
    'uskoci.pre_p4_rls_discovery_count',
    v_discovery_count::text,
    true
  );
end
$proof_seed$;

set local role authenticated;

do $authenticated_rls_proof$
declare
  v_need_id uuid :=
    nullif(current_setting('uskoci.pre_p4_rls_need_id', true), '')::uuid;
  v_requester_id uuid :=
    nullif(current_setting('uskoci.pre_p4_rls_requester_id', true), '')::uuid;
  v_worker_id uuid :=
    nullif(current_setting('uskoci.pre_p4_rls_worker_id', true), '')::uuid;
  v_unrelated_id uuid :=
    nullif(current_setting('uskoci.pre_p4_rls_unrelated_id', true), '')::uuid;
  v_expected_discovery integer :=
    coalesce(
      nullif(current_setting('uskoci.pre_p4_rls_discovery_count', true), '')::integer,
      0
    );
  v_actual integer;
begin
  if v_need_id is not null then
    perform set_config('request.jwt.claim.sub', v_worker_id::text, true);
    perform set_config('request.jwt.claims', '', true);

    select count(*) into v_actual
      from public.needs n
     where n.id = v_need_id;

    if v_actual <> 1 then
      raise exception
        'PRE-P4 RLS proof failed: participant worker expected 1 row, got %',
        v_actual;
    end if;

    perform set_config('request.jwt.claim.sub', v_requester_id::text, true);

    select count(*) into v_actual
      from public.needs n
     where n.id = v_need_id;

    if v_actual <> 1 then
      raise exception
        'PRE-P4 RLS proof failed: requester expected 1 owned row, got %',
        v_actual;
    end if;
  end if;

  perform set_config('request.jwt.claim.sub', v_unrelated_id::text, true);

  select count(*) into v_actual
    from public.needs n
   where n.status = 'ACTIVE';

  if v_actual <> 0 then
    raise exception
      'PRE-P4 RLS proof failed: unrelated subject saw % ACTIVE rows',
      v_actual;
  end if;

  select count(*) into v_actual
    from public.needs n
   where n.status in ('PUBLISHED', 'SELECTION');

  if v_actual <> v_expected_discovery then
    raise exception
      'PRE-P4 RLS proof failed: discovery expected %, got %',
      v_expected_discovery,
      v_actual;
  end if;
end
$authenticated_rls_proof$;

reset role;

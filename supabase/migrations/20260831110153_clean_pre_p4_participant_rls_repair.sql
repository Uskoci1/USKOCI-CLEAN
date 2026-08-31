-- PRE-P4 Repair 2: restore participant visibility without ambiguous outer-column binding.
--
-- Invariant:
--   * requesters retain owner visibility through needs_owner_select;
--   * PUBLISHED/SELECTION discovery remains controlled by needs_public_discovery;
--   * only a currently selected worker or a worker party to a confirmed/completed
--     Agreement receives participant visibility for non-discoverable Need states;
--   * cancelled/superseded participation does not widen access.

create or replace function private.need_participant_can_read(p_need_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog'
as $$
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
$$;

revoke all on function private.need_participant_can_read(uuid)
  from public, anon, authenticated;

drop policy if exists needs_participant_read on public.needs;

create policy needs_participant_read on public.needs
  for select to authenticated
  using (private.need_participant_can_read(public.needs.id));

comment on function private.need_participant_can_read(uuid) is
  'PRE-P4 participant predicate. SECURITY DEFINER prevents joined-table RLS from erasing a valid worker relationship; auth.uid() is the only subject.';

comment on policy needs_participant_read on public.needs is
  'Allows a selected or Agreement worker to read the correlated outer Need. The outer reference is explicitly public.needs.id.';


-- 1. FIX PARTICIPANT VISIBILITY OF NEEDS
-- Workers lose access to Needs they are participating in once status changes to SELECTION or ACTIVE.
create policy needs_participant_read on public.needs
  for select to authenticated
  using (
    exists (select 1 from public.agreements a where a.need_id = id and a.worker_account_id = auth.uid())
    or exists (select 1 from public.need_selections s where s.need_id = id and s.worker_account_id = auth.uid())
  );

-- 2. FIX PARTIALLY-FILLED NEED DISCOVERY
-- Needs in SELECTION state have remaining capacity and must be discoverable.
drop policy if exists needs_published_read on public.needs;
create policy needs_public_discovery on public.needs
  for select to authenticated
  using (status in ('PUBLISHED', 'SELECTION'));

-- 3. EXPOSE CANONICAL COVERAGE TO POSTGREST
-- Create a computed column function so the client can query 'covered_slots' without breaking RLS on need_selections.
create or replace function public.covered_slots(n public.needs)
returns integer language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(sum(s.covered_slots), 0)::integer
    from public.need_selections s
   where s.need_id = n.id and s.status = 'SELECTED';
$$;

revoke all on function public.covered_slots(public.needs) from public, anon;
grant execute on function public.covered_slots(public.needs) to authenticated;


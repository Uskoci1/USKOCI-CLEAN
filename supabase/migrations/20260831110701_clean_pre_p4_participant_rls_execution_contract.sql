-- PRE-P4 Repair 2 execution contract.
--
-- The preceding private helper was intentionally non-callable, but an RLS policy
-- caller also needs function/schema execution rights. Keep the predicate caller-bound
-- and expose only its boolean result to authenticated users.

create or replace function public.fn_need_participant_can_read(p_need_id uuid)
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

revoke all on function public.fn_need_participant_can_read(uuid)
  from public, anon;
grant execute on function public.fn_need_participant_can_read(uuid)
  to authenticated;

drop policy if exists needs_participant_read on public.needs;

create policy needs_participant_read on public.needs
  for select to authenticated
  using (public.fn_need_participant_can_read(public.needs.id));

comment on function public.fn_need_participant_can_read(uuid) is
  'Caller-bound PRE-P4 RLS predicate. It accepts no account id and returns only whether auth.uid() participates in the supplied Need.';

comment on policy needs_participant_read on public.needs is
  'Allows only the selected or confirmed/completed Agreement worker to read the explicitly correlated outer public.needs.id.';

drop function private.need_participant_can_read(uuid);

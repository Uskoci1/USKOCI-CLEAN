-- Dva stvarna nalaza Supabase advisora iz migracije 15/17d.

-- 1) Tri funkcije iz 15 nisu imale fiksiran search_path. Nijedna nije SECURITY DEFINER
--    i nijedna ne dodiruje nista van pg_catalog, pa je pinovanje bezbedno.
alter function private.set_updated_at() set search_path to 'pg_catalog';
alter function private.category_of_event(text) set search_path to 'pg_catalog';
alter function private.in_quiet_hours(public.notification_preferences) set search_path to 'pg_catalog';

-- 2) fn_need_urgency je bio SECURITY DEFINER i time zaobilazio RLS na needs:
--    bilo koji prijavljen korisnik je mogao da ispituje postojanje proizvoljnog UUID-a.
--    Kao INVOKER vazi politika needs_published_read / needs_owner_all, pa Potreba
--    koju pozivalac ne sme da vidi vraca null umesto projekcije.
create or replace function public.fn_need_urgency(p_need_id uuid)
returns jsonb language sql stable security invoker set search_path to 'pg_catalog' as $$
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

revoke all on function public.fn_need_urgency(uuid) from public, anon;
grant execute on function public.fn_need_urgency(uuid) to authenticated;

comment on function public.fn_need_urgency(uuid) is
  'Jedini vlasnik hitnosti za CARD/DETAIL/listu/mapu/push. SECURITY INVOKER: RLS na needs vazi, nema ispitivanja tudjih UUID-a. Istekao prozor se cita kao NORMAL i pre nego sto cron obrise zastavicu.';

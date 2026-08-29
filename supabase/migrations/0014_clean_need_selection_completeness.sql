-- G4 + G9: need_selections je bio nepotpun u odnosu na donor, a needs nema rok.
--
-- Donor drzi pokrivenost preko need_selections.status='SELECTED'. Moj
-- fn_need_covered_slots je brojao preko agreements — sto radi, ali gubi
-- alokacije koje postoje pre Dogovora i lomi se kod BIDDING moda.
-- Vracam donorov izvor istine.
--
-- selection_mode je kanonski koncept koji clean backend nije poznavao:
-- bez njega nema razlike izmedju "Narucilac bira" i "prvi koji prihvati".

alter table public.needs
  add column if not exists response_deadline timestamptz;

comment on column public.needs.response_deadline is
  'G9: rok za prijave. Tick po njemu gasi Potrebu u EXPIRED.';

alter table public.need_selections
  add column if not exists response_id uuid references public.marketplace_responses(id) on delete restrict,
  add column if not exists worker_account_id uuid references auth.users(id) on delete restrict,
  add column if not exists worker_profile_id uuid references public.app_profiles(id) on delete restrict,
  add column if not exists selection_mode text
    check (selection_mode in ('AUTO_FILL','REQUESTER_SELECTS','BIDDING')),
  add column if not exists status text not null default 'SELECTED'
    check (status in ('SELECTED','CANCELLED','SUPERSEDED')),
  add column if not exists updated_at timestamptz not null default statement_timestamp();

-- Jedna ziva selekcija po prijavi.
create unique index if not exists need_selections_one_live_per_response
  on public.need_selections (response_id)
  where status = 'SELECTED';

create index if not exists need_selections_need_status_idx
  on public.need_selections (need_id, status);

comment on column public.need_selections.selection_mode is
  'Kanon: AUTO_FILL | REQUESTER_SELECTS | BIDDING. Bez toga nema razlike izmedju biranja i prvog koji prihvati.';

-- Pokrivenost se sada racuna iz need_selections, kako donor i radi.
create or replace function public.fn_need_covered_slots(p_need_id uuid)
returns integer language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select coalesce(sum(s.covered_slots), 0)::integer
    from public.need_selections s
   where s.need_id = p_need_id
     and s.status = 'SELECTED';
$fn$;

revoke all on function public.fn_need_covered_slots(uuid) from public, anon, authenticated;

-- 05 — dozvole za kontakt i lokaciju
--
-- OVO JE REBUILD, NE KEEP.
--
-- Donorov private_access_grants ima JEDAN grant po (agreement, version) sa
-- status LOCKED/GRANTED/REVOKED. To je "combined reveal" — jedan prekidač
-- otkriva sve. M10 ga izričito ukida, a kanon traži:
--
--   * telefon i tačna lokacija su ODVOJENE dozvole;
--   * deljenje je USMERENO — to što sam ja podelio svoj broj
--     ne znači da vidim njihov;
--   * email nije standardno deljeno polje i ovde ga namerno nema.
--
-- Donorova tabela se NE briše. Ovde se prosto ne prenosi.

create table if not exists public.access_grants (
  id uuid primary key default extensions.gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,

  -- Šta se deli. Odvojeno po kanalu, ne jednim prekidačem.
  channel text not null check (channel in ('PHONE','EXACT_LOCATION')),

  -- Ko deli i kome. Bez ovoga se ne razlikuju smerovi.
  granted_by_account_id uuid not null references auth.users(id) on delete restrict,
  granted_to_account_id uuid not null references auth.users(id) on delete restrict,

  status text not null default 'GRANTED' check (status in ('GRANTED','REVOKED')),
  granted_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,

  check (granted_by_account_id <> granted_to_account_id),
  check (status <> 'REVOKED' or revoked_at is not null),

  -- Jedan živ grant po kanalu i smeru.
  unique (agreement_id, channel, granted_by_account_id, granted_to_account_id)
);

create index if not exists access_grants_lookup_idx
  on public.access_grants (agreement_id, granted_to_account_id, channel)
  where status = 'GRANTED';

comment on table public.access_grants is
  'Usmerene dozvole po kanalu. Zamenjuje donorov combined reveal (M10 RETIRE).';

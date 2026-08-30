-- REBUILD, ne KEEP.
-- Donorov private_access_grants ima JEDAN grant po (agreement, version) —
-- combined reveal koji M10 ukida. Kanon trazi odvojene i USMERENE dozvole.
-- Donorova tabela se ne brise; ovde se prosto ne prenosi.

create table if not exists public.access_grants (
  id uuid primary key default extensions.gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  channel text not null check (channel in ('PHONE','EXACT_LOCATION')),
  granted_by_account_id uuid not null references auth.users(id) on delete restrict,
  granted_to_account_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'GRANTED' check (status in ('GRANTED','REVOKED')),
  granted_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  check (granted_by_account_id <> granted_to_account_id),
  check (status <> 'REVOKED' or revoked_at is not null),
  unique (agreement_id, channel, granted_by_account_id, granted_to_account_id)
);

create index if not exists access_grants_lookup_idx
  on public.access_grants (agreement_id, granted_to_account_id, channel)
  where status = 'GRANTED';

comment on table public.access_grants is
  'Usmerene dozvole po kanalu. Zamenjuje donorov combined reveal (M10 RETIRE). To sto sam ja podelio svoj broj ne znaci da vidim njihov.';

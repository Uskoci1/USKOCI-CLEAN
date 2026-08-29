-- G14: donor ima r24_set_updated_at() na 8 tabela; clean backend nije imao nijedan.
-- Bez ovoga se updated_at odrzava samo rucno u RPC-evima, pa svaki direktan
-- UPDATE ostavlja lazan timestamp.

create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$fn$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

do $do$
declare
  t text;
  tabele text[] := array[
    'needs','need_sensitive','need_selections',
    'marketplace_responses','agreements','agreement_execution'
  ];
begin
  foreach t in array tabele loop
    execute format(
      'drop trigger if exists %I on public.%I', t || '_set_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function private.set_updated_at()',
      t || '_set_updated_at', t);
  end loop;
end;
$do$;

comment on function private.set_updated_at is
  'G14: odrzava updated_at na svakom UPDATE-u, ne samo kroz RPC.';

-- Ispravka: politika je pozivala private.grant_* koje su revoke-ovane od authenticated.
-- RLS se izvrsava kao POZIVALAC, pa bi otvaranje tih funkcija napravilo oracle
-- „da li je nalog X strana u Dogovoru Y" nad proizvoljnim UUID-em.
--
-- Resenje: logika se ugradjuje u samu politiku. Time prirodno vazi i RLS na
-- agreements — izdavalac mora da VIDI Dogovor da bi izdao dozvolu.
--
-- Pravilo vlasnistva nad podatkom:
--   Narucilac  -> sme PHONE i EXACT_LOCATION (adresa je njegova)
--   Izvrsilac  -> sme SAMO PHONE (svoj broj)
-- Primalac je uvek DRUGA strana istog Dogovora.

drop policy if exists access_grants_grant on public.access_grants;
create policy access_grants_grant on public.access_grants
  for insert to authenticated
  with check (
    granted_by_account_id = auth.uid()
    and granted_by_account_id <> granted_to_account_id
    and exists (
      select 1 from public.agreements a
      where a.id = agreement_id
        and (
          (a.requester_account_id = auth.uid()
             and a.worker_account_id = granted_to_account_id
             and channel in ('PHONE','EXACT_LOCATION'))
          or
          (a.worker_account_id = auth.uid()
             and a.requester_account_id = granted_to_account_id
             and channel = 'PHONE')
        )
    )
  );

comment on policy access_grants_grant on public.access_grants is
  'Dozvolu izdaje SAMO vlasnik podatka i SAMO drugoj strani istog Dogovora. Tacnu lokaciju deli iskljucivo Narucilac. Trece lice je nemoguce.';

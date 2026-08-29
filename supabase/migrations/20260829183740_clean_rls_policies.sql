-- Podrazumevano NISTA nije vidljivo. Svaka vidljivost je izricita.
-- Ovo je jedino mesto gde se privatnost stvarno sprovodi ΓÇö ekran nije zastita.

alter table public.needs                         enable row level security;
alter table public.need_sensitive                enable row level security;
alter table public.need_selections               enable row level security;
alter table public.marketplace_responses         enable row level security;
alter table public.marketplace_response_versions enable row level security;
alter table public.agreements                    enable row level security;
alter table public.agreement_versions            enable row level security;
alter table public.agreement_messages            enable row level security;
alter table public.agreement_execution           enable row level security;
alter table public.access_grants                 enable row level security;
alter table public.ai_conversations              enable row level security;
alter table public.ai_structured_facts           enable row level security;
alter table public.ai_action_proposals           enable row level security;

create policy needs_owner_all on public.needs
  for all to authenticated
  using (requester_account_id = auth.uid())
  with check (requester_account_id = auth.uid());

create policy needs_published_read on public.needs
  for select to authenticated
  using (status = 'PUBLISHED');

create policy need_sensitive_owner on public.need_sensitive
  for all to authenticated
  using (exists (select 1 from public.needs n where n.id = need_id and n.requester_account_id = auth.uid()))
  with check (exists (select 1 from public.needs n where n.id = need_id and n.requester_account_id = auth.uid()));

create policy need_sensitive_granted_read on public.need_sensitive
  for select to authenticated
  using (exists (
    select 1 from public.agreements a
      join public.access_grants g on g.agreement_id = a.id
     where a.need_id = need_sensitive.need_id
       and g.channel = 'EXACT_LOCATION'
       and g.status = 'GRANTED'
       and g.granted_to_account_id = auth.uid()));

create policy responses_worker_all on public.marketplace_responses
  for all to authenticated
  using (worker_account_id = auth.uid())
  with check (worker_account_id = auth.uid());

create policy responses_requester_read on public.marketplace_responses
  for select to authenticated
  using (status <> 'DRAFT'
     and exists (select 1 from public.needs n where n.id = need_id and n.requester_account_id = auth.uid()));

create policy response_versions_read on public.marketplace_response_versions
  for select to authenticated
  using (exists (
    select 1 from public.marketplace_responses r
     where r.id = response_id
       and (r.worker_account_id = auth.uid()
            or (r.status <> 'DRAFT'
                and exists (select 1 from public.needs n where n.id = r.need_id and n.requester_account_id = auth.uid())))));

create policy selections_requester on public.need_selections
  for select to authenticated
  using (selected_by_account_id = auth.uid());

create policy agreements_parties_read on public.agreements
  for select to authenticated
  using (requester_account_id = auth.uid() or worker_account_id = auth.uid());

create policy agreement_versions_read on public.agreement_versions
  for select to authenticated
  using (exists (select 1 from public.agreements a
                  where a.id = agreement_id
                    and (a.requester_account_id = auth.uid() or a.worker_account_id = auth.uid())));

create policy agreement_execution_read on public.agreement_execution
  for select to authenticated
  using (exists (select 1 from public.agreements a
                  where a.id = agreement_id
                    and (a.requester_account_id = auth.uid() or a.worker_account_id = auth.uid())));

create policy agreement_messages_read on public.agreement_messages
  for select to authenticated
  using (exists (select 1 from public.agreements a
                  where a.id = agreement_id
                    and (a.requester_account_id = auth.uid() or a.worker_account_id = auth.uid())));

create policy agreement_messages_send on public.agreement_messages
  for insert to authenticated
  with check (sender_account_id = auth.uid()
    and exists (select 1 from public.agreements a
                 where a.id = agreement_id
                   and a.status in ('CONFIRMED','SUPERSEDED')
                   and (a.requester_account_id = auth.uid() or a.worker_account_id = auth.uid())));

create policy access_grants_read on public.access_grants
  for select to authenticated
  using (granted_by_account_id = auth.uid() or granted_to_account_id = auth.uid());

create policy access_grants_grant on public.access_grants
  for insert to authenticated
  with check (granted_by_account_id = auth.uid()
    and exists (select 1 from public.agreements a
                 where a.id = agreement_id
                   and (a.requester_account_id = auth.uid() or a.worker_account_id = auth.uid())));

create policy access_grants_revoke on public.access_grants
  for update to authenticated
  using (granted_by_account_id = auth.uid())
  with check (granted_by_account_id = auth.uid());

create policy ai_conversations_own on public.ai_conversations
  for all to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());

create policy ai_facts_own on public.ai_structured_facts
  for all to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());

create policy ai_proposals_own on public.ai_action_proposals
  for all to authenticated
  using (account_id = auth.uid()) with check (account_id = auth.uid());

comment on policy agreement_messages_read on public.agreement_messages is
  'M04: chat radi NEZAVISNO od dozvola za privatne podatke. Uslov je clanstvo u Dogovoru, ne postojanje granta.';
comment on policy access_grants_grant on public.access_grants is
  'Dozvolu daje SAMO onaj ciji je podatak. Niko ne moze da podeli tudji broj.';
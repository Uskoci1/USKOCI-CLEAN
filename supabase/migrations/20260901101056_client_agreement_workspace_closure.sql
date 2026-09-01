-- Canonical Agreement workspace closure: safe projections, real chat command,
-- and proposal -> counterparty accept/reject semantics.

create table if not exists public.agreement_change_proposals (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  base_version integer not null check (base_version >= 1),
  proposed_terms jsonb not null check (jsonb_typeof(proposed_terms) = 'object'),
  content_hash text not null check (char_length(content_hash) >= 16),
  reason text,
  client_request_id text not null check (char_length(btrim(client_request_id)) >= 1),
  proposed_by_account_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','REJECTED','SUPERSEDED')),
  responded_by_account_id uuid references auth.users(id) on delete restrict,
  responded_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (agreement_id, proposed_by_account_id, client_request_id)
);

create index if not exists agreement_change_proposals_agreement_status_idx
  on public.agreement_change_proposals (agreement_id, status, created_at desc);

alter table public.agreement_change_proposals enable row level security;
revoke all on table public.agreement_change_proposals from public, anon;
revoke insert, update, delete on table public.agreement_change_proposals from authenticated;
grant select on table public.agreement_change_proposals to authenticated;

drop policy if exists agreement_change_proposals_participant_read on public.agreement_change_proposals;
create policy agreement_change_proposals_participant_read
on public.agreement_change_proposals
for select
to authenticated
using (
  exists (
    select 1 from public.agreements a
    where a.id = agreement_change_proposals.agreement_id
      and auth.uid() in (a.requester_account_id, a.worker_account_id)
  )
);

create or replace function public.rpc_list_my_agreements()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select coalesce(jsonb_agg(x.payload order by x.created_at desc), '[]'::jsonb)
    into v_result
    from (
      select
        a.created_at,
        jsonb_build_object(
          'id', a.id,
          'currentVersion', a.current_version,
          'status', coalesce(ae.state, a.status),
          'agreementStatus', a.status,
          'title', n.title,
          'approximateArea', n.approximate_area,
          'approximateCity', n.approximate_city,
          'requiredSlots', n.required_slots,
          'startsAt', n.starts_at,
          'terms', av.terms,
          'requesterAccountId', a.requester_account_id,
          'workerAccountId', a.worker_account_id,
          'requesterName', rp.display_name,
          'workerName', wp.display_name,
          'executionMode', ae.mode,
          'requesterDeadlineAt', ae.requester_deadline_at,
          'problemOpened', (ae.problem_opened_at is not null),
          'myPhoneShared', exists (
            select 1 from public.access_grants g
             where g.agreement_id = a.id
               and g.channel = 'PHONE'
               and g.granted_by_account_id = v_uid
               and g.status = 'GRANTED'
               and (g.expires_at is null or g.expires_at > statement_timestamp())
          ),
          'theirPhone', case
            when a.status = 'CONFIRMED' and exists (
              select 1 from public.access_grants g
               where g.agreement_id = a.id
                 and g.channel = 'PHONE'
                 and g.granted_to_account_id = v_uid
                 and g.status = 'GRANTED'
                 and (g.expires_at is null or g.expires_at > statement_timestamp())
            ) then (
              select nullif(btrim(acc.phone), '')
                from public.app_accounts acc
               where acc.id = case when v_uid = a.requester_account_id then a.worker_account_id else a.requester_account_id end
            )
            else null
          end,
          'createdAt', a.created_at
        ) as payload
      from public.agreements a
      join public.agreement_versions av
        on av.agreement_id = a.id and av.version = a.current_version
      join public.needs n on n.id = a.need_id
      join public.app_profiles rp on rp.id = a.requester_profile_id
      join public.app_profiles wp on wp.id = a.worker_profile_id
      left join public.agreement_execution ae on ae.agreement_id = a.id
      where v_uid in (a.requester_account_id, a.worker_account_id)
    ) x;

  return v_result;
end;
$function$;

revoke all on function public.rpc_list_my_agreements() from public, anon;
grant execute on function public.rpc_list_my_agreements() to authenticated;

create or replace function public.rpc_get_agreement_workspace(p_agreement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select jsonb_build_object(
      'id', a.id,
      'currentVersion', a.current_version,
      'status', coalesce(ae.state, a.status),
      'agreementStatus', a.status,
      'title', n.title,
      'approximateArea', n.approximate_area,
      'approximateCity', n.approximate_city,
      'requiredSlots', n.required_slots,
      'startsAt', n.starts_at,
      'terms', av.terms,
      'requesterAccountId', a.requester_account_id,
      'workerAccountId', a.worker_account_id,
      'requesterName', rp.display_name,
      'workerName', wp.display_name,
      'executionMode', ae.mode,
      'requesterDeadlineAt', ae.requester_deadline_at,
      'problemOpened', (ae.problem_opened_at is not null),
      'myPhoneShared', exists (
        select 1 from public.access_grants g
         where g.agreement_id = a.id
           and g.channel = 'PHONE'
           and g.granted_by_account_id = v_uid
           and g.status = 'GRANTED'
           and (g.expires_at is null or g.expires_at > statement_timestamp())
      ),
      'theirPhone', case
        when a.status = 'CONFIRMED' and exists (
          select 1 from public.access_grants g
           where g.agreement_id = a.id
             and g.channel = 'PHONE'
             and g.granted_to_account_id = v_uid
             and g.status = 'GRANTED'
             and (g.expires_at is null or g.expires_at > statement_timestamp())
        ) then (
          select nullif(btrim(acc.phone), '')
            from public.app_accounts acc
           where acc.id = case when v_uid = a.requester_account_id then a.worker_account_id else a.requester_account_id end
        )
        else null
      end,
      'createdAt', a.created_at
    )
    into v_result
    from public.agreements a
    join public.agreement_versions av
      on av.agreement_id = a.id and av.version = a.current_version
    join public.needs n on n.id = a.need_id
    join public.app_profiles rp on rp.id = a.requester_profile_id
    join public.app_profiles wp on wp.id = a.worker_profile_id
    left join public.agreement_execution ae on ae.agreement_id = a.id
   where a.id = p_agreement_id
     and v_uid in (a.requester_account_id, a.worker_account_id);

  if v_result is null then
    raise exception 'AGREEMENT_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0002';
  end if;
  return v_result;
end;
$function$;

revoke all on function public.rpc_get_agreement_workspace(uuid) from public, anon;
grant execute on function public.rpc_get_agreement_workspace(uuid) to authenticated;

create or replace function public.rpc_send_agreement_message(p_agreement_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_agreement public.agreements%rowtype;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) < 1 then
    raise exception 'MESSAGE_REQUIRED' using errcode = 'P0001';
  end if;
  if char_length(btrim(p_body)) > 2000 then
    raise exception 'MESSAGE_TOO_LONG' using errcode = '22001';
  end if;

  select * into v_agreement from public.agreements where id = p_agreement_id;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_uid not in (v_agreement.requester_account_id, v_agreement.worker_account_id) then
    raise exception 'NOT_PARTY' using errcode = '42501';
  end if;
  if v_agreement.status not in ('CONFIRMED','SUPERSEDED') then
    raise exception 'CHAT_NOT_AVAILABLE' using errcode = 'P0001', detail = v_agreement.status;
  end if;

  insert into public.agreement_messages(agreement_id, agreement_version, sender_account_id, body)
  values (p_agreement_id, v_agreement.current_version, v_uid, btrim(p_body))
  returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function public.rpc_send_agreement_message(uuid,text) from public, anon;
grant execute on function public.rpc_send_agreement_message(uuid,text) to authenticated;

create or replace function public.rpc_propose_agreement_change_v2(
  p_agreement_id uuid,
  p_expected_version integer,
  p_patch jsonb,
  p_reason text,
  p_client_request_id text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_agreement public.agreements%rowtype;
  v_current public.agreement_versions%rowtype;
  v_terms jsonb;
  v_hash text;
  v_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if jsonb_typeof(p_patch) <> 'object' or p_patch = '{}'::jsonb then
    raise exception 'CHANGE_PATCH_REQUIRED' using errcode='22023';
  end if;
  if coalesce(btrim(p_client_request_id),'') = '' then
    raise exception 'CLIENT_REQUEST_ID_REQUIRED' using errcode='22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_patch) k
    where k not in ('price_rsd','currency','proposed_start_at','proposed_end_at','scope_note')
  ) then
    raise exception 'UNSUPPORTED_CHANGE_FIELD' using errcode='22023';
  end if;

  select * into v_agreement from public.agreements where id=p_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode='P0002'; end if;
  if v_uid not in (v_agreement.requester_account_id,v_agreement.worker_account_id) then
    raise exception 'NOT_PARTY' using errcode='42501';
  end if;
  if v_agreement.status <> 'CONFIRMED' then raise exception 'AGREEMENT_NOT_ACTIVE' using errcode='P0001'; end if;
  if v_agreement.current_version <> p_expected_version then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;

  select * into v_current from public.agreement_versions
   where agreement_id=p_agreement_id and version=v_agreement.current_version;
  if not found then raise exception 'AGREEMENT_VERSION_NOT_FOUND' using errcode='P0002'; end if;

  select id into v_id from public.agreement_change_proposals
   where agreement_id=p_agreement_id and proposed_by_account_id=v_uid and client_request_id=p_client_request_id;
  if found then return v_id; end if;

  v_terms := v_current.terms || p_patch;
  v_hash := encode(extensions.digest(convert_to(v_terms::text,'UTF8'),'sha256'),'hex');

  insert into public.agreement_change_proposals(
    agreement_id,base_version,proposed_terms,content_hash,reason,client_request_id,proposed_by_account_id
  ) values (
    p_agreement_id,v_agreement.current_version,v_terms,v_hash,nullif(btrim(p_reason),''),p_client_request_id,v_uid
  ) returning id into v_id;
  return v_id;
end;
$function$;

revoke all on function public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text) from public, anon;
grant execute on function public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text) to authenticated;

create or replace function public.rpc_respond_agreement_change(p_proposal_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_proposal public.agreement_change_proposals%rowtype;
  v_agreement public.agreements%rowtype;
  v_new_version integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_accept is null then raise exception 'DECISION_REQUIRED' using errcode='22004'; end if;

  select * into v_proposal from public.agreement_change_proposals where id=p_proposal_id for update;
  if not found then raise exception 'CHANGE_PROPOSAL_NOT_FOUND' using errcode='P0002'; end if;

  select * into v_agreement from public.agreements where id=v_proposal.agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode='P0002'; end if;
  if v_uid not in (v_agreement.requester_account_id,v_agreement.worker_account_id) then raise exception 'NOT_PARTY' using errcode='42501'; end if;
  if v_uid = v_proposal.proposed_by_account_id then raise exception 'PROPOSER_CANNOT_RESPOND' using errcode='42501'; end if;

  if v_proposal.status = 'ACCEPTED' and p_accept then
    return jsonb_build_object('proposalId',v_proposal.id,'accepted',true,'agreementVersion',v_agreement.current_version,'authoritative',true);
  elsif v_proposal.status = 'REJECTED' and not p_accept then
    return jsonb_build_object('proposalId',v_proposal.id,'accepted',false,'agreementVersion',v_agreement.current_version,'authoritative',true);
  elsif v_proposal.status <> 'PENDING' then
    raise exception 'PROPOSAL_NOT_PENDING' using errcode='P0001', detail=v_proposal.status;
  end if;

  if v_agreement.status <> 'CONFIRMED' then raise exception 'AGREEMENT_NOT_ACTIVE' using errcode='P0001'; end if;
  if v_agreement.current_version <> v_proposal.base_version then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;

  if not p_accept then
    update public.agreement_change_proposals
       set status='REJECTED', responded_by_account_id=v_uid, responded_at=statement_timestamp()
     where id=v_proposal.id;
    return jsonb_build_object('proposalId',v_proposal.id,'accepted',false,'agreementVersion',v_agreement.current_version,'authoritative',true);
  end if;

  v_new_version := v_agreement.current_version + 1;
  insert into public.agreement_versions(
    agreement_id,version,status,terms,content_hash,supersedes_version,created_by_account_id
  ) values (
    v_agreement.id,v_new_version,'CONFIRMED',v_proposal.proposed_terms,v_proposal.content_hash,
    v_agreement.current_version,v_proposal.proposed_by_account_id
  );

  update public.agreement_versions set status='SUPERSEDED'
   where agreement_id=v_agreement.id and version=v_agreement.current_version;
  update public.agreements set current_version=v_new_version, updated_at=statement_timestamp()
   where id=v_agreement.id;
  update public.agreement_execution set agreement_version=v_new_version, updated_at=statement_timestamp()
   where agreement_id=v_agreement.id;
  update public.agreement_change_proposals
     set status='ACCEPTED', responded_by_account_id=v_uid, responded_at=statement_timestamp()
   where id=v_proposal.id;
  update public.agreement_change_proposals
     set status='SUPERSEDED', responded_at=coalesce(responded_at,statement_timestamp())
   where agreement_id=v_agreement.id and id<>v_proposal.id and status='PENDING';

  return jsonb_build_object('proposalId',v_proposal.id,'accepted',true,'agreementVersion',v_new_version,'authoritative',true);
end;
$function$;

revoke all on function public.rpc_respond_agreement_change(uuid,boolean) from public, anon;
grant execute on function public.rpc_respond_agreement_change(uuid,boolean) to authenticated;

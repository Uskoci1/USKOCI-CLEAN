-- M05: preserve the existing bilateral proposal owner, events and calendar.
-- Serialize every proposal decision behind its Agreement; bind replay to the
-- immutable base and actual semantic terms, never the current display version.
begin;
set local search_path to pg_catalog;

do $guard$
declare expected record;
begin
  for expected in select * from (values
    ('public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)','1e7189bfb0f3baca51f24aca820d62c2'),
    ('public.rpc_respond_agreement_change(uuid,boolean)','0bbfc5fd26c97bc5fe953561c2330c49')
  ) p(signature,body_md5) loop
    if to_regprocedure(expected.signature) is null or
       (select md5(prosrc) from pg_proc where oid=to_regprocedure(expected.signature)) is distinct from expected.body_md5 then
      raise exception 'M05_PREDECESSOR_MISMATCH' using detail=expected.signature;
    end if;
  end loop;
  if to_regprocedure('private.agreement_calendar_interval(jsonb)') is null then
    raise exception 'M05_CALENDAR_AUTHORITY_MISSING';
  end if;
end $guard$;
create temporary table m05_original_functions on commit drop as
  select oid,to_jsonb(p)-'prosrc' as metadata from pg_proc p
  where oid in ('public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)'::regprocedure,
                'public.rpc_respond_agreement_change(uuid,boolean)'::regprocedure);

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
  v_existing public.agreement_change_proposals%rowtype;
  v_terms jsonb;
  v_hash text;
  v_id uuid;
  v_start timestamptz; v_end timestamptz;
  v_old_start timestamptz; v_old_end timestamptz;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if jsonb_typeof(p_patch) is distinct from 'object' or p_patch = '{}'::jsonb then
    raise exception 'CHANGE_PATCH_REQUIRED' using errcode='22023';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'VERSION_REQUIRED' using errcode='22023';
  end if;
  if coalesce(btrim(p_client_request_id),'') = '' then
    raise exception 'CLIENT_REQUEST_ID_REQUIRED' using errcode='22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_patch) k
    where k not in ('price_rsd','currency','proposed_start_at','proposed_end_at','scope_note')) then
    raise exception 'UNSUPPORTED_CHANGE_FIELD' using errcode='22023';
  end if;

  select * into v_agreement from public.agreements where id=p_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode='P0002'; end if;
  if v_uid not in (v_agreement.requester_account_id,v_agreement.worker_account_id) then
    raise exception 'NOT_PARTY' using errcode='42501';
  end if;

  select * into v_existing from public.agreement_change_proposals
   where agreement_id=p_agreement_id and proposed_by_account_id=v_uid and client_request_id=p_client_request_id;
  if found then
    if v_existing.base_version is distinct from p_expected_version then
      raise exception 'CHANGE_REQUEST_ID_REUSED' using errcode='22023';
    end if;
  else
    if v_agreement.status <> 'CONFIRMED' then raise exception 'AGREEMENT_NOT_ACTIVE' using errcode='P0001'; end if;
    if v_agreement.current_version <> p_expected_version then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;
  end if;
  -- A replay uses the original immutable base even after another change or
  -- terminal transition. This never writes or reopens the Agreement.
  select * into v_current from public.agreement_versions
   where agreement_id=p_agreement_id and version=p_expected_version;
  if not found then raise exception 'AGREEMENT_VERSION_NOT_FOUND' using errcode='P0002'; end if;
  v_terms := v_current.terms || p_patch;

  -- Match the existing positive int4 price_rsd and non-null text scope owner.
  -- No additional monetary, reason-length or scope-length policy is invented.
  if jsonb_typeof(v_terms->'price_rsd') is distinct from 'number' then
    raise exception 'INVALID_PRICE' using errcode='22023';
  end if;
  if (v_terms->>'price_rsd')::numeric <= 0 or (v_terms->>'price_rsd')::numeric > 2147483647
     or trunc((v_terms->>'price_rsd')::numeric) <> (v_terms->>'price_rsd')::numeric then
    raise exception 'INVALID_PRICE' using errcode='22023';
  end if;
  if jsonb_typeof(v_terms->'scope_note') is distinct from 'string' then
    raise exception 'CHANGE_SCOPE_INVALID' using errcode='22023';
  end if;
  if v_terms ? 'currency' and (jsonb_typeof(v_terms->'currency') is distinct from 'string'
     or v_terms->>'currency' is distinct from 'RSD') then
    raise exception 'CHANGE_CURRENCY_INVALID' using errcode='22023';
  end if;
  select starts_at,ends_at into v_start,v_end from private.agreement_calendar_interval(v_terms);

  if v_existing.id is not null then
    select starts_at,ends_at into v_old_start,v_old_end
      from private.agreement_calendar_interval(v_existing.proposed_terms);
    if (v_terms-array['proposed_start_at','proposed_end_at','currency'])
         is distinct from (v_existing.proposed_terms-array['proposed_start_at','proposed_end_at','currency'])
       or coalesce(v_existing.proposed_terms->>'currency','RSD') <> 'RSD'
       or (v_existing.proposed_terms ? 'currency' and jsonb_typeof(v_existing.proposed_terms->'currency') is distinct from 'string')
       or v_start is distinct from v_old_start or v_end is distinct from v_old_end
       or nullif(btrim(p_reason),'') is distinct from v_existing.reason then
      raise exception 'CHANGE_REQUEST_ID_REUSED' using errcode='22023';
    end if;
    return v_existing.id;
  end if;

  v_hash := encode(extensions.digest(convert_to(v_terms::text,'UTF8'),'sha256'),'hex');
  insert into public.agreement_change_proposals(
    agreement_id,base_version,proposed_terms,content_hash,reason,client_request_id,proposed_by_account_id
  ) values (
    p_agreement_id,v_agreement.current_version,v_terms,v_hash,nullif(btrim(p_reason),''),p_client_request_id,v_uid
  ) returning id into v_id;
  perform private.emit_event(
    case when v_uid=v_agreement.requester_account_id then v_agreement.worker_account_id else v_agreement.requester_account_id end,
    case when v_uid=v_agreement.requester_account_id then 'WORKER' else 'REQUESTER' end,
    'AGREEMENT_CHANGE_PROPOSED','AGREEMENT',v_agreement.id,v_agreement.current_version,
    'Predložena je izmena Dogovora','Pogledajte predlog i odgovorite u Dogovoru.',
    'agreement_change_proposed:'||v_id::text,'NORMAL',jsonb_build_object('proposal_id',v_id)
  );
  return v_id;
end;
$function$;

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
  v_agreement_id uuid;
  v_base_terms jsonb;
  v_terms jsonb;
  v_new_version integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_accept is null then raise exception 'DECISION_REQUIRED' using errcode='22004'; end if;

  -- Discover without locking. Every decision then locks Agreement -> proposal,
  -- including rejection/replay, so sibling acceptances cannot form a cycle.
  select agreement_id into v_agreement_id from public.agreement_change_proposals where id=p_proposal_id;
  if not found then raise exception 'CHANGE_PROPOSAL_NOT_FOUND' using errcode='P0002'; end if;
  select * into v_agreement from public.agreements where id=v_agreement_id for update;
  if not found then raise exception 'AGREEMENT_NOT_FOUND' using errcode='P0002'; end if;
  if v_uid not in (v_agreement.requester_account_id,v_agreement.worker_account_id) then raise exception 'NOT_PARTY' using errcode='42501'; end if;
  select * into v_proposal from public.agreement_change_proposals
    where id=p_proposal_id and agreement_id=v_agreement.id for update;
  if not found then raise exception 'CHANGE_PROPOSAL_NOT_FOUND' using errcode='P0002'; end if;
  if v_uid = v_proposal.proposed_by_account_id then raise exception 'PROPOSER_CANNOT_RESPOND' using errcode='42501'; end if;

  if v_proposal.status = 'ACCEPTED' and p_accept then
    return jsonb_build_object('proposalId',v_proposal.id,'accepted',true,'agreementVersion',v_proposal.base_version+1,'authoritative',true);
  elsif v_proposal.status = 'REJECTED' and not p_accept then
    return jsonb_build_object('proposalId',v_proposal.id,'accepted',false,'agreementVersion',v_proposal.base_version,'authoritative',true);
  elsif v_proposal.status <> 'PENDING' then
    raise exception 'PROPOSAL_NOT_PENDING' using errcode='P0001', detail=v_proposal.status;
  end if;
  if v_agreement.status <> 'CONFIRMED' then raise exception 'AGREEMENT_NOT_ACTIVE' using errcode='P0001'; end if;
  if v_agreement.current_version <> v_proposal.base_version then raise exception 'VERSION_CONFLICT' using errcode='P0001'; end if;

  if not p_accept then
    update public.agreement_change_proposals
       set status='REJECTED', responded_by_account_id=v_uid, responded_at=statement_timestamp()
     where id=v_proposal.id;
    perform private.emit_event(
      v_proposal.proposed_by_account_id,
      case when v_proposal.proposed_by_account_id=v_agreement.requester_account_id then 'REQUESTER' else 'WORKER' end,
      'AGREEMENT_CHANGE_REJECTED','AGREEMENT',v_agreement.id,v_agreement.current_version,
      'Predlog izmene nije prihvaćen','Važeći uslovi Dogovora ostaju nepromenjeni.',
      'agreement_change_rejected:'||v_proposal.id::text,'NORMAL',jsonb_build_object('proposal_id',v_proposal.id)
    );
    return jsonb_build_object('proposalId',v_proposal.id,'accepted',false,'agreementVersion',v_proposal.base_version,'authoritative',true);
  end if;

  -- Revalidate stored proposals too: older pending rows were not type-checked.
  -- Invalid historical data remains immutable and can still be rejected.
  v_terms := v_proposal.proposed_terms;
  select terms into v_base_terms from public.agreement_versions
    where agreement_id=v_agreement.id and version=v_proposal.base_version;
  if not found then raise exception 'AGREEMENT_VERSION_NOT_FOUND' using errcode='P0002'; end if;
  if jsonb_typeof(v_terms) is distinct from 'object' or
     (v_terms-array['price_rsd','currency','proposed_start_at','proposed_end_at','scope_note']) is distinct from
     (v_base_terms-array['price_rsd','currency','proposed_start_at','proposed_end_at','scope_note']) then
    raise exception 'CHANGE_TERMS_INVALID' using errcode='22023';
  end if;
  if jsonb_typeof(v_terms->'price_rsd') is distinct from 'number' then
    raise exception 'INVALID_PRICE' using errcode='22023';
  end if;
  if (v_terms->>'price_rsd')::numeric <= 0 or (v_terms->>'price_rsd')::numeric > 2147483647
     or trunc((v_terms->>'price_rsd')::numeric) <> (v_terms->>'price_rsd')::numeric then
    raise exception 'INVALID_PRICE' using errcode='22023';
  end if;
  if jsonb_typeof(v_terms->'scope_note') is distinct from 'string' then
    raise exception 'CHANGE_SCOPE_INVALID' using errcode='22023';
  end if;
  if v_terms ? 'currency' and (jsonb_typeof(v_terms->'currency') is distinct from 'string'
     or v_terms->>'currency' is distinct from 'RSD') then
    raise exception 'CHANGE_CURRENCY_INVALID' using errcode='22023';
  end if;
  perform 1 from private.agreement_calendar_interval(v_terms);
  if encode(extensions.digest(convert_to(v_terms::text,'UTF8'),'sha256'),'hex') is distinct from v_proposal.content_hash then
    raise exception 'CHANGE_TERMS_INVALID' using errcode='22023';
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
  perform private.emit_event(
    v_proposal.proposed_by_account_id,
    case when v_proposal.proposed_by_account_id=v_agreement.requester_account_id then 'REQUESTER' else 'WORKER' end,
    'AGREEMENT_VERSION_CHANGED','AGREEMENT',v_agreement.id,v_new_version,
    'Izmena Dogovora je prihvaćena','Pogledajte važeće uslove u Dogovoru.',
    'agreement_version_changed:'||v_proposal.id::text,'NORMAL',jsonb_build_object('proposal_id',v_proposal.id)
  );
  return jsonb_build_object('proposalId',v_proposal.id,'accepted',true,'agreementVersion',v_new_version,'authoritative',true);
end;
$function$;

do $postflight$
declare expected record;
begin
  if exists(select 1 from m05_original_functions o left join pg_proc p on p.oid=o.oid
    where p.oid is null or (to_jsonb(p)-'prosrc') is distinct from o.metadata) then
    raise exception 'M05_FUNCTION_METADATA_CHANGED';
  end if;
  for expected in select * from (values
    ('public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)','1f742b446dba8e2af4b40fc036ec2503'),
    ('public.rpc_respond_agreement_change(uuid,boolean)','1396c096460bfd8efd2ccd0d9556f991')
  ) p(signature,body_md5) loop
    if (select md5(prosrc) from pg_proc where oid=to_regprocedure(expected.signature)) is distinct from expected.body_md5 then
      raise exception 'M05_RESULT_BODY_MISMATCH' using detail=expected.signature;
    end if;
  end loop;
end $postflight$;
commit;

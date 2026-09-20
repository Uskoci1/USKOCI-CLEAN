-- V5 owner-only navigation and exact reviewed legal acceptance. Candidate129.
-- No policy publication, new report category, retention default or live activation.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create function public.rpc_list_my_account_blocks(p_after uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $f$
declare u uuid:=auth.uid(); items jsonb; next_id uuid;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 with page as (
  select b.* from private.account_blocks b
  where b.blocker_account_id=u and b.active and (p_after is null or b.blocked_account_id>p_after)
  order by b.blocked_account_id limit 50
 ) select coalesce(jsonb_agg(jsonb_build_object('accountId',u,'targetAccountId',b.blocked_account_id,
   'blocked',true,'revision',b.revision,'authoritative',true,
   'displayName',(select nullif(btrim(p.display_name),'') from public.app_profiles p
    where p.account_id=b.blocked_account_id and p.profile_status='ACTIVE' and nullif(btrim(p.display_name),'') is not null
    order by p.kind limit 1)) order by b.blocked_account_id),'[]'::jsonb) into items from page b;
 if jsonb_array_length(items)=50 then
  next_id:=(items->49->>'targetAccountId')::uuid;
  if not exists(select 1 from private.account_blocks b where b.blocker_account_id=u and b.active and b.blocked_account_id>next_id) then next_id:=null; end if;
 end if;
 return jsonb_build_object('accountId',u,'items',items,'nextCursor',next_id,'authoritative',true);
end;
$f$;

create function public.rpc_read_my_safety_report_command(p_client_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $f$
declare u uuid:=auth.uid(); r private.safety_reports;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_client_request_id is null then raise exception 'SAFETY_REPORT_INPUT_INVALID' using errcode='22023'; end if;
 select * into r from private.safety_reports where reporter_account_id=u and client_request_id=p_client_request_id;
 return jsonb_build_object('accountId',u,'clientRequestId',p_client_request_id,'found',found,'authoritative',true,
  'receipt',case when r.id is not null then jsonb_build_object('reportId',r.id,'received',true,'createdAt',r.created_at,
   'clientRequestId',p_client_request_id,'idempotentReplay',true,'authoritative',true) else null end);
end;
$f$;

create function public.rpc_accept_reviewed_legal_bundle(p_client_request_id text,p_terms_sha256 text,p_privacy_sha256 text)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $f$
declare b jsonb; r jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_client_request_id is null or length(p_client_request_id) not between 16 and 96 or p_client_request_id !~ '^[A-Za-z0-9_-]+$' then
  raise exception 'INVALID_CLIENT_REQUEST_ID' using errcode='22023'; end if;
 if p_terms_sha256 is null or p_terms_sha256 !~ '^[0-9a-f]{64}$' or p_privacy_sha256 is null or p_privacy_sha256 !~ '^[0-9a-f]{64}$' then
  raise exception 'LEGAL_REVIEW_CHANGED' using errcode='22023';
 end if;
 -- Protect the active-document pointer as well as row bytes against publication
 -- between review validation and the existing immutable ledger writer.
 lock table private.legal_document_versions in share mode;
 b:=public.rpc_get_legal_bundle();
 if b->>'ready'<>'true' then raise exception 'LEGAL_DOCUMENTS_NOT_PUBLISHED' using errcode='55000'; end if;
 if not exists(select 1 from jsonb_array_elements(b->'documents') d where d->>'kind'='TERMS' and d->>'sha256'=p_terms_sha256)
 or not exists(select 1 from jsonb_array_elements(b->'documents') d where d->>'kind'='PRIVACY' and d->>'sha256'=p_privacy_sha256) then
  raise exception 'LEGAL_REVIEW_CHANGED' using errcode='40001';
 end if;
 r:=public.rpc_accept_legal_bundle(p_client_request_id);
 return r||jsonb_build_object('accountId',auth.uid(),'clientRequestId',p_client_request_id,'authoritative',true);
end;
$f$;

create function public.rpc_read_my_legal_acceptance(p_client_request_id text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $f$
declare u uuid:=auth.uid(); r public.account_legal_acceptance_events;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_client_request_id is null or length(p_client_request_id) not between 16 and 96 or p_client_request_id !~ '^[A-Za-z0-9_-]+$' then
  raise exception 'INVALID_CLIENT_REQUEST_ID' using errcode='22023'; end if;
 select * into r from public.account_legal_acceptance_events where account_id=u and request_id=p_client_request_id;
 return jsonb_build_object('accountId',u,'clientRequestId',p_client_request_id,'found',found,'authoritative',true,
  'receipt',case when r.id is not null then jsonb_build_object('accepted',true,'idempotentReplay',true,'acceptedAt',r.accepted_at,
   'termsVersion',r.terms_version_label,'termsSha256',r.terms_content_sha256,
   'privacyVersion',r.privacy_version_label,'privacySha256',r.privacy_content_sha256) else null end);
end;
$f$;

revoke all on function public.rpc_list_my_account_blocks(uuid),public.rpc_read_my_safety_report_command(uuid),
 public.rpc_accept_reviewed_legal_bundle(text,text,text),public.rpc_read_my_legal_acceptance(text) from public,anon,service_role;
grant execute on function public.rpc_list_my_account_blocks(uuid),public.rpc_read_my_safety_report_command(uuid),
 public.rpc_accept_reviewed_legal_bundle(text,text,text),public.rpc_read_my_legal_acceptance(text) to authenticated;
commit;

-- P4 exact message event resolver SOURCE ONLY. NOT RUN / NOT APPLIED.
-- One additive read RPC after applied B3b. No event/body transport, ACK, writer,
-- table, publication, client, certificate or readiness-definition change.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create temporary table chat_p4_before on commit drop as
select private.closure_source_digest_v5() digest,
  (select to_jsonb(c) from private.closure_source_v5 c where singleton) certificate,
  (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) erasure,
  private.closure_erasure_binding_v5() binding,
  pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) readiness_definition;

do $pre$
declare pin record; certified text;
begin
  if to_regprocedure('public.rpc_resolve_activity_message_v1(uuid,uuid)') is not null then
    raise exception 'CHAT_P4_ALREADY_APPLIED' using errcode='55000';
  end if;
  for pin in select * from (values
    ('private.support_auth_v5(uuid)','66773994698c60b9fab919f2a9fda93a','plpgsql','v','uuid','{postgres=X/postgres}'),
    ('private.push_session_valid(uuid,uuid)','3454eb7040f3dab3cb0c35b512b46859','sql','v','boolean','{postgres=X/postgres}'),
    ('private.closure_assert_open(uuid,uuid)','dc9bc4c718593850da4fdb49e612dbd2','plpgsql','v','void','{postgres=X/postgres}'),
    ('private.closure_account_restricted(uuid)','f4999250c315e0253374d4611291c7ad','sql','s','boolean','{postgres=X/postgres}'),
    ('public.rpc_read_agreement_message_window_v1(uuid,uuid,uuid,integer,integer)','9ae403a4c1ba9130e18cdd5b3dd831f6','plpgsql','v','jsonb','{postgres=X/postgres,authenticated=X/postgres}')
  ) p(signature,body_md5,language_name,volatility,result_type,acl) loop
    if not exists(select 1 from pg_proc where oid=to_regprocedure(pin.signature)
      and md5(replace(prosrc,E'\r\n',E'\n'))=pin.body_md5 and prosecdef
      and proconfig=array['search_path=pg_catalog'] and proowner='postgres'::regrole
      and prolang=(select oid from pg_language where lanname=pin.language_name)
      and provolatile::text=pin.volatility and not proisstrict and prokind='f'
      and not proretset and pg_get_function_result(oid)=pin.result_type
      and proacl::text=pin.acl) then
      raise exception 'CHAT_P4_PREDECESSOR_DRIFT: %',pin.signature using errcode='55000';
    end if;
  end loop;
  certified:=(select digest from chat_p4_before);
  if certified is null or certified is distinct from (select certificate->>'sha256' from chat_p4_before)
    or certified is distinct from (select erasure->>'sha256' from chat_p4_before)
    or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from certified
    or private.retention_ai_source_ready() is distinct from true then
    raise exception 'CHAT_P4_CLOSURE_NOT_READY' using errcode='55000';
  end if;
  -- The exact event/message IDs and global canonical dedupe are unique. No scan
  -- or new index is introduced to search messages by untrusted payload text.
  for pin in select * from (values
    ('public.user_activity_events','id',true),
    ('public.user_activity_events','dedupe_key',false),
    ('public.agreement_messages','id',true),
    ('public.notification_deliveries','dedupe_key',false)
  ) p(relation_name,column_name,primary_required) loop
    if not exists(select 1 from pg_index i join pg_attribute a
      on a.attrelid=i.indrelid and a.attname=pin.column_name
      where i.indrelid=to_regclass(pin.relation_name) and i.indisunique
        and (not pin.primary_required or i.indisprimary)
        and i.indisvalid and i.indisready and i.indpred is null
        and i.indexprs is null and i.indnkeyatts=1 and i.indkey[0]=a.attnum) then
      raise exception 'CHAT_P4_CANONICAL_UNIQUENESS_REQUIRED' using errcode='55000';
    end if;
  end loop;
end
$pre$;

create function public.rpc_resolve_activity_message_v1(p_expected_user_id uuid,p_event_id uuid)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog
as $resolve$
declare
  u uuid:=private.support_auth_v5(p_expected_user_id);
  ag public.agreements; target_message uuid; target_role text;
  unavailable jsonb:=jsonb_build_object('schema','ACTIVITY_MESSAGE_TARGET_V1',
    'accountId',u,'kind','UNAVAILABLE','authoritative',true);
begin
  -- The first lookup reveals nothing. It identifies the two closure locks before
  -- the final authoritative join; foreign/unknown IDs have the same envelope.
  select g.* into ag from public.user_activity_events e
    join public.agreements g on g.id=e.entity_id
    where e.id=p_event_id and e.recipient_user_id=u
      and e.event_type='MESSAGE_RECEIVED' and e.entity_type='AGREEMENT'
      and (u=g.requester_account_id or u=g.worker_account_id);
  if not found then
    perform private.support_auth_v5(u);return unavailable;
  end if;
  if (u is distinct from ag.requester_account_id and u is distinct from ag.worker_account_id)
    or ag.requester_account_id is null or ag.worker_account_id is null
    or ag.requester_account_id=ag.worker_account_id then
    perform private.support_auth_v5(u);return unavailable;
  end if;
  begin
    -- Same ordered shared account locks as canonical writers; a closing caller
    -- OR counterpart makes an event unavailable. No closure state is returned.
    perform private.closure_assert_open(ag.requester_account_id,ag.worker_account_id);
  exception when sqlstate '42501' then
    perform private.support_auth_v5(u);return unavailable;
  end;
  target_role:=case when u=ag.requester_account_id then 'REQUESTER' else 'WORKER' end;
  select m.id into target_message from public.user_activity_events e
    join public.agreements g on g.id=e.entity_id
    join public.agreement_messages m on m.id=case
      when jsonb_typeof(e.payload->'message_id')='string'
        and (e.payload->>'message_id')~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (e.payload->>'message_id')::uuid else null end
    where e.id=p_event_id and e.recipient_user_id=u and e.recipient_role=target_role
      and e.event_type='MESSAGE_RECEIVED' and e.entity_type='AGREEMENT'
      and g.id=ag.id and g.requester_account_id=ag.requester_account_id
      and g.worker_account_id=ag.worker_account_id
      and m.agreement_id=g.id and m.agreement_version=e.entity_version
      and m.sender_account_id=case when target_role='REQUESTER' then g.worker_account_id else g.requester_account_id end
      and e.dedupe_key='agreement_message:'||m.id::text
      and exists(select 1 from public.notification_deliveries d
        where d.event_id=e.id and d.recipient_user_id=u and d.recipient_role=target_role
          and d.channel='IN_APP' and d.dedupe_key=e.dedupe_key||':in_app'
          -- CREATED is canonical IN_APP emission. Retain legitimate delivered
          -- and read history; pending/retry/failure/expiry/suppression are denied.
          and d.state in('CREATED','SENT','DELIVERED','READ')
          and d.suppression_reason is null
          and (d.expires_at is null or d.expires_at>clock_timestamp()));
  perform private.support_auth_v5(u);
  if target_message is null then return unavailable;end if;
  -- No current-status/version equality: terminal/historical Agreement messages
  -- remain exact targets while their current authorization and delivery permit.
  return jsonb_build_object('schema','ACTIVITY_MESSAGE_TARGET_V1','accountId',u,
    'kind','AGREEMENT_MESSAGE','eventId',p_event_id,'agreementId',ag.id,
    'messageId',target_message,'role',target_role,'authoritative',true);
end
$resolve$;
revoke all on function public.rpc_resolve_activity_message_v1(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_resolve_activity_message_v1(uuid,uuid) to authenticated;

do $post$
begin
  if not exists(select 1 from pg_proc where oid='public.rpc_resolve_activity_message_v1(uuid,uuid)'::regprocedure
      and md5(replace(prosrc,E'\r\n',E'\n'))='dc06e399d221726fcf8a8bd604ad0b68'
      and proowner='postgres'::regrole and prolang=(select oid from pg_language where lanname='plpgsql')
      and prosecdef and provolatile='v' and not proisstrict and not proleakproof
      and proparallel='u' and prokind='f' and not proretset and prorettype='jsonb'::regtype
      and pronargs=2 and pronargdefaults=0 and proargtypes='2950 2950'::oidvector
      and proargnames=array['p_expected_user_id','p_event_id']
      and proconfig=array['search_path=pg_catalog']
      and proacl::text='{postgres=X/postgres,authenticated=X/postgres}') then
    raise exception 'CHAT_P4_FUNCTION_MISMATCH' using errcode='55000';
  end if;
  if private.closure_source_digest_v5() is distinct from (select digest from chat_p4_before)
    or (select to_jsonb(c) from private.closure_source_v5 c where singleton) is distinct from (select certificate from chat_p4_before)
    or (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) is distinct from (select erasure from chat_p4_before)
    or private.closure_erasure_binding_v5() is distinct from (select binding from chat_p4_before)
    or pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) is distinct from (select readiness_definition from chat_p4_before)
    or private.retention_ai_source_ready() is distinct from true then
    raise exception 'CHAT_P4_CERTIFICATE_CHANGED' using errcode='55000';
  end if;
end
$post$;
notify pgrst,'reload schema';
commit;

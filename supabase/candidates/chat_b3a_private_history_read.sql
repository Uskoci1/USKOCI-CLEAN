-- Chat B3a SOURCE-ONLY CANDIDATE. NOT RUN / NOT APPLIED.
-- Two additive functions only. No legacy replacement, schema/ACL-of-table change,
-- message/read_at rewrite, provider IO, voice support or closure recertification.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
create temporary table chat_b3a_before(digest text, erasure text, binding jsonb) on commit drop;

do $pre$
declare pin record; s text;
begin
  if to_regprocedure('public.rpc_read_agreement_messages_page_v1(uuid,uuid,integer,timestamptz,uuid)') is not null
    or to_regprocedure('public.rpc_mark_displayed_agreement_messages_v1(uuid,uuid,uuid[])') is not null then
    raise exception 'CHAT_B3A_ALREADY_APPLIED' using errcode='55000';
  end if;
  for pin in select * from (values
    ('private.support_auth_v5(uuid)', '66773994698c60b9fab919f2a9fda93a'),
    ('private.agreement_photo_context_v5(uuid,uuid,integer,boolean)', '7790c5be70effa702dd106ab6ae8f807'),
    ('public.rpc_read_agreement_photo_messages_v5(uuid,uuid,uuid[])', '9c5a0868e9507b23b600863f4508a5a5'),
    ('public.rpc_mark_agreement_messages_read(uuid)', '725de3a6132fba68b98a09fb2b66ae7a')
  ) p(signature,body_md5) loop
    if (select md5(replace(prosrc,E'\r\n',E'\n')) from pg_proc where oid=to_regprocedure(pin.signature))
      is distinct from pin.body_md5 then
      raise exception 'CHAT_B3A_PREDECESSOR_DRIFT: %',pin.signature using errcode='55000';
    end if;
  end loop;
  s:=private.closure_source_digest_v5();
  if s is null or s is distinct from (select sha256 from private.closure_source_v5 where singleton)
    or s is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
    or private.retention_ai_source_ready() is distinct from true
    or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from s then
    raise exception 'CHAT_B3A_CLOSURE_NOT_READY' using errcode='55000';
  end if;
  insert into chat_b3a_before values(s,(select sha256 from private.closure_erasure_source_v5 where singleton),private.closure_erasure_binding_v5());
end
$pre$;

create function public.rpc_read_agreement_messages_page_v1(
  p_expected_user_id uuid, p_agreement_id uuid, p_limit integer default 50,
  p_before_created_at timestamptz default null, p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $page$
declare
  u uuid:=private.support_auth_v5(p_expected_user_id); ag public.agreements;
  selected jsonb; page_rows jsonb; photo_rows jsonb; messages jsonb;
  ids uuid[]; older jsonb:=null; has_older boolean;
begin
  ag:=private.agreement_photo_context_v5(u,p_agreement_id,null,false);
  -- The schema permits NULL participants (hard-delete FK/legacy states). The reused
  -- helper's NOT IN check is not sufficient for that state; require a positive match.
  if u is distinct from ag.requester_account_id and u is distinct from ag.worker_account_id then
    raise exception 'MEDIA_NOT_FOUND' using errcode='42501';
  end if;
  if p_limit is null or p_limit not between 1 and 50
    or (p_before_created_at is null)<>(p_before_id is null)
    or (p_before_created_at is not null and not isfinite(p_before_created_at)) then
    raise exception 'CHAT_CURSOR_INVALID' using errcode='22023';
  end if;
  if p_before_id is not null and not exists(select 1 from public.agreement_messages m
    where m.agreement_id=p_agreement_id and m.id=p_before_id and m.created_at=p_before_created_at) then
    raise exception 'CHAT_CURSOR_INVALID' using errcode='22023';
  end if;
  -- Read one extra row solely to determine whether an older page exists.
  -- The returned page is chronological; cursor comparisons retain microseconds.
  select coalesce(jsonb_agg(jsonb_build_object(
    'messageId',m.id,'agreementVersion',m.agreement_version,'senderAccountId',m.sender_account_id,
    'clientMessageId',m.client_message_id,'body',m.body,'createdAt',m.created_at,
    'kind',case when cardinality(m.photo_asset_ids)>0 then 'PHOTO' else 'TEXT' end,
    'mine',m.sender_account_id=u) order by m.created_at desc,m.id desc),'[]'::jsonb)
  into selected from (select x.* from public.agreement_messages x
    where x.agreement_id=p_agreement_id
      and (p_before_id is null or (x.created_at,x.id)<(p_before_created_at,p_before_id))
    order by x.created_at desc,x.id desc limit p_limit+1) m;
  has_older:=jsonb_array_length(selected)>p_limit;
  select coalesce(jsonb_agg(value order by ord desc),'[]'::jsonb),array_agg((value->>'messageId')::uuid order by ord desc)
    into page_rows,ids from jsonb_array_elements(selected) with ordinality r(value,ord) where ord<=p_limit;
  if cardinality(ids)>0 then
    -- Reuse the existing membership/link validation and ordered metadata allowlist.
    -- No private storage path, URL, input hash or unbound asset enters this page.
    photo_rows:=public.rpc_read_agreement_photo_messages_v5(u,p_agreement_id,ids)->'messages';
    select jsonb_agg(r.value||jsonb_build_object('photos',p.value->'photos') order by r.ord)
      into messages from jsonb_array_elements(page_rows) with ordinality r(value,ord)
      join jsonb_array_elements(photo_rows) p(value) on p.value->>'messageId'=r.value->>'messageId'
        and p.value->>'agreementVersion'=r.value->>'agreementVersion'
        and p.value->'clientMessageId'=r.value->'clientMessageId' and p.value->>'body'=r.value->>'body';
    if messages is null or jsonb_array_length(messages)<>cardinality(ids) then
      raise exception 'CHAT_MESSAGE_PROJECTION_CHANGED' using errcode='55000';
    end if;
    if has_older then older:=jsonb_build_object('createdAt',page_rows->0->'createdAt','messageId',page_rows->0->'messageId');end if;
  else messages:='[]'::jsonb;end if;
  perform private.support_auth_v5(u);
  return jsonb_build_object('schema','AGREEMENT_MESSAGES_PAGE_V1','accountId',u,'agreementId',p_agreement_id,
    'messages',messages,'olderCursor',older,'asOf',statement_timestamp(),'authoritative',true);
end
$page$;

create function public.rpc_mark_displayed_agreement_messages_v1(
  p_expected_user_id uuid,p_agreement_id uuid,p_message_ids uuid[])
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $read$
declare u uuid:=private.support_auth_v5(p_expected_user_id);changed integer;ag public.agreements;
begin
  ag:=private.agreement_photo_context_v5(u,p_agreement_id,null,false);
  if u is distinct from ag.requester_account_id and u is distinct from ag.worker_account_id then
    raise exception 'MEDIA_NOT_FOUND' using errcode='42501';
  end if;
  perform private.closure_assert_open(u);
  if p_message_ids is null or cardinality(p_message_ids) not between 1 and 50
    or array_ndims(p_message_ids)<>1 or array_lower(p_message_ids,1)<>1
    or array_position(p_message_ids,null) is not null
    or (select count(distinct id) from unnest(p_message_ids) id)<>cardinality(p_message_ids) then
    raise exception 'CHAT_DISPLAYED_IDS_INVALID' using errcode='22023';
  end if;
  -- Fail the entire batch before any write if even one ID is unknown or belongs
  -- to another Agreement. The client must supply actual viewability, not a page.
  if (select count(*) from public.agreement_messages m
    where m.agreement_id=p_agreement_id and m.id=any(p_message_ids))<>cardinality(p_message_ids) then
    raise exception 'CHAT_MESSAGE_NOT_AVAILABLE' using errcode='42501';
  end if;
  update public.user_activity_events e set read_at=statement_timestamp()
    from public.agreement_messages m
    where m.agreement_id=p_agreement_id and m.id=any(p_message_ids) and m.sender_account_id<>u
      and e.recipient_user_id=u and e.entity_type='AGREEMENT' and e.entity_id=p_agreement_id
      and e.event_type='MESSAGE_RECEIVED' and e.read_at is null
      and e.dedupe_key='agreement_message:'||m.id::text and e.payload->>'message_id'=m.id::text
      and exists(select 1 from public.notification_deliveries d
        where d.event_id=e.id and d.recipient_user_id=u and d.channel='IN_APP' and d.state<>'SUPPRESSED');
  get diagnostics changed=row_count;
  perform private.support_auth_v5(u);
  return jsonb_build_object('schema','AGREEMENT_MESSAGE_READ_V1','accountId',u,'agreementId',p_agreement_id,
    'displayedMessageIds',to_jsonb(p_message_ids),'markedEventCount',changed,'authoritative',true);
end
$read$;

revoke all on function public.rpc_read_agreement_messages_page_v1(uuid,uuid,integer,timestamptz,uuid),
  public.rpc_mark_displayed_agreement_messages_v1(uuid,uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function public.rpc_read_agreement_messages_page_v1(uuid,uuid,integer,timestamptz,uuid),
  public.rpc_mark_displayed_agreement_messages_v1(uuid,uuid,uuid[]) to authenticated;

do $post$
declare pin record;
begin
  for pin in select * from (values
    ('public.rpc_read_agreement_messages_page_v1(uuid,uuid,integer,timestamptz,uuid)','912f1c7e4df9c8c933351f45bd1fa1c5'),
    ('public.rpc_mark_displayed_agreement_messages_v1(uuid,uuid,uuid[])','27e5395f9ba25e0bccd5136dfde5d931')
  ) p(signature,body_md5) loop
    if not exists(select 1 from pg_proc where oid=to_regprocedure(pin.signature)
      and md5(replace(prosrc,E'\r\n',E'\n'))=pin.body_md5 and prosecdef and provolatile='v'
      and proconfig=array['search_path=pg_catalog'])
      or has_function_privilege('anon',pin.signature,'EXECUTE')
      or has_function_privilege('service_role',pin.signature,'EXECUTE')
      or not has_function_privilege('authenticated',pin.signature,'EXECUTE') then
      raise exception 'CHAT_B3A_FUNCTION_MISMATCH: %',pin.signature using errcode='55000';
    end if;
  end loop;
  if private.closure_source_digest_v5() is distinct from (select digest from chat_b3a_before)
    or (select sha256 from private.closure_source_v5 where singleton) is distinct from (select digest from chat_b3a_before)
    or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from (select erasure from chat_b3a_before)
    or private.closure_erasure_binding_v5() is distinct from (select binding from chat_b3a_before)
    or private.retention_ai_source_ready() is distinct from true then
    raise exception 'CHAT_B3A_CERTIFICATE_CHANGED' using errcode='55000';
  end if;
end
$post$;
notify pgrst,'reload schema';
commit;

-- Chat B3b SOURCE-ONLY CANDIDATE. NOT RUN / NOT APPLIED.
-- One additive authenticated read RPC after the reviewed B3a source.
-- No event resolution, read acknowledgement, stream, writer, index or certificate change.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
create temporary table chat_b3b_before on commit drop as
select private.closure_source_digest_v5() as digest,
  (select to_jsonb(c) from private.closure_source_v5 c where singleton) as certificate,
  (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) as erasure_certificate,
  private.closure_erasure_binding_v5() as binding,
  pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) as readiness_definition;

do $pre$
declare pin record; s text;
begin
  if to_regprocedure('public.rpc_read_agreement_message_window_v1(uuid,uuid,uuid,integer,integer)') is not null then
    raise exception 'CHAT_B3B_ALREADY_APPLIED' using errcode='55000';
  end if;
  for pin in select * from (values
    ('private.support_auth_v5(uuid)','66773994698c60b9fab919f2a9fda93a'),
    ('private.agreement_photo_context_v5(uuid,uuid,integer,boolean)','7790c5be70effa702dd106ab6ae8f807'),
    ('public.rpc_read_agreement_photo_messages_v5(uuid,uuid,uuid[])','9c5a0868e9507b23b600863f4508a5a5'),
    ('public.rpc_read_agreement_messages_page_v1(uuid,uuid,integer,timestamptz,uuid)','912f1c7e4df9c8c933351f45bd1fa1c5'),
    ('public.rpc_mark_displayed_agreement_messages_v1(uuid,uuid,uuid[])','27e5395f9ba25e0bccd5136dfde5d931')
  ) p(signature,body_md5) loop
    if not exists(select 1 from pg_proc where oid=to_regprocedure(pin.signature)
      and md5(replace(prosrc,E'\r\n',E'\n'))=pin.body_md5 and prosecdef
      and proconfig=array['search_path=pg_catalog']) then
      raise exception 'CHAT_B3B_PREDECESSOR_DRIFT: %',pin.signature using errcode='55000';
    end if;
  end loop;
  s:=(select digest from chat_b3b_before);
  if s is null or s is distinct from (select sha256 from private.closure_source_v5 where singleton)
    or s is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
    or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from s
    or private.retention_ai_source_ready() is distinct from true then
    raise exception 'CHAT_B3B_CLOSURE_NOT_READY' using errcode='55000';
  end if;
  -- Existing target PK and Agreement/time prefix only. The prefix lacks the UUID
  -- tie-breaker; output is bounded, but no tie-heavy scan-cost claim is made.
  if not exists(select 1 from pg_index i join pg_attribute a
      on a.attrelid=i.indrelid and a.attname='id'
      where i.indrelid='public.agreement_messages'::regclass and i.indisprimary
        and i.indisvalid and i.indisready and i.indnkeyatts=1 and i.indkey[0]=a.attnum)
    or not exists(select 1 from pg_index i join pg_class c on c.oid=i.indexrelid
      join pg_am am on am.oid=c.relam join pg_attribute a on a.attrelid=i.indrelid and a.attname='agreement_id'
      join pg_attribute t on t.attrelid=i.indrelid and t.attname='created_at'
      where i.indrelid='public.agreement_messages'::regclass and am.amname='btree'
        and i.indisvalid and i.indisready and i.indpred is null and i.indnkeyatts>=2
        and i.indkey[0]=a.attnum and i.indkey[1]=t.attnum) then
    raise exception 'CHAT_B3B_EXISTING_INDEX_REQUIRED' using errcode='55000';
  end if;
end
$pre$;

create function public.rpc_read_agreement_message_window_v1(
  p_expected_user_id uuid,p_agreement_id uuid,p_target_message_id uuid,
  p_before_count integer default 24,p_after_count integer default 25)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $window$
declare
  u uuid:=private.support_auth_v5(p_expected_user_id); ag public.agreements;
  target_at timestamptz; page_rows jsonb; photo_rows jsonb; messages jsonb; ids uuid[];
  has_before boolean; has_after boolean; before_cursor jsonb:=null; after_cursor jsonb:=null;
begin
  ag:=private.agreement_photo_context_v5(u,p_agreement_id,null,false);
  -- NULL participants are permitted by the schema; NOT IN alone is insufficient.
  if u is distinct from ag.requester_account_id and u is distinct from ag.worker_account_id then
    raise exception 'MEDIA_NOT_FOUND' using errcode='42501';
  end if;
  if p_before_count is null or p_after_count is null
    or p_before_count not between 0 and 49 or p_after_count not between 0 and 49 then
    raise exception 'CHAT_WINDOW_INVALID' using errcode='22023';
  end if;
  if p_before_count+p_after_count>49 then raise exception 'CHAT_WINDOW_INVALID' using errcode='22023';end if;
  select m.created_at into target_at from public.agreement_messages m
    where m.id=p_target_message_id and m.agreement_id=p_agreement_id;
  if not found then raise exception 'CHAT_MESSAGE_NOT_AVAILABLE' using errcode='42501';end if;

  -- Each side retains only its requested nearest rows plus one existence probe.
  -- All three branches use the same statement snapshot; the target is never trimmed.
  with before_rows as materialized (
    select m.* from public.agreement_messages m where m.agreement_id=p_agreement_id
      and (m.created_at,m.id)<(target_at,p_target_message_id)
    order by m.created_at desc,m.id desc limit p_before_count+1
  ), after_rows as materialized (
    select m.* from public.agreement_messages m where m.agreement_id=p_agreement_id
      and (m.created_at,m.id)>(target_at,p_target_message_id)
    order by m.created_at,m.id limit p_after_count+1
  ), window_rows as (
    (select * from before_rows order by created_at desc,id desc limit p_before_count)
    union all
    (select m.* from public.agreement_messages m where m.id=p_target_message_id
      and m.agreement_id=p_agreement_id and m.created_at=target_at)
    union all
    (select * from after_rows order by created_at,id limit p_after_count)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'messageId',m.id,'agreementVersion',m.agreement_version,'senderAccountId',m.sender_account_id,
      'clientMessageId',m.client_message_id,'body',m.body,'createdAt',m.created_at,
      'kind',case when cardinality(m.photo_asset_ids)>0 then 'PHOTO' else 'TEXT' end,
      'mine',m.sender_account_id=u) order by m.created_at,m.id),'[]'::jsonb),
    array_agg(m.id order by m.created_at,m.id),
    (select count(*)>p_before_count from before_rows),(select count(*)>p_after_count from after_rows)
    into page_rows,ids,has_before,has_after from window_rows m;
  if cardinality(ids) is null or cardinality(ids)>50 or not p_target_message_id=any(ids) then
    raise exception 'CHAT_MESSAGE_NOT_AVAILABLE' using errcode='42501';
  end if;
  -- B3a's explicit TEXT/PHOTO projection and validated metadata identity join.
  photo_rows:=public.rpc_read_agreement_photo_messages_v5(u,p_agreement_id,ids)->'messages';
  select jsonb_agg(r.value||jsonb_build_object('photos',p.value->'photos') order by r.ord)
    into messages from jsonb_array_elements(page_rows) with ordinality r(value,ord)
    join jsonb_array_elements(photo_rows) p(value) on p.value->>'messageId'=r.value->>'messageId'
      and p.value->>'agreementVersion'=r.value->>'agreementVersion'
      and p.value->'clientMessageId'=r.value->'clientMessageId' and p.value->>'body'=r.value->>'body';
  if messages is null or jsonb_array_length(messages)<>cardinality(ids) then
    raise exception 'CHAT_MESSAGE_PROJECTION_CHANGED' using errcode='55000';
  end if;
  if has_before then before_cursor:=jsonb_build_object('createdAt',page_rows->0->'createdAt','messageId',page_rows->0->'messageId');end if;
  if has_after then after_cursor:=jsonb_build_object('createdAt',page_rows->-1->'createdAt','messageId',page_rows->-1->'messageId');end if;
  perform private.support_auth_v5(u);
  return jsonb_build_object('schema','AGREEMENT_MESSAGE_WINDOW_V1','accountId',u,'agreementId',p_agreement_id,
    'targetMessageId',p_target_message_id,'messages',messages,'beforeCursor',before_cursor,'afterCursor',after_cursor,
    'asOf',statement_timestamp(),'authoritative',true);
end
$window$;

revoke all on function public.rpc_read_agreement_message_window_v1(uuid,uuid,uuid,integer,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.rpc_read_agreement_message_window_v1(uuid,uuid,uuid,integer,integer) to authenticated;

do $post$
begin
  if not exists(select 1 from pg_proc where oid='public.rpc_read_agreement_message_window_v1(uuid,uuid,uuid,integer,integer)'::regprocedure
      and md5(replace(prosrc,E'\r\n',E'\n'))='9ae403a4c1ba9130e18cdd5b3dd831f6'
      and prosecdef and provolatile='v' and proconfig=array['search_path=pg_catalog'])
    or has_function_privilege('anon','public.rpc_read_agreement_message_window_v1(uuid,uuid,uuid,integer,integer)','EXECUTE')
    or has_function_privilege('service_role','public.rpc_read_agreement_message_window_v1(uuid,uuid,uuid,integer,integer)','EXECUTE')
    or not has_function_privilege('authenticated','public.rpc_read_agreement_message_window_v1(uuid,uuid,uuid,integer,integer)','EXECUTE') then
    raise exception 'CHAT_B3B_FUNCTION_MISMATCH' using errcode='55000';
  end if;
  if private.closure_source_digest_v5() is distinct from (select digest from chat_b3b_before)
    or (select to_jsonb(c) from private.closure_source_v5 c where singleton) is distinct from (select certificate from chat_b3b_before)
    or (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) is distinct from (select erasure_certificate from chat_b3b_before)
    or private.closure_erasure_binding_v5() is distinct from (select binding from chat_b3b_before)
    or pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) is distinct from (select readiness_definition from chat_b3b_before)
    or private.retention_ai_source_ready() is distinct from true then
    raise exception 'CHAT_B3B_CERTIFICATE_CHANGED' using errcode='55000';
  end if;
end
$post$;
notify pgrst,'reload schema';
commit;

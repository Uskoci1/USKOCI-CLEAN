-- SOURCE CANDIDATE ONLY. Included by candidate.sql; never applied in this task.
create function public.rpc_list_my_conversations_v1(
  p_expected_user_id uuid, p_limit integer default 30, p_cursor jsonb default null
) returns jsonb language plpgsql security definer set search_path = pg_catalog
as $inbox$
declare
  u uuid := private.support_auth_v5(p_expected_user_id);
  snapshot_at timestamptz := statement_timestamp();
  cursor_at timestamptz; cursor_kind text; cursor_id uuid;
  selected jsonb; items jsonb; tail jsonb; next_cursor jsonb := null;
begin
  if private.closure_account_restricted(u) then
    raise exception 'ACCOUNT_CLOSING' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception 'INBOX_LIMIT_INVALID' using errcode = '22023';
  end if;
  if p_cursor is not null then
    if jsonb_typeof(p_cursor) is distinct from 'object' then
      raise exception 'INBOX_CURSOR_INVALID' using errcode = '22023';
    end if;
    if (select count(*) from jsonb_object_keys(p_cursor)) <> 4
       or not (p_cursor ?& array['snapshotAt','lastAt','kind','id'])
       or jsonb_typeof(p_cursor->'snapshotAt') is distinct from 'string'
       or jsonb_typeof(p_cursor->'lastAt') is distinct from 'string'
       or jsonb_typeof(p_cursor->'kind') is distinct from 'string'
       or jsonb_typeof(p_cursor->'id') is distinct from 'string'
       or p_cursor->>'kind' not in ('AGREEMENT','GROUP')
       or (p_cursor->>'id') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       or length(p_cursor->>'snapshotAt') > 40 or length(p_cursor->>'lastAt') > 40
       or (p_cursor->>'snapshotAt') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$'
       or (p_cursor->>'lastAt') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$' then
      raise exception 'INBOX_CURSOR_INVALID' using errcode = '22023';
    end if;
    begin
      snapshot_at := (p_cursor->>'snapshotAt')::timestamptz;
      cursor_at := (p_cursor->>'lastAt')::timestamptz;
      cursor_kind := p_cursor->>'kind'; cursor_id := (p_cursor->>'id')::uuid;
    exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
      raise exception 'INBOX_CURSOR_INVALID' using errcode = '22023';
    end;
    if not isfinite(snapshot_at) or not isfinite(cursor_at)
       or snapshot_at > statement_timestamp() or cursor_at > snapshot_at then
      raise exception 'INBOX_CURSOR_INVALID' using errcode = '22023';
    end if;
  end if;

  -- Positive party test is the same read boundary as agreement_voice_context_v1(false).
  -- Do not filter by writable state: closed Agreements retain their admitted history.
  with own_agreements as materialized (
    select a.* from public.agreements a
    where a.requester_account_id = u or a.worker_account_id = u
  ), private_rows as (
    select 'AGREEMENT'::text kind, a.id, m.created_at last_at,
      jsonb_build_object('kind','AGREEMENT','id',a.id,'routeAgreementId',a.id,
        'task',jsonb_build_object('id',a.need_id,'title',left(coalesce(nullif(btrim(n.title),''),'Zadatak'),1000)),
        'counterpart',case when p.id is null or private.closure_account_restricted(p.account_id) then null
          else jsonb_build_object('profileId',p.id,'displayName',left(coalesce(nullif(btrim(p.display_name),''),'Učesnik'),200)) end,
        'lastMessage',jsonb_build_object('id',m.id,'createdAt',m.created_at,'mine',m.sender_account_id = u,
          'kind',case when m.voice_asset_id is not null then 'VOICE'
            when cardinality(m.photo_asset_ids) > 0 then 'PHOTO' else 'TEXT' end,
          'preview',case when m.voice_asset_id is not null then null else nullif(left(btrim(m.body),240),'') end),
        -- Legacy Agreement read_at is not maintained by the measured-message ACK.
        'unreadMessageCount',null) document
    from own_agreements a join public.needs n on n.id = a.need_id
    left join public.app_profiles p on p.id = case when a.requester_account_id = u then a.worker_profile_id else a.requester_profile_id end
    join lateral (
      select x.* from public.agreement_messages x
      where x.agreement_id = a.id and x.created_at <= snapshot_at
      order by x.created_at desc,x.id desc limit 1
    ) m on true
  ), own_groups as materialized (
    select g.*, route.id route_agreement_id
    from private.group_conversations_v5 g
    join lateral (
      select a.id from own_agreements a where a.need_id = g.need_id order by a.id limit 1
    ) route on true
    where private.group_member_v5(g,u)
  ), group_rows as (
    select 'GROUP'::text kind,g.id,m.created_at last_at,
      jsonb_build_object('kind','GROUP','id',g.id,'routeAgreementId',g.route_agreement_id,
        'task',jsonb_build_object('id',g.need_id,'title',left(coalesce(nullif(btrim(n.title),''),'Zadatak'),1000)),
        'counterpart',null,
        'lastMessage',jsonb_build_object('id',m.id,'createdAt',m.created_at,'mine',m.sender_account_id = u,
          'kind','TEXT','preview',nullif(left(btrim(m.body),240),'')),
        'unreadMessageCount',(select count(*) from private.group_messages_v5 gm
          join private.group_message_visibility_v5 visible on visible.message_id = gm.id and visible.account_id = u
          where gm.group_id = g.id and gm.created_at <= snapshot_at and visible.read_at is null)) document
    from own_groups g join public.needs n on n.id = g.need_id
    join lateral (
      -- Membership does not imply access to messages sent before admission or after removal.
      select x.id,x.created_at,x.sender_account_id,x.body from private.group_messages_v5 x
      join private.group_message_visibility_v5 visible on visible.message_id = x.id and visible.account_id = u
      where x.group_id = g.id and x.created_at <= snapshot_at
      order by x.created_at desc,x.id desc limit 1
    ) m on true
  ), conversations as (
    select * from private_rows union all select * from group_rows
  ), page as (
    select c.* from conversations c
    where cursor_id is null or (c.last_at,c.kind collate "C",c.id) < (cursor_at,cursor_kind collate "C",cursor_id)
    order by c.last_at desc,c.kind collate "C" desc,c.id desc limit p_limit + 1
  )
  select coalesce(jsonb_agg(document order by page.last_at desc,kind collate "C" desc,id desc),'[]'::jsonb)
    into selected from page;

  select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) into items
    from jsonb_array_elements(selected) with ordinality r(value,ord) where ord <= p_limit;
  if jsonb_array_length(selected) > p_limit then
    tail := items->(p_limit - 1);
    next_cursor := jsonb_build_object('snapshotAt',snapshot_at,'lastAt',tail->'lastMessage'->'createdAt',
      'kind',tail->'kind','id',tail->'id');
  end if;
  perform private.support_auth_v5(u);
  if private.closure_account_restricted(u) then
    raise exception 'ACCOUNT_CLOSING' using errcode = '42501';
  end if;
  return jsonb_build_object('schema','MY_CONVERSATIONS_PAGE_V1','accountId',u,'authoritative',true,
    'asOf',statement_timestamp(),'snapshotAt',snapshot_at,'items',items,'nextCursor',next_cursor);
end
$inbox$;

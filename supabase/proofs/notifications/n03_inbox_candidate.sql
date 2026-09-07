-- N03 S06 event Inbox. PROOF-ONLY CANDIDATE, NOT LIVE / NOT APPLIED HISTORY.
-- Extend the existing durable event owner; never use transport state as read truth.
begin;
alter table public.user_activity_events add column read_at timestamptz;
create index activity_inbox_page_idx on public.user_activity_events
  (recipient_user_id,created_at desc,id desc);
create index activity_inbox_unread_idx on public.user_activity_events
  (recipient_user_id,recipient_role) where read_at is null;
create index delivery_inbox_copy_idx on public.notification_deliveries
  (event_id,created_at,id) where channel='IN_APP';

create function public.rpc_list_inbox(
  p_role text default null, p_limit integer default 30,
  p_before_at timestamptz default null, p_before_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $inbox$
declare
  v_uid uuid := auth.uid();
  v_items jsonb;
  v_unread bigint;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_role is not null and p_role not in ('REQUESTER','WORKER') then
    raise exception 'INVALID_ROLE' using errcode='22023'; end if;
  if p_limit is null or p_limit < 1 or p_limit > 100
     or (p_before_at is null) <> (p_before_id is null) then
    raise exception 'INVALID_PAGE' using errcode='22023'; end if;
  select count(*) into v_unread from public.user_activity_events e
    where e.recipient_user_id=v_uid and (p_role is null or e.recipient_role=p_role) and e.read_at is null;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'eventType',q.event_type,'role',q.recipient_role,'occurredAt',q.created_at,
    'readAt',q.read_at,'title',coalesce(d.title,'Novo obaveštenje'),
    'body',coalesce(d.body,'Otvorite za trenutne informacije.'),
    'family',private.category_of_event(q.event_type)
  ) order by q.created_at desc,q.id desc),'[]'::jsonb) into v_items
  from (
    select e.id,e.event_type,e.recipient_role,e.created_at,e.read_at
    from public.user_activity_events e
    where e.recipient_user_id=v_uid and (p_role is null or e.recipient_role=p_role)
      and (p_before_at is null or (e.created_at,e.id)<(p_before_at,p_before_id))
    order by e.created_at desc,e.id desc limit p_limit+1
  ) q
  left join lateral (
    select nd.title,nd.body from public.notification_deliveries nd
    where nd.event_id=q.id and nd.recipient_user_id=v_uid and nd.channel='IN_APP'
    order by nd.created_at,nd.id limit 1
  ) d on true;
  return jsonb_build_object('items',case when jsonb_array_length(v_items)>p_limit
      then v_items - p_limit else v_items end,
    'hasMore',jsonb_array_length(v_items)>p_limit,'unreadCount',v_unread,'asOf',statement_timestamp());
end
$inbox$;

create function public.rpc_mark_activity_event_read(p_event_id uuid)
returns timestamptz language plpgsql security definer set search_path=pg_catalog
as $read$
declare v_uid uuid := auth.uid(); v_read_at timestamptz;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  update public.user_activity_events set read_at=coalesce(read_at,statement_timestamp())
    where id=p_event_id and recipient_user_id=v_uid returning read_at into v_read_at;
  if not found then raise exception 'EVENT_NOT_FOUND' using errcode='P0002'; end if;
  return v_read_at;
end
$read$;

create function public.rpc_mark_inbox_read(p_through timestamptz,p_role text default null)
returns integer language plpgsql security definer set search_path=pg_catalog
as $readall$
declare v_uid uuid := auth.uid(); v_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_through is null or p_through>statement_timestamp()
     or (p_role is not null and p_role not in ('REQUESTER','WORKER')) then
    raise exception 'INVALID_READ_BOUNDARY' using errcode='22023'; end if;
  update public.user_activity_events set read_at=statement_timestamp()
    where recipient_user_id=v_uid and (p_role is null or recipient_role=p_role)
      and created_at<=p_through and read_at is null;
  get diagnostics v_count=row_count;
  return v_count;
end
$readall$;

-- Invoker deliberately applies current entity RLS on every tap. Opaque event ID
-- is only an intent, never an authorization grant or a client-supplied route.
create function public.rpc_resolve_activity_event(p_event_id uuid)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog
as $target$
declare
  v_uid uuid := auth.uid();
  e public.user_activity_events%rowtype;
  a public.agreements%rowtype;
  r public.marketplace_responses%rowtype;
  n public.needs%rowtype;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  select * into e from public.user_activity_events where id=p_event_id and recipient_user_id=v_uid;
  if not found then raise exception 'EVENT_NOT_FOUND' using errcode='P0002'; end if;
  if e.entity_type='AGREEMENT' then
    select * into a from public.agreements where id=e.entity_id
      and v_uid in (requester_account_id,worker_account_id);
    if found then return jsonb_build_object('kind','AGREEMENT','id',a.id,'role',e.recipient_role); end if;
  elsif e.entity_type='RESPONSE' then
    select * into r from public.marketplace_responses where id=e.entity_id;
    if found then
      select * into a from public.agreements where selected_response_id=r.id
        and v_uid in (requester_account_id,worker_account_id) order by created_at desc,id desc limit 1;
      if found then return jsonb_build_object('kind','AGREEMENT','id',a.id,'role',e.recipient_role); end if;
      if r.worker_account_id=v_uid then return jsonb_build_object('kind','APPLICATIONS','id',r.id,'role','WORKER'); end if;
      select * into n from public.needs where id=r.need_id and requester_account_id=v_uid;
      if found then return jsonb_build_object('kind','CANDIDATES','id',n.id,'role','REQUESTER'); end if;
    end if;
  elsif e.entity_type='NEED' then
    select * into n from public.needs where id=e.entity_id;
    if found then return jsonb_build_object('kind',case when n.requester_account_id=v_uid then 'OWN_NEED' else 'OPPORTUNITY' end,
      'id',n.id,'role',case when n.requester_account_id=v_uid then 'REQUESTER' else 'WORKER' end); end if;
  end if;
  return jsonb_build_object('kind','UNAVAILABLE');
end
$target$;

-- Keep durable event writes server-owned. Delivery write privileges are not opened.
revoke insert,update,delete on public.user_activity_events from anon,authenticated;
revoke all on function public.rpc_list_inbox(text,integer,timestamptz,uuid) from public,anon,service_role;
revoke all on function public.rpc_mark_activity_event_read(uuid) from public,anon,service_role;
revoke all on function public.rpc_mark_inbox_read(timestamptz,text) from public,anon,service_role;
revoke all on function public.rpc_resolve_activity_event(uuid) from public,anon,service_role;
grant execute on function public.rpc_list_inbox(text,integer,timestamptz,uuid) to authenticated;
grant execute on function public.rpc_mark_activity_event_read(uuid) to authenticated;
grant execute on function public.rpc_mark_inbox_read(timestamptz,text) to authenticated;
grant execute on function public.rpc_resolve_activity_event(uuid) to authenticated;
commit;

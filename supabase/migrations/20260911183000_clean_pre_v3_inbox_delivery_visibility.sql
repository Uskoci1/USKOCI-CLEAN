-- PRE-V3 P04: delivery-aware Inbox, without deleting durable audit events.
-- Quiet hours suppress PUSH only. Existing IN_APP READ/CREATED deliveries remain
-- visible; category/IN_APP suppression at emission hides that event and count.
-- This does not retrospectively rewrite prior valid deliveries on preference edit.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $preflight$
begin
  if (select md5(prosrc) from pg_proc where oid='public.rpc_list_inbox(text,integer,timestamptz,uuid)'::regprocedure) is distinct from 'e9007393bba828af26f52488b04b6660' then raise exception 'PRE_V3_INBOX_PREDECESSOR_CHANGED'; end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_mark_activity_event_read(uuid)'::regprocedure) is distinct from '72c52a6ca57439a4e7c773b452191c3d' then raise exception 'PRE_V3_INBOX_PREDECESSOR_CHANGED'; end if;
  if (select md5(prosrc) from pg_proc where oid='public.rpc_mark_inbox_read(timestamptz,text)'::regprocedure) is distinct from 'a341da19c834ebb24ecd6fb13bf66799' then raise exception 'PRE_V3_INBOX_PREDECESSOR_CHANGED'; end if;
  if (select md5(prosrc) from pg_proc where oid='private.category_of_event(text)'::regprocedure) is distinct from 'ebf240d01493496be0f7cadff17943d2' then raise exception 'PRE_V3_INBOX_PREDECESSOR_CHANGED'; end if;
end;
$preflight$;
create or replace function public.rpc_list_inbox(
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
    where e.recipient_user_id=v_uid and (p_role is null or e.recipient_role=p_role) and e.read_at is null
      and exists(select 1 from public.notification_deliveries visible
        where visible.event_id=e.id and visible.recipient_user_id=v_uid
          and visible.channel='IN_APP' and visible.state<>'SUPPRESSED');
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
      and exists(select 1 from public.notification_deliveries visible
        where visible.event_id=e.id and visible.recipient_user_id=v_uid
          and visible.channel='IN_APP' and visible.state<>'SUPPRESSED')
      and (p_before_at is null or (e.created_at,e.id)<(p_before_at,p_before_id))
    order by e.created_at desc,e.id desc limit p_limit+1
  ) q
  left join lateral (
    select nd.title,nd.body from public.notification_deliveries nd
    where nd.event_id=q.id and nd.recipient_user_id=v_uid and nd.channel='IN_APP' and nd.state<>'SUPPRESSED'
    order by nd.created_at,nd.id limit 1
  ) d on true;
  return jsonb_build_object('items',case when jsonb_array_length(v_items)>p_limit
      then v_items - p_limit else v_items end,
    'hasMore',jsonb_array_length(v_items)>p_limit,'unreadCount',v_unread,'asOf',statement_timestamp());
end
$inbox$;

create or replace function public.rpc_mark_activity_event_read(p_event_id uuid)
returns timestamptz language plpgsql security definer set search_path=pg_catalog
as $read$
declare v_uid uuid := auth.uid(); v_read_at timestamptz;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  update public.user_activity_events e set read_at=coalesce(read_at,statement_timestamp())
    where id=p_event_id and recipient_user_id=v_uid
      and exists(select 1 from public.notification_deliveries visible
        where visible.event_id=e.id and visible.recipient_user_id=v_uid
          and visible.channel='IN_APP' and visible.state<>'SUPPRESSED') returning read_at into v_read_at;
  if not found then raise exception 'EVENT_NOT_FOUND' using errcode='P0002'; end if;
  return v_read_at;
end
$read$;

create or replace function public.rpc_mark_inbox_read(p_through timestamptz,p_role text default null)
returns integer language plpgsql security definer set search_path=pg_catalog
as $readall$
declare v_uid uuid := auth.uid(); v_count integer;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_through is null or p_through>statement_timestamp()
     or (p_role is not null and p_role not in ('REQUESTER','WORKER')) then
    raise exception 'INVALID_READ_BOUNDARY' using errcode='22023'; end if;
  update public.user_activity_events e set read_at=statement_timestamp()
    where recipient_user_id=v_uid and (p_role is null or recipient_role=p_role)
      and created_at<=p_through and read_at is null
      and exists(select 1 from public.notification_deliveries visible
        where visible.event_id=e.id and visible.recipient_user_id=v_uid
          and visible.channel='IN_APP' and visible.state<>'SUPPRESSED');
  get diagnostics v_count=row_count;
  return v_count;
end
$readall$;

create or replace function private.category_of_event(p_event_type text)
returns text language sql immutable set search_path to 'pg_catalog' as $$
  select case
    when p_event_type = 'OPPORTUNITY_AVAILABLE' then 'opportunities'
    when p_event_type like 'RESPONSE\_%'
      or p_event_type in ('NEED_REVISED','NEED_CANCELLED','CLARIFICATION_CREATED','CLARIFICATION_ANSWERED') then 'responses'
    when p_event_type like 'AGREEMENT\_%'
      or p_event_type in ('MESSAGE_RECEIVED','PRIVATE_ACCESS_GRANTED','REVIEW_RECEIVED') then 'dogovor'
    when p_event_type in ('EXECUTION_STATE_CHANGED','COMPLETION_REQUIRED') then 'execution'
    when p_event_type = 'RECOVERY_OPENED' then 'recovery'
    else 'account'
  end;
$$;
notify pgrst,'reload schema';
commit;

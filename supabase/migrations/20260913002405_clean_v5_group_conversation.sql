-- V5 true group coordination over existing per-participant Agreements.
-- L007A/B/C/C.1, L021/22, AF-D13/D14. No prices/terms copied into group storage.
-- New/replacement members see from admission onward. Cancelled members retain
-- their previously granted history, never future messages. No live activation.
begin;
set local lock_timeout='5s';set local statement_timeout='30s';

create table private.group_conversations_v5(
 id uuid primary key default gen_random_uuid(),need_id uuid not null unique references public.needs(id),
 requester_account_id uuid not null references public.app_accounts(id),
 sequence bigint not null default 0 check(sequence between 0 and 9007199254740990),
 created_at timestamptz not null default clock_timestamp());
create table private.group_memberships_v5(
 group_id uuid not null references private.group_conversations_v5(id),
 agreement_id uuid primary key references public.agreements(id),account_id uuid not null references public.app_accounts(id),
 profile_id uuid not null references public.app_profiles(id),
 joined_sequence bigint not null check(joined_sequence>0),ended_sequence bigint check(ended_sequence>=joined_sequence-1),
 joined_at timestamptz not null default clock_timestamp(),ended_at timestamptz,
 check((ended_sequence is null)=(ended_at is null)));
create index group_memberships_account_v5 on private.group_memberships_v5(account_id,group_id);
create index group_memberships_active_v5 on private.group_memberships_v5(group_id,account_id) where ended_sequence is null;
create table private.group_messages_v5(
 id uuid primary key default gen_random_uuid(),group_id uuid not null references private.group_conversations_v5(id),
 sequence bigint not null check(sequence>0),sender_account_id uuid not null references public.app_accounts(id),
 client_request_id uuid not null,body text not null check(char_length(body) between 1 and 2000 and body=btrim(body)),
 body_sha256 text not null check(body_sha256~'^[a-f0-9]{64}$'),created_at timestamptz not null default clock_timestamp(),
 unique(group_id,sequence),unique(sender_account_id,client_request_id));
create table private.group_message_visibility_v5(
 message_id uuid not null references private.group_messages_v5(id) on delete cascade,
 account_id uuid not null references public.app_accounts(id),read_at timestamptz,
 primary key(message_id,account_id));
create index group_visibility_account_v5 on private.group_message_visibility_v5(account_id,message_id);
create index group_visibility_unread_v5 on private.group_message_visibility_v5(account_id,message_id) where read_at is null;
alter table private.group_conversations_v5 enable row level security;
alter table private.group_memberships_v5 enable row level security;
alter table private.group_messages_v5 enable row level security;
alter table private.group_message_visibility_v5 enable row level security;
revoke all on private.group_conversations_v5,private.group_memberships_v5,private.group_messages_v5,private.group_message_visibility_v5
 from public,anon,authenticated,service_role;
comment on table private.group_message_visibility_v5 is 'Immutable per-message recipient admission. Missing grants are never backfilled after unblock or rejoin. Read markers do not create visibility.';

create function private.group_sync_agreement_v5(a public.agreements) returns void
language plpgsql security definer set search_path=pg_catalog as $f$
declare g private.group_conversations_v5;n public.needs;
begin
 select * into g from private.group_conversations_v5 where need_id=a.need_id for update;
 if not found then
  -- A single worker bringing several people still has the existing private
  -- Agreement. The shared conversation starts with two independently selected
  -- accounts. There is no earlier group history to grant retroactively.
  select * into n from public.needs where id=a.need_id;
  if (select count(distinct worker_account_id) from public.agreements where need_id=a.need_id and status<>'CANCELLED')<2 then return;end if;
  insert into private.group_conversations_v5(need_id,requester_account_id) values(n.id,n.requester_account_id)
   on conflict(need_id) do nothing;
  select * into g from private.group_conversations_v5 where need_id=a.need_id for update;
  insert into private.group_memberships_v5(group_id,agreement_id,account_id,profile_id,joined_sequence)
   select g.id,x.id,x.worker_account_id,x.worker_profile_id,g.sequence+1 from public.agreements x
   where x.need_id=a.need_id and x.status<>'CANCELLED' on conflict(agreement_id) do nothing;
 end if;
 if a.status='CANCELLED' then
  update private.group_memberships_v5 set ended_sequence=g.sequence,ended_at=clock_timestamp()
   where agreement_id=a.id and ended_sequence is null;
 else
  insert into private.group_memberships_v5(group_id,agreement_id,account_id,profile_id,joined_sequence)
   values(g.id,a.id,a.worker_account_id,a.worker_profile_id,g.sequence+1) on conflict(agreement_id) do nothing;
 end if;
end $f$;
create function private.group_agreement_changed_v5() returns trigger
language plpgsql security definer set search_path=pg_catalog as $f$
begin perform private.group_sync_agreement_v5(new);return new;end $f$;
create trigger v5_group_agreement_admission after insert or update of status on public.agreements
 for each row execute function private.group_agreement_changed_v5();
create function private.group_need_changed_v5() returns trigger
language plpgsql security definer set search_path=pg_catalog as $f$
begin
 -- Serialize terminal visibility with sends without adding a second Need writer.
 perform 1 from private.group_conversations_v5 where need_id=new.id for update;return new;
end $f$;
create trigger v5_group_need_lifecycle after update of status on public.needs
 for each row execute function private.group_need_changed_v5();
-- Explicit source-only bootstrap: currently selected participants enter a new,
-- empty conversation at sequence1. No old private chat is copied or exposed.
-- Applying this candidate to live data is part of the separate concrete batch.
do $bootstrap$ declare a public.agreements;begin
 for a in select * from public.agreements where status<>'CANCELLED' order by need_id,id loop
  perform private.group_sync_agreement_v5(a);
 end loop;
end $bootstrap$;

create function private.group_member_v5(g private.group_conversations_v5,u uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $f$
 select u is not null and not private.closure_account_restricted(u)
 and (g.requester_account_id=u or exists(select 1 from private.group_memberships_v5 m where m.group_id=g.id and m.account_id=u));
$f$;
create function private.group_can_send_v5(g private.group_conversations_v5,u uuid) returns boolean
language sql stable security definer set search_path=pg_catalog as $f$
 select private.group_member_v5(g,u) and not private.closure_account_restricted(g.requester_account_id)
 and exists(select 1 from public.needs n where n.id=g.need_id and n.status not in('COMPLETED','CANCELLED','EXPIRED','ARCHIVED'))
 and (g.requester_account_id=u or (exists(select 1 from private.group_memberships_v5 m where m.group_id=g.id and m.account_id=u and m.ended_sequence is null)
 and not private.safety_pair_blocked(u,g.requester_account_id)));
$f$;
create function public.rpc_read_group_context_v5(p_expected_user_id uuid,p_agreement_id uuid,p_management_after_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid();a public.agreements;g private.group_conversations_v5;n public.needs;members jsonb;management jsonb;unread integer;active_member boolean;management_next uuid;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000';end if;
 select * into a from public.agreements where id=p_agreement_id and u in(requester_account_id,worker_account_id);
 if not found or private.closure_account_restricted(u) then raise exception 'GROUP_NOT_AVAILABLE' using errcode='42501';end if;
 select * into g from private.group_conversations_v5 where need_id=a.need_id;
 if not found then return jsonb_build_object('accountId',u,'agreementId',a.id,'needId',a.need_id,'available',false,'group',null,'authoritative',true);end if;
 if not private.group_member_v5(g,u) then raise exception 'GROUP_NOT_AVAILABLE' using errcode='42501';end if;
 select * into n from public.needs where id=g.need_id;
 active_member:=g.requester_account_id=u or exists(select 1 from private.group_memberships_v5 where group_id=g.id and account_id=u and ended_sequence is null);
 -- Former members do not learn later admissions or management changes.
 if active_member then
  select coalesce(jsonb_agg(jsonb_build_object('accountId',x.account_id,'profileId',x.profile_id,'displayName',coalesce(nullif(p.display_name,''),'Učesnik'),
   'role',x.role) order by x.role,x.account_id),'[]'::jsonb) into members
  from (select g.requester_account_id account_id,n.requester_profile_id profile_id,'REQUESTER'::text role
   union select m.account_id,m.profile_id,'PARTICIPANT' from private.group_memberships_v5 m where m.group_id=g.id and m.ended_sequence is null) x
   join public.app_profiles p on p.id=x.profile_id where not private.closure_account_restricted(x.account_id);
 else members:='[]'::jsonb;end if;
 if u=g.requester_account_id then
  select coalesce(jsonb_agg(jsonb_build_object('agreementId',x.id,'accountId',x.worker_account_id,'status',x.status,'executionState',e.state,
   'problemOpened',e.problem_opened_at is not null) order by x.id),'[]'::jsonb) into management
  from (select * from public.agreements where need_id=g.need_id and (p_management_after_id is null or id>p_management_after_id) order by id limit 50) x
   left join public.agreement_execution e on e.agreement_id=x.id;
  select x.id into management_next from public.agreements x where x.need_id=g.need_id and (p_management_after_id is null or x.id>p_management_after_id)
   order by x.id offset 49 limit 1;
  if not exists(select 1 from public.agreements where need_id=g.need_id and id>management_next) then management_next:=null;end if;
 end if;
 select count(*)::integer into unread from private.group_messages_v5 m join private.group_message_visibility_v5 v on v.message_id=m.id
  where m.group_id=g.id and v.account_id=u and v.read_at is null;
 return jsonb_build_object('accountId',u,'agreementId',a.id,'needId',a.need_id,'available',true,'authoritative',true,
 'group',jsonb_build_object('groupId',g.id,'title',n.title,'canSend',private.group_can_send_v5(g,u),
 'terminal',n.status in('COMPLETED','CANCELLED','EXPIRED','ARCHIVED'),'role',case when u=g.requester_account_id then 'REQUESTER' else 'PARTICIPANT' end,
 'members',members,'management',management,'managementNextId',management_next,'unreadCount',unread));
end $f$;

create function private.group_message_receipt_v5(m private.group_messages_v5,replayed boolean) returns jsonb
language sql immutable set search_path=pg_catalog as $f$
 select jsonb_build_object('accountId',m.sender_account_id,'groupId',m.group_id,'clientRequestId',m.client_request_id,
 'messageId',m.id,'sequence',m.sequence::text,'bodySha256',m.body_sha256,'createdAt',m.created_at,'idempotentReplay',replayed,'authoritative',true);
$f$;
create function public.rpc_send_group_message_v5(p_expected_user_id uuid,p_group_id uuid,p_client_request_id uuid,p_body text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid();g private.group_conversations_v5;m private.group_messages_v5;body text:=btrim(p_body);r uuid;seq bigint;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000';end if;
 if p_group_id is null or p_client_request_id is null or body is null or char_length(body) not between 1 and 2000 then raise exception 'GROUP_MESSAGE_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('uskoci:group-message:'||u::text||':'||p_client_request_id::text,137));
 select * into g from private.group_conversations_v5 where id=p_group_id for update;
 if not found or not private.group_member_v5(g,u) then raise exception 'GROUP_NOT_AVAILABLE' using errcode='42501';end if;
 select * into m from private.group_messages_v5 where sender_account_id=u and client_request_id=p_client_request_id;
 if found then
  if m.group_id<>g.id or m.body<>body then raise exception 'GROUP_MESSAGE_KEY_REUSED' using errcode='22023';end if;
  return private.group_message_receipt_v5(m,true);
 end if;
 perform private.closure_assert_open(u,g.requester_account_id);
 if u<>g.requester_account_id then perform pg_advisory_xact_lock_shared(private.safety_pair_key(u,g.requester_account_id));end if;
 if not private.group_can_send_v5(g,u) then raise exception 'GROUP_READ_ONLY' using errcode='42501';end if;
 -- Safety and closure exclusive barriers never take group/domain row locks.
 -- All eligibility is read again under these shared barriers before admission.
 for r in select distinct account_id from private.group_memberships_v5 where group_id=g.id and ended_sequence is null
  union select g.requester_account_id order by 1 loop
  perform pg_advisory_xact_lock_shared(private.closure_account_key(r));
  if r<>u then perform pg_advisory_xact_lock_shared(private.safety_pair_key(u,r));end if;
 end loop;
 if not private.group_can_send_v5(g,u) then raise exception 'GROUP_READ_ONLY' using errcode='42501';end if;
 update private.group_conversations_v5 set sequence=sequence+1 where id=g.id returning sequence into seq;
 insert into private.group_messages_v5(group_id,sequence,sender_account_id,client_request_id,body,body_sha256)
 values(g.id,seq,u,p_client_request_id,body,encode(extensions.digest(convert_to(body,'UTF8'),'sha256'),'hex')) returning * into m;
 insert into private.group_message_visibility_v5(message_id,account_id,read_at)
 select m.id,x.account_id,case when x.account_id=u then m.created_at end from (
  select g.requester_account_id account_id union select t.account_id from private.group_memberships_v5 t
  where t.group_id=g.id and t.ended_sequence is null and t.joined_sequence<=seq) x
 where not private.closure_account_restricted(x.account_id) and (x.account_id=u or not private.safety_pair_blocked(u,x.account_id));
 return private.group_message_receipt_v5(m,false);
end $f$;
create function public.rpc_read_group_command_v5(p_expected_user_id uuid,p_group_id uuid,p_client_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid();g private.group_conversations_v5;m private.group_messages_v5;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000';end if;
 if p_group_id is null or p_client_request_id is null then raise exception 'GROUP_MESSAGE_INVALID' using errcode='22023';end if;
 select * into g from private.group_conversations_v5 where id=p_group_id;
 if not found or not private.group_member_v5(g,u) then raise exception 'GROUP_NOT_AVAILABLE' using errcode='42501';end if;
 select * into m from private.group_messages_v5 where group_id=g.id and sender_account_id=u and client_request_id=p_client_request_id;
 return jsonb_build_object('accountId',u,'groupId',g.id,'clientRequestId',p_client_request_id,'found',found,
  'receipt',case when found then private.group_message_receipt_v5(m,true) end,'authoritative',true);
end $f$;
create function public.rpc_read_group_messages_v5(p_expected_user_id uuid,p_group_id uuid,p_after_sequence text default null,p_before_sequence text default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid();g private.group_conversations_v5;after_seq bigint;before_seq bigint;messages jsonb;first_seq bigint;last_seq bigint;next_before text;next_after text;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000';end if;
 if (p_after_sequence is not null and p_before_sequence is not null)
 or (p_after_sequence is not null and p_after_sequence!~'^(0|[1-9][0-9]{0,15})$')
 or (p_before_sequence is not null and p_before_sequence!~'^[1-9][0-9]{0,15}$') then raise exception 'GROUP_CURSOR_INVALID' using errcode='22023';end if;
 after_seq:=p_after_sequence::bigint;before_seq:=p_before_sequence::bigint;
 select * into g from private.group_conversations_v5 where id=p_group_id;
 if not found or not private.group_member_v5(g,u) then raise exception 'GROUP_NOT_AVAILABLE' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('messageId',x.id,'sequence',x.sequence::text,'senderAccountId',x.sender_account_id,
  'body',x.body,'createdAt',x.created_at,'mine',x.sender_account_id=u) order by x.sequence),'[]'::jsonb),min(x.sequence),max(x.sequence)
 into messages,first_seq,last_seq from (select m.* from private.group_messages_v5 m
 join private.group_message_visibility_v5 v on v.message_id=m.id and v.account_id=u
 where m.group_id=g.id and (after_seq is null or m.sequence>after_seq) and (before_seq is null or m.sequence<before_seq)
 order by case when after_seq is null then -m.sequence else m.sequence end limit 50) x;
 if exists(select 1 from private.group_messages_v5 m join private.group_message_visibility_v5 v on v.message_id=m.id and v.account_id=u
  where m.group_id=g.id and m.sequence<first_seq) then next_before:=first_seq::text;end if;
 if exists(select 1 from private.group_messages_v5 m join private.group_message_visibility_v5 v on v.message_id=m.id and v.account_id=u
  where m.group_id=g.id and m.sequence>last_seq) then next_after:=last_seq::text;end if;
 return jsonb_build_object('accountId',u,'groupId',g.id,'messages',messages,'nextBeforeSequence',next_before,'nextAfterSequence',next_after,'authoritative',true);
end $f$;
create function public.rpc_mark_group_messages_read_v5(p_expected_user_id uuid,p_group_id uuid,p_message_ids uuid[]) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $f$
declare u uuid:=auth.uid();g private.group_conversations_v5;changed integer;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000';end if;
 if p_message_ids is null or cardinality(p_message_ids) not between 1 and 50 or array_position(p_message_ids,null) is not null then raise exception 'GROUP_MESSAGE_INVALID' using errcode='22023';end if;
 perform private.closure_assert_open(u);
 select * into g from private.group_conversations_v5 where id=p_group_id;
 if not found or not private.group_member_v5(g,u) then raise exception 'GROUP_NOT_AVAILABLE' using errcode='42501';end if;
 update private.group_message_visibility_v5 v set read_at=clock_timestamp() from private.group_messages_v5 m
 where v.message_id=m.id and m.group_id=g.id and v.account_id=u and v.message_id=any(p_message_ids) and v.read_at is null;
 get diagnostics changed=row_count;
 return jsonb_build_object('accountId',u,'groupId',g.id,'markedCount',changed,'authoritative',true);
end $f$;

update private.closure_dataset_catalog_v5 set relations=relations||array['private.group_conversations_v5','private.group_memberships_v5'] where data_class='AGREEMENT_CORE';
update private.closure_dataset_catalog_v5 set relations=relations||array['private.group_messages_v5','private.group_message_visibility_v5'] where data_class='AGREEMENT_MESSAGES';
-- Technical dataset coverage only. Existing executable retention/export source
-- bindings must be reviewed against their changed digests; no duration is added.
do $export$ declare catalog jsonb;d text;needle text;replacement text;begin
 catalog:=private.data_export_dataset_catalog();
 if jsonb_array_length(catalog)<>37 or exists(select 1 from jsonb_array_elements(catalog) x where x->>'key' in('ownGroupMessages','ownGroupMemberships'))
 then raise exception 'GROUP_EXPORT_PREDECESSOR_DRIFT' using errcode='55000';end if;
 catalog:=catalog||'[{"key":"ownGroupMessages","dataClass":"AGREEMENT_MESSAGES","fields":["id","groupId","body","createdAt"],"ownershipFilter":"t.sender_account_id=REQUEST_ACCOUNT"},{"key":"ownGroupMemberships","dataClass":"AGREEMENT_CORE","fields":["groupId","agreementId","joinedAt","endedAt"],"ownershipFilter":"t.account_id=REQUEST_ACCOUNT"}]'::jsonb;
 execute format('create or replace function private.data_export_dataset_catalog() returns jsonb language sql immutable security definer set search_path=pg_catalog as $catalog$ select %L::jsonb $catalog$',catalog::text);
 d:=pg_get_functiondef('private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)'::regprocedure);
 needle:='from private.closure_actions_v5 t where t.account_id=p_account_id),';
 if length(d)-length(replace(d,needle,''))<>length(needle) or strpos(d,'''OWN_ACCOUNT_V5_1''')=0 then raise exception 'GROUP_EXPORT_PREDECESSOR_DRIFT' using errcode='55000';end if;
 replacement:=$rows$from private.closure_actions_v5 t where t.account_id=p_account_id
union all
select 'ownGroupMessages' as key,jsonb_build_object('id',t.id,'groupId',t.group_id,'body',t.body,'createdAt',t.created_at) as value
 from private.group_messages_v5 t where t.sender_account_id=p_account_id
union all
select 'ownGroupMemberships' as key,jsonb_build_object('groupId',t.group_id,'agreementId',t.agreement_id,'joinedAt',t.joined_at,'endedAt',t.ended_at) as value
 from private.group_memberships_v5 t where t.account_id=p_account_id),$rows$;
 execute replace(replace(d,needle,replacement),'''OWN_ACCOUNT_V5_1''','''OWN_ACCOUNT_V5_2''');
 d:=pg_get_functiondef('private.data_export_policy_binding()'::regprocedure);
 if strpos(d,'''OWN_ACCOUNT_V5_1''')=0 or strpos(d,'jsonb_array_length(m->''datasets'')<>37')=0 then raise exception 'GROUP_EXPORT_PREDECESSOR_DRIFT' using errcode='55000';end if;
 execute replace(replace(d,'''OWN_ACCOUNT_V5_1''','''OWN_ACCOUNT_V5_2'''),'jsonb_array_length(m->''datasets'')<>37','jsonb_array_length(m->''datasets'')<>39');
 -- Existing projection SHA includes both modified compiled bodies and all four
 -- nested sanitizers. A37-dataset V5_1 binding is deliberately not sufficient.
end $export$;
do $acl$ declare p record;begin
 for p in select f.oid::regprocedure signature,n.nspname from pg_proc f join pg_namespace n on n.oid=f.pronamespace where n.nspname in('public','private')
 and f.proname in('group_sync_agreement_v5','group_agreement_changed_v5','group_need_changed_v5','group_member_v5','group_can_send_v5','group_message_receipt_v5',
 'rpc_read_group_context_v5','rpc_send_group_message_v5','rpc_read_group_command_v5','rpc_read_group_messages_v5','rpc_mark_group_messages_read_v5') loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',p.signature);
 if p.nspname='public' then execute format('grant execute on function %s to authenticated',p.signature);end if;
 end loop;
end $acl$;
update private.closure_source_v5 set sha256=private.closure_source_digest_v5() where singleton;
notify pgrst,'reload schema';
commit;

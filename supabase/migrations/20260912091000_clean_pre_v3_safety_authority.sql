-- PRE-V3 P8. Private reporting and directional account blocks are distinct from
-- Agreement problem/recovery. Candidate118, NOT LIVE. No policy activation.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create table private.account_blocks (
 blocker_account_id uuid not null references public.app_accounts(id),
 blocked_account_id uuid not null references public.app_accounts(id),
 active boolean not null,
 revision integer not null check(revision>=1),
 last_blocked_at timestamptz,
 updated_at timestamptz not null default clock_timestamp(),
 primary key(blocker_account_id,blocked_account_id),
 check(blocker_account_id<>blocked_account_id),
 check(not active or last_blocked_at is not null)
);
create table private.account_block_commands (
 actor_account_id uuid not null references public.app_accounts(id),
 client_request_id uuid not null,
 target_account_id uuid not null references public.app_accounts(id),
 input_hash text not null check(input_hash ~ '^[0-9a-f]{64}$'),
 receipt jsonb not null check(jsonb_typeof(receipt)='object'),
 created_at timestamptz not null default clock_timestamp(),
 primary key(actor_account_id,client_request_id)
);
create table private.safety_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_account_id uuid not null references public.app_accounts(id),
 target_account_id uuid not null references public.app_accounts(id),
 need_id uuid references public.needs(id),
 agreement_id uuid references public.agreements(id),
 category text not null check(category in('HARASSMENT','FRAUD','UNSAFE_WORK','DISCRIMINATION','OTHER')),
 reason text not null check(length(btrim(reason)) between 1 and 200 and octet_length(reason)<=800),
 narrative text not null check(length(narrative)<=2000 and octet_length(narrative)<=8000),
 client_request_id uuid not null,
 input_hash text not null check(input_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 status text not null default 'RECEIVED' check(status in('RECEIVED','IN_REVIEW','RESOLVED')),
 unique(reporter_account_id,client_request_id),
 check(reporter_account_id<>target_account_id)
);
alter table private.account_blocks enable row level security;
alter table private.account_block_commands enable row level security;
alter table private.safety_reports enable row level security;
revoke all on private.account_blocks,private.account_block_commands,private.safety_reports from public,anon,authenticated,service_role;
comment on table private.safety_reports is 'Private safety narrative, never bilateral chat/public/push. Retention requires separately approved legal execution binding; no purge or retention duration is invented here.';

-- All ordinary domain writers take a SHARED pair barrier at their actual write
-- seam. Block/unblock takes EXCLUSIVE, and touches only its private ledger/row.
-- It never locks Need/Agreement/Response/device/delivery rows. Thus adding a
-- safety barrier after existing domain locks cannot invert that lock order.
create function private.safety_pair_key(a uuid,b uuid)
returns bigint language sql immutable strict set search_path=pg_catalog
as $f$ select hashtextextended('uskoci:safety-pair:'||least(a,b)::text||':'||greatest(a,b)::text,8318); $f$;
create function private.safety_pair_blocked(a uuid,b uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
as $f$ select exists(select 1 from private.account_blocks x where x.active
 and ((x.blocker_account_id=a and x.blocked_account_id=b) or (x.blocker_account_id=b and x.blocked_account_id=a))); $f$;
create function private.safety_assert_pair(a uuid,b uuid)
returns void language plpgsql volatile security definer set search_path=pg_catalog
as $f$
begin
 if a is null or b is null or a=b then raise exception 'INTERACTION_CONTEXT_INVALID' using errcode='42501'; end if;
 perform pg_advisory_xact_lock_shared(private.safety_pair_key(a,b));
 if private.safety_pair_blocked(a,b) then raise exception 'INTERACTION_BLOCKED' using errcode='42501'; end if;
end;
$f$;
-- A block permanently invalidates older grants even after unblock. A fresh
-- explicit grant is required; old private access never silently resurrects.
create function private.safety_grant_valid(a uuid,b uuid,granted timestamptz)
returns boolean language sql stable security definer set search_path=pg_catalog
as $f$ select granted is not null and not exists(select 1 from private.account_blocks x
 where ((x.blocker_account_id=a and x.blocked_account_id=b) or (x.blocker_account_id=b and x.blocked_account_id=a))
 and (x.active or x.last_blocked_at>=granted)); $f$;

create function public.rpc_get_account_block(p_target_account_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $f$
declare u uuid:=auth.uid(); r private.account_blocks;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_target_account_id is null or u=p_target_account_id then raise exception 'BLOCK_INPUT_INVALID' using errcode='22023'; end if;
 select * into r from private.account_blocks where blocker_account_id=u and blocked_account_id=p_target_account_id;
 -- Only the caller's outgoing choice is visible. Never disclose an incoming block.
 return jsonb_build_object('accountId',u,'targetAccountId',p_target_account_id,'blocked',coalesce(r.active,false),'revision',coalesce(r.revision,0),'authoritative',true);
end;
$f$;
create function public.rpc_set_account_block(p_target_account_id uuid,p_blocked boolean,p_expected_revision integer,p_client_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $f$
declare u uuid:=auth.uid(); r private.account_blocks; c private.account_block_commands; h text; receipt jsonb;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_target_account_id is null or p_target_account_id=u or p_blocked is null or p_client_request_id is null
 or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>=2147483647 then raise exception 'BLOCK_INPUT_INVALID' using errcode='22023'; end if;
 h:=encode(extensions.digest(jsonb_build_object('target',p_target_account_id,'blocked',p_blocked,'revision',p_expected_revision)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('uskoci:block-command:'||u::text||':'||p_client_request_id::text,8318));
 select * into c from private.account_block_commands where actor_account_id=u and client_request_id=p_client_request_id;
 if found then
  if c.input_hash<>h then raise exception 'REQUEST_ID_REUSED' using errcode='22023'; end if;
  return c.receipt||jsonb_build_object('idempotentReplay',true);
 end if;
 if not exists(select 1 from public.app_accounts where id=p_target_account_id) then raise exception 'TARGET_NOT_AVAILABLE' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(private.safety_pair_key(u,p_target_account_id));
 select * into r from private.account_blocks where blocker_account_id=u and blocked_account_id=p_target_account_id;
 if coalesce(r.revision,0)<>p_expected_revision then raise exception 'BLOCK_REVISION_CONFLICT' using errcode='40001'; end if;
 insert into private.account_blocks(blocker_account_id,blocked_account_id,active,revision,last_blocked_at)
 values(u,p_target_account_id,p_blocked,p_expected_revision+1,case when p_blocked then clock_timestamp() end)
 on conflict(blocker_account_id,blocked_account_id) do update set active=excluded.active,revision=excluded.revision,
 last_blocked_at=case when excluded.active then clock_timestamp() else private.account_blocks.last_blocked_at end,updated_at=clock_timestamp();
 receipt:=jsonb_build_object('accountId',u,'targetAccountId',p_target_account_id,'blocked',p_blocked,'revision',p_expected_revision+1,
  'clientRequestId',p_client_request_id,'idempotentReplay',false,'authoritative',true);
 insert into private.account_block_commands(actor_account_id,client_request_id,target_account_id,input_hash,receipt) values(u,p_client_request_id,p_target_account_id,h,receipt);
 perform private.audit_marketplace(u,case when p_blocked then 'ACCOUNT_BLOCKED' else 'ACCOUNT_UNBLOCKED' end,'ACCOUNT',p_target_account_id,p_expected_revision+1,'{}');
 return receipt;
end;
$f$;

create function private.safety_report_context_allowed(actor uuid,target uuid,nid uuid,aid uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog
as $f$
declare a public.agreements; n public.needs;
begin
 if aid is not null then
  select * into a from public.agreements where id=aid;
  return found and actor in(a.requester_account_id,a.worker_account_id) and target in(a.requester_account_id,a.worker_account_id)
   and actor<>target and (nid is null or nid=a.need_id);
 elsif nid is not null then
  select * into n from public.needs where id=nid;
  if not found then return false; end if;
  return (actor=n.requester_account_id and exists(select 1 from public.marketplace_responses r where r.need_id=nid and r.worker_account_id=target))
   or (target=n.requester_account_id and (n.status in('PUBLISHED','SELECTION') or exists(select 1 from public.marketplace_responses r where r.need_id=nid and r.worker_account_id=actor)));
 end if;
 return exists(select 1 from public.app_profiles where account_id=target and profile_status='ACTIVE')
  or exists(select 1 from public.agreements where actor in(requester_account_id,worker_account_id) and target in(requester_account_id,worker_account_id));
end;
$f$;
create function public.rpc_submit_safety_report(p_target_account_id uuid,p_need_id uuid,p_agreement_id uuid,p_category text,p_reason text,p_narrative text,p_client_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $f$
declare u uuid:=auth.uid(); r private.safety_reports; h text;
begin
 if u is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_target_account_id is null or p_target_account_id=u or p_client_request_id is null or p_category is null
 or p_category not in('HARASSMENT','FRAUD','UNSAFE_WORK','DISCRIMINATION','OTHER')
 or p_reason is null or length(btrim(p_reason)) not between 1 and 200 or octet_length(p_reason)>800
 or p_narrative is null or length(p_narrative)>2000 or octet_length(p_narrative)>8000 then raise exception 'SAFETY_REPORT_INPUT_INVALID' using errcode='22023'; end if;
 h:=encode(extensions.digest(jsonb_build_object('target',p_target_account_id,'need',p_need_id,'agreement',p_agreement_id,
 'category',p_category,'reason',btrim(p_reason),'narrative',btrim(p_narrative))::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('uskoci:report:'||u::text||':'||p_client_request_id::text,8318));
 select * into r from private.safety_reports where reporter_account_id=u and client_request_id=p_client_request_id;
 if found then
  if r.input_hash<>h then raise exception 'REQUEST_ID_REUSED' using errcode='22023'; end if;
  return jsonb_build_object('reportId',r.id,'clientRequestId',p_client_request_id,'received',true,'createdAt',r.created_at,'idempotentReplay',true,'authoritative',true);
 end if;
 if not private.safety_report_context_allowed(u,p_target_account_id,p_need_id,p_agreement_id) then raise exception 'SAFETY_CONTEXT_NOT_AVAILABLE' using errcode='42501'; end if;
 insert into private.safety_reports(reporter_account_id,target_account_id,need_id,agreement_id,category,reason,narrative,client_request_id,input_hash)
 values(u,p_target_account_id,p_need_id,p_agreement_id,p_category,btrim(p_reason),btrim(p_narrative),p_client_request_id,h) returning * into r;
 perform private.audit_marketplace(u,'SAFETY_REPORT_RECEIVED','SAFETY_REPORT',r.id,1,'{}');
 return jsonb_build_object('reportId',r.id,'clientRequestId',p_client_request_id,'received',true,'createdAt',r.created_at,'idempotentReplay',false,'authoritative',true);
end;
$f$;
create function public.rpc_get_my_safety_report(p_report_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $f$
declare r private.safety_reports;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 select * into r from private.safety_reports where id=p_report_id and reporter_account_id=auth.uid();
 if not found then raise exception 'REPORT_NOT_AVAILABLE' using errcode='42501'; end if;
 return jsonb_build_object('reportId',r.id,'received',true,'createdAt',r.created_at,'authoritative',true);
end;
$f$;

create function private.safety_guard_interaction_write()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $f$
declare a public.agreements; other uuid;
begin
 if tg_table_name='marketplace_responses' then
  if new.status not in('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED','SELECTED') then return new; end if;
  select requester_account_id into other from public.needs where id=new.need_id;
  perform private.safety_assert_pair(new.worker_account_id,other);
 elsif tg_table_name='agreements' then
  perform private.safety_assert_pair(new.requester_account_id,new.worker_account_id);
 elsif tg_table_name='agreement_messages' then
  select * into a from public.agreements where id=new.agreement_id;
  perform private.safety_assert_pair(a.requester_account_id,a.worker_account_id);
 elsif tg_table_name='agreement_change_proposals' then
  if tg_op='UPDATE' and new.status<>'ACCEPTED' then return new; end if;
  select * into a from public.agreements where id=new.agreement_id;
  perform private.safety_assert_pair(a.requester_account_id,a.worker_account_id);
 elsif tg_table_name='access_grants' then
  if new.status<>'GRANTED' then return new; end if;
  perform private.safety_assert_pair(new.granted_by_account_id,new.granted_to_account_id);
 end if;
 return new;
end;
$f$;
create trigger pre_v3_safety_response before insert or update on public.marketplace_responses for each row execute function private.safety_guard_interaction_write();
create trigger pre_v3_safety_agreement before insert on public.agreements for each row execute function private.safety_guard_interaction_write();
create trigger pre_v3_safety_message before insert on public.agreement_messages for each row execute function private.safety_guard_interaction_write();
create trigger pre_v3_safety_proposal before insert or update on public.agreement_change_proposals for each row execute function private.safety_guard_interaction_write();
create trigger pre_v3_safety_grant before insert or update on public.access_grants for each row execute function private.safety_guard_interaction_write();

-- Recovery is a separate authority. Its neutral execution record/event remains
-- possible when chat is blocked; only its legacy automatic chat echo is omitted.
do $recovery$
declare d text; anchor text:=$a$    insert into public.agreement_messages(agreement_id,agreement_version,sender_account_id,body)
    values (a.id,a.current_version,uid,'⚠️ Prijavljen problem: '||narrative);$a$;
begin
 d:=pg_get_functiondef('public.rpc_report_problem(uuid,text)'::regprocedure);
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'SAFETY_RECOVERY_ANCHOR_DRIFT'; end if;
 execute replace(d,anchor,'    if not private.safety_pair_blocked(a.requester_account_id,a.worker_account_id) then'||E'\n'||anchor||E'\n    end if;');
end;
$recovery$;

-- Production Q&A retains its independent rate/content/materiality gates.
create or replace function private.ru4b_assert_block_authority_ready(p_worker_account_id uuid,p_requester_account_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog
as $f$ begin perform private.safety_assert_pair(p_worker_account_id,p_requester_account_id); end; $f$;

-- Existing grants are checked on raw private-location RLS as well as the RPC.
-- The public RLS predicate is caller-bound and returns no peer/relationship data.
create function public.fn_safety_need_grant_valid(p_need_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
as $f$ select auth.uid() is not null and exists(select 1 from public.agreements a join public.access_grants g on g.agreement_id=a.id
 where a.need_id=p_need_id and a.status='CONFIRMED' and a.worker_account_id=auth.uid()
 and g.channel='EXACT_LOCATION' and g.status='GRANTED' and g.granted_to_account_id=auth.uid() and g.granted_by_account_id=a.requester_account_id
 and (g.expires_at is null or g.expires_at>statement_timestamp()) and private.safety_grant_valid(g.granted_by_account_id,g.granted_to_account_id,g.granted_at)); $f$;
drop policy need_sensitive_granted_read on public.need_sensitive;
create policy need_sensitive_granted_read on public.need_sensitive for select to authenticated using(public.fn_safety_need_grant_valid(public.need_sensitive.need_id));
do $reveal$
declare d text; anchor text:=$a$  if not private.grant_is_ownable(p_agreement_id, p_channel, g.granted_by_account_id) then$a$;
begin
 d:=pg_get_functiondef('public.rpc_reveal_contact(uuid,text)'::regprocedure);
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'SAFETY_REVEAL_ANCHOR_DRIFT'; end if;
 execute replace(d,anchor,$a$  if not private.safety_grant_valid(g.granted_by_account_id,g.granted_to_account_id,g.granted_at) then
    raise exception 'NO_ACTIVE_GRANT' using errcode='42501';
  end if;
$a$||anchor);
 d:=pg_get_functiondef('public.rpc_get_public_profile(uuid)'::regprocedure);
 anchor:=$a$  if v_profile.kind = 'REQUESTER' then$a$;
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'SAFETY_PUBLIC_PROFILE_ANCHOR_DRIFT'; end if;
 execute replace(d,anchor,$a$  if private.safety_pair_blocked(v_actor,v_profile.account_id) then return null; end if;
$a$||anchor);
end;
$reveal$;

create function private.safety_event_blocked(e public.user_activity_events)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog
as $f$
declare a public.agreements; peer uuid; target uuid;
begin
 -- Safe terminal notification must not make an active Agreement inescapable.
 if e.event_type in('AGREEMENT_CANCELLED','NEED_CANCELLED','EXECUTION_STATE_CHANGED','COMPLETION_REQUIRED','RECOVERY_OPENED') then return false; end if;
 if e.entity_type='AGREEMENT' then
  select * into a from public.agreements where id=e.entity_id;
  peer:=case when e.recipient_user_id=a.requester_account_id then a.worker_account_id when e.recipient_user_id=a.worker_account_id then a.requester_account_id end;
 elsif e.entity_type='RESPONSE' then
  select case when e.recipient_user_id=r.worker_account_id then n.requester_account_id
   when e.recipient_user_id=n.requester_account_id then r.worker_account_id end into peer
   from public.marketplace_responses r join public.needs n on n.id=r.need_id where r.id=e.entity_id;
 elsif e.entity_type='NEED' then
  select requester_account_id into peer from public.needs where id=e.entity_id;
 elsif e.entity_type='CLARIFICATION' then
  select case when e.recipient_user_id=n.requester_account_id then qa.asker_account_id else n.requester_account_id end into peer
   from private.preselection_qa_questions qa join public.needs n on n.id=qa.need_id where qa.id=e.entity_id;
 end if;
 if peer is null or peer=e.recipient_user_id then return false; end if;
 perform pg_advisory_xact_lock_shared(private.safety_pair_key(e.recipient_user_id,peer));
 return private.safety_pair_blocked(e.recipient_user_id,peer);
end;
$f$;
create function private.safety_guard_delivery()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $f$
declare e public.user_activity_events;
begin
 select * into e from public.user_activity_events where id=new.event_id;
 if found and private.safety_event_blocked(e) then new.state:='SUPPRESSED';new.suppression_reason:='ACCOUNT_BLOCKED';end if;
 return new;
end;
$f$;
create trigger pre_v3_safety_delivery before insert on public.notification_deliveries for each row execute function private.safety_guard_delivery();
do $push$
declare d text; anchor text:=$a$ select * into p from public.notification_preferences where user_id=p_delivery.recipient_user_id and role_context=p_delivery.recipient_role;$a$;
begin
 d:=pg_get_functiondef('private.push_suppression(public.notification_deliveries)'::regprocedure);
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'SAFETY_PUSH_SUPPRESSION_ANCHOR_DRIFT'; end if;
 execute replace(d,anchor,$a$ if private.safety_event_blocked(e) then return 'ACCOUNT_BLOCKED'; end if;
$a$||anchor);
end;
$push$;

revoke all on function private.safety_pair_key(uuid,uuid),private.safety_pair_blocked(uuid,uuid),private.safety_assert_pair(uuid,uuid),
 private.safety_grant_valid(uuid,uuid,timestamptz),private.safety_report_context_allowed(uuid,uuid,uuid,uuid),private.safety_guard_interaction_write(),
 private.safety_event_blocked(public.user_activity_events),private.safety_guard_delivery(),private.ru4b_assert_block_authority_ready(uuid,uuid)
 from public,anon,authenticated,service_role;
revoke all on function public.rpc_get_account_block(uuid),public.rpc_set_account_block(uuid,boolean,integer,uuid),
 public.rpc_submit_safety_report(uuid,uuid,uuid,text,text,text,uuid),public.rpc_get_my_safety_report(uuid),public.fn_safety_need_grant_valid(uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.rpc_get_account_block(uuid),public.rpc_set_account_block(uuid,boolean,integer,uuid),
 public.rpc_submit_safety_report(uuid,uuid,uuid,text,text,text,uuid),public.rpc_get_my_safety_report(uuid),public.fn_safety_need_grant_valid(uuid) to authenticated;
notify pgrst,'reload schema';
commit;

-- PRE-V3 P10: authoritative fail-closed preparation and restriction barrier.
-- Candidate121, NOT LIVE. This does NOT invent an erasure/retention policy or
-- implement an unapproved auth/media deletion adapter. No executable READY or
-- CLOSED receipt can be manufactured through this API. Export stays separate.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

create table private.account_closure_requests (
 account_id uuid primary key references public.app_accounts(id),
 id uuid not null unique default gen_random_uuid(),
 state text not null check(state in('REQUESTED','BLOCKED','NOT_READY','READY','EXECUTING','FAILED','CLOSED')),
 revision integer not null check(revision between 1 and 2147483647),
 requested_at timestamptz not null default clock_timestamp(),
 prepared_at timestamptz,
 preparation jsonb not null default '{}'::jsonb check(jsonb_typeof(preparation)='object'),
 updated_at timestamptz not null default clock_timestamp(),
 closed_at timestamptz,
 execution_receipt jsonb,
 check((state='CLOSED')=(closed_at is not null)),
 check(state<>'CLOSED' or (execution_receipt is not null and jsonb_typeof(execution_receipt)='object'))
);
create table private.account_closure_commands (
 account_id uuid not null references public.app_accounts(id),
 client_request_id uuid not null,
 input_hash text not null check(input_hash ~ '^[0-9a-f]{64}$'),
 receipt jsonb not null check(jsonb_typeof(receipt)='object'),
 created_at timestamptz not null default clock_timestamp(),
 primary key(account_id,client_request_id)
);
alter table private.account_closure_requests enable row level security;
alter table private.account_closure_commands enable row level security;
alter table private.account_closure_requests force row level security;
alter table private.account_closure_commands force row level security;
revoke all on private.account_closure_requests,private.account_closure_commands from public,anon,authenticated,service_role;
comment on table private.account_closure_requests is 'P10 private preparation ledger. READY/EXECUTING/FAILED/CLOSED reserve the restriction protocol for a separately policy-bound executor. This migration exposes no setter or executor for those states. It cannot close an Auth account or delete media.';

-- Ordinary writers hold SHARED at their existing write seam. Preparation holds
-- EXCLUSIVE and reads domain obligations without row locks, writing ONLY the
-- private closure ledger. Never acquire a domain row lock under EXCLUSIVE here.
create function private.closure_account_key(a uuid)
returns bigint language sql immutable strict set search_path=pg_catalog
as $f$ select hashtextextended('uskoci:account-closure:'||a::text,10121); $f$;
create function private.closure_account_restricted(a uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
as $f$ select exists(select 1 from private.account_closure_requests r where r.account_id=a
 and r.state in('READY','EXECUTING','FAILED','CLOSED')); $f$;
create function private.closure_assert_open(a uuid,b uuid default null)
returns void language plpgsql volatile security definer set search_path=pg_catalog
as $f$
declare u uuid;
begin
 if a is null then raise exception 'CLOSURE_CONTEXT_INVALID' using errcode='42501'; end if;
 for u in select distinct x from unnest(array[a,b]) x where x is not null order by x loop
  perform pg_advisory_xact_lock_shared(private.closure_account_key(u));
  if private.closure_account_restricted(u) then raise exception 'ACCOUNT_CLOSING' using errcode='42501'; end if;
 end loop;
end;
$f$;

create function private.account_closure_preparation(a uuid)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog
as $f$
declare blockers jsonb:='[]'; reasons jsonb:='[]'; legal jsonb; retention jsonb;
begin
 -- Bounded existence checks use existing account/owner indexes; no public IDs,
 -- narratives, hold keys or counterpart data are exposed in the receipt.
 if exists(select 1 from public.agreements where requester_account_id=a and status not in('COMPLETED','CANCELLED'))
 or exists(select 1 from public.agreements where worker_account_id=a and status not in('COMPLETED','CANCELLED')) then
  blockers:=blockers||'"ACTIVE_AGREEMENT"'::jsonb;
 end if;
 if exists(select 1 from public.needs where requester_account_id=a and status in('PUBLISHED','SELECTION','ACTIVE')) then
  blockers:=blockers||'"OPEN_TASK"'::jsonb;
 end if;
 if exists(select 1 from public.marketplace_responses where worker_account_id=a and status in('SUBMITTED','DELIVERED','VIEWED','SHORTLISTED')) then
  blockers:=blockers||'"ACTIVE_APPLICATION"'::jsonb;
 end if;
 if exists(select 1 from private.ai_need_turn_commands where account_id=a and state='PROCESSING')
 or exists(select 1 from private.retention_jobs where account_id=a and status='CLAIMED')
 or exists(select 1 from public.data_export_requests where account_id=a and status='PROCESSING') then
  blockers:=blockers||'"PENDING_WORKFLOW"'::jsonb;
 end if;
 if exists(select 1 from private.retention_holds where account_id=a and active) then
  blockers:=blockers||'"RETENTION_HOLD"'::jsonb;
 end if;
 legal:=public.rpc_get_legal_bundle();
 retention:=public.rpc_get_retention_policy_status();
 if (legal->>'ready')::boolean is distinct from true then reasons:=reasons||'"LEGAL_POLICY_NOT_READY"'::jsonb; end if;
 if (retention->>'ready')::boolean is distinct from true then reasons:=reasons||'"RETENTION_POLICY_NOT_READY"'::jsonb; end if;
 -- The existing P3 adapter covers AI_ABANDONED_UNBOUND only. Neither a legal
 -- document nor a schedule admits account erasure, auth closure or media cleanup.
 -- A future implementation must bind real approved coverage before removing this
 -- source gate. There is intentionally NO operator flag to bypass missing code.
 reasons:=reasons||'"CLOSURE_EXECUTION_NOT_READY"'::jsonb;
 return jsonb_build_object('observedAt',clock_timestamp(),'blockers',blockers,'notReadyReasons',reasons,
  'legalReady',coalesce((legal->>'ready')::boolean,false),'retentionReady',coalesce((retention->>'ready')::boolean,false),
  'executionReady',false,'authClosureReady',false,'mediaCleanupReady',false);
end;
$f$;
create function private.account_closure_document(r private.account_closure_requests)
returns jsonb language sql stable security definer set search_path=pg_catalog
as $f$ select jsonb_build_object('accountId',r.account_id,'requestId',r.id,'state',r.state,'revision',r.revision,
 'requestedAt',r.requested_at,'preparedAt',r.prepared_at,'preparation',r.preparation,
 'restricted',r.state in('READY','EXECUTING','FAILED','CLOSED'),'canExecute',false,'authoritative',true); $f$;

create function public.rpc_get_account_closure(p_expected_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $f$
declare u uuid:=auth.uid(); r private.account_closure_requests;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000'; end if;
 select * into r from private.account_closure_requests where account_id=u;
 if not found then return jsonb_build_object('accountId',u,'request',null,'revision',0,'restricted',false,'canExecute',false,'authoritative',true); end if;
 return jsonb_build_object('accountId',u,'request',private.account_closure_document(r),'revision',r.revision,
  'restricted',private.closure_account_restricted(u),'canExecute',false,'authoritative',true);
end;
$f$;
create function public.rpc_prepare_account_closure(p_expected_user_id uuid,p_expected_revision integer,p_client_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $f$
declare u uuid:=auth.uid(); r private.account_closure_requests; c private.account_closure_commands; h text; facts jsonb; receipt jsonb;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000'; end if;
 if p_client_request_id is null or p_expected_revision is null or p_expected_revision<0 or p_expected_revision>=2147483647 then
  raise exception 'CLOSURE_INPUT_INVALID' using errcode='22023'; end if;
 h:=encode(extensions.digest(jsonb_build_object('account',u,'revision',p_expected_revision,'command','PREPARE')::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(private.closure_account_key(u));
 select * into c from private.account_closure_commands where account_id=u and client_request_id=p_client_request_id;
 if found then
  if c.input_hash<>h then raise exception 'REQUEST_ID_REUSED' using errcode='22023'; end if;
  return c.receipt||jsonb_build_object('idempotentReplay',true);
 end if;
 select * into r from private.account_closure_requests where account_id=u;
 if coalesce(r.revision,0)<>p_expected_revision then raise exception 'CLOSURE_REVISION_CONFLICT' using errcode='40001'; end if;
 -- Never clear an already restricted/failed-execution stage by preparing again.
 if private.closure_account_restricted(u) then raise exception 'ACCOUNT_CLOSING' using errcode='42501'; end if;
 insert into private.account_closure_requests(account_id,state,revision)
 values(u,'REQUESTED',p_expected_revision+1)
 on conflict(account_id) do update set state='REQUESTED',revision=excluded.revision,updated_at=clock_timestamp()
 returning * into r;
 perform private.audit_marketplace(u,'ACCOUNT_CLOSURE_REQUESTED','ACCOUNT',u,r.revision,'{}');
 facts:=private.account_closure_preparation(u);
 update private.account_closure_requests set state=case when jsonb_array_length(facts->'blockers')>0 then 'BLOCKED' else 'NOT_READY' end,
  preparation=facts,prepared_at=(facts->>'observedAt')::timestamptz,updated_at=clock_timestamp() where account_id=u returning * into r;
 receipt:=private.account_closure_document(r)||jsonb_build_object('clientRequestId',p_client_request_id,'idempotentReplay',false);
 insert into private.account_closure_commands(account_id,client_request_id,input_hash,receipt) values(u,p_client_request_id,h,receipt);
 perform private.audit_marketplace(u,'ACCOUNT_CLOSURE_PREPARED','ACCOUNT',u,r.revision,jsonb_build_object('state',r.state));
 return receipt;
end;
$f$;
create function public.rpc_get_account_closure_receipt(p_expected_user_id uuid,p_client_request_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $f$
declare u uuid:=auth.uid(); c private.account_closure_commands;
begin
 if u is null or u is distinct from p_expected_user_id then raise exception 'AUTH_CONTEXT_CHANGED' using errcode='28000'; end if;
 if p_client_request_id is null then raise exception 'CLOSURE_INPUT_INVALID' using errcode='22023'; end if;
 select * into c from private.account_closure_commands where account_id=u and client_request_id=p_client_request_id;
 return jsonb_build_object('accountId',u,'clientRequestId',p_client_request_id,'found',found,
  'receipt',case when found then c.receipt else null end,'authoritative',true);
end;
$f$;

-- Guards augment, never replace, existing Auth/ownership/revision/mutation tokens.
-- Scope values below are fixed at migration time, not caller-controlled SQL.
create function private.closure_guard_owned_write()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $f$
declare r jsonb; prior jsonb; a uuid; b uuid;
begin
 r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 prior:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
 if tg_table_name='needs' and tg_op='UPDATE' and (r->>'status') is distinct from (prior->>'status') and (r->>'status') in('CANCELLED','COMPLETED','EXPIRED','ARCHIVED') then return new; end if;
 if tg_table_name='marketplace_responses' and tg_op='UPDATE' and (r->>'status') is distinct from (prior->>'status') and (r->>'status') in('WITHDRAWN','EXPIRED','NOT_SELECTED','STALE') then return new; end if;
 if tg_table_name='agreements' and tg_op='UPDATE' and (r->>'status') is distinct from (prior->>'status') and (r->>'status') in('CANCELLED','COMPLETED') then return new; end if;
 if tg_table_name='agreement_versions' and tg_op='UPDATE' and (r->>'status')='CANCELLED' then return new; end if;
 if tg_table_name='agreement_change_proposals' and tg_op='UPDATE' and (r->>'status') not in('PENDING','ACCEPTED') then return new; end if;
 if tg_table_name='access_grants' and tg_op='UPDATE' and (r->>'status')='REVOKED' then return new; end if;
 if tg_table_name='notification_push_devices' and tg_op='UPDATE' and (r->>'active')::boolean is false
  and (r->>'user_id')=(prior->>'user_id') and (r->>'expo_push_token')=(prior->>'expo_push_token') and (r->>'platform')=(prior->>'platform') then return new; end if;
 if tg_table_name='ai_need_turn_commands' and tg_op='UPDATE' and (prior->>'state')='PROCESSING' and (r->>'state') in('SUCCEEDED','FAILED') then return new; end if;
 -- Export remains a separate request/read/cancel capability; only a new
 -- processing claim is fenced. Existing attempts can settle without new work.
 if tg_table_name='data_export_requests' and (r->>'status')<>'PROCESSING' then
  if tg_op='DELETE' then return old; end if; return new;
 end if;
 if tg_table_name='retention_jobs' and (r->>'status')<>'CLAIMED' then return new; end if;
 if tg_argv[0]='ACCOUNT' then a:=(r->>tg_argv[1])::uuid;
 elsif tg_argv[0]='PROFILE' then select account_id into a from public.app_profiles where id=(r->>tg_argv[1])::uuid;
 elsif tg_argv[0]='NEED' then select requester_account_id into a from public.needs where id=(r->>tg_argv[1])::uuid;
 elsif tg_argv[0]='CONVERSATION' then select account_id into a from public.ai_conversations where id=(r->>tg_argv[1])::uuid;
 elsif tg_argv[0]='PAIR' then a:=(r->>tg_argv[1])::uuid;b:=(r->>tg_argv[2])::uuid;
 elsif tg_argv[0]='AGREEMENT' then select requester_account_id,worker_account_id into a,b from public.agreements where id=(r->>tg_argv[1])::uuid;
 elsif tg_argv[0]='RESPONSE' then select n.requester_account_id,m.worker_account_id into a,b from public.marketplace_responses m join public.needs n on n.id=m.need_id where m.id=(r->>tg_argv[1])::uuid;
 elsif tg_argv[0]='APPLICATION' then select requester_account_id into a from public.needs where id=(r->>'need_id')::uuid;b:=(r->>'worker_account_id')::uuid;
 else raise exception 'CLOSURE_CONTEXT_INVALID' using errcode='42501'; end if;
 perform private.closure_assert_open(a,b);
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$f$;
create trigger pre_v3_closure_account before update on public.app_accounts for each row execute function private.closure_guard_owned_write('ACCOUNT','id');
create trigger pre_v3_closure_profile before insert or update on public.app_profiles for each row execute function private.closure_guard_owned_write('ACCOUNT','account_id');
create trigger pre_v3_closure_need before insert or update on public.needs for each row execute function private.closure_guard_owned_write('ACCOUNT','requester_account_id');
create trigger pre_v3_closure_selection before insert on public.need_selections for each row execute function private.closure_guard_owned_write('NEED','need_id');
create trigger pre_v3_closure_response before insert or update on public.marketplace_responses for each row execute function private.closure_guard_owned_write('APPLICATION');
create trigger pre_v3_closure_response_version before insert on public.marketplace_response_versions for each row execute function private.closure_guard_owned_write('RESPONSE','response_id');
create trigger pre_v3_closure_agreement before insert or update on public.agreements for each row execute function private.closure_guard_owned_write('PAIR','requester_account_id','worker_account_id');
create trigger pre_v3_closure_terms before insert or update on public.agreement_versions for each row execute function private.closure_guard_owned_write('AGREEMENT','agreement_id');
create trigger pre_v3_closure_message before insert on public.agreement_messages for each row execute function private.closure_guard_owned_write('AGREEMENT','agreement_id');
create trigger pre_v3_closure_proposal before insert or update on public.agreement_change_proposals for each row execute function private.closure_guard_owned_write('AGREEMENT','agreement_id');
create trigger pre_v3_closure_grant before insert or update on public.access_grants for each row execute function private.closure_guard_owned_write('PAIR','granted_by_account_id','granted_to_account_id');
create trigger pre_v3_closure_device before insert or update on public.notification_push_devices for each row execute function private.closure_guard_owned_write('ACCOUNT','user_id');
create trigger pre_v3_closure_worker_preferences before insert or update or delete on public.worker_match_preferences for each row execute function private.closure_guard_owned_write('PROFILE','worker_profile_id');
create trigger pre_v3_closure_availability_rule before insert or update or delete on public.profile_availability_rules for each row execute function private.closure_guard_owned_write('PROFILE','profile_id');
create trigger pre_v3_closure_availability_window before insert or update or delete on public.profile_availability_windows for each row execute function private.closure_guard_owned_write('PROFILE','profile_id');
create trigger pre_v3_closure_location before insert or update on public.need_sensitive for each row execute function private.closure_guard_owned_write('NEED','need_id');
create trigger pre_v3_closure_ai_conversation before insert or update on public.ai_conversations for each row execute function private.closure_guard_owned_write('ACCOUNT','account_id');
create trigger pre_v3_closure_ai_message before insert on public.ai_messages for each row execute function private.closure_guard_owned_write('CONVERSATION','conversation_id');
create trigger pre_v3_closure_ai_fact before insert or update on public.ai_structured_facts for each row execute function private.closure_guard_owned_write('CONVERSATION','conversation_id');
create trigger pre_v3_closure_ai_command before insert or update on private.ai_need_turn_commands for each row execute function private.closure_guard_owned_write('ACCOUNT','account_id');

create trigger pre_v3_closure_review before insert on private.agreement_reviews for each row execute function private.closure_guard_owned_write('ACCOUNT','reviewer_account_id');
create trigger pre_v3_closure_export_claim before insert or update on public.data_export_requests for each row execute function private.closure_guard_owned_write('ACCOUNT','account_id');
create trigger pre_v3_closure_retention_claim before insert or update on private.retention_jobs for each row execute function private.closure_guard_owned_write('ACCOUNT','account_id');

-- Preserve safety/rate/policy controls on Q&A. New questions/answers cannot
-- create ordinary future connections during an account restriction.
create or replace function private.ru4b_assert_block_authority_ready(p_worker_account_id uuid,p_requester_account_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog
as $f$ begin
 perform private.closure_assert_open(p_worker_account_id,p_requester_account_id);
 perform private.safety_assert_pair(p_worker_account_id,p_requester_account_id);
end; $f$;

-- Prior contact grants become unreadable while restricted, without granting any
-- new access or deleting a historical grant. Existing unblock semantics survive.
create or replace function private.safety_grant_valid(a uuid,b uuid,granted timestamptz)
returns boolean language sql stable security definer set search_path=pg_catalog
as $f$ select granted is not null and not private.closure_account_restricted(a) and not private.closure_account_restricted(b)
 and not exists(select 1 from private.account_blocks x
 where ((x.blocker_account_id=a and x.blocked_account_id=b) or (x.blocker_account_id=b and x.blocked_account_id=a))
 and (x.active or x.last_blocked_at>=granted)); $f$;

create function private.closure_event_restricted(e public.user_activity_events)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog
as $f$
declare peer uuid; a public.agreements;
begin
 perform pg_advisory_xact_lock_shared(private.closure_account_key(e.recipient_user_id));
 if private.closure_account_restricted(e.recipient_user_id) then return true; end if;
 if e.event_type in('AGREEMENT_CANCELLED','NEED_CANCELLED','EXECUTION_STATE_CHANGED','COMPLETION_REQUIRED','RECOVERY_OPENED') then return false; end if;
 if e.entity_type='AGREEMENT' then
  select * into a from public.agreements where id=e.entity_id;
  peer:=case when e.recipient_user_id=a.requester_account_id then a.worker_account_id when e.recipient_user_id=a.worker_account_id then a.requester_account_id end;
 elsif e.entity_type='RESPONSE' then
  select case when e.recipient_user_id=r.worker_account_id then n.requester_account_id when e.recipient_user_id=n.requester_account_id then r.worker_account_id end into peer
  from public.marketplace_responses r join public.needs n on n.id=r.need_id where r.id=e.entity_id;
 elsif e.entity_type='NEED' then select requester_account_id into peer from public.needs where id=e.entity_id;
 elsif e.entity_type='CLARIFICATION' then
  select case when e.recipient_user_id=n.requester_account_id then q.asker_account_id else n.requester_account_id end into peer
  from private.preselection_qa_questions q join public.needs n on n.id=q.need_id where q.id=e.entity_id;
 end if;
 if peer is null then return false; end if;
 perform pg_advisory_xact_lock_shared(private.closure_account_key(peer));
 return private.closure_account_restricted(peer);
end;
$f$;
create function private.closure_guard_delivery()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $f$
declare e public.user_activity_events;
begin
 select * into e from public.user_activity_events where id=new.event_id;
 if found and private.closure_event_restricted(e) then new.state:='SUPPRESSED';new.suppression_reason:='ACCOUNT_CLOSING';end if;
 return new;
end;
$f$;
create trigger pre_v3_closure_delivery before insert on public.notification_deliveries for each row execute function private.closure_guard_delivery();
do $seams$
declare d text; anchor text;
begin
 d:=pg_get_functiondef('private.push_suppression(public.notification_deliveries)'::regprocedure);
 anchor:=$a$ if private.safety_event_blocked(e) then return 'ACCOUNT_BLOCKED'; end if;$a$;
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'CLOSURE_PUSH_ANCHOR_DRIFT'; end if;
 execute replace(d,anchor,$a$ if private.closure_event_restricted(e) then return 'ACCOUNT_CLOSING'; end if;
$a$||anchor);
 d:=pg_get_functiondef('public.rpc_get_public_profile(uuid)'::regprocedure);
 anchor:=$a$  if private.safety_pair_blocked(v_actor,v_profile.account_id) then return null; end if;$a$;
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'CLOSURE_PROFILE_ANCHOR_DRIFT'; end if;
 execute replace(d,anchor,$a$  if private.closure_account_restricted(v_actor) or private.closure_account_restricted(v_profile.account_id) then return null; end if;
$a$||anchor);
 -- Cancellation must release existing obligations, but must not reopen
 -- matching for a restricted requester. An open requester whose worker closes
 -- retains the existing remaining-capacity search behavior.
 d:=pg_get_functiondef('public.rpc_cancel_agreement(uuid,text)'::regprocedure);
 anchor:=$a$     and v_need.status in ('ACTIVE','SELECTION') then$a$;
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'CLOSURE_CANCEL_ANCHOR_DRIFT'; end if;
 execute replace(d,anchor,$a$     and v_need.status in ('ACTIVE','SELECTION')
     and not private.closure_account_restricted(v_need.requester_account_id) then$a$);
 -- Suppress only the legacy chat echo of recovery; retain the authoritative
 -- recovery transition and its safe event even when ordinary chat is fenced.
 d:=pg_get_functiondef('public.rpc_report_problem(uuid,text)'::regprocedure);
 anchor:=$a$    if not private.safety_pair_blocked(a.requester_account_id,a.worker_account_id) then$a$;
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'CLOSURE_RECOVERY_ANCHOR_DRIFT'; end if;
 execute replace(d,anchor,$a$    if not private.safety_pair_blocked(a.requester_account_id,a.worker_account_id)
     and not private.closure_account_restricted(a.requester_account_id) and not private.closure_account_restricted(a.worker_account_id) then$a$);
 d:=pg_get_functiondef('public.rpc_get_my_agreement_review(uuid)'::regprocedure);
 anchor:=$a$'eligible',own_review is null and a.status='COMPLETED'$a$;
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'CLOSURE_REVIEW_ANCHOR_DRIFT'; end if;
 execute replace(d,anchor,$a$'eligible',own_review is null and not private.closure_account_restricted(u) and a.status='COMPLETED'$a$);
 d:=pg_get_functiondef('public.rpc_get_account_reputation(uuid)'::regprocedure);
 anchor:=$a$ if p_account_id is null or not exists(select 1 from public.app_accounts where id=p_account_id)$a$;
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'CLOSURE_REPUTATION_ANCHOR_DRIFT'; end if;
 execute replace(d,anchor,anchor||E'\n or private.closure_account_restricted(auth.uid()) or private.closure_account_restricted(p_account_id)');
end;
$seams$;

revoke all on function private.closure_account_key(uuid),private.closure_account_restricted(uuid),private.closure_assert_open(uuid,uuid),
 private.account_closure_preparation(uuid),private.account_closure_document(private.account_closure_requests),private.closure_guard_owned_write(),
 private.closure_event_restricted(public.user_activity_events),private.closure_guard_delivery() from public,anon,authenticated,service_role;
revoke all on function public.rpc_get_account_closure(uuid),public.rpc_prepare_account_closure(uuid,integer,uuid),public.rpc_get_account_closure_receipt(uuid,uuid)
 from public,anon,authenticated,service_role;
grant execute on function public.rpc_get_account_closure(uuid),public.rpc_prepare_account_closure(uuid,integer,uuid),public.rpc_get_account_closure_receipt(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;

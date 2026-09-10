-- P3 bounded retention execution: one compiled AI adapter, existing policy owner.
-- No legal duration, approved content, hold or deletion job is seeded.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $pre$ begin
 if to_regclass('private.data_export_artifacts') is null
 or to_regprocedure('private.revoke_data_export_receipt(uuid,uuid)') is null
 or not exists(select 1 from pg_attribute where attrelid='private.retention_policy_sets'::regclass and attname='export_delivery' and not attisdropped)
 then raise exception 'P3_EXECUTION_SOURCE104_REQUIRED'; end if;
 if not exists(select 1 from supabase_migrations.schema_migrations where md5(statements[1])='3ed748517ea4a4cb3d83fcc57db6ac86')
 then raise exception 'P3_EXECUTION_SOURCE104_BYTES_REQUIRED'; end if;
 if (select md5(prosrc) from pg_proc where oid='private.marketplace_tick(integer,timestamptz)'::regprocedure)
 is distinct from 'f6a48054291457d3f2b731dde0f19e2c' then raise exception 'P3_EXECUTION_TICK104_BODY_REQUIRED';end if;
end $pre$;
create temporary table p3_execution_old_acl on commit drop as
 select oid,proacl from pg_proc where oid='private.marketplace_tick(integer,timestamptz)'::regprocedure;

alter table private.retention_policy_sets add column retention_execution jsonb null
 check(retention_execution is null or (jsonb_typeof(retention_execution)='object' and octet_length(retention_execution::text)<=16384));
comment on column private.retention_policy_sets.retention_execution is
 'Reviewed executable binding for the existing policy version. NULL is closed. Prose is never parsed. SQL105 supports only AI_ABANDONED_UNBOUND/DELETE; no production value is seeded.';

-- Older records have no trustworthy abandonment/origin history. Keep them closed.
alter table public.ai_conversations add column retention_unbound_origin boolean not null default false,
 add column retention_abandoned_at timestamptz null;
create index ai_conversations_retention_due_idx on public.ai_conversations(retention_abandoned_at,id)
 where status='ABANDONED' and retention_unbound_origin;
create function private.guard_retention_ai_origin() returns trigger
language plpgsql security definer set search_path=pg_catalog as $f$
begin
 if tg_op='INSERT' then
   new.retention_unbound_origin:=new.purpose='NEED_INTAKE' and new.bound_need_id is null and new.need_edit_base_fingerprint is null;
   new.retention_abandoned_at:=case when new.status='ABANDONED' then clock_timestamp() else null end;
 else
   new.retention_unbound_origin:=old.retention_unbound_origin and new.retention_unbound_origin
     and new.account_id=old.account_id and new.purpose=old.purpose and new.bound_need_id is null and new.need_edit_base_fingerprint is null;
   new.retention_abandoned_at:=case when new.status<>'ABANDONED' then null
     when old.status='ABANDONED' then old.retention_abandoned_at else clock_timestamp() end;
 end if;
 return new;
end $f$;
revoke all on function private.guard_retention_ai_origin() from public,anon,authenticated,service_role;
create trigger guard_retention_ai_origin_trg before insert or update on public.ai_conversations
for each row execute function private.guard_retention_ai_origin();

-- Serialize child changes with the final parent-row deletion check. Evidence
-- admission permanently retires origin eligibility even if later removed.
create function private.guard_retention_ai_child() returns trigger
language plpgsql security definer set search_path=pg_catalog as $f$
declare parent_id uuid; old_id uuid; evidence boolean;
begin
 parent_id:=case when tg_op='DELETE' then old.conversation_id else new.conversation_id end;
 old_id:=case when tg_op='UPDATE' then old.conversation_id else parent_id end;
 perform 1 from public.ai_conversations where id in(parent_id,old_id) order by id for update;
 if tg_op<>'DELETE' then
   evidence:=tg_table_name<>'ai_messages';
   if tg_table_name='ai_messages' then evidence:=cardinality(new.proposed_fact_ids)>0 or new.safety in('REVIEW','BLOCK'); end if;
   update public.ai_conversations set retention_unbound_origin=false where id=parent_id and retention_unbound_origin
    and (coalesce(evidence,false) or status='ABANDONED');
 end if;
 if tg_op='DELETE' then return old; end if;return new;
end $f$;
revoke all on function private.guard_retention_ai_child() from public,anon,authenticated,service_role;
create trigger guard_retention_ai_messages_trg before insert or update or delete on public.ai_messages
 for each row execute function private.guard_retention_ai_child();
create trigger guard_retention_ai_facts_trg before insert or update or delete on public.ai_structured_facts
 for each row execute function private.guard_retention_ai_child();
create trigger guard_retention_ai_proposals_trg before insert or update or delete on public.ai_action_proposals
 for each row execute function private.guard_retention_ai_child();

create table private.retention_holds(
 id uuid primary key default gen_random_uuid(),account_id uuid not null references auth.users(id) on delete restrict,
 hold_key text not null check(char_length(hold_key) between 8 and 128),conversation_id uuid null,
 active boolean not null,revision bigint not null check(revision>0),created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),unique(account_id,hold_key)
);
create index retention_holds_active_idx on private.retention_holds(account_id,conversation_id) where active;
alter table private.retention_holds enable row level security;alter table private.retention_holds force row level security;
revoke all on private.retention_holds from public,anon,authenticated,service_role;

create table private.retention_jobs(
 id uuid primary key default gen_random_uuid(),account_id uuid not null references auth.users(id) on delete restrict,
 conversation_id uuid not null unique,dataset text not null default 'AI_ABANDONED_UNBOUND' check(dataset='AI_ABANDONED_UNBOUND'),
 status text not null check(status in('CLAIMED','SUCCEEDED','BLOCKED','FAILED')),
 attempt_id uuid not null,attempt_number integer not null check(attempt_number between 1 and 5),lease_until timestamptz not null,
 policy_id uuid not null references private.retention_policy_sets(id) on delete restrict,policy_sha256 text not null check(policy_sha256~'^[a-f0-9]{64}$'),
 source_sha256 text not null check(source_sha256~'^[a-f0-9]{64}$'),due_at timestamptz not null,
 next_attempt_at timestamptz null,last_code text null check(last_code in('HELD','POLICY_CHANGED','SOURCE_CHANGED','LEASE_EXPIRED','EXECUTION_FAILED')),
 result jsonb null,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp()
);
alter table private.retention_jobs enable row level security;alter table private.retention_jobs force row level security;
revoke all on private.retention_jobs from public,anon,authenticated,service_role;
create index retention_jobs_retry_idx on private.retention_jobs(next_attempt_at,conversation_id) where status in('BLOCKED','FAILED');

-- Bounded scanning progress belongs to this job owner, not a second scheduler.
-- The zero scope is the global scan; other scopes are explicit account scans.
create table private.retention_scan_cursors(
 scope_id uuid primary key,abandoned_at timestamptz null,conversation_id uuid null,
 check((abandoned_at is null)=(conversation_id is null))
);
alter table private.retention_scan_cursors enable row level security;alter table private.retention_scan_cursors force row level security;
revoke all on private.retention_scan_cursors from public,anon,authenticated,service_role;

create function private.retention_ai_source_ready() returns boolean language sql stable security definer set search_path=pg_catalog as $f$
 select
 (select count(*)=5 and bool_and(relkind='r' and not relispartition) from pg_class where oid in(
  'public.ai_conversations'::regclass,'public.ai_messages'::regclass,'public.ai_structured_facts'::regclass,
  'public.ai_action_proposals'::regclass,'private.need_draft_save_commands'::regclass))
 and not exists(select 1 from pg_inherits where inhparent in('public.ai_conversations'::regclass,'public.ai_messages'::regclass,
  'public.ai_structured_facts'::regclass,'public.ai_action_proposals'::regclass,'private.need_draft_save_commands'::regclass)
  or inhrelid in('public.ai_conversations'::regclass,'public.ai_messages'::regclass,'public.ai_structured_facts'::regclass,
  'public.ai_action_proposals'::regclass,'private.need_draft_save_commands'::regclass))
 and
 (select array_agg(attname::text||':'||format_type(atttypid,atttypmod)||':'||attnotnull::text||':'||attidentity::text||':'||attgenerated::text order by attname)
  from pg_attribute where attrelid='public.ai_conversations'::regclass and attnum>0 and not attisdropped)
 =array['account_id:uuid:true::','bound_need_id:uuid:false::','completed_at:timestamp with time zone:false::','created_at:timestamp with time zone:true::',
 'fact_schema_version:text:true::','id:uuid:true::','need_edit_base_fingerprint:text:false::','purpose:text:true::',
 'retention_abandoned_at:timestamp with time zone:false::','retention_unbound_origin:boolean:true::','status:text:true::']::text[]
 and (select array_agg(attname::text||':'||format_type(atttypid,atttypmod)||':'||attnotnull::text||':'||attidentity::text||':'||attgenerated::text order by attname)
  from pg_attribute where attrelid='public.ai_messages'::regclass and attnum>0 and not attisdropped)
 =array['account_id:uuid:true::','body:text:true::','conversation_id:uuid:true::','created_at:timestamp with time zone:true::','id:uuid:true::',
 'proposed_fact_ids:uuid[]:true::','role:text:true::','safety:text:false::','sequence_no:bigint:true:a:']::text[]
 and (select array_agg(conrelid::regclass::text order by conrelid::regclass::text) from pg_constraint where contype='f' and confrelid='public.ai_conversations'::regclass)
 =array['private.need_draft_save_commands','public.ai_action_proposals','public.ai_messages','public.ai_structured_facts']::text[]
 and not exists(select 1 from pg_constraint c where contype='f' and confrelid='public.ai_conversations'::regclass and
  (confdeltype<>'c' or confkey<>array[1]::smallint[] or conkey<>array[(select attnum from pg_attribute where attrelid=c.conrelid and attname='conversation_id' and not attisdropped)]::smallint[]))
 and not exists(select 1 from pg_constraint where contype='f' and confrelid='public.ai_messages'::regclass)
 -- Exact admitted trigger functions and events: an added/changed DELETE or
 -- statement trigger cannot silently introduce an unreviewed side effect.
 and (select array_agg(t.tgrelid::regclass::text||':'||t.tgname||':'||t.tgtype::text||':'||p.proname||':'||md5(p.prosrc)
   order by t.tgrelid::regclass::text,t.tgname) from pg_trigger t join pg_proc p on p.oid=t.tgfoid
   where not t.tgisinternal and t.tgrelid in('public.ai_conversations'::regclass,'public.ai_messages'::regclass,
    'public.ai_structured_facts'::regclass,'public.ai_action_proposals'::regclass,'private.need_draft_save_commands'::regclass))
 =array[
  'public.ai_action_proposals:guard_ai_proposal_write_trg:19:guard_ai_proposal_write:da1587175d84767009e24c4eab6628c1',
  'public.ai_action_proposals:guard_retention_ai_proposals_trg:31:guard_retention_ai_child:a4ccc5f48bdcca189510405e297c5ef3',
  'public.ai_conversations:guard_need_edit_base_marker_trg:23:guard_need_edit_base_marker:033e9307815212049bdf083c7083959b',
  'public.ai_conversations:guard_retention_ai_origin_trg:23:guard_retention_ai_origin:bd6a0fdc6c3dbb96844424dd7714e01a',
  'public.ai_messages:guard_retention_ai_messages_trg:31:guard_retention_ai_child:a4ccc5f48bdcca189510405e297c5ef3',
  'public.ai_structured_facts:guard_ai_fact_schema_trg:23:guard_ai_fact_schema:b2386ca23e82d730f876ea18e8855616',
  'public.ai_structured_facts:guard_ai_fact_write_trg:19:guard_ai_fact_write:e85a09a79a217d1ab7d350470875d437',
  'public.ai_structured_facts:guard_resolved_location_fact_trg:23:guard_resolved_location_fact:66bdc1abd6439c4c44523158345e2216',
  'public.ai_structured_facts:guard_retention_ai_facts_trg:31:guard_retention_ai_child:a4ccc5f48bdcca189510405e297c5ef3',
  'public.ai_structured_facts:invalidate_resolved_location_fact_trg:21:invalidate_resolved_location_fact:ff135eaf8f8c5eabd562186f5ee48669'
 ]::text[]
 and not exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal
  and t.tgrelid in('public.ai_conversations'::regclass,'public.ai_messages'::regclass,'public.ai_structured_facts'::regclass,
  'public.ai_action_proposals'::regclass,'private.need_draft_save_commands'::regclass)
  and (t.tgenabled<>'O' or t.tgqual is not null or t.tgnargs<>0
    or case when t.tgrelid='public.ai_structured_facts'::regclass and t.tgname='guard_ai_fact_schema_trg' then
      (select array_agg(a.attname::text order by x.ordinality) from unnest(t.tgattr) with ordinality x(attnum,ordinality)
       join pg_attribute a on a.attrelid=t.tgrelid and a.attnum=x.attnum and not a.attisdropped)
       is distinct from array['conversation_id','fact_key','fact_value','fact_schema_version','value_type','display_value']::text[]
      else t.tgattr<>''::int2vector end
    or p.pronamespace<>'private'::regnamespace or not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog']::text[]));
$f$;
revoke all on function private.retention_ai_source_ready() from public,anon,authenticated,service_role;

create function private.retention_execution_binding() returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare p private.retention_policy_sets;m jsonb;privacy private.legal_document_versions;rules jsonb;binding jsonb;
begin
 select * into p from private.retention_policy_sets where retired_at is null and effective_at<=statement_timestamp();
 if not found or p.retention_execution is null then return null;end if;m:=p.retention_execution;
 if m-ARRAY['schemaVersion','adapterVersion','dataClass','dataset','action','trigger','retentionSeconds','privacyDocumentId','privacyContentSha256','contentSha256']<>'{}'::jsonb
 or not(m ?& ARRAY['schemaVersion','adapterVersion','dataClass','dataset','action','trigger','retentionSeconds','privacyDocumentId','privacyContentSha256','contentSha256'])
 or m->'schemaVersion' is distinct from '1'::jsonb or m->>'adapterVersion' is distinct from 'P3_AI_ABANDONED_UNBOUND_V1'
 or m->>'dataClass' is distinct from 'AI_VOLATILE' or m->>'dataset' is distinct from 'AI_ABANDONED_UNBOUND'
 or m->>'action' is distinct from 'DELETE' or m->>'trigger' is distinct from 'OBSERVED_ABANDONMENT'
 or jsonb_typeof(m->'retentionSeconds') is distinct from 'number' or (m->>'retentionSeconds')!~'^[1-9][0-9]{0,9}$'
 or coalesce(m->>'privacyDocumentId','')!~'^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
 or coalesce(m->>'privacyContentSha256','')!~'^[a-f0-9]{64}$' or coalesce(m->>'contentSha256','')!~'^[a-f0-9]{64}$'
 then return null;end if;
 if (m->>'retentionSeconds')::numeric>2147483647 then return null;end if;
 if encode(extensions.digest(convert_to((m-'contentSha256')::text,'UTF8'),'sha256'),'hex')<>m->>'contentSha256' then return null;end if;
 select * into privacy from private.legal_document_versions where id=(m->>'privacyDocumentId')::uuid and document_kind='PRIVACY'
 and is_active and published_at<=statement_timestamp() and effective_at<=statement_timestamp() and content_sha256=m->>'privacyContentSha256';
 if not found or not exists(select 1 from private.retention_data_classes where code='AI_VOLATILE' and active and required)
 or exists(select 1 from private.retention_data_classes d where d.active and d.required and not exists(select 1 from private.retention_policy_rules r where r.policy_id=p.id and r.data_class=d.code))
 then return null;end if;
 select jsonb_agg(to_jsonb(r) order by r.data_class) into rules from private.retention_policy_rules r where policy_id=p.id;
 binding:=jsonb_build_object('policyId',p.id,'policyVersion',p.policy_version,'effectiveAt',p.effective_at,'counselReference',p.counsel_reference,
 'rules',rules,'execution',m,'privacy',jsonb_build_object('id',privacy.id,'contentSha256',privacy.content_sha256,'version',privacy.version_label));
 return jsonb_build_object('policyId',p.id,'policyVersion',p.policy_version,'retentionSeconds',m->'retentionSeconds',
 'sha256',encode(extensions.digest(convert_to(binding::text,'UTF8'),'sha256'),'hex'));
end $f$;
revoke all on function private.retention_execution_binding() from public,anon,authenticated,service_role;

create function public.rpc_get_retention_execution_status() returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare b jsonb;source_ready boolean;ready boolean;unsupported jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 b:=private.retention_execution_binding();source_ready:=coalesce(private.retention_ai_source_ready(),false);ready:=b is not null and source_ready;
 select coalesce(jsonb_agg(code order by code),'[]'::jsonb) into unsupported from private.retention_data_classes where active and code<>'AI_VOLATILE';
 return jsonb_build_object('engineVersion','P3_AI_ABANDONED_UNBOUND_V1','executionAdmitted',ready,'policyVersion',b->>'policyVersion',
 'datasets',jsonb_build_array(jsonb_build_object('dataset','AI_ABANDONED_UNBOUND','dataClass','AI_VOLATILE','action','DELETE','ready',ready,
 'reason',case when b is null then 'POLICY_NOT_READY' when not source_ready then 'SOURCE_NOT_READY' else null end)),
 'unsupportedDataClasses',unsupported,'storageCleanup','NOT_APPLICABLE');
end $f$;
revoke all on function public.rpc_get_retention_execution_status() from public,anon,authenticated,service_role;
grant execute on function public.rpc_get_retention_execution_status() to authenticated;

create function private.retention_ai_candidate(p_conversation_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare c public.ai_conversations;messages jsonb;
begin
 select * into c from public.ai_conversations where id=p_conversation_id;
 if not found or c.status<>'ABANDONED' or c.purpose<>'NEED_INTAKE' or c.bound_need_id is not null or c.need_edit_base_fingerprint is not null
 or not c.retention_unbound_origin or c.retention_abandoned_at is null
 or exists(select 1 from public.ai_structured_facts where conversation_id=c.id)
 or exists(select 1 from public.ai_action_proposals where conversation_id=c.id)
 or exists(select 1 from private.need_draft_save_commands where conversation_id=c.id)
 or exists(select 1 from public.ai_messages where conversation_id=c.id and (account_id<>c.account_id or cardinality(proposed_fact_ids)>0 or safety in('REVIEW','BLOCK')))
 or (select count(*) from (select 1 from public.ai_messages where conversation_id=c.id limit 101) bounded_messages)>100
 then return null;end if;
 select coalesce(jsonb_agg(to_jsonb(m) order by m.sequence_no),'[]'::jsonb) into messages from public.ai_messages m where conversation_id=c.id;
 return jsonb_build_object('accountId',c.account_id,'abandonedAt',c.retention_abandoned_at,'messageCount',jsonb_array_length(messages),
 'sha256',encode(extensions.digest(convert_to(jsonb_build_object('conversation',to_jsonb(c),'messages',messages)::text,'UTF8'),'sha256'),'hex'));
end $f$;
revoke all on function private.retention_ai_candidate(uuid) from public,anon,authenticated,service_role;

create function public.rpc_set_retention_hold(p_account_id uuid,p_conversation_id uuid,p_hold_key text,p_active boolean,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare h private.retention_holds;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'TRUSTED_SERVER_REQUIRED' using errcode='42501';end if;
 if p_account_id is null or p_active is null or p_expected_revision is null or p_expected_revision<0
 or p_expected_revision>=9007199254740991 or char_length(coalesce(p_hold_key,'')) not between 8 and 128 then raise exception 'RETENTION_HOLD_INVALID' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('uskoci:retention:'||p_account_id::text,0));
 if not exists(select 1 from public.app_accounts where id=p_account_id) then raise exception 'RETENTION_ACCOUNT_NOT_FOUND';end if;
 select * into h from private.retention_holds where account_id=p_account_id and hold_key=p_hold_key for update;
 if found then
   if h.conversation_id is distinct from p_conversation_id then raise exception 'RETENTION_HOLD_SCOPE_MISMATCH';end if;
   if h.revision=p_expected_revision+1 and h.active=p_active then return jsonb_build_object('holdId',h.id,'revision',h.revision,'active',h.active,'idempotentReplay',true);end if;
   if h.revision<>p_expected_revision then raise exception 'RETENTION_HOLD_REVISION_STALE' using errcode='40001';end if;
 elsif p_expected_revision<>0 then raise exception 'RETENTION_HOLD_REVISION_STALE' using errcode='40001';end if;
 if p_conversation_id is not null and not exists(select 1 from public.ai_conversations where id=p_conversation_id and account_id=p_account_id)
 then raise exception 'RETENTION_TARGET_NOT_FOUND';end if;
 insert into private.retention_holds(account_id,hold_key,conversation_id,active,revision) values(p_account_id,p_hold_key,p_conversation_id,p_active,1)
 on conflict(account_id,hold_key) do update set active=excluded.active,revision=retention_holds.revision+1,updated_at=clock_timestamp() returning * into h;
 perform private.audit_marketplace(null,case when p_active then 'RETENTION_HOLD_SET' else 'RETENTION_HOLD_RELEASED' end,'SYSTEM',h.id,null,jsonb_build_object('revision',h.revision));
 return jsonb_build_object('holdId',h.id,'revision',h.revision,'active',h.active,'idempotentReplay',false);
end $f$;
revoke all on function public.rpc_set_retention_hold(uuid,uuid,text,boolean,bigint) from public,anon,authenticated,service_role;
grant execute on function public.rpc_set_retention_hold(uuid,uuid,text,boolean,bigint) to service_role;

create function private.claim_retention_job(p_account_id uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare b jsonb;candidate record;c public.ai_conversations;v jsonb;j private.retention_jobs;now_at timestamptz;due timestamptz;token uuid;
 scan private.retention_scan_cursors;scope uuid:=coalesce(p_account_id,'00000000-0000-0000-0000-000000000000'::uuid);
begin
 lock table private.retention_policy_sets,private.retention_policy_rules,private.retention_data_classes,private.legal_document_versions in share mode;
 b:=private.retention_execution_binding();if b is null then return jsonb_build_object('kind','NOT_READY','code','POLICY_NOT_READY');end if;
 if not coalesce(private.retention_ai_source_ready(),false) then return jsonb_build_object('kind','NOT_READY','code','SOURCE_NOT_READY');end if;
 if not pg_try_advisory_xact_lock(hashtextextended('uskoci:retention-scan:'||scope::text,0)) then return jsonb_build_object('kind','NONE');end if;
 insert into private.retention_scan_cursors(scope_id) values(scope) on conflict do nothing;
 select * into scan from private.retention_scan_cursors where scope_id=scope for update;
 now_at:=clock_timestamp();
 if scan.abandoned_at is not null and not exists(select 1 from public.ai_conversations c0 where c0.status='ABANDONED' and c0.retention_unbound_origin
  and c0.retention_abandoned_at is not null and (p_account_id is null or c0.account_id=p_account_id)
  and (c0.retention_abandoned_at,c0.id)>(scan.abandoned_at,scan.conversation_id)
  and c0.retention_abandoned_at<=now_at-make_interval(secs=>(b->>'retentionSeconds')::integer)) then
  scan.abandoned_at:=null;scan.conversation_id:=null;
 end if;
 for candidate in select c0.id,c0.account_id,c0.retention_abandoned_at from public.ai_conversations c0 where c0.status='ABANDONED' and c0.retention_unbound_origin and c0.retention_abandoned_at is not null
 and (p_account_id is null or c0.account_id=p_account_id) and c0.retention_abandoned_at<=now_at-make_interval(secs=>(b->>'retentionSeconds')::integer)
 and (scan.abandoned_at is null or (c0.retention_abandoned_at,c0.id)>(scan.abandoned_at,scan.conversation_id))
 order by c0.retention_abandoned_at,c0.id limit 100 loop
   update private.retention_scan_cursors set abandoned_at=candidate.retention_abandoned_at,conversation_id=candidate.id where scope_id=scope;
   if not pg_try_advisory_xact_lock(hashtextextended('uskoci:retention:'||candidate.account_id::text,0)) then continue;end if;
   select * into c from public.ai_conversations where id=candidate.id for update skip locked;if not found then continue;end if;
   now_at:=clock_timestamp();v:=private.retention_ai_candidate(c.id);if v is null then continue;end if;
   due:=(v->>'abandonedAt')::timestamptz+make_interval(secs=>(b->>'retentionSeconds')::integer);if due>now_at then continue;end if;
   if exists(select 1 from private.retention_holds where account_id=c.account_id and active and (conversation_id is null or conversation_id=c.id)) then continue;end if;
   select * into j from private.retention_jobs where conversation_id=c.id for update;
   if found and (j.status='SUCCEEDED' or j.attempt_number>=5 or (j.status='CLAIMED' and j.lease_until>now_at) or j.next_attempt_at>now_at) then continue;end if;
   token:=gen_random_uuid();
   insert into private.retention_jobs(account_id,conversation_id,status,attempt_id,attempt_number,lease_until,policy_id,policy_sha256,source_sha256,due_at)
   values(c.account_id,c.id,'CLAIMED',token,1,now_at+interval '120 seconds',(b->>'policyId')::uuid,b->>'sha256',v->>'sha256',due)
   on conflict(conversation_id) do update set status='CLAIMED',attempt_id=excluded.attempt_id,attempt_number=retention_jobs.attempt_number+1,
    lease_until=excluded.lease_until,policy_id=excluded.policy_id,policy_sha256=excluded.policy_sha256,source_sha256=excluded.source_sha256,due_at=excluded.due_at,
    next_attempt_at=null,last_code=null,result=null,updated_at=now_at returning * into j;
   perform private.audit_marketplace(null,'RETENTION_JOB_CLAIMED','SYSTEM',j.id,null,jsonb_build_object('attempt',j.attempt_number,'policyId',j.policy_id,'dataset',j.dataset));
   return jsonb_build_object('kind','CLAIMED','jobId',j.id,'attemptId',j.attempt_id,'leaseExpiresAt',j.lease_until,'dataset',j.dataset,'policyVersion',b->>'policyVersion');
 end loop;
 return jsonb_build_object('kind','NONE');
end $f$;
revoke all on function private.claim_retention_job(uuid) from public,anon,authenticated,service_role;
create function public.rpc_claim_retention_job(p_account_id uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'TRUSTED_SERVER_REQUIRED' using errcode='42501';end if;
 return private.claim_retention_job(p_account_id);
end $f$;
revoke all on function public.rpc_claim_retention_job(uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_claim_retention_job(uuid) to service_role;

create function private.execute_retention_job(p_job_id uuid,p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare j private.retention_jobs;b jsonb;v jsonb;now_at timestamptz;code text;v_result jsonb;message_count integer:=0;account uuid;
begin
 lock table private.retention_policy_sets,private.retention_policy_rules,private.retention_data_classes,private.legal_document_versions in share mode;
 select account_id into account from private.retention_jobs where id=p_job_id;if not found then raise exception 'RETENTION_JOB_NOT_FOUND';end if;
 perform pg_advisory_xact_lock(hashtextextended('uskoci:retention:'||account::text,0));
 select * into j from private.retention_jobs where id=p_job_id for update;
 if p_attempt_id is null or j.attempt_id<>p_attempt_id then raise exception 'RETENTION_ATTEMPT_STALE' using errcode='40001';end if;
 if j.result is not null then return j.result||jsonb_build_object('idempotentReplay',true);end if;
 perform 1 from public.ai_conversations where id=j.conversation_id for update;
 now_at:=clock_timestamp();b:=private.retention_execution_binding();v:=private.retention_ai_candidate(j.conversation_id);
 code:=case when j.lease_until<=now_at then 'LEASE_EXPIRED'
   when exists(select 1 from private.retention_holds where account_id=j.account_id and active and (conversation_id is null or conversation_id=j.conversation_id)) then 'HELD'
   when b is null or b->>'sha256'<>j.policy_sha256 then 'POLICY_CHANGED'
   when not coalesce(private.retention_ai_source_ready(),false) or v is null or v->>'sha256'<>j.source_sha256 or j.due_at>now_at then 'SOURCE_CHANGED' else null end;
 if code is null then
   begin
     -- No network or Storage work: final hold check and complete deletion commit
     -- atomically under the account+parent locks. The candidate has no facts,
     -- proposals, draft receipts or links to Need/edit evidence.
     message_count:=(v->>'messageCount')::integer;
     delete from public.ai_conversations where id=j.conversation_id;
     if not found then raise exception 'RETENTION_SOURCE_DISAPPEARED';end if;
     v_result:=jsonb_build_object('jobId',j.id,'status','SUCCEEDED','deletedConversation',true,'deletedMessages',message_count,'idempotentReplay',false);
     update private.retention_jobs set status='SUCCEEDED',result=v_result,last_code=null,next_attempt_at=null,updated_at=clock_timestamp() where id=j.id;
     perform private.audit_marketplace(null,'RETENTION_DELETE_COMPLETED','SYSTEM',j.id,null,jsonb_build_object('dataset',j.dataset,'policyId',j.policy_id,'deletedMessages',message_count));
     return v_result;
   exception when others then
     -- Subtransaction rollback restores every deleted row before recording a
     -- bounded technical retry. Never expose exception text or private content.
     code:='EXECUTION_FAILED';
   end;
 end if;
 v_result:=jsonb_build_object('jobId',j.id,'status',case when code='EXECUTION_FAILED' then 'FAILED' else 'BLOCKED' end,
 'code',code,'deletedConversation',false,'deletedMessages',0,'idempotentReplay',false);
 update private.retention_jobs set status=case when code='EXECUTION_FAILED' then 'FAILED' else 'BLOCKED' end,last_code=code,result=v_result,
  next_attempt_at=case when attempt_number<5 then clock_timestamp()+interval '60 seconds' else null end,updated_at=clock_timestamp() where id=j.id;
 perform private.audit_marketplace(null,'RETENTION_DELETE_DEFERRED','SYSTEM',j.id,null,jsonb_build_object('code',code,'attempt',j.attempt_number));
 return v_result;
end $f$;
revoke all on function private.execute_retention_job(uuid,uuid) from public,anon,authenticated,service_role;
create function public.rpc_execute_retention_job(p_job_id uuid,p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'TRUSTED_SERVER_REQUIRED' using errcode='42501';end if;
 return private.execute_retention_job(p_job_id,p_attempt_id);
end $f$;
revoke all on function public.rpc_execute_retention_job(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.rpc_execute_retention_job(uuid,uuid) to service_role;

create function private.retention_maintenance(p_batch integer default 25) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare i integer;j jsonb;r jsonb;deleted integer:=0;deferred integer:=0;
begin
 for i in 1..greatest(1,least(coalesce(p_batch,25),25)) loop
   j:=private.claim_retention_job();if j->>'kind'<>'CLAIMED' then
     return jsonb_build_object('deletedConversations',deleted,'deferred',deferred,'state',j->>'kind','code',j->>'code','storageCleanup','NOT_APPLICABLE');end if;
   r:=private.execute_retention_job((j->>'jobId')::uuid,(j->>'attemptId')::uuid);
   if r->>'status'='SUCCEEDED' then deleted:=deleted+1;else deferred:=deferred+1;end if;
 end loop;
 return jsonb_build_object('deletedConversations',deleted,'deferred',deferred,'state','BATCH_COMPLETED','storageCleanup','NOT_APPLICABLE');
end $f$;
revoke all on function private.retention_maintenance(integer) from public,anon,authenticated,service_role;
create or replace function private.marketplace_tick(p_batch integer default 25,p_at timestamptz default statement_timestamp())
returns jsonb language plpgsql security definer set search_path to 'pg_catalog' as $$
declare expiry jsonb;dispatch jsonb;completion jsonb;export_maintenance jsonb;retention_maintenance jsonb;
begin
 expiry:=private.expire_lifecycle(p_at);dispatch:=private.dispatch_tick(p_batch,p_at);
 completion:=to_jsonb(public.rpc_tick_auto_completion());export_maintenance:=private.data_export_maintenance(p_batch);
 retention_maintenance:=private.retention_maintenance(p_batch);
 return jsonb_build_object('at',p_at,'expiry',expiry,'dispatch',dispatch,'completion',completion,'authoritative',true,
 'exportMaintenance',export_maintenance,'retentionMaintenance',retention_maintenance);
end $$;
do $post$ begin
 if exists(select 1 from p3_execution_old_acl o join pg_proc p on p.oid=o.oid where p.proacl is distinct from o.proacl) then raise exception 'P3_EXISTING_ACL_CHANGED';end if;
 if exists(select 1 from private.retention_policy_sets where retention_execution is not null) then raise exception 'P3_EXECUTION_POLICY_SEED_FORBIDDEN';end if;
 if exists(select 1 from private.retention_jobs) or exists(select 1 from private.retention_holds) or exists(select 1 from private.retention_scan_cursors) then raise exception 'P3_EXECUTION_ROW_SEED_FORBIDDEN';end if;
 if not coalesce(private.retention_ai_source_ready(),false) then raise exception 'P3_AI_SOURCE_UNSUPPORTED';end if;
end $post$;
commit;

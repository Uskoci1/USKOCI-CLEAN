-- V5 bounded P3 compatibility only: no policy, duration, candidate widening or purge class.
-- Exact source105 + reviewed121 closure triggers +126 edit-base body, through139.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $pre$ begin
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.retention_ai_candidate(uuid)')) is distinct from '67cbf2fa3eb32f07d96cb9abf9059292' then raise exception 'V5_RETENTION_PREDECESSOR_DRIFT' using detail='private.retention_ai_candidate(uuid)';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.retention_ai_source_ready()')) is distinct from 'e2ca037fa633809eaa5fbe9029b40fb9' then raise exception 'V5_RETENTION_PREDECESSOR_DRIFT' using detail='private.retention_ai_source_ready()';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.claim_retention_job(uuid)')) is distinct from 'daac9913ccc777eb3c1a0368f1b3cd2f' then raise exception 'V5_RETENTION_PREDECESSOR_DRIFT' using detail='private.claim_retention_job(uuid)';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.execute_retention_job(uuid,uuid)')) is distinct from '96fcdf695c0a31ad75df1f80c6c73618' then raise exception 'V5_RETENTION_PREDECESSOR_DRIFT' using detail='private.execute_retention_job(uuid,uuid)';end if;
 if (select md5(prosrc) from pg_proc where oid=to_regprocedure('private.closure_guard_owned_write()')) is distinct from '04242657eb1f99d3576766070d343445' then raise exception 'V5_RETENTION_PREDECESSOR_DRIFT' using detail='private.closure_guard_owned_write()';end if;
 if private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) or to_regclass('private.media_evidence_refs_v5') is null then raise exception 'V5_RETENTION_SOURCE139_REQUIRED';end if;
end $pre$;

create or replace function private.retention_ai_source_ready() returns boolean language sql stable security definer set search_path=pg_catalog as $f$
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
  'public.ai_conversations:guard_need_edit_base_marker_trg:23:guard_need_edit_base_marker:27761a396b3b9016c3edc54b2d131629',
  'public.ai_conversations:guard_retention_ai_origin_trg:23:guard_retention_ai_origin:bd6a0fdc6c3dbb96844424dd7714e01a',
  'public.ai_conversations:pre_v3_closure_ai_conversation:23:closure_guard_owned_write:04242657eb1f99d3576766070d343445',
  'public.ai_messages:guard_retention_ai_messages_trg:31:guard_retention_ai_child:a4ccc5f48bdcca189510405e297c5ef3',
  'public.ai_messages:pre_v3_closure_ai_message:7:closure_guard_owned_write:04242657eb1f99d3576766070d343445',
  'public.ai_structured_facts:guard_ai_fact_schema_trg:23:guard_ai_fact_schema:b2386ca23e82d730f876ea18e8855616',
  'public.ai_structured_facts:guard_ai_fact_write_trg:19:guard_ai_fact_write:e85a09a79a217d1ab7d350470875d437',
  'public.ai_structured_facts:guard_resolved_location_fact_trg:23:guard_resolved_location_fact:66bdc1abd6439c4c44523158345e2216',
  'public.ai_structured_facts:guard_retention_ai_facts_trg:31:guard_retention_ai_child:a4ccc5f48bdcca189510405e297c5ef3',
  'public.ai_structured_facts:invalidate_resolved_location_fact_trg:21:invalidate_resolved_location_fact:ff135eaf8f8c5eabd562186f5ee48669',
  'public.ai_structured_facts:pre_v3_closure_ai_fact:23:closure_guard_owned_write:04242657eb1f99d3576766070d343445'
 ]::text[]
 and not exists(select 1 from pg_trigger t join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal
  and t.tgrelid in('public.ai_conversations'::regclass,'public.ai_messages'::regclass,'public.ai_structured_facts'::regclass,
  'public.ai_action_proposals'::regclass,'private.need_draft_save_commands'::regclass)
  and (t.tgenabled<>'O' or t.tgqual is not null or case
      when t.tgrelid='public.ai_conversations'::regclass and t.tgname='pre_v3_closure_ai_conversation' then
       t.tgnargs<>2 or encode(t.tgargs,'hex')<>'4143434f554e54006163636f756e745f696400'
      when (t.tgrelid='public.ai_messages'::regclass and t.tgname='pre_v3_closure_ai_message')
       or (t.tgrelid='public.ai_structured_facts'::regclass and t.tgname='pre_v3_closure_ai_fact') then
       t.tgnargs<>2 or encode(t.tgargs,'hex')<>'434f4e564552534154494f4e00636f6e766572736174696f6e5f696400'
      else t.tgnargs<>0 or octet_length(t.tgargs)<>0 end
    or case when t.tgrelid='public.ai_structured_facts'::regclass and t.tgname='guard_ai_fact_schema_trg' then
      (select array_agg(a.attname::text order by x.ordinality) from unnest(t.tgattr) with ordinality x(attnum,ordinality)
       join pg_attribute a on a.attrelid=t.tgrelid and a.attnum=x.attnum and not a.attisdropped)
       is distinct from array['conversation_id','fact_key','fact_value','fact_schema_version','value_type','display_value']::text[]
      else t.tgattr<>''::int2vector end
    or p.pronamespace<>'private'::regnamespace or not p.prosecdef or p.proconfig is distinct from array['search_path=pg_catalog']::text[]))
 and (select count(*)=3 and bool_and(md5(p.prosrc)=x.body_md5 and p.prosecdef=x.definer and p.proisstrict=x.strict
 and p.provolatile::text=x.volatility and p.prolang=(select oid from pg_language where lanname=x.language)
 and p.proconfig is not distinct from array['search_path=pg_catalog']::text[])
 from (values
 ('private.closure_assert_open(uuid,uuid)','dc9bc4c718593850da4fdb49e612dbd2',true,false,'v','plpgsql'),
 ('private.closure_account_key(uuid)','2dde6ad2462255b188e4f03ffe88edcd',false,true,'i','sql'),
 ('private.closure_account_restricted(uuid)','f4999250c315e0253374d4611291c7ad',true,false,'s','sql')) x(signature,body_md5,definer,strict,volatility,language)
 join pg_proc p on p.oid=to_regprocedure(x.signature))
 -- Pin the complete reviewed139 relation/trigger inventory. Any later schema
 -- addition requires another exact admission review, including semantic sidecars.
 and private.closure_source_digest_v5()='__SOURCE139_SHA256__';
$f$;


do $pin139$
declare d text;sha text;
begin
 select sha256 into strict sha from private.closure_source_v5 where singleton;
 if sha !~ '^[0-9a-f]{64}$' or sha is distinct from private.closure_source_digest_v5() then raise exception 'V5_RETENTION_SOURCE139_REQUIRED';end if;
 d:=pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
 if length(d)-length(replace(d,'__SOURCE139_SHA256__',''))<>length('__SOURCE139_SHA256__') then raise exception 'V5_RETENTION_SOURCE_BINDING_INVALID';end if;
 execute replace(d,'__SOURCE139_SHA256__',sha);
end $pin139$;

create or replace function private.retention_ai_candidate(p_conversation_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $f$
declare c public.ai_conversations;messages jsonb;
begin
 select * into c from public.ai_conversations where id=p_conversation_id;
 if not found or c.status<>'ABANDONED' or c.purpose<>'NEED_INTAKE' or c.bound_need_id is not null or c.need_edit_base_fingerprint is not null
 or not c.retention_unbound_origin or c.retention_abandoned_at is null
 or exists(select 1 from public.ai_structured_facts where conversation_id=c.id)
 or exists(select 1 from public.ai_action_proposals where conversation_id=c.id)
 or exists(select 1 from private.need_draft_save_commands where conversation_id=c.id)
 -- Non-FK durable commands, reviews and media remain outside the old volatile dataset.
 or exists(select 1 from private.ai_need_open_commands where conversation_id=c.id)
 or exists(select 1 from private.ai_need_turn_commands where conversation_id=c.id)
 or exists(select 1 from private.ai_task_reviews where conversation_id=c.id)
 or exists(select 1 from private.worker_ai_sessions where conversation_id=c.id)
 or exists(select 1 from private.worker_ai_turns where conversation_id=c.id)
 or exists(select 1 from private.worker_ai_reviews where conversation_id=c.id)
 or exists(select 1 from private.owned_media_assets where conversation_id=c.id)
 or exists(select 1 from public.ai_messages where conversation_id=c.id and (account_id<>c.account_id or cardinality(proposed_fact_ids)>0 or safety in('REVIEW','BLOCK')))
 or (select count(*) from (select 1 from public.ai_messages where conversation_id=c.id limit 101) bounded_messages)>100
 then return null;end if;
 select coalesce(jsonb_agg(to_jsonb(m) order by m.sequence_no),'[]'::jsonb) into messages from public.ai_messages m where conversation_id=c.id;
 return jsonb_build_object('accountId',c.account_id,'abandonedAt',c.retention_abandoned_at,'messageCount',jsonb_array_length(messages),
 'sha256',encode(extensions.digest(convert_to(jsonb_build_object('conversation',to_jsonb(c),'messages',messages)::text,'UTF8'),'sha256'),'hex'));
end $f$;

create or replace function private.claim_retention_job(p_account_id uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
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
   -- Closure always precedes retention and parent locks. Busy/restricted accounts
   -- are skipped; no new CLAIMED row can deadlock its closure guard.
   if not pg_try_advisory_xact_lock_shared(private.closure_account_key(candidate.account_id)) then continue;end if;
   if private.closure_account_restricted(candidate.account_id) then continue;end if;
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

create or replace function private.execute_retention_job(p_job_id uuid,p_attempt_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog as $f$
declare j private.retention_jobs;b jsonb;v jsonb;now_at timestamptz;code text;v_result jsonb;message_count integer:=0;account uuid;
begin
 lock table private.retention_policy_sets,private.retention_policy_rules,private.retention_data_classes,private.legal_document_versions in share mode;
 select account_id into account from private.retention_jobs where id=p_job_id;if not found then raise exception 'RETENTION_JOB_NOT_FOUND';end if;
 -- Preserve immutable result replay; acquire the shared closure fence first.
 perform pg_advisory_xact_lock_shared(private.closure_account_key(account));
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

-- No trigger/table changes:139 technical inventory remains exact. Existing reviewed
-- closure policy is neither rewritten nor newly admitted by this compatibility fix.
do $post$ begin
 if private.retention_ai_source_ready() is distinct from true then raise exception 'V5_RETENTION_SOURCE_NOT_READY';end if;
 if private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton) then raise exception 'V5_RETENTION_CLOSURE_SOURCE_CHANGED';end if;
end $post$;
revoke all on function private.retention_ai_source_ready(),private.retention_ai_candidate(uuid),private.claim_retention_job(uuid),private.execute_retention_job(uuid,uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;

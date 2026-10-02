CREATE OR REPLACE FUNCTION private.retention_ai_source_ready()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
  'public.ai_action_proposals:guard_ai_proposal_write_trg:19:guard_ai_proposal_write:0ec9c38c1bfa92db7ce18a68f86ea1a0',
  'public.ai_action_proposals:guard_retention_ai_proposals_trg:31:guard_retention_ai_child:57c374edac340755d033506c92a5eec1',
  'public.ai_conversations:guard_need_edit_base_marker_trg:23:guard_need_edit_base_marker:a88fa97fe58cab5b374d99eb9ee2c9af',
  'public.ai_conversations:guard_retention_ai_origin_trg:23:guard_retention_ai_origin:f378d9640f366416fc277a4753ec5fe4',
  'public.ai_conversations:pre_v3_closure_ai_conversation:23:closure_guard_owned_write:f13117fd601dcb82de423b78f25acb4f',
  'public.ai_messages:guard_retention_ai_messages_trg:31:guard_retention_ai_child:57c374edac340755d033506c92a5eec1',
  'public.ai_messages:pre_v3_closure_ai_message:7:closure_guard_owned_write:f13117fd601dcb82de423b78f25acb4f',
  'public.ai_structured_facts:guard_ai_fact_schema_trg:23:guard_ai_fact_schema:58c5a40f731b3aef845691668ec1f2d4',
  'public.ai_structured_facts:guard_ai_fact_write_trg:19:guard_ai_fact_write:f9972cfc47af0358a9f4f03c2e43fe63',
  'public.ai_structured_facts:guard_resolved_location_fact_trg:23:guard_resolved_location_fact:08fb5e837ee4cfe8c1e56fb9589b5dc2',
  'public.ai_structured_facts:guard_retention_ai_facts_trg:31:guard_retention_ai_child:57c374edac340755d033506c92a5eec1',
  'public.ai_structured_facts:invalidate_resolved_location_fact_trg:21:invalidate_resolved_location_fact:998febc1ba2a93e6737d77ee46ce0d72',
  'public.ai_structured_facts:pre_v3_closure_ai_fact:23:closure_guard_owned_write:f13117fd601dcb82de423b78f25acb4f'
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
 and private.closure_source_digest_v5()='0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431';
$function$

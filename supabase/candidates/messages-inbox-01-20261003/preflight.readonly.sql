-- METADATA ONLY. Does not invoke the candidate, read messages or calculate full closure digest.
select statement_timestamp() captured_at, jsonb_build_object(
  'ALREADY_PRESENT',(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='rpc_list_my_conversations_v1')),
  'FUNCTION_BASELINE',(not exists (
  select 1 from (values ('private.agreement_voice_context_v1(uuid,uuid,integer,boolean)','db79bbcb1557e698f96e1973f5f1114d','v','{postgres=X/postgres}'),
    ('private.closure_account_restricted(uuid)','f4999250c315e0253374d4611291c7ad','s','{postgres=X/postgres}'),
    ('private.agreement_photo_context_v5(uuid,uuid,integer,boolean)','ec19c697db73b6339813be3e8dceab6b','v','{postgres=X/postgres}'),
    ('private.agreement_voice_surface_v1()','b697d12234198c95815257d7ce73f147','s','{postgres=X/postgres}'),
    ('private.closure_schema_digest_v5_139()','988b9d3ab9c0dc7341cd30a391184e40','s','{postgres=X/postgres}'),
    ('private.push_session_valid(uuid,uuid)','3454eb7040f3dab3cb0c35b512b46859','v','{postgres=X/postgres}'),
    ('public.rpc_read_agreement_photo_messages_v5(uuid,uuid,uuid[])','9c5a0868e9507b23b600863f4508a5a5','v','{postgres=X/postgres,authenticated=X/postgres}'),
    ('private.closure_erasure_program_digest_v5()','02a2926d1b6cff5a2c9f5b3497b61377','s','{postgres=X/postgres}'),
    ('private.closure_source_digest_v5()','f562ce85e73cf6c981d784fde7a785d0','s','{postgres=X/postgres}'),
    ('private.group_member_v5(private.group_conversations_v5,uuid)','f65ad5a98b153cef560b3a1530b6af50','s','{postgres=X/postgres}'),
    ('private.support_auth_v5(uuid)','66773994698c60b9fab919f2a9fda93a','v','{postgres=X/postgres}'),
    ('public.rpc_read_agreement_messages_page_v2(uuid,uuid,integer,timestamp with time zone,uuid)','c0ae8862bb86be54834227c10d2aef89','v','{postgres=X/postgres,authenticated=X/postgres}'),
    ('public.rpc_read_group_context_v5(uuid,uuid,uuid)','be76c434c8a1e796757872ffbffc0db4','s','{postgres=X/postgres,authenticated=X/postgres}'),
    ('public.rpc_read_group_messages_v5(uuid,uuid,text,text)','07d5b784bc6eebd714250f0ff630f77a','s','{postgres=X/postgres,authenticated=X/postgres}'),
    ('private.agreement_invalidation_surface_v1()','a362fcc11419703eb07f07b4f82eebdb','s','{postgres=X/postgres}')) pin(signature,body_md5,volatility,acl)
  left join pg_proc p on p.oid=to_regprocedure(pin.signature)
  where p.oid is null or md5(replace(p.prosrc,E'\r\n',E'\n')) is distinct from pin.body_md5
     or not p.prosecdef or p.provolatile::text is distinct from pin.volatility
     or p.proconfig is distinct from array['search_path=pg_catalog']::text[]
     or p.proacl::text is distinct from pin.acl or pg_get_userbyid(p.proowner)<>'postgres')),
  'COLUMN_BASELINE',(not exists (
  select 1 from (values ('public.agreement_messages','id','uuid','true'),
    ('public.agreement_messages','agreement_id','uuid','true'),
    ('public.agreement_messages','sender_account_id','uuid','true'),
    ('public.agreement_messages','body','text','true'),
    ('public.agreement_messages','created_at','timestamp with time zone','true'),
    ('public.agreement_messages','photo_asset_ids','uuid[]','true'),
    ('public.agreement_messages','voice_asset_id','uuid','false'),
    ('public.agreements','id','uuid','true'),
    ('public.agreements','need_id','uuid','true'),
    ('public.agreements','requester_account_id','uuid','true'),
    ('public.agreements','requester_profile_id','uuid','true'),
    ('public.agreements','worker_account_id','uuid','true'),
    ('public.agreements','worker_profile_id','uuid','true'),
    ('public.app_profiles','id','uuid','true'),
    ('public.app_profiles','account_id','uuid','true'),
    ('public.app_profiles','display_name','text','true'),
    ('public.needs','id','uuid','true'),
    ('public.needs','title','text','true'),
    ('private.group_conversations_v5','id','uuid','true'),
    ('private.group_conversations_v5','need_id','uuid','true'),
    ('private.group_conversations_v5','requester_account_id','uuid','true'),
    ('private.group_memberships_v5','group_id','uuid','true'),
    ('private.group_memberships_v5','account_id','uuid','true'),
    ('private.group_message_visibility_v5','message_id','uuid','true'),
    ('private.group_message_visibility_v5','account_id','uuid','true'),
    ('private.group_message_visibility_v5','read_at','timestamp with time zone','false'),
    ('private.group_messages_v5','id','uuid','true'),
    ('private.group_messages_v5','group_id','uuid','true'),
    ('private.group_messages_v5','sender_account_id','uuid','true'),
    ('private.group_messages_v5','body','text','true'),
    ('private.group_messages_v5','created_at','timestamp with time zone','true')) pin(relation,column_name,type_name,not_null)
  left join pg_attribute a on a.attrelid=to_regclass(pin.relation) and a.attname=pin.column_name and a.attnum>0 and not a.attisdropped
  where a.attrelid is null or format_type(a.atttypid,a.atttypmod) is distinct from pin.type_name
     or a.attnotnull::text is distinct from pin.not_null)),
  'RELATION_AUTHORITY',(not exists (
  select 1 from (values ('public.agreement_messages','postgres','{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=r/postgres}','true','false'),
    ('public.agreements','postgres','{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}','true','false'),
    ('public.app_profiles','postgres','{postgres=arwdDxtm/postgres,authenticated=arwDxtm/postgres,service_role=arwdDxtm/postgres}','true','false'),
    ('public.needs','postgres','{postgres=arwdDxtm/postgres,anon=Dxtm/postgres,authenticated=awDxtm/postgres,service_role=arwdDxtm/postgres}','true','false'),
    ('private.group_conversations_v5','postgres','{postgres=arwdDxtm/postgres}','true','false'),
    ('private.group_memberships_v5','postgres','{postgres=arwdDxtm/postgres}','true','false'),
    ('private.group_message_visibility_v5','postgres','{postgres=arwdDxtm/postgres}','true','false'),
    ('private.group_messages_v5','postgres','{postgres=arwdDxtm/postgres}','true','false')) pin(relation,owner,acl,rls,force_rls)
  left join pg_class c on c.oid=to_regclass(pin.relation)
  where c.oid is null or pg_get_userbyid(c.relowner) is distinct from pin.owner or c.relacl::text is distinct from pin.acl
    or c.relrowsecurity::text is distinct from pin.rls or c.relforcerowsecurity::text is distinct from pin.force_rls)),
  'INDEX_BASELINE',(not exists (
  select 1 from (values ('public.agreement_messages_agreement_idx','CREATE INDEX agreement_messages_agreement_idx ON public.agreement_messages USING btree (agreement_id, created_at)'),
    ('public.agreement_messages_pkey','CREATE UNIQUE INDEX agreement_messages_pkey ON public.agreement_messages USING btree (id)'),
    ('public.agreement_messages_sender_client_id_unique','CREATE UNIQUE INDEX agreement_messages_sender_client_id_unique ON public.agreement_messages USING btree (sender_account_id, client_message_id) WHERE (client_message_id IS NOT NULL)'),
    ('public.agreements_need_worker_participant_idx','CREATE INDEX agreements_need_worker_participant_idx ON public.agreements USING btree (need_id, worker_account_id) WHERE (status = ANY (ARRAY[''CONFIRMED''::text, ''COMPLETED''::text]))'),
    ('public.agreements_pkey','CREATE UNIQUE INDEX agreements_pkey ON public.agreements USING btree (id)'),
    ('public.agreements_requester_idx','CREATE INDEX agreements_requester_idx ON public.agreements USING btree (requester_account_id, created_at DESC)'),
    ('public.agreements_selected_response_id_key','CREATE UNIQUE INDEX agreements_selected_response_id_key ON public.agreements USING btree (selected_response_id)'),
    ('public.agreements_selection_id_key','CREATE UNIQUE INDEX agreements_selection_id_key ON public.agreements USING btree (selection_id)'),
    ('public.agreements_worker_idx','CREATE INDEX agreements_worker_idx ON public.agreements USING btree (worker_account_id, created_at DESC)'),
    ('private.group_conversations_v5_need_id_key','CREATE UNIQUE INDEX group_conversations_v5_need_id_key ON private.group_conversations_v5 USING btree (need_id)'),
    ('private.group_conversations_v5_pkey','CREATE UNIQUE INDEX group_conversations_v5_pkey ON private.group_conversations_v5 USING btree (id)'),
    ('private.group_memberships_account_v5','CREATE INDEX group_memberships_account_v5 ON private.group_memberships_v5 USING btree (account_id, group_id)'),
    ('private.group_memberships_active_v5','CREATE INDEX group_memberships_active_v5 ON private.group_memberships_v5 USING btree (group_id, account_id) WHERE (ended_sequence IS NULL)'),
    ('private.group_memberships_v5_pkey','CREATE UNIQUE INDEX group_memberships_v5_pkey ON private.group_memberships_v5 USING btree (agreement_id)'),
    ('private.group_message_visibility_v5_pkey','CREATE UNIQUE INDEX group_message_visibility_v5_pkey ON private.group_message_visibility_v5 USING btree (message_id, account_id)'),
    ('private.group_visibility_account_v5','CREATE INDEX group_visibility_account_v5 ON private.group_message_visibility_v5 USING btree (account_id, message_id)'),
    ('private.group_visibility_unread_v5','CREATE INDEX group_visibility_unread_v5 ON private.group_message_visibility_v5 USING btree (account_id, message_id) WHERE (read_at IS NULL)'),
    ('private.group_messages_v5_group_id_sequence_key','CREATE UNIQUE INDEX group_messages_v5_group_id_sequence_key ON private.group_messages_v5 USING btree (group_id, sequence)'),
    ('private.group_messages_v5_pkey','CREATE UNIQUE INDEX group_messages_v5_pkey ON private.group_messages_v5 USING btree (id)'),
    ('private.group_messages_v5_sender_account_id_client_request_id_key','CREATE UNIQUE INDEX group_messages_v5_sender_account_id_client_request_id_key ON private.group_messages_v5 USING btree (sender_account_id, client_request_id)')) pin(index_name,definition)
  left join pg_index i on i.indexrelid=to_regclass(pin.index_name)
  where i.indexrelid is null or not i.indisvalid or pg_get_indexdef(i.indexrelid) is distinct from pin.definition)),
  'STORED_CERTIFICATES',((select sha256 from private.closure_source_v5 where singleton) is not distinct from '3a785d423a564a5b39f55f916c536753ac73c4a76664ce0a09394ee68909cd23'
  and (select sha256 from private.closure_erasure_source_v5 where singleton) is not distinct from '3a785d423a564a5b39f55f916c536753ac73c4a76664ce0a09394ee68909cd23')) checks;

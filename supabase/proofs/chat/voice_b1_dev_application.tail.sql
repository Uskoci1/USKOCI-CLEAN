  -- END EXACT PROVED INSTALL FRAGMENTS. Their own preconditions proved the predecessor and their postconditions proved the closed, uncertified state.
  new_source:=private.closure_source_digest_v5();
  if new_source is null or new_source=old_source or new_source!~'^[0-9a-f]{64}$' then
    raise exception 'VOICE_B1_APPLICATION_NEW_SOURCE_INVALID' using errcode='55000';end if;
  if private.retention_ai_source_ready() is distinct from false or private.closure_erasure_binding_v5() is not null then
    raise exception 'VOICE_B1_APPLICATION_UNCERTIFIED_STATE_NOT_CLOSED' using errcode='55000';end if;
  update private.closure_source_v5 set sha256=new_source where singleton and sha256=old_source;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'VOICE_B1_APPLICATION_SOURCE_ROW_COUNT' using errcode='55000';end if;
  update private.closure_erasure_source_v5 set sha256=new_source where singleton and sha256=old_source;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'VOICE_B1_APPLICATION_ERASURE_ROW_COUNT' using errcode='55000';end if;
  execute replace(definition,old_source,new_source);

  -- Delta accounting 1/4: every old function is unchanged, except the readiness constant and the rewritten ones (their body only; owner, ACL, security, configuration and result stay).
  for prior in select * from voice_b1_application_functions loop
    select to_jsonb(p) into actual from pg_proc p where oid=prior.oid;
    if actual is null then raise exception 'VOICE_B1_APPLICATION_FUNCTION_REMOVED: %',prior.signature using errcode='55000';end if;
    if prior.oid='private.retention_ai_source_ready()'::regprocedure then
      if actual is distinct from jsonb_set(prior.metadata,'{prosrc}',to_jsonb(replace(prior.metadata->>'prosrc',old_source,new_source))) then
        raise exception 'VOICE_B1_APPLICATION_READINESS_DELTA' using errcode='55000';end if;
    elsif prior.oid=any(rewritten) then
      if actual-'prosrc' is distinct from prior.metadata-'prosrc' then
        raise exception 'VOICE_B1_APPLICATION_FUNCTION_AUTHORITY_DELTA: %',prior.signature using errcode='55000';end if;
      if actual->>'prosrc' is not distinct from prior.metadata->>'prosrc' then
        raise exception 'VOICE_B1_APPLICATION_REWRITE_MISSING: %',prior.signature using errcode='55000';end if;
    elsif actual is distinct from prior.metadata then
      raise exception 'VOICE_B1_APPLICATION_UNRELATED_FUNCTION_DELTA: %',prior.signature using errcode='55000';
    end if;
  end loop;
  -- Delta accounting 2/4: exactly the reviewed new functions exist, each with its exact body, language, volatility, security, result and ACL.
  select coalesce(array_agg(p.oid order by p.oid),'{}'::oid[]) into fresh from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in('public','private','rls_private') and not exists(select 1 from voice_b1_application_functions old where old.oid=p.oid);
  if fresh is distinct from (select array_agg(to_regprocedure(x)::oid order by to_regprocedure(x)::oid) from unnest(array[
    'private.agreement_voice_key_v1(uuid)','private.agreement_voice_context_v1(uuid,uuid,integer,boolean)',
    'private.agreement_voice_document_v1(private.agreement_voice_uploads_v1)','private.agreement_voice_transfer_v1(private.agreement_voice_uploads_v1)',
    'private.agreement_voice_message_guard_v1()','private.agreement_voice_link_guard_v1()','private.agreement_voice_asset_guard_v1()','private.agreement_voice_storage_guard_v1()',
    'public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)','public.rpc_agreement_voice_read_service_v1(uuid,uuid,uuid,uuid,uuid)',
    'public.rpc_agreement_voice_upload_service_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)',
    'public.rpc_read_agreement_messages_page_v2(uuid,uuid,integer,timestamptz,uuid)','public.rpc_read_agreement_message_window_v2(uuid,uuid,uuid,integer,integer)',
    'private.agreement_messages_v1_view(jsonb,text)','private.agreement_voice_surface_v1()']::text[]) x) then
    raise exception 'VOICE_B1_APPLICATION_FUNCTION_ROSTER_DELTA' using errcode='55000';end if;
  for pin in select * from (values
    ('private.agreement_voice_key_v1(uuid)','7fc22c4fa37e737d09917f03c497b84c','sql','i',false,true,'bigint','{postgres=X/postgres}'),
    ('private.agreement_voice_context_v1(uuid,uuid,integer,boolean)','db79bbcb1557e698f96e1973f5f1114d','plpgsql','v',true,false,'public.agreements','{postgres=X/postgres}'),
    ('private.agreement_voice_document_v1(private.agreement_voice_uploads_v1)','e3d28dc212ec03b7686809307125a2b0','sql','s',false,false,'jsonb','{postgres=X/postgres}'),
    ('private.agreement_voice_transfer_v1(private.agreement_voice_uploads_v1)','90adbecaf2f168e5aa2813053ef4ee71','sql','s',false,false,'jsonb','{postgres=X/postgres}'),
    ('private.agreement_voice_message_guard_v1()','f7945764ecc4176f519c6adc051036a4','plpgsql','v',true,false,'trigger','{postgres=X/postgres}'),
    ('private.agreement_voice_link_guard_v1()','70b7d13295f1a9407106d32a7c08fb15','plpgsql','v',true,false,'trigger','{postgres=X/postgres}'),
    ('private.agreement_voice_asset_guard_v1()','7dac0b4c2cad1da11dcd30e1ea35509a','plpgsql','v',true,false,'trigger','{postgres=X/postgres}'),
    ('private.agreement_voice_storage_guard_v1()','f3baf1ab27b347216cdede156ca3f42a','plpgsql','v',true,false,'trigger','{postgres=X/postgres}'),
    ('public.rpc_send_agreement_voice_message_v1(uuid,uuid,integer,text,uuid)','2cb1a99fd913115235a5762bf068f52e','plpgsql','v',true,false,'jsonb','{postgres=X/postgres,authenticated=X/postgres}'),
    ('public.rpc_agreement_voice_read_service_v1(uuid,uuid,uuid,uuid,uuid)','5d82c4a9683513a43f4edc9d8bd08e54','plpgsql','v',true,false,'jsonb','{postgres=X/postgres,service_role=X/postgres}'),
    ('public.rpc_agreement_voice_upload_service_v1(uuid,uuid,text,uuid,integer,uuid,jsonb)','aebb8132f2500415b2daded197e57975','plpgsql','v',true,false,'jsonb','{postgres=X/postgres,service_role=X/postgres}'),
    ('public.rpc_read_agreement_messages_page_v2(uuid,uuid,integer,timestamptz,uuid)','c0ae8862bb86be54834227c10d2aef89','plpgsql','v',true,false,'jsonb','{postgres=X/postgres,authenticated=X/postgres}'),
    ('public.rpc_read_agreement_message_window_v2(uuid,uuid,uuid,integer,integer)','e16aeb18144c44a8baa4aebaf420944c','plpgsql','v',true,false,'jsonb','{postgres=X/postgres,authenticated=X/postgres}'),
    ('private.agreement_messages_v1_view(jsonb,text)','4a2065e1b0c27894f4e2dcc352d7fb59','sql','i',false,false,'jsonb','{postgres=X/postgres}'),
    ('private.agreement_voice_surface_v1()','b697d12234198c95815257d7ce73f147','sql','s',true,false,'text','{postgres=X/postgres}')
  ) p(signature,body_md5,language_name,volatility,definer,strict_function,result_type,acl) loop
    if not exists(select 1 from pg_proc p where p.oid=to_regprocedure(pin.signature)
      and md5(replace(prosrc,E'\r\n',E'\n'))=pin.body_md5 and prosecdef=pin.definer and proisstrict=pin.strict_function
      and proconfig=array['search_path=pg_catalog'] and proowner='postgres'::regrole
      and prolang=(select oid from pg_language where lanname=pin.language_name)
      and provolatile::text=pin.volatility and prokind='f' and prorettype=to_regtype(pin.result_type)
      and proacl::text=pin.acl and not proretset and not proleakproof and proparallel='u'
      and probin is null and prosqlbody is null and protrftypes is null and proallargtypes is null and proargmodes is null) then
      raise exception 'VOICE_B1_APPLICATION_NEW_FUNCTION_DELTA: %',pin.signature using errcode='55000';end if;
  end loop;
  -- Delta accounting 3/4: every table, column, constraint, trigger, policy, index and bucket is unchanged except the reviewed additions and the two replaced constraints.
  execute surface_query into after_surface;
  if after_surface is distinct from before_surface then
    -- Name what differs (the key, how many entries each way and one example of each), so a refused application explains itself.
    select string_agg(k||': +'||(select count(*) from jsonb_array_elements(coalesce(after_surface->k,'[]'::jsonb)) e where not(coalesce(before_surface->k,'[]'::jsonb) @> jsonb_build_array(e)))::text
      ||' -'||(select count(*) from jsonb_array_elements(coalesce(before_surface->k,'[]'::jsonb)) e where not(coalesce(after_surface->k,'[]'::jsonb) @> jsonb_build_array(e)))::text
      ||' added '||coalesce((select left(e::text,240) from jsonb_array_elements(coalesce(after_surface->k,'[]'::jsonb)) e where not(coalesce(before_surface->k,'[]'::jsonb) @> jsonb_build_array(e)) limit 1),'-')
      ||' removed '||coalesce((select left(e::text,240) from jsonb_array_elements(coalesce(before_surface->k,'[]'::jsonb)) e where not(coalesce(after_surface->k,'[]'::jsonb) @> jsonb_build_array(e)) limit 1),'-'),' | ')
      into diff_keys from jsonb_object_keys(before_surface) k where before_surface->k is distinct from after_surface->k;
    raise exception 'VOICE_B1_APPLICATION_UNRELATED_CATALOG_DELTA: %',diff_keys using errcode='55000';
  end if;
  if (select jsonb_agg(to_jsonb(b) order by b.id) from storage.buckets b where b.id is distinct from 'agreement-voice') is distinct from before_buckets
     or not exists(select 1 from storage.buckets where id='agreement-voice' and not public and file_size_limit=4194304 and allowed_mime_types=array['audio/mp4'])
     or (select jsonb_agg(to_jsonb(p) order by policyname) from pg_policies p where schemaname='storage' and tablename='objects' and policyname is distinct from 'agreement_voice_no_client_v1')
       is distinct from before_storage_policies
     or not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='agreement_voice_no_client_v1'
       and permissive='RESTRICTIVE' and roles=array['authenticated']::name[] and cmd='ALL' and qual like '%agreement-voice%' and with_check like '%agreement-voice%') then
    raise exception 'VOICE_B1_APPLICATION_STORAGE_DELTA' using errcode='55000';end if;
  if not exists(select 1 from pg_class where oid='private.agreement_voice_uploads_v1'::regclass and relowner='postgres'::regrole and relkind='r' and relpersistence='p'
      and not relispartition and relrowsecurity and relforcerowsecurity and relreplident='d' and reloptions is null and relacl=acldefault('r','postgres'::regrole))
    or exists(select 1 from pg_policies where schemaname='private' and tablename='agreement_voice_uploads_v1')
    or (select count(*) from pg_attribute where attrelid='public.agreement_messages'::regclass and attname='voice_asset_id' and not attisdropped and atttypid='uuid'::regtype and not attnotnull)<>1 then
    raise exception 'VOICE_B1_APPLICATION_NEW_TABLE_DELTA' using errcode='55000';end if;
  for pin in select * from (values
    ('public.agreement_messages','agreement_voice_message_guard_v1','private.agreement_voice_message_guard_v1()',23,false),
    ('public.agreement_messages','agreement_voice_link_guard_v1','private.agreement_voice_link_guard_v1()',5,true),
    ('private.agreement_voice_uploads_v1','agreement_voice_asset_guard_v1','private.agreement_voice_asset_guard_v1()',27,false),
    ('storage.objects','agreement_voice_storage_guard_v1','private.agreement_voice_storage_guard_v1()',27,false)
  ) p(relation,trigger_name,signature,event_type,deferred) loop
    if not exists(select 1 from pg_trigger t where tgrelid=pin.relation::regclass and tgname=pin.trigger_name
      and tgfoid=to_regprocedure(pin.signature) and tgtype=pin.event_type and tgenabled='O' and not tgisinternal
      and tgnargs=0 and octet_length(tgargs)=0 and tgqual is null and (tgconstraint<>0)=pin.deferred
      and tgdeferrable=pin.deferred and tginitdeferred=pin.deferred and tgoldtable is null and tgnewtable is null and tgparentid=0 and tgattr::text='') then
      raise exception 'VOICE_B1_APPLICATION_NEW_TRIGGER_DELTA: %',pin.trigger_name using errcode='55000';end if;
  end loop;
  -- Delta accounting 4/4: the retention catalog changed only by the new relation, publications and migration history are untouched, the certificate is bound in its three places and nothing else.
  if (select jsonb_agg(to_jsonb(c) order by data_class) from private.closure_dataset_catalog_v5 c) is distinct from expected_datasets then
    raise exception 'VOICE_B1_APPLICATION_CATALOG_DELTA' using errcode='55000';end if;
  if (select to_jsonb(c) from private.closure_source_v5 c where singleton) is distinct from jsonb_set(source_row,'{sha256}',to_jsonb(new_source))
    or (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) is distinct from jsonb_set(erasure_row,'{sha256}',to_jsonb(new_source))
    or pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) is distinct from replace(definition,old_source,new_source)
    or private.closure_source_digest_v5() is distinct from new_source
    or private.retention_ai_source_ready() is distinct from true
    or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from new_source then
    raise exception 'VOICE_B1_APPLICATION_CERTIFIED_POSTCONDITION' using errcode='55000';end if;
  if exists(select 1 from private.closure_executions_v5 where state='EXECUTING')
    or has_function_privilege('anon','private.retention_ai_source_ready()','EXECUTE')
    or has_function_privilege('authenticated','private.retention_ai_source_ready()','EXECUTE')
    or has_function_privilege('anon','private.agreement_voice_surface_v1()','EXECUTE')
    or has_function_privilege('authenticated','private.agreement_voice_surface_v1()','EXECUTE')
    or has_function_privilege('service_role','private.agreement_voice_surface_v1()','EXECUTE') then
    raise exception 'VOICE_B1_APPLICATION_FINAL_AUTHORITY_OR_STATE_DRIFT' using errcode='55000';end if;
end
$voice_b1_application$;

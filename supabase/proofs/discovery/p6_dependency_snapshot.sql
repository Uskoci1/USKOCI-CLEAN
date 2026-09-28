-- Read-only catalog projection. No user rows, provider calls or schema mutation.
with functions as (
 select sig, p.* from unnest(array[
 'auth.uid()', 'public.covered_slots(public.needs)', 'public.rpc_storage_account_open()',
 'rls_private.need_participant_can_read(uuid)', 'private.viewer_same_world(uuid)',
 'private.accounts_same_world(uuid,uuid)', 'private.account_visibility_world(uuid)',
 'private.account_lineage(uuid)', 'private.closure_assert_open(uuid,uuid)',
 'private.closure_account_key(uuid)', 'private.closure_account_restricted(uuid)'
 ]) sig left join pg_proc p on p.oid=to_regprocedure(sig)
), relations as (
 select label,c.* from unnest(array['public.needs','public.need_geography','public.need_requirement_details',
 'public.need_selections','public.agreements','private.account_closure_requests','private.account_lineage_v5']) label
 left join pg_class c on c.oid=to_regclass(label)
)
select jsonb_build_object('version','P6_DEPENDENCY_V1','functions',(
 select jsonb_object_agg(sig,jsonb_build_object('present',oid is not null,'bodyMd5',md5(replace(prosrc,E'\r\n',E'\n')),
 'volatile',provolatile,'definer',prosecdef,'strict',proisstrict,'settings',proconfig,'owner',pg_get_userbyid(proowner),
 'acl',(select jsonb_agg(jsonb_build_array(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable) order by a.grantee::regrole::text,a.privilege_type)
 from aclexplode(coalesce(proacl,acldefault('f',proowner))) a))) from functions),
 'relations',(select jsonb_object_agg(label,jsonb_build_object('present',oid is not null,'rls',relrowsecurity,'forceRls',relforcerowsecurity,
 'columnsMd5',(select md5(jsonb_agg(jsonb_build_array(a.attname,t.typname,n.nspname,a.atttypmod,a.attnotnull,a.attacl::text,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)::text)
 from pg_attribute a join pg_type t on t.oid=a.atttypid join pg_namespace n on n.oid=t.typnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=r.oid and a.attnum>0 and not a.attisdropped),
 'policiesMd5',(select md5(coalesce(jsonb_agg(jsonb_build_object('name',polname,'permissive',polpermissive,'cmd',polcmd,
 'roles',(select jsonb_agg(case when x=0 then 'PUBLIC' else pg_get_userbyid(x) end order by x::regrole::text) from unnest(polroles) x),
 'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) order by polname),'[]'::jsonb)::text) from pg_policy where polrelid=r.oid),
 'indexesMd5',(select md5(coalesce(jsonb_agg(pg_get_indexdef(indexrelid) order by pg_get_indexdef(indexrelid)),'[]'::jsonb)::text) from pg_index where indrelid=r.oid),
 'acl',(select jsonb_agg(jsonb_build_array(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,a.privilege_type,a.is_grantable) order by a.grantee::regrole::text,a.privilege_type)
 from aclexplode(coalesce(relacl,acldefault('r',relowner))) a))) from relations r));

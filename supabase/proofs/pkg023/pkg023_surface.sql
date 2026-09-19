-- The whole domain surface as sorted lines, one object per line, so that two snapshots can be
-- compared with diff: every function (body, security, configuration, grants), table, column,
-- constraint, trigger, policy and index of the public, private and rls_private schemas.
-- Read-only. Used by the PKG-023 workflow to prove what a candidate changed and what it did not.
select line from (
  select 'function:' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || '):'
      || md5(replace(p.prosrc, E'\r\n', E'\n')) || ':definer=' || p.prosecdef || ':volatility=' || p.provolatile
      || ':config=' || coalesce(array_to_string(p.proconfig, ','), '') || ':acl=' || coalesce(p.proacl::text, 'default') as line
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public','private','rls_private')
  union all
  select 'table:' || n.nspname || '.' || c.relname || ':rls=' || c.relrowsecurity || ':force=' || c.relforcerowsecurity
      || ':acl=' || coalesce(c.relacl::text, 'default')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public','private','rls_private') and c.relkind in ('r','p')
  union all
  select 'column:' || n.nspname || '.' || c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod)
      || ':notnull=' || a.attnotnull || ':generated=' || a.attgenerated
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public','private','rls_private') and c.relkind in ('r','p') and a.attnum > 0 and not a.attisdropped
  union all
  select 'constraint:' || n.nspname || '.' || c.relname || '.' || x.conname || ':' || md5(pg_get_constraintdef(x.oid))
    from pg_constraint x join pg_class c on c.oid = x.conrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public','private','rls_private')
  union all
  select 'trigger:' || n.nspname || '.' || c.relname || '.' || t.tgname || ':' || md5(pg_get_triggerdef(t.oid)) || ':enabled=' || t.tgenabled
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public','private','rls_private') and not t.tgisinternal
  union all
  select 'policy:' || schemaname || '.' || tablename || '.' || policyname || ':' || md5(coalesce(cmd, '') || '|' || coalesce(array_to_string(roles, ','), '')
      || '|' || coalesce(qual, '') || '|' || coalesce(with_check, '') || '|' || permissive)
    from pg_policies where schemaname in ('public','private','rls_private')
  union all
  select 'index:' || schemaname || '.' || indexname || ':' || md5(indexdef)
    from pg_indexes where schemaname in ('public','private','rls_private')
) s
order by line collate "C";

-- PKG-051a candidate. Owner request 2026-09-24: set up the platform payment settings, every price 0 RSD at the start,
-- a later price added as a NEW version. Server only: a versioned platform price list for Povezivanje and HITNO.
-- Contract: docs/implementation/v5-ai-first/pkg051/PKG051_PLATFORM_PRICE_LIST.md
--
-- What is missing today. The server has no place for a platform price. Povezivanje is recorded at every selection in
-- the free ledger (private.connection_policy_versions: one row REQUESTER_SELECTION_V1/1, CHECK-locked to
-- PROMOTIONAL_FREE, HEADCOUNT and 0 RSD), and HITNO carries only a false fee flag in its config. Neither can hold an
-- amount, a payer or the moment a price starts, and a later price would have to overwrite something.
--
-- What this adds. Nothing existing reads it and the app changes nothing.
--   * Four data rows under NEW keys in private.marketplace_config: version 1 of each product (CONNECTION = Povezivanje,
--     URGENT_BOOST = HITNO), both 0 RSD; a head naming the latest version of each; the payments switch, off.
--   * Five private functions, executable only by the database owner (the SQL editor), never through the API:
--     platform_payments_enabled, platform_price_canonical, platform_price_versions (integrity only),
--     platform_price_list_at (current and next price at a moment) and platform_price_add_version (the only writer).
--   * Every version holds amount (minor units: para), currency, payer role, unit basis, effective time, the time it
--     was recorded, its predecessor's sha256 and its own. A later price is a new version; no version is edited. An
--     accidental edit that breaks the chain makes every read and write refuse until repaired. This is tamper-evident,
--     not tamper-proof: the database owner can still re-chain consistently from any version on, backdated times
--     included, or cut its newest versions. Only an external record of each returned sha256 makes that visible.
--   * Kill switch, fail closed: a price above 0 is refused while payments are off, and payments count as on only when
--     the switch row is exactly the enabled V1 object AND the charge ledger private.platform_charges exists, which no
--     package has created. A zero version can always be appended. Enabling payments is not part of this package.
--
-- The free Povezivanje path stays byte-identical: no DDL on any existing object; rpc_select_response, the two ledger
-- trigger functions, the free policy row, its locks and triggers are pinned before, and the whole domain surface and
-- every pre-existing marketplace_config row are compared after.
--
-- Function-only plus four data rows: no table, column, constraint, trigger, table ACL or reviewed erasure function
-- changes, so the certified closure digest must NOT move. The candidate asserts that before and after, and refuses to
-- run twice. No API-visible object changes, so PostgREST needs no schema reload.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table pkg051_state(
  certified text not null,
  surface_md5 text not null,
  surface_lines bigint not null,
  config_md5 text not null
) on commit drop;

-- The whole domain surface (supabase/proofs/pkg023/pkg023_surface.sql), read before and after from the same text.
create temporary view pkg051_surface as
select line from (
  select 'function:' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || '):'
      || md5(replace(p.prosrc, E'\r\n', E'\n')) || ':definer=' || p.prosecdef::text || ':volatility=' || p.provolatile::text
      || ':config=' || coalesce(array_to_string(p.proconfig, ','), '') || ':acl=' || coalesce(p.proacl::text, 'default') as line
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public','private','rls_private')
  union all
  select 'table:' || n.nspname || '.' || c.relname || ':rls=' || c.relrowsecurity::text || ':force=' || c.relforcerowsecurity::text
      || ':acl=' || coalesce(c.relacl::text, 'default')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public','private','rls_private') and c.relkind in ('r','p')
  union all
  select 'column:' || n.nspname || '.' || c.relname || '.' || a.attname || ':' || format_type(a.atttypid, a.atttypmod)
      || ':notnull=' || a.attnotnull::text || ':generated=' || a.attgenerated::text
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public','private','rls_private') and c.relkind in ('r','p') and a.attnum > 0 and not a.attisdropped
  union all
  select 'constraint:' || n.nspname || '.' || c.relname || '.' || x.conname || ':' || md5(pg_get_constraintdef(x.oid))
    from pg_constraint x join pg_class c on c.oid = x.conrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public','private','rls_private')
  union all
  select 'trigger:' || n.nspname || '.' || c.relname || '.' || t.tgname || ':' || md5(pg_get_triggerdef(t.oid)) || ':enabled=' || t.tgenabled::text
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('public','private','rls_private') and not t.tgisinternal
  union all
  select 'policy:' || schemaname || '.' || tablename || '.' || policyname || ':' || md5(coalesce(cmd, '') || '|' || coalesce(array_to_string(roles, ','), '')
      || '|' || coalesce(qual, '') || '|' || coalesce(with_check, '') || '|' || permissive)
    from pg_policies where schemaname in ('public','private','rls_private')
  union all
  select 'index:' || schemaname || '.' || indexname || ':' || md5(indexdef)
    from pg_indexes where schemaname in ('public','private','rls_private')
) s;

do $pre$
declare v_certified text;
begin
  -- 1. Not already applied, in any form.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname in ('public', 'private')
                and (starts_with(p.proname::text, 'platform_price') or starts_with(p.proname::text, 'platform_payment'))) then
    raise exception 'PKG051_ALREADY_APPLIED' using errcode = '55000';
  end if;
  -- 2. Nobody else holds the keys this package writes.
  if exists (select 1 from private.marketplace_config c
              where c.key = 'platform_payments' or starts_with(c.key, 'platform_price')) then
    raise exception 'PKG051_CONFIG_KEY_CONFLICT' using errcode = '55000';
  end if;
  -- 3. The free Povezivanje path exactly as DEV runs it: the pkg035a pin and the two P0D-03 ledger trigger functions.
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
       where oid = to_regprocedure('public.rpc_select_response(uuid,integer,uuid,integer,text,text)'))
       is distinct from '7cbb83905c1c983be4a7d92ff505411e' then
    raise exception 'PKG051_PREDECESSOR_DRIFT: rpc_select_response' using errcode = '55000';
  end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
       where oid = to_regprocedure('private.reject_connection_ledger_mutation()'))
       is distinct from '577e554a42da691160731eb097a726a6' then
    raise exception 'PKG051_PREDECESSOR_DRIFT: reject_connection_ledger_mutation' using errcode = '55000';
  end if;
  if (select md5(replace(prosrc, E'\r\n', E'\n')) from pg_proc
       where oid = to_regprocedure('private.require_connection_activation_for_new_agreement()'))
       is distinct from '7eda7b4af744abe5175e612f475a11d9' then
    raise exception 'PKG051_PREDECESSOR_DRIFT: require_connection_activation_for_new_agreement' using errcode = '55000';
  end if;
  -- 4. The one free policy row, its five lock CHECKs and the three triggers that keep the ledger free and immutable.
  if (select count(*) from private.connection_policy_versions) <> 1
     or not exists (select 1 from private.connection_policy_versions v
                     where v.policy_key = 'REQUESTER_SELECTION_V1' and v.version = 1 and v.beneficiary_role = 'REQUESTER'
                       and v.activation_reason = 'SELECTION' and v.charge_mode = 'PROMOTIONAL_FREE'
                       and v.unit_basis = 'HEADCOUNT' and v.platform_cost_rsd = 0)
     or (select count(*) from pg_constraint x
          where x.conrelid = 'private.connection_policy_versions'::regclass and x.contype = 'c' and x.convalidated
            and (x.conname::text, md5(pg_get_constraintdef(x.oid))) in (
              ('connection_policy_versions_requester_only', '2e213bf4a19b8957289558217531093c'),
              ('connection_policy_versions_selection_only', '295d99da074e6fa9444b73dc4f44f9a4'),
              ('connection_policy_versions_promotional_free_only', 'd56684273f2f0454a480ae3e8118553e'),
              ('connection_policy_versions_headcount_only', '728975eebbd437598e6db62f09ac7af2'),
              ('connection_policy_versions_zero_cost_only', '424b76c107d5a823d2d4ef24b93aefe2'))) <> 5
     or (select count(*) from pg_trigger t
          where not t.tgisinternal and t.tgenabled = 'O'
            and (t.tgrelid, t.tgname::text, md5(pg_get_triggerdef(t.oid))) in (
              ('private.connection_policy_versions'::regclass::oid, 'connection_policy_versions_immutable_trg', '602e565e16f55ef99f28a64d5d3623be'),
              ('private.connection_activations'::regclass::oid, 'connection_activations_immutable_trg', '0ffc4b6364265b9f8b4993ea90a8ec09'),
              ('public.agreements'::regclass::oid, 'agreements_require_connection_activation_trg', '121d695fca8c64886ba994f5fc3982d0'))) <> 3 then
    raise exception 'PKG051_FREE_POLICY_DRIFT' using errcode = '55000';
  end if;
  -- 5. HITNO charges no fee today; the URGENT_BOOST seed records exactly that.
  if (select c.value -> 'chargesFee' from private.marketplace_config c where c.key = 'urgent_activation_policy')
       is distinct from 'false'::jsonb then
    raise exception 'PKG051_URGENT_POLICY_DRIFT' using errcode = '55000';
  end if;
  -- 6. The config table is exactly the three-column, triggerless, ruleless table the inserts below assume.
  if (select string_agg(a.attname::text || ':' || format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
        from pg_attribute a
       where a.attrelid = 'private.marketplace_config'::regclass and a.attnum > 0 and not a.attisdropped)
       is distinct from 'key:text:true,value:jsonb:true,updated_at:timestamp with time zone:true'
     or (select count(*) from pg_constraint x where x.conrelid = 'private.marketplace_config'::regclass and x.contype <> 'n') <> 1
     or not exists (select 1 from pg_constraint x
                     where x.conrelid = 'private.marketplace_config'::regclass and x.contype = 'p'
                       and md5(pg_get_constraintdef(x.oid)) = '729d3ed6c85722f863da384d2313331e')
     or exists (select 1 from pg_trigger t where t.tgrelid = 'private.marketplace_config'::regclass)
     or exists (select 1 from pg_rewrite r where r.ev_class = 'private.marketplace_config'::regclass)
     or (select c.relrowsecurity::text || ':' || c.relforcerowsecurity::text || ':' || coalesce(c.relacl::text, 'default')
           from pg_class c where c.oid = 'private.marketplace_config'::regclass) is distinct from 'true:false:default' then
    raise exception 'PKG051_CONFIG_SHAPE_DRIFT' using errcode = '55000';
  end if;
  -- 7. The certificate is consistent and ready before anything is written.
  v_certified := private.closure_source_digest_v5();
  if v_certified is distinct from (select sha256 from private.closure_source_v5 where singleton)
     or v_certified is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
     or not private.retention_ai_source_ready() then
    raise exception 'PKG051_CERTIFICATE_NOT_READY' using errcode = '55000';
  end if;
  -- 8. The seed is dated 2026-09-24 00:00 Belgrade; a server clock before it is wrong.
  if clock_timestamp() < timestamptz '2026-09-23 22:00:00+00' then
    raise exception 'PKG051_CLOCK_BEFORE_SEED' using errcode = '55000';
  end if;
  insert into pkg051_state(certified, surface_md5, surface_lines, config_md5)
  select v_certified,
         (select md5(string_agg(s.line, E'\n' order by s.line collate "C")) from pkg051_surface s),
         (select count(*) from pkg051_surface s),
         (select md5(string_agg(c.key || '=' || c.value::text || '@' || c.updated_at::text, E'\n' order by c.key collate "C"))
            from private.marketplace_config c);
end
$pre$;

create function private.platform_payments_enabled()
returns boolean
language sql
stable
set search_path = pg_catalog
as $function$
  -- PKG-051: on only when the switch row is exactly the enabled V1 object AND the charge ledger a payment package
  -- creates exists. A missing, malformed or differently shaped row, or no ledger, means off.
  select coalesce((select c.value = '{"schema": "PLATFORM_PAYMENTS_SWITCH_V1", "enabled": true}'::jsonb
                     from private.marketplace_config c
                    where c.key = 'platform_payments'), false)
     and pg_catalog.to_regclass('private.platform_charges') is not null
$function$;

create function private.platform_price_canonical(
  p_product text, p_version integer, p_amount_minor bigint, p_currency text, p_payer_role text, p_unit_basis text,
  p_effective_at timestamptz, p_recorded_at timestamptz, p_previous_sha256 text)
returns jsonb
language sql
stable
set search_path = pg_catalog
as $function$
  -- PKG-051: the one canonical form of a price version. Times are UTC text with microseconds and a Z, whatever the
  -- session time zone. The sha256 covers a fixed '|'-joined string, so it can be recomputed outside the database.
  select pg_catalog.jsonb_build_object(
           'schema', 'PLATFORM_PRICE_V1',
           'product', p_product,
           'version', p_version,
           'amountMinor', p_amount_minor,
           'currency', p_currency,
           'payerRole', p_payer_role,
           'unitBasis', p_unit_basis,
           'effectiveAt', t.effective_at,
           'recordedAt', t.recorded_at,
           'previousSha256', p_previous_sha256,
           'sha256', pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
             'PLATFORM_PRICE_V1|' || p_product || '|' || p_version::text || '|' || p_amount_minor::text || '|'
             || p_currency || '|' || p_payer_role || '|' || p_unit_basis || '|' || t.effective_at || '|'
             || t.recorded_at || '|' || coalesce(p_previous_sha256, ''), 'UTF8')), 'hex'))
    from (select pg_catalog.to_char(p_effective_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as effective_at,
                 pg_catalog.to_char(p_recorded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as recorded_at) as t
$function$;

create function private.platform_price_versions()
returns jsonb
language plpgsql
stable
set search_path = pg_catalog
as $function$
declare
  v_row record; v_match text[]; v_value jsonb; v_detail text; v_product text; v_list jsonb; v_entry jsonb;
  v_prior jsonb; v_index integer; v_head jsonb; v_heads jsonb := '{}'::jsonb;
  v_versions jsonb := '{"CONNECTION": [], "URGENT_BOOST": []}'::jsonb;
begin
  -- PKG-051: integrity only, no price policy. Every failure is PRICE_LIST_INTEGRITY_FAILED with a reason in DETAIL.
  -- 1. Each stored version: a known key, a well-formed value, and exactly its own canonical form (self-hash included).
  for v_row in
    select c.key, c.value from private.marketplace_config c
     where pg_catalog.starts_with(c.key, 'platform_price') and c.key <> 'platform_price_head'
     order by c.key collate "C"
  loop
    v_match := pg_catalog.regexp_match(v_row.key, '^platform_price:(CONNECTION|URGENT_BOOST):([0-9]{6})$');
    if v_match is null then
      raise exception 'PRICE_LIST_INTEGRITY_FAILED' using errcode = '55000', detail = 'KEY';
    end if;
    v_value := v_row.value;
    v_detail := 'CONTENT:' || v_match[1] || ':' || (v_match[2])::integer::text;
    begin
      if pg_catalog.jsonb_typeof(v_value) is distinct from 'object'
         or pg_catalog.jsonb_typeof(v_value->'version') is distinct from 'number'
         or not coalesce((v_value->>'version') ~ '^[1-9][0-9]{0,5}$', false)
         or pg_catalog.jsonb_typeof(v_value->'amountMinor') is distinct from 'number'
         or not coalesce((v_value->>'amountMinor') ~ '^(0|[1-9][0-9]{0,7})$', false)
         or pg_catalog.jsonb_typeof(v_value->'effectiveAt') is distinct from 'string'
         or not coalesce((v_value->>'effectiveAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$', false)
         or pg_catalog.jsonb_typeof(v_value->'recordedAt') is distinct from 'string'
         or not coalesce((v_value->>'recordedAt') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{6}Z$', false)
         or not coalesce(pg_catalog.jsonb_typeof(v_value->'previousSha256') in ('null', 'string'), false)
         or not coalesce((v_value->>'previousSha256') ~ '^[0-9a-f]{64}$', true)
         or (v_value->>'product') is distinct from v_match[1]
         or (v_value->>'version')::integer <> (v_match[2])::integer
         or (v_value->>'amountMinor')::bigint > 10000000
         or (v_value->>'currency') is distinct from 'RSD'
         or not coalesce((v_value->>'payerRole') in ('REQUESTER', 'WORKER'), false)
         or not coalesce((v_value->>'unitBasis') in ('HEADCOUNT', 'FLAT'), false)
         or v_value::text is distinct from private.platform_price_canonical(
              v_value->>'product', (v_value->>'version')::integer, (v_value->>'amountMinor')::bigint,
              v_value->>'currency', v_value->>'payerRole', v_value->>'unitBasis',
              (v_value->>'effectiveAt')::timestamptz, (v_value->>'recordedAt')::timestamptz,
              v_value->>'previousSha256')::text then
        raise exception 'PRICE_LIST_INTEGRITY_FAILED' using errcode = '55000', detail = v_detail;
      end if;
    exception when others then
      -- A malformed value (a bad date, a cast that fails) is the same finding as any other content mismatch.
      raise exception 'PRICE_LIST_INTEGRITY_FAILED' using errcode = '55000', detail = v_detail;
    end;
    v_versions := pg_catalog.jsonb_set(v_versions, array[v_match[1]],
                    (v_versions->v_match[1]) || pg_catalog.jsonb_build_array(v_value));
  end loop;
  -- 2. Each product: versions 1..N without a gap, each naming its predecessor's hash, never effective before it
  --    was recorded, and recorded in order.
  foreach v_product in array array['CONNECTION', 'URGENT_BOOST'] loop
    v_list := v_versions->v_product;
    if pg_catalog.jsonb_array_length(v_list) = 0 then
      raise exception 'PRICE_LIST_INTEGRITY_FAILED' using errcode = '55000', detail = 'PRODUCT_MISSING:' || v_product;
    end if;
    v_prior := null;
    for v_index in 0 .. pg_catalog.jsonb_array_length(v_list) - 1 loop
      v_entry := v_list->v_index;
      if (v_entry->>'version')::integer <> v_index + 1 then
        raise exception 'PRICE_LIST_INTEGRITY_FAILED' using errcode = '55000',
          detail = 'GAP:' || v_product || ':' || (v_entry->>'version');
      end if;
      if (v_entry->'previousSha256') is distinct from coalesce(v_prior->'sha256', 'null'::jsonb) then
        raise exception 'PRICE_LIST_INTEGRITY_FAILED' using errcode = '55000',
          detail = 'CHAIN:' || v_product || ':' || (v_entry->>'version');
      end if;
      if (v_entry->>'effectiveAt')::timestamptz < (v_entry->>'recordedAt')::timestamptz
         or (v_entry->>'recordedAt')::timestamptz < coalesce((v_prior->>'recordedAt')::timestamptz, '-infinity') then
        raise exception 'PRICE_LIST_INTEGRITY_FAILED' using errcode = '55000',
          detail = 'TIME:' || v_product || ':' || (v_entry->>'version');
      end if;
      v_prior := v_entry;
    end loop;
    v_heads := v_heads || pg_catalog.jsonb_build_object(v_product, pg_catalog.jsonb_build_object(
      'version', pg_catalog.jsonb_array_length(v_list), 'sha256', v_prior->'sha256'));
  end loop;
  -- 3. The head names exactly the latest version and hash of each product.
  select c.value into v_head from private.marketplace_config c where c.key = 'platform_price_head';
  if v_head is null then
    raise exception 'PRICE_LIST_INTEGRITY_FAILED' using errcode = '55000', detail = 'HEAD:MISSING';
  end if;
  if v_head::text is distinct from
     pg_catalog.jsonb_build_object('schema', 'PLATFORM_PRICE_HEAD_V1', 'heads', v_heads)::text then
    raise exception 'PRICE_LIST_INTEGRITY_FAILED' using errcode = '55000',
      detail = 'HEAD:' || coalesce((select p.product from unnest(array['CONNECTION', 'URGENT_BOOST']) with ordinality as p(product, n)
                                     where (v_head->'heads'->p.product) is distinct from (v_heads->p.product)
                                     order by p.n limit 1), 'SHAPE');
  end if;
  return pg_catalog.jsonb_build_object('schema', 'PLATFORM_PRICE_VERSIONS_V1', 'products', v_versions);
end
$function$;

create function private.platform_price_list_at(p_at timestamptz)
returns jsonb
language plpgsql
stable
set search_path = pg_catalog
as $function$
declare
  v_versions jsonb; v_enabled boolean; v_product text; v_list jsonb; v_current jsonb; v_next jsonb;
  v_change timestamptz; v_products jsonb := '[]'::jsonb;
begin
  -- PKG-051: the price list as of one moment. Integrity first, then the kill switch, then resolution.
  if p_at is null then
    raise exception 'PRICE_AS_OF_REQUIRED' using errcode = '22023';
  end if;
  if not pg_catalog.isfinite(p_at) then
    raise exception 'PRICE_AS_OF_INVALID' using errcode = '22023';
  end if;
  v_versions := private.platform_price_versions()->'products';
  v_enabled := private.platform_payments_enabled();
  foreach v_product in array array['CONNECTION', 'URGENT_BOOST'] loop
    v_list := v_versions->v_product;
    -- Current: the highest version number already in effect at p_at.
    select e.value into v_current
      from pg_catalog.jsonb_array_elements(v_list) as e
     where (e.value->>'effectiveAt')::timestamptz <= p_at
     order by (e.value->>'version')::integer desc
     limit 1;
    -- Next: what is current at the first later moment when a higher version takes effect.
    select min((e.value->>'effectiveAt')::timestamptz) into v_change
      from pg_catalog.jsonb_array_elements(v_list) as e
     where (e.value->>'version')::integer > coalesce((v_current->>'version')::integer, 0);
    v_next := null;
    if v_change is not null then
      select e.value into v_next
        from pg_catalog.jsonb_array_elements(v_list) as e
       where (e.value->>'effectiveAt')::timestamptz <= v_change
       order by (e.value->>'version')::integer desc
       limit 1;
    end if;
    -- Kill switch: while payments are off, a price above 0 is never served as current or next.
    if not v_enabled and (coalesce((v_current->>'amountMinor')::bigint, 0) > 0
                          or coalesce((v_next->>'amountMinor')::bigint, 0) > 0) then
      raise exception 'PLATFORM_PAYMENTS_DISABLED' using errcode = '55000', detail = v_product;
    end if;
    v_products := v_products || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'product', v_product,
      'latestVersion', pg_catalog.jsonb_array_length(v_list),
      'current', v_current - array['schema', 'product', 'previousSha256'],
      'next', v_next - array['schema', 'product', 'previousSha256']));
  end loop;
  return pg_catalog.jsonb_build_object(
    'schema', 'PLATFORM_PRICE_LIST_V1',
    'asOf', pg_catalog.to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'paymentsEnabled', v_enabled,
    'products', v_products);
end
$function$;

create function private.platform_price_add_version(
  p_product text,
  p_expected_latest_version integer,
  p_amount_minor bigint,
  p_payer_role text,
  p_unit_basis text,
  p_effective_at timestamptz default null,
  p_currency text default 'RSD')
returns jsonb
language plpgsql
volatile
set search_path = pg_catalog
as $function$
declare
  v_versions jsonb; v_latest_version integer; v_now timestamptz; v_effective timestamptz; v_value jsonb;
begin
  -- PKG-051: the only writer. It appends version N+1 of one product and moves the head; it never edits a version.
  if p_product is null or p_product not in ('CONNECTION', 'URGENT_BOOST') then
    raise exception 'PRICE_PRODUCT_UNKNOWN' using errcode = '22023';
  end if;
  if p_expected_latest_version is null or p_expected_latest_version < 1 then
    raise exception 'PRICE_EXPECTED_VERSION_REQUIRED' using errcode = '22023';
  end if;
  if p_amount_minor is null or p_amount_minor < 0 or p_amount_minor > 10000000 then
    raise exception 'PRICE_AMOUNT_INVALID' using errcode = '22023';
  end if;
  if p_currency is null or p_currency <> 'RSD' then
    raise exception 'PRICE_CURRENCY_UNSUPPORTED' using errcode = '22023';
  end if;
  if p_payer_role is null or p_payer_role not in ('REQUESTER', 'WORKER') then
    raise exception 'PRICE_PAYER_ROLE_INVALID' using errcode = '22023';
  end if;
  if p_unit_basis is null or p_unit_basis not in ('HEADCOUNT', 'FLAT') then
    raise exception 'PRICE_UNIT_BASIS_INVALID' using errcode = '22023';
  end if;
  -- One writer at a time: the head row is the lock, and the switch cannot flip until this commits.
  perform 1 from private.marketplace_config c where c.key = 'platform_price_head' for update;
  if not found then
    raise exception 'PRICE_LIST_INTEGRITY_FAILED' using errcode = '55000', detail = 'HEAD:MISSING';
  end if;
  perform 1 from private.marketplace_config c where c.key = 'platform_payments' for share;
  -- The time is read after any wait for the lock: a new version never takes effect before it was recorded.
  v_now := pg_catalog.clock_timestamp();
  v_effective := coalesce(p_effective_at, v_now);
  if v_effective < v_now then
    raise exception 'PRICE_EFFECTIVE_IN_PAST' using errcode = '22023';
  end if;
  if v_effective > v_now + interval '366 days' then
    raise exception 'PRICE_EFFECTIVE_TOO_FAR' using errcode = '22023';
  end if;
  -- Never append to a broken or hand-edited list.
  v_versions := private.platform_price_versions()->'products';
  v_latest_version := pg_catalog.jsonb_array_length(v_versions->p_product);
  if p_expected_latest_version <> v_latest_version then
    raise exception 'PRICE_VERSION_STALE' using errcode = '40001', detail = 'latest=' || v_latest_version::text;
  end if;
  if p_amount_minor > 0 and not private.platform_payments_enabled() then
    raise exception 'PLATFORM_PAYMENTS_DISABLED' using errcode = '55000', detail = p_product;
  end if;
  if v_latest_version >= 999999 then
    raise exception 'PRICE_VERSION_LIMIT' using errcode = '54000';
  end if;
  v_value := private.platform_price_canonical(p_product, v_latest_version + 1, p_amount_minor, p_currency,
    p_payer_role, p_unit_basis, v_effective, v_now, v_versions->p_product->(v_latest_version - 1)->>'sha256');
  insert into private.marketplace_config(key, value)
  values ('platform_price:' || p_product || ':' || pg_catalog.lpad((v_latest_version + 1)::text, 6, '0'), v_value);
  update private.marketplace_config c
     set value = pg_catalog.jsonb_set(c.value, array['heads', p_product],
                   pg_catalog.jsonb_build_object('version', v_latest_version + 1, 'sha256', v_value->'sha256')),
         updated_at = pg_catalog.statement_timestamp()
   where c.key = 'platform_price_head';
  perform private.platform_price_versions();
  return v_value;
end
$function$;

revoke all on function private.platform_payments_enabled() from public, anon, authenticated, service_role;
revoke all on function private.platform_price_canonical(text,integer,bigint,text,text,text,timestamptz,timestamptz,text) from public, anon, authenticated, service_role;
revoke all on function private.platform_price_versions() from public, anon, authenticated, service_role;
revoke all on function private.platform_price_list_at(timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.platform_price_add_version(text,integer,bigint,text,text,timestamptz,text) from public, anon, authenticated, service_role;

comment on function private.platform_payments_enabled() is
  'PKG-051 platform payments kill switch. True only when marketplace_config(platform_payments) is exactly {"schema":"PLATFORM_PAYMENTS_SWITCH_V1","enabled":true} and private.platform_charges exists; anything else is off.';
comment on function private.platform_price_canonical(text,integer,bigint,text,text,text,timestamptz,timestamptz,text) is
  'PKG-051 canonical PLATFORM_PRICE_V1 value of one price version, with its sha256 over the |-joined fields. No validation; callers validate.';
comment on function private.platform_price_versions() is
  'PKG-051 every stored price version per product after verifying keys, content, self-hashes, the chain, times and the head. Raises PRICE_LIST_INTEGRITY_FAILED.';
comment on function private.platform_price_list_at(timestamptz) is
  'PKG-051 the platform price list at one moment: latestVersion, current and next per product. Refuses to serve a price above 0 while payments are off.';
comment on function private.platform_price_add_version(text,integer,bigint,text,text,timestamptz,text) is
  'PKG-051 the only price writer (database owner only): appends version N+1 of CONNECTION or URGENT_BOOST and moves the head. Refuses a price above 0 while payments are off.';

-- Seed, deterministic so DEV and the disposable proof hold the same rows: version 1 of each product at 0 RSD.
-- Its effectiveAt and recordedAt are both 2026-09-24 00:00 Belgrade, the owner's decision day, and NOT the moment
-- this file runs: v1's recordedAt is a declared date. The rule that a version never takes effect before it was
-- recorded holds from v2 on, for versions written by platform_price_add_version. Nothing reads this list, so no
-- Agreement is affected: the free ledger alone governs them. CONNECTION repeats the free policy row (payer
-- REQUESTER, HEADCOUNT); the URGENT_BOOST payer and basis are placeholders, not answers to P2/P3/P12.
insert into private.marketplace_config(key, value)
select 'platform_price:' || s.product || ':000001',
       private.platform_price_canonical(s.product, 1, 0, 'RSD', s.payer_role, s.unit_basis, t.seed_at, t.seed_at, null)
  from (values ('CONNECTION', 'REQUESTER', 'HEADCOUNT'),
               ('URGENT_BOOST', 'REQUESTER', 'FLAT')) as s(product, payer_role, unit_basis)
 cross join (select timestamptz '2026-09-23T22:00:00Z' as seed_at) as t;

insert into private.marketplace_config(key, value)
select 'platform_price_head',
       jsonb_build_object('schema', 'PLATFORM_PRICE_HEAD_V1', 'heads',
         jsonb_object_agg(c.value->>'product', jsonb_build_object('version', 1, 'sha256', c.value->'sha256')))
  from private.marketplace_config c
 where c.key in ('platform_price:CONNECTION:000001', 'platform_price:URGENT_BOOST:000001');

insert into private.marketplace_config(key, value)
values ('platform_payments', jsonb_build_object('schema', 'PLATFORM_PAYMENTS_SWITCH_V1', 'enabled', false));

do $post$
declare
  v_state record; v_fn record; v_free record; v_list jsonb; v_probe text; v_sqlstate text; v_message text;
  v_surface_md5 text; v_surface_lines bigint; v_new_lines bigint;
begin
  select * into strict v_state from pkg051_state;
  -- Bodies, authority and access of the five new functions: owner only, invoker, pg_catalog.
  for v_fn in
    select f.signature, f.body_md5, f.volatility, f.lang, p.oid, p.prosrc, p.prosecdef, p.proconfig,
           p.provolatile, p.proacl, p.proowner, l.lanname
      from (values
        ('private.platform_payments_enabled()', 'f4998801754e272d2be0a42d9e52ca77', 's', 'sql'),
        ('private.platform_price_canonical(text,integer,bigint,text,text,text,timestamptz,timestamptz,text)', 'dde80e0dcaffeb0dca25107e06a47e1f', 's', 'sql'),
        ('private.platform_price_versions()', '737e74c58cec244b7e15f90a95669163', 's', 'plpgsql'),
        ('private.platform_price_list_at(timestamptz)', '16ce63c18f886210f120a9691403559f', 's', 'plpgsql'),
        ('private.platform_price_add_version(text,integer,bigint,text,text,timestamptz,text)', 'cd92f120495bf6b4cd550f558876d1b0', 'v', 'plpgsql')
      ) as f(signature, body_md5, volatility, lang)
      left join pg_proc p on p.oid = to_regprocedure(f.signature)
      left join pg_language l on l.oid = p.prolang
  loop
    if v_fn.oid is null or md5(v_fn.prosrc) is distinct from v_fn.body_md5 then
      raise exception 'PKG051_BODY_MISMATCH: %', v_fn.signature using errcode = '55000';
    end if;
    if v_fn.prosecdef or v_fn.proconfig::text is distinct from '{search_path=pg_catalog}'
       or v_fn.provolatile::text is distinct from v_fn.volatility or v_fn.lanname::text is distinct from v_fn.lang then
      raise exception 'PKG051_FUNCTION_AUTHORITY_MISMATCH: %', v_fn.signature using errcode = '55000';
    end if;
    if (select count(*) from aclexplode(v_fn.proacl) a) <> 1
       or not exists (select 1 from aclexplode(v_fn.proacl) a
                       where a.grantee = v_fn.proowner and a.grantor = v_fn.proowner and a.privilege_type = 'EXECUTE')
       or has_function_privilege('anon', v_fn.oid, 'EXECUTE')
       or has_function_privilege('authenticated', v_fn.oid, 'EXECUTE')
       or has_function_privilege('service_role', v_fn.oid, 'EXECUTE')
       or not has_function_privilege('postgres', v_fn.oid, 'EXECUTE') then
      raise exception 'PKG051_ACL_MISMATCH: %', v_fn.signature using errcode = '55000';
    end if;
  end loop;
  -- The seed repeats today's canon: Povezivanje is the free policy row (payer, basis, 0 RSD as para), HITNO is 0.
  select v.beneficiary_role, v.unit_basis, v.platform_cost_rsd into strict v_free
    from private.connection_policy_versions v where v.policy_key = 'REQUESTER_SELECTION_V1' and v.version = 1;
  v_list := private.platform_price_list_at(clock_timestamp());
  if (select count(*) from jsonb_array_elements(v_list->'products') e
       where e.value->>'product' = 'CONNECTION'
         and (e.value->'current'->>'version')::integer = 1
         and e.value->'current'->>'payerRole' = v_free.beneficiary_role
         and e.value->'current'->>'unitBasis' = v_free.unit_basis
         and (e.value->'current'->>'amountMinor')::bigint = v_free.platform_cost_rsd::bigint * 100) <> 1
     or (select count(*) from jsonb_array_elements(v_list->'products') e
          where e.value->>'product' = 'URGENT_BOOST'
            and (e.value->'current'->>'version')::integer = 1
            and (e.value->'current'->>'amountMinor')::bigint = 0) <> 1 then
    raise exception 'PKG051_FREE_POLICY_MISMATCH' using errcode = '55000';
  end if;
  -- Kill switch, proven on the target itself: a price above 0 is refused now. The sub-block rolls the probe back.
  -- Defence in depth: once the bodies and the switch value hold, this cannot fail.
  begin
    perform private.platform_price_add_version('CONNECTION', 1, 1, 'REQUESTER', 'HEADCOUNT');
    v_probe := 'NO_ERROR';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate, v_message = message_text;
    v_probe := v_sqlstate || ':' || v_message;
  end;
  if v_probe is distinct from '55000:PLATFORM_PAYMENTS_DISABLED' then
    raise exception 'PKG051_KILL_SWITCH_NOT_CLOSED: %', v_probe using errcode = '55000';
  end if;
  -- Exactly the four seeded rows, byte for byte, and the list they give at the seed moment.
  if (select count(*) from private.marketplace_config c
       where c.key = 'platform_payments' or starts_with(c.key, 'platform_price')) <> 4
     or (select c.value::text from private.marketplace_config c where c.key = 'platform_price:CONNECTION:000001')
        is distinct from '{"schema": "PLATFORM_PRICE_V1", "product": "CONNECTION", "version": 1, "amountMinor": 0, "currency": "RSD", "payerRole": "REQUESTER", "unitBasis": "HEADCOUNT", "effectiveAt": "2026-09-23T22:00:00.000000Z", "recordedAt": "2026-09-23T22:00:00.000000Z", "previousSha256": null, "sha256": "3df2b860def7e5a08b388caeaff1a19fb6e8fd678c9989b15b32d9624226b1f6"}'::jsonb::text
     or (select c.value::text from private.marketplace_config c where c.key = 'platform_price:URGENT_BOOST:000001')
        is distinct from '{"schema": "PLATFORM_PRICE_V1", "product": "URGENT_BOOST", "version": 1, "amountMinor": 0, "currency": "RSD", "payerRole": "REQUESTER", "unitBasis": "FLAT", "effectiveAt": "2026-09-23T22:00:00.000000Z", "recordedAt": "2026-09-23T22:00:00.000000Z", "previousSha256": null, "sha256": "4ed7b18ecad29f5005f17cc8e5f8ea6bc5e04f0924c67614ba6f3976de477abb"}'::jsonb::text
     or (select c.value::text from private.marketplace_config c where c.key = 'platform_price_head')
        is distinct from '{"schema": "PLATFORM_PRICE_HEAD_V1", "heads": {"CONNECTION": {"version": 1, "sha256": "3df2b860def7e5a08b388caeaff1a19fb6e8fd678c9989b15b32d9624226b1f6"}, "URGENT_BOOST": {"version": 1, "sha256": "4ed7b18ecad29f5005f17cc8e5f8ea6bc5e04f0924c67614ba6f3976de477abb"}}}'::jsonb::text
     or (select c.value::text from private.marketplace_config c where c.key = 'platform_payments')
        is distinct from '{"schema": "PLATFORM_PAYMENTS_SWITCH_V1", "enabled": false}'::jsonb::text
     or private.platform_payments_enabled()
     or private.platform_price_list_at(timestamptz '2026-09-23T22:00:00Z')::text
        is distinct from '{"schema": "PLATFORM_PRICE_LIST_V1", "asOf": "2026-09-23T22:00:00.000000Z", "paymentsEnabled": false, "products": [{"product": "CONNECTION", "latestVersion": 1, "current": {"version": 1, "amountMinor": 0, "currency": "RSD", "payerRole": "REQUESTER", "unitBasis": "HEADCOUNT", "effectiveAt": "2026-09-23T22:00:00.000000Z", "recordedAt": "2026-09-23T22:00:00.000000Z", "sha256": "3df2b860def7e5a08b388caeaff1a19fb6e8fd678c9989b15b32d9624226b1f6"}, "next": null}, {"product": "URGENT_BOOST", "latestVersion": 1, "current": {"version": 1, "amountMinor": 0, "currency": "RSD", "payerRole": "REQUESTER", "unitBasis": "FLAT", "effectiveAt": "2026-09-23T22:00:00.000000Z", "recordedAt": "2026-09-23T22:00:00.000000Z", "sha256": "4ed7b18ecad29f5005f17cc8e5f8ea6bc5e04f0924c67614ba6f3976de477abb"}, "next": null}]}'::jsonb::text then
    raise exception 'PKG051_SEED_MISMATCH' using errcode = '55000';
  end if;
  -- Every pre-existing config row (the dispatch and HITNO settings) is untouched, value and updated_at.
  if (select md5(string_agg(c.key || '=' || c.value::text || '@' || c.updated_at::text, E'\n' order by c.key collate "C"))
        from private.marketplace_config c
       where not (c.key = 'platform_payments' or starts_with(c.key, 'platform_price')))
     is distinct from v_state.config_md5 then
    raise exception 'PKG051_CONFIG_CHANGED' using errcode = '55000';
  end if;
  -- The whole domain surface is unchanged except for exactly the five new function lines.
  select md5(string_agg(s.line, E'\n' order by s.line collate "C")), count(*) into v_surface_md5, v_surface_lines
    from pkg051_surface s
   where s.line !~ '^function:private\.(platform_payments_enabled|platform_price_canonical|platform_price_versions|platform_price_list_at|platform_price_add_version)\(';
  select count(*) into v_new_lines
    from pkg051_surface s
   where s.line ~ '^function:private\.(platform_payments_enabled|platform_price_canonical|platform_price_versions|platform_price_list_at|platform_price_add_version)\(';
  if v_surface_md5 is distinct from v_state.surface_md5 or v_surface_lines <> v_state.surface_lines or v_new_lines <> 5 then
    raise exception 'PKG051_EXISTING_OBJECT_CHANGED' using errcode = '55000';
  end if;
  -- Nothing the certificate watches was touched.
  if private.closure_source_digest_v5() is distinct from v_state.certified
     or (select sha256 from private.closure_source_v5 where singleton) is distinct from v_state.certified
     or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from v_state.certified
     or not private.retention_ai_source_ready() then
    raise exception 'PKG051_CERTIFICATE_CHANGED' using errcode = '55000';
  end if;
end
$post$;
drop view pkg051_surface;
commit;

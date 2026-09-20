-- PKG-026. Owner requested removal of the internal reservation blocker on 2026-09-20.
-- Apply only for the owner's explicit 2026-09-20 removal request, after disposable proof and live pins.
-- Reservations remain an audit/idempotency record, never a claim of provider billing.
-- No historical reservation is erased, released, reclassified or reported as zero spend.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local search_path to pg_catalog;

create temporary table pkg026_before on commit drop as
select private.closure_source_digest_v5() as certified,
       null::text as intermediate,
       to_jsonb(b) as budget
from private.ai_test_budget_v5 b where singleton;

do $pre$
declare p record;
begin
  if exists(select 1 from pg_attribute where attrelid='private.ai_test_budget_v5'::regclass
            and attname='reservation_cap_enforced' and not attisdropped) then
    raise exception 'PKG026_ALREADY_APPLIED';
  end if;
  if (select count(*) from pkg026_before) <> 1
     or private.retention_ai_source_ready() is distinct from true
     or (select sha256 from private.closure_source_v5 where singleton) is distinct from (select certified from pkg026_before)
     or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from (select certified from pkg026_before)
     or private.closure_erasure_binding_v5() is null then
    raise exception 'PKG026_CLOSURE_NOT_READY';
  end if;
  for p in select * from (values
    ('public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)','0b32e21c1fa560125c7579a3f3a77ec0'),
    ('public.rpc_ai_test_budget_report_service()','fa7b94109eeda4c0b0e0a9d56a0b8d75')
  ) pins(signature,body_md5) loop
    if (select md5(prosrc) from pg_proc where oid=to_regprocedure(p.signature)) is distinct from p.body_md5 then
      raise exception 'PKG026_PREDECESSOR_DRIFT: %', p.signature;
    end if;
  end loop;
  if (select md5(regexp_replace(prosrc,'[0-9a-f]{64}','<CERTIFIED>','g'))
      from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure)
      is distinct from '397094d2982821e4f2c48c02fb073c7c' then
    raise exception 'PKG026_READINESS_BODY_DRIFT';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint
      where conrelid='private.ai_test_budget_v5'::regclass and conname='ai_test_budget_v5_reserved_microusd_check')
      is distinct from 'CHECK (((reserved_microusd >= 0) AND (reserved_microusd <= 5000000)))' then
    raise exception 'PKG026_COUNTER_CONSTRAINT_DRIFT';
  end if;
end
$pre$;

-- A global operational setting, not account data: no new personal-data relation or erasure action.
-- Default remains capped for future independently initialized environments.
alter table private.ai_test_budget_v5 add column reservation_cap_enforced boolean not null default true;
update pkg026_before set intermediate=private.closure_source_digest_v5();
alter table private.ai_test_budget_v5 drop constraint ai_test_budget_v5_reserved_microusd_check;
alter table private.ai_test_budget_v5 add constraint ai_test_budget_v5_reserved_microusd_check
  check (reserved_microusd >= 0 and (not reservation_cap_enforced or reserved_microusd <= ceiling_microusd));

do $patch$
declare def text; anchor text; replacement text; p record;
begin
  def:=pg_get_functiondef('public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)'::regprocedure);
  anchor:='if v_budget.reserved_microusd + p_max_cost_microusd > v_budget.ceiling_microusd then';
  replacement:='if v_budget.reservation_cap_enforced and v_budget.reserved_microusd + p_max_cost_microusd > v_budget.ceiling_microusd then';
  if (length(def)-length(replace(def,anchor,''))) <> length(anchor) then raise exception 'PKG026_RESERVE_ANCHOR'; end if;
  execute replace(def,anchor,replacement);

  def:=pg_get_functiondef('public.rpc_ai_test_budget_report_service()'::regprocedure);
  for p in select * from (values
    ($a$'internalTestBudgetCapUsd', round(v_budget.ceiling_microusd / 1000000.0, 2),$a$,
     $b$'reservationCapEnforced', v_budget.reservation_cap_enforced,
    'internalTestBudgetCapUsd', case when v_budget.reservation_cap_enforced then round(v_budget.ceiling_microusd / 1000000.0, 2) else null end,$b$),
    ($a$'remainingAllowedCalls', (v_budget.ceiling_microusd - v_budget.reserved_microusd) / 250000,$a$,
     $b$'remainingAllowedCalls', case when v_budget.reservation_cap_enforced then greatest(0, (v_budget.ceiling_microusd - v_budget.reserved_microusd) / 250000) else null end,$b$),
    ($a$'capIsACallCounter', true,$a$, $b$'capIsACallCounter', v_budget.reservation_cap_enforced,$b$)
  ) patches(old_text,new_text) loop
    if (length(def)-length(replace(def,p.old_text,''))) <> length(p.old_text) then raise exception 'PKG026_REPORT_ANCHOR'; end if;
    def:=replace(def,p.old_text,p.new_text);
  end loop;
  execute def;
end
$patch$;

-- Explicit owner-selected DEV policy. Enable/admission, account closure, expiry,
-- maximum input/output/audio and operation replay protections remain in place.
update private.ai_test_budget_v5 set reservation_cap_enforced=false where singleton;

-- Same certified-source mechanism as PKG-023f. The preflight required a fully certified baseline;
-- the column addition and constraint replacement each have to move its digest independently.
do $rebind$
declare old_digest text; intermediate_digest text; new_digest text; def text;
        schema_sql text; source_sql text; anchor text; reconstructed text; control_digest text;
begin
  select certified,intermediate into strict old_digest,intermediate_digest from pkg026_before;
  new_digest:=private.closure_source_digest_v5();
  if new_digest is null or intermediate_digest is null or intermediate_digest=old_digest
     or new_digest in (old_digest,intermediate_digest) then raise exception 'PKG026_SOURCE_CHANGE_NOT_BOUND'; end if;
  -- Reconstruct the certified predecessor from the current catalog, excluding ONLY our new column
  -- and substituting ONLY the previous counter constraint. A concurrent unrelated schema/program
  -- change must not be swept into this certificate. Same method as PKG-023f's drift reconstruction.
  select regexp_replace(prosrc,';[[:space:]]*$','') into strict schema_sql
    from pg_proc where oid='private.closure_schema_digest_v5_139()'::regprocedure;
  select regexp_replace(prosrc,';[[:space:]]*$','') into strict source_sql
    from pg_proc where oid='private.closure_source_digest_v5()'::regprocedure;
  execute source_sql into control_digest;
  if control_digest is distinct from new_digest then raise exception 'PKG026_RECONSTRUCTION_CONTROL'; end if;
  anchor:='where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)';
  if (length(schema_sql)-length(replace(schema_sql,anchor,''))) <> length(anchor) then raise exception 'PKG026_SCHEMA_COLUMN_ANCHOR'; end if;
  schema_sql:=replace(schema_sql,anchor,
    $r$where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped and not (c.oid='private.ai_test_budget_v5'::regclass and a.attname='reservation_cap_enforced'))$r$);
  anchor:='pg_get_constraintdef(x.oid) order by x.conname';
  if (length(schema_sql)-length(replace(schema_sql,anchor,''))) <> length(anchor) then raise exception 'PKG026_SCHEMA_CONSTRAINT_ANCHOR'; end if;
  schema_sql:=replace(schema_sql,anchor,
    $r$case when c.oid='private.ai_test_budget_v5'::regclass and x.conname='ai_test_budget_v5_reserved_microusd_check'
      then 'CHECK (((reserved_microusd >= 0) AND (reserved_microusd <= 5000000)))' else pg_get_constraintdef(x.oid) end order by x.conname$r$);
  anchor:='private.closure_schema_digest_v5_139()';
  if (length(source_sql)-length(replace(source_sql,anchor,''))) <> length(anchor) then raise exception 'PKG026_SOURCE_SCHEMA_ANCHOR'; end if;
  execute replace(source_sql,anchor,'('||schema_sql||')') into reconstructed;
  if reconstructed is distinct from old_digest then raise exception 'PKG026_UNREVIEWED_CONCURRENT_DRIFT'; end if;
  def:=pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
  if (length(def)-length(replace(def,old_digest,''))) <> length(old_digest) then raise exception 'PKG026_CERTIFICATE_ANCHOR'; end if;
  update private.closure_source_v5 set sha256=new_digest where singleton and sha256=old_digest;
  if not found then raise exception 'PKG026_SOURCE_CERTIFICATE_DRIFT'; end if;
  update private.closure_erasure_source_v5 set sha256=new_digest where singleton and sha256=old_digest;
  if not found then raise exception 'PKG026_ERASURE_CERTIFICATE_DRIFT'; end if;
  execute replace(def,old_digest,new_digest);
end
$rebind$;

do $post$
declare p record; role_name text; relation_name text;
begin
  for p in select * from (values
    ('public.rpc_ai_test_budget_reserve_service(uuid,uuid,text,bigint)','3cadd9345025fd962fc64cab085f29f7'),
    ('public.rpc_ai_test_budget_report_service()','13dfb835abb6610c8181de7d2426eb33')
  ) pins(signature,body_md5) loop
    if (select md5(prosrc) from pg_proc where oid=to_regprocedure(p.signature)) is distinct from p.body_md5 then
      raise exception 'PKG026_RESULT_BODY_MISMATCH: %',p.signature;
    end if;
    if has_function_privilege('anon',p.signature,'EXECUTE') or has_function_privilege('authenticated',p.signature,'EXECUTE')
       or not has_function_privilege('service_role',p.signature,'EXECUTE') then raise exception 'PKG026_GRANTS_CHANGED'; end if;
  end loop;
  foreach relation_name in array array['private.ai_test_budget_v5','private.ai_test_accounts_v5','private.ai_test_reservations_v5','private.ai_test_usage_v5'] loop
    if not (select relrowsecurity from pg_class where oid=relation_name::regclass) then raise exception 'PKG026_RLS_CHANGED'; end if;
    foreach role_name in array array['anon','authenticated','service_role'] loop
      if has_table_privilege(role_name,relation_name,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'PKG026_TABLE_GRANTS_CHANGED'; end if;
    end loop;
  end loop;
  if (select to_jsonb(b)-'reservation_cap_enforced' from private.ai_test_budget_v5 b where singleton)
       is distinct from (select budget from pkg026_before)
     or (select reservation_cap_enforced from private.ai_test_budget_v5 where singleton) is distinct from false then
    raise exception 'PKG026_BUDGET_HISTORY_CHANGED';
  end if;
  if private.retention_ai_source_ready() is distinct from true
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_source_v5 where singleton)
     or private.closure_source_digest_v5() is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton)
     or private.closure_erasure_binding_v5()->>'sourceSha256' is distinct from private.closure_source_digest_v5()
     or (select md5(regexp_replace(prosrc,'[0-9a-f]{64}','<CERTIFIED>','g')) from pg_proc where oid='private.retention_ai_source_ready()'::regprocedure)
       is distinct from '397094d2982821e4f2c48c02fb073c7c' then raise exception 'PKG026_CLOSURE_POSTCONDITION'; end if;
end
$post$;
notify pgrst,'reload schema';
commit;

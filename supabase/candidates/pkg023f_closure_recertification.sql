-- PKG-023f: re-certify the closure source after the reviewed dev_alpha additions of 2026-09-17.
--
-- A CANDIDATE. NOT APPLIED ANYWHERE. The owner asked for a forensic review first and a separate approval
-- before any re-certification on canonical DEV/ALPHA leqcwgzvjsxugfgzdmth (2026-09-19). The review is
-- docs/implementation/v5-ai-first/pkg023/CLOSURE_FORENSIC_REVIEW_20260919.md.
--
-- What is wrong today. private.retention_ai_source_ready() compares private.closure_source_digest_v5() with
-- the value written at the last certification. Since 2026-09-17 the two differ on canonical DEV, because
-- five dev_alpha migrations added tables, columns, constraints and a trigger without re-binding:
--   dev_alpha_pkg015_account_lineage           private.account_lineage_v5, private.account_lineage_events_v5
--                                              and the trigger account_lineage_events_v5_append_only
--   dev_alpha_pkg014b_ai_provider_usage        private.ai_test_usage_v5
--   dev_alpha_pkg019b / pkg019c / pkg019d      private.ai_test_reservations_v5: settled_microusd, settlement_basis,
--                                              settled_at, measured_audio_bytes, measured_transcript_chars,
--                                              ai_test_reservations_v5_settlement_check, ..._audio_measure_check
-- While they differ, private.closure_erasure_binding_v5() is null: an account closure cannot start. That is
-- the guard working, fail-closed. It is also why pkg023c refuses this database.
--
-- What this does NOT do. It does not write a new expected value over the old one and call it certified.
-- It certifies only if it can prove, inside its own transaction, all of the following; otherwise nothing
-- is committed:
--   1. the certified value is one value, held in all three places that hold it;
--   2. the digest has in fact drifted, and no account closure is executing;
--   3. every OTHER condition of retention_ai_source_ready() is true: the digest is the only reason;
--   4. the reviewed additions have exactly the shape that was reviewed (every column, constraint, trigger,
--      trigger body and RLS flag of the three tables; the five columns and two constraints of the
--      reservations table), and no API role holds any privilege on the three tables;
--   5. THE RECONSTRUCTION: the live text of the digest functions, evaluated with exactly those additions
--      filtered out of its input, yields the certified value. So the reviewed additions are the ONLY
--      difference the digest can see between the last certified state and now. One unreviewed column,
--      constraint, trigger, table, grant, owner or function body anywhere else, and this refuses.
--
-- What it changes.
--   a. private.closure_dataset_catalog_v5: the three new account-linked tables join AUDIT_SECURITY_LOGS, the
--      class their siblings private.ai_test_accounts_v5 and private.ai_test_reservations_v5 already have.
--      Every earlier source migration that added an account-linked table catalogued it; the dev_alpha
--      migrations did not. The catalog is data, not part of the digest.
--   b. the certified value, in its three places: private.closure_source_v5, private.closure_erasure_source_v5
--      and the constant inside private.retention_ai_source_ready() (the $rebind$ pattern of source migration
--      20260913081147). Nothing else of that function changes.
-- It changes no table, column, constraint, trigger, policy, grant or any other function, and the erasure
-- program (private.closure_redaction_relations_v5, private.closure_redaction_patch_v5) is untouched: the
-- review found no user-authored content in the additions. See the review for what stays after a closure.
--
-- The same bytes run on the disposable proof database and on canonical DEV: no digest is hard-coded, because
-- the digest contains role and type OIDs and is different in every database by construction.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
-- The digest functions print regclass and regprocedure names and run with this search_path. The
-- reconstruction evaluates their text here and must print the same names. Every object below is qualified.
set local search_path to pg_catalog;

create temporary table pkg023f_predecessor(certified text not null, drifted text not null) on commit drop;

do $pre$
declare
  v_certified text; v_live text; v_ready_def text; v_ready_sql text; v_needle text; v_other boolean;
  v_shape text; v_schema text; v_program text; v_source text; v_reconstructed text;
  n_columns constant text := 'where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)';
  n_constraints constant text := 'from pg_constraint x where x.conrelid=c.oid)';
  n_relkind constant text := $n$and c.relkind in('r','p')$n$;
  n_trigger_state constant text := $n$or t.tgrelid='storage.objects'::regclass))$n$;
  r_tables constant text := $r$and c.relkind in('r','p') and c.oid not in('private.account_lineage_v5'::regclass,'private.account_lineage_events_v5'::regclass,'private.ai_test_usage_v5'::regclass)$r$;
begin
  if to_regclass('private.account_lineage_v5') is null or to_regclass('private.account_lineage_events_v5') is null
     or to_regclass('private.ai_test_usage_v5') is null or to_regclass('private.ai_test_reservations_v5') is null then
    raise exception 'PKG023F_REVIEWED_ADDITIONS_ABSENT';
  end if;

  -- 1. One certified value, in all three places.
  select sha256 into strict v_certified from private.closure_source_v5 where singleton;
  if v_certified is distinct from (select sha256 from private.closure_erasure_source_v5 where singleton) then
    raise exception 'PKG023F_CERTIFIED_VALUES_DISAGREE';
  end if;
  v_ready_def := pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
  if (length(v_ready_def) - length(replace(v_ready_def, v_certified, ''))) <> length(v_certified)
     or (select count(*) from regexp_matches(v_ready_def, '[0-9a-f]{64}', 'g')) <> 1 then
    raise exception 'PKG023F_READY_BINDING_INVALID';
  end if;

  -- 2. There is a drift to certify, and nothing is executing against the old certificate.
  v_live := private.closure_source_digest_v5();
  if v_live is null then raise exception 'PKG023F_SOURCE_DIGEST_UNAVAILABLE'; end if;
  if v_live = v_certified or private.retention_ai_source_ready() is not distinct from true then
    raise exception 'PKG023F_NOTHING_TO_RECERTIFY';
  end if;
  if exists (select 1 from private.closure_executions_v5 where state = 'EXECUTING') then
    raise exception 'PKG023F_CLOSURE_IN_FLIGHT';
  end if;

  -- 3. The digest is the ONLY readiness condition that fails.
  select regexp_replace(prosrc, ';[[:space:]]*$', '') into strict v_ready_sql
    from pg_proc where oid = 'private.retention_ai_source_ready()'::regprocedure;
  v_needle := 'private.closure_source_digest_v5()=' || quote_literal(v_certified);
  if (length(v_ready_sql) - length(replace(v_ready_sql, v_needle, ''))) <> length(v_needle) then
    raise exception 'PKG023F_READY_BINDING_INVALID';
  end if;
  execute replace(v_ready_sql, v_needle, 'true') into v_other;
  if v_other is distinct from true then raise exception 'PKG023F_ANOTHER_READINESS_CONDITION_FAILS'; end if;

  -- 4. The reviewed additions have exactly the reviewed shape, and no API role can touch them.
  select encode(extensions.digest(convert_to(jsonb_build_object(
    'tables', (select jsonb_agg(jsonb_build_object('table', c.oid::regclass::text,
        'columns', (select jsonb_agg(jsonb_build_array(a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull) order by a.attnum) from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped),
        'constraints', (select jsonb_agg(pg_get_constraintdef(x.oid) order by x.conname) from pg_constraint x where x.conrelid = c.oid),
        'triggers', (select jsonb_agg(jsonb_build_array(t.tgname, pg_get_triggerdef(t.oid), md5(p.prosrc), t.tgenabled) order by t.tgname) from pg_trigger t join pg_proc p on p.oid = t.tgfoid where t.tgrelid = c.oid and not t.tgisinternal),
        'rowSecurity', jsonb_build_array(c.relrowsecurity, c.relforcerowsecurity)) order by c.oid::regclass::text)
      from pg_class c where c.oid in ('private.account_lineage_v5'::regclass, 'private.account_lineage_events_v5'::regclass, 'private.ai_test_usage_v5'::regclass)),
    'reservationColumns', (select jsonb_agg(jsonb_build_array(a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull) order by a.attnum) from pg_attribute a
      where a.attrelid = 'private.ai_test_reservations_v5'::regclass and not a.attisdropped
        and a.attname in ('settled_microusd','settlement_basis','settled_at','measured_audio_bytes','measured_transcript_chars')),
    'reservationConstraints', (select jsonb_agg(pg_get_constraintdef(x.oid) order by x.conname) from pg_constraint x
      where x.conrelid = 'private.ai_test_reservations_v5'::regclass and x.conname in ('ai_test_reservations_v5_settlement_check','ai_test_reservations_v5_audio_measure_check'))
  )::text, 'UTF8'), 'sha256'), 'hex') into v_shape;
  if v_shape is distinct from '00715283f6a95df1c95dad4394a9fe61ae9cb3f5891c10eead434a40b1f13791' then
    raise exception 'PKG023F_REVIEWED_ADDITIONS_CHANGED_SHAPE %', v_shape;
  end if;
  if exists (select 1 from unnest(array['anon','authenticated','service_role']) r,
                  unnest(array['private.account_lineage_v5','private.account_lineage_events_v5','private.ai_test_usage_v5']) t
              where has_table_privilege(r, t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) then
    raise exception 'PKG023F_REVIEWED_ADDITIONS_ARE_REACHABLE_BY_AN_API_ROLE';
  end if;

  -- 5. The reconstruction. The live text of the three digest functions, with the reviewed additions
  --    filtered out of the input. Each filter must land exactly once, or it filtered nothing.
  select regexp_replace(prosrc, ';[[:space:]]*$', '') into strict v_schema from pg_proc where oid = 'private.closure_schema_digest_v5_139()'::regprocedure;
  select regexp_replace(prosrc, ';[[:space:]]*$', '') into strict v_program from pg_proc where oid = 'private.closure_erasure_program_digest_v5()'::regprocedure;
  select regexp_replace(prosrc, ';[[:space:]]*$', '') into strict v_source from pg_proc where oid = 'private.closure_source_digest_v5()'::regprocedure;
  if (length(v_schema) - length(replace(v_schema, n_columns, ''))) <> length(n_columns)
     or (length(v_schema) - length(replace(v_schema, n_constraints, ''))) <> length(n_constraints)
     or (length(v_schema) - length(replace(v_schema, n_relkind, ''))) <> length(n_relkind)
     or (length(v_program) - length(replace(v_program, n_relkind, ''))) <> length(n_relkind)
     or (length(v_program) - length(replace(v_program, n_trigger_state, ''))) <> length(n_trigger_state)
     or (length(v_source) - length(replace(v_source, 'private.closure_schema_digest_v5_139()', ''))) <> length('private.closure_schema_digest_v5_139()')
     or (length(v_source) - length(replace(v_source, 'private.closure_erasure_program_digest_v5()', ''))) <> length('private.closure_erasure_program_digest_v5()') then
    raise exception 'PKG023F_DIGEST_FUNCTIONS_ARE_NOT_THE_REVIEWED_ONES';
  end if;
  -- Control: the same evaluation with nothing filtered must give the live digest, or the method is unsound here.
  execute replace(replace(v_source, 'private.closure_schema_digest_v5_139()', '(' || v_schema || ')'),
                  'private.closure_erasure_program_digest_v5()', '(' || v_program || ')') into v_reconstructed;
  if v_reconstructed is distinct from v_live then raise exception 'PKG023F_RECONSTRUCTION_METHOD_UNSOUND'; end if;

  v_schema := replace(replace(replace(v_schema,
    n_columns, $r$where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped and not (c.oid='private.ai_test_reservations_v5'::regclass and a.attname in('settled_microusd','settlement_basis','settled_at','measured_audio_bytes','measured_transcript_chars')))$r$),
    n_constraints, $r$from pg_constraint x where x.conrelid=c.oid and not (c.oid='private.ai_test_reservations_v5'::regclass and x.conname in('ai_test_reservations_v5_settlement_check','ai_test_reservations_v5_audio_measure_check')))$r$),
    n_relkind, r_tables);
  v_program := replace(replace(v_program,
    n_relkind, r_tables),
    n_trigger_state, $r$or t.tgrelid='storage.objects'::regclass) and t.tgrelid<>'private.account_lineage_events_v5'::regclass)$r$);
  execute replace(replace(v_source, 'private.closure_schema_digest_v5_139()', '(' || v_schema || ')'),
                  'private.closure_erasure_program_digest_v5()', '(' || v_program || ')') into v_reconstructed;
  if v_reconstructed is distinct from v_certified then
    raise exception 'PKG023F_UNREVIEWED_CHANGE: without the reviewed additions the digest is %, the certified value is %', v_reconstructed, v_certified;
  end if;

  insert into pkg023f_predecessor values (v_certified, v_live);
end
$pre$;

-- a. The three account-linked tables join the class of their siblings.
do $catalog$
declare v_rows integer;
begin
  update private.closure_dataset_catalog_v5
     set relations = relations || array['private.ai_test_usage_v5','private.account_lineage_v5','private.account_lineage_events_v5']
   where data_class = 'AUDIT_SECURITY_LOGS'
     and relations @> array['private.ai_test_accounts_v5','private.ai_test_reservations_v5']
     and not relations && array['private.ai_test_usage_v5','private.account_lineage_v5','private.account_lineage_events_v5'];
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'PKG023F_CATALOG_NOT_AS_REVIEWED'; end if;
  if exists (select 1 from private.closure_dataset_catalog_v5 c, unnest(c.relations) r
              where r in ('private.ai_test_usage_v5','private.account_lineage_v5','private.account_lineage_events_v5')
              group by r having count(*) <> 1) then
    raise exception 'PKG023F_CATALOG_NOT_AS_REVIEWED';
  end if;
end
$catalog$;

-- b. The certified value, in its three places.
do $rebind$
declare v_certified text; v_drifted text; v_def text;
begin
  select certified, drifted into strict v_certified, v_drifted from pkg023f_predecessor;
  -- The catalog is data; if the digest moved, something here is not what was reviewed.
  if private.closure_source_digest_v5() is distinct from v_drifted then raise exception 'PKG023F_DIGEST_MOVED_DURING_RECERTIFICATION'; end if;
  v_def := pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure);
  update private.closure_source_v5 set sha256 = v_drifted where singleton and sha256 = v_certified;
  if not found then raise exception 'PKG023F_CERTIFIED_VALUES_DISAGREE'; end if;
  update private.closure_erasure_source_v5 set sha256 = v_drifted where singleton and sha256 = v_certified;
  if not found then raise exception 'PKG023F_CERTIFIED_VALUES_DISAGREE'; end if;
  execute replace(v_def, v_certified, v_drifted);
end
$rebind$;

do $post$
declare v_certified text; v_drifted text; v_ready text;
begin
  select certified, drifted into strict v_certified, v_drifted from pkg023f_predecessor;
  select prosrc into strict v_ready from pg_proc where oid = 'private.retention_ai_source_ready()'::regprocedure;
  if private.closure_source_digest_v5() is distinct from v_drifted
     or (select sha256 from private.closure_source_v5 where singleton) is distinct from v_drifted
     or (select sha256 from private.closure_erasure_source_v5 where singleton) is distinct from v_drifted
     or position(v_certified in v_ready) > 0
     or (length(v_ready) - length(replace(v_ready, v_drifted, ''))) <> length(v_drifted) then
    raise exception 'PKG023F_REBIND_INCOMPLETE';
  end if;
  -- Nothing of the readiness function changed except the one constant.
  if md5(regexp_replace(v_ready, '[0-9a-f]{64}', '<CERTIFIED>', 'g')) is distinct from '397094d2982821e4f2c48c02fb073c7c' then
    raise exception 'PKG023F_READINESS_FUNCTION_CHANGED_BEYOND_THE_CONSTANT';
  end if;
  if private.retention_ai_source_ready() is distinct from true then raise exception 'PKG023F_SOURCE_NOT_READY'; end if;
  if private.closure_erasure_binding_v5() is null then raise exception 'PKG023F_ERASURE_BINDING_NOT_READY'; end if;
  if has_function_privilege('anon', 'private.retention_ai_source_ready()', 'EXECUTE')
     or has_function_privilege('authenticated', 'private.retention_ai_source_ready()', 'EXECUTE') then
    raise exception 'PKG023F_GRANTS_NOT_EXACT';
  end if;
end
$post$;

commit;

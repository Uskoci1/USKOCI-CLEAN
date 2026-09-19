-- PKG-023f closure forensic: what moved the closure source digest, proven on the database itself.
--
-- Read-only. One SELECT inside a transaction that is rolled back; it writes nothing and calls no writer.
-- The transaction exists only to give the SELECT the search_path the digest functions themselves run
-- with (pg_catalog): they print regclass and regprocedure names, and those names depend on it.
--
-- private.closure_source_digest_v5() is a sha256 over three things: every column, constraint and trigger
-- of every public/private table (closure_schema_digest_v5_139), the erasure program with every table's
-- owner/ACL/RLS state and every trigger's enabled state (closure_erasure_program_digest_v5), and the md5 of
-- 72 named functions. private.retention_ai_source_ready() compares it with a constant written at the last
-- certification.
--
-- This query takes the LIVE text of those three functions from pg_proc, and evaluates it twice through
-- query_to_xml:
--   control        unchanged                         -> must equal private.closure_source_digest_v5()
--   reconstructed  with exactly the reviewed DEV additions filtered out of the input
--                                                     -> must equal the certified constant
-- If the reconstruction equals the certified constant, the reviewed additions are the ONLY differences
-- between the certified state and today that the digest can see. If it does not, something else changed.
--
-- The reviewed additions (canonical DEV ledger, 2026-09-17):
--   dev_alpha_pkg015_account_lineage            tables private.account_lineage_v5, private.account_lineage_events_v5
--                                               and its trigger account_lineage_events_v5_append_only
--   dev_alpha_pkg014b_ai_provider_usage         table private.ai_test_usage_v5
--   dev_alpha_pkg019b / pkg019c / pkg019d       private.ai_test_reservations_v5: columns settled_microusd,
--                                               settlement_basis, settled_at, measured_audio_bytes,
--                                               measured_transcript_chars; constraints
--                                               ai_test_reservations_v5_settlement_check,
--                                               ai_test_reservations_v5_audio_measure_check
begin;
set local search_path to pg_catalog;
with src as (
  select
    (select regexp_replace(prosrc, ';[[:space:]]*$', '') from pg_proc where oid = 'private.closure_schema_digest_v5_139()'::regprocedure) as schema_sql,
    (select regexp_replace(prosrc, ';[[:space:]]*$', '') from pg_proc where oid = 'private.closure_erasure_program_digest_v5()'::regprocedure) as program_sql,
    (select regexp_replace(prosrc, ';[[:space:]]*$', '') from pg_proc where oid = 'private.closure_source_digest_v5()'::regprocedure) as source_sql
), needles as (
  select
    'where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped)'::text as n_columns,
    'from pg_constraint x where x.conrelid=c.oid)'::text as n_constraints,
    $n$and c.relkind in('r','p')$n$::text as n_relkind,
    $n$or t.tgrelid='storage.objects'::regclass))$n$::text as n_trigger_state
), filtered as (
  select s.*, n.*,
    replace(replace(replace(s.schema_sql,
      n.n_columns,
      $r$where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped and not (c.oid='private.ai_test_reservations_v5'::regclass and a.attname in('settled_microusd','settlement_basis','settled_at','measured_audio_bytes','measured_transcript_chars')))$r$),
      n.n_constraints,
      $r$from pg_constraint x where x.conrelid=c.oid and not (c.oid='private.ai_test_reservations_v5'::regclass and x.conname in('ai_test_reservations_v5_settlement_check','ai_test_reservations_v5_audio_measure_check')))$r$),
      n.n_relkind,
      $r$and c.relkind in('r','p') and c.oid not in('private.account_lineage_v5'::regclass,'private.account_lineage_events_v5'::regclass,'private.ai_test_usage_v5'::regclass)$r$) as schema_without,
    replace(replace(s.program_sql,
      n.n_relkind,
      $r$and c.relkind in('r','p') and c.oid not in('private.account_lineage_v5'::regclass,'private.account_lineage_events_v5'::regclass,'private.ai_test_usage_v5'::regclass)$r$),
      n.n_trigger_state,
      $r$or t.tgrelid='storage.objects'::regclass) and t.tgrelid<>'private.account_lineage_events_v5'::regclass)$r$) as program_without
  from src s, needles n
), assembled as (
  select f.*,
    replace(replace(f.source_sql, 'private.closure_schema_digest_v5_139()', '(' || f.schema_sql || ')'),
            'private.closure_erasure_program_digest_v5()', '(' || f.program_sql || ')') as control_sql,
    replace(replace(f.source_sql, 'private.closure_schema_digest_v5_139()', '(' || f.schema_without || ')'),
            'private.closure_erasure_program_digest_v5()', '(' || f.program_without || ')') as reconstructed_sql
  from filtered f
)
select
  -- each needle must be found exactly where it is expected, or the filter silently filtered nothing
  (length(schema_sql) - length(replace(schema_sql, n_columns, ''))) / length(n_columns) as columns_needle_in_schema,
  (length(schema_sql) - length(replace(schema_sql, n_constraints, ''))) / length(n_constraints) as constraints_needle_in_schema,
  (length(schema_sql) - length(replace(schema_sql, n_relkind, ''))) / length(n_relkind) as relkind_needle_in_schema,
  (length(program_sql) - length(replace(program_sql, n_relkind, ''))) / length(n_relkind) as relkind_needle_in_program,
  (length(program_sql) - length(replace(program_sql, n_trigger_state, ''))) / length(n_trigger_state) as trigger_state_needle_in_program,
  private.closure_source_digest_v5() as live_digest,
  substring(query_to_xml(control_sql, false, true, '')::text from '[0-9a-f]{64}') as control_digest,
  substring(query_to_xml(reconstructed_sql, false, true, '')::text from '[0-9a-f]{64}') as reconstructed_digest,
  (select sha256 from private.closure_source_v5 where singleton) as certified_in_closure_source_v5,
  (select sha256 from private.closure_erasure_source_v5 where singleton) as certified_in_closure_erasure_source_v5,
  substring((select prosrc from pg_proc where oid = 'private.retention_ai_source_ready()'::regprocedure)
            from $p$closure_source_digest_v5[(][)]='([0-9a-f]{64})'$p$) as certified_in_retention_ai_source_ready,
  private.retention_ai_source_ready() as ready
from assembled;
rollback;

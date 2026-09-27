// Proof-only complete catalog handoff. No connections, env or output at import.
// Values stay in memory; the uploaded handoff is only the SHA256 of this object.
import {readFileSync} from 'node:fs';
import {migrationSnapshotQuery} from '../pre_v3/history_snapshot.mjs';

export function invalidationCatalogSnapshot(rt) {
  const state = rt.rows(`select
    (select to_jsonb(c) from private.closure_source_v5 c where singleton) source,
    (select to_jsonb(c) from private.closure_erasure_source_v5 c where singleton) erasure,
    pg_get_functiondef('private.retention_ai_source_ready()'::regprocedure) readiness_definition,
    (select to_jsonb(p) from pg_proc p where oid='private.retention_ai_source_ready()'::regprocedure) readiness_metadata,
    (select md5(to_jsonb(p)::text) from pg_proc p where oid='private.retention_ai_source_ready()'::regprocedure) readiness_metadata_md5,
    private.closure_source_digest_v5() digest,
    private.closure_schema_digest_v5_139() schema_digest,
    private.closure_erasure_program_digest_v5() erasure_program_digest,
    private.retention_ai_source_ready() ready,
    private.closure_erasure_binding_v5() binding,
    (select jsonb_agg(to_jsonb(c) order by data_class) from private.closure_dataset_catalog_v5 c) datasets,
    (select jsonb_agg(jsonb_build_array(p.oid,md5(to_jsonb(p)::text)) order by p.oid)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in('public','private','rls_private')
        and p.oid<>'private.retention_ai_source_ready()'::regprocedure) other_function_metadata,
    (select jsonb_agg(jsonb_build_array(c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity,c.relreplident) order by c.oid)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in('public','private','rls_private') and c.relkind in('r','p')) table_authority,
    (select jsonb_agg(to_jsonb(p) order by pubname) from pg_publication p) publications,
    (select jsonb_agg(to_jsonb(p) order by pubname,schemaname,tablename) from pg_publication_tables p) publication_tables,
    to_regclass('public.agreement_invalidations_v1') is not null candidate_present`)[0];
  return {
    state,
    surface: rt.sql(readFileSync('supabase/proofs/pkg023/pkg023_surface.sql', 'utf8')).split(/\r?\n/).filter(Boolean),
    history: rt.rows(migrationSnapshotQuery()),
  };
}

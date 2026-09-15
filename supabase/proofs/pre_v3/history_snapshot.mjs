// Proof-only: compare every migration-row field without transporting all SQL
// bodies through child_process's bounded stdout pipe. No history is rewritten.
export function migrationSnapshotQuery(excludeVersion = null) {
  if (excludeVersion !== null && !/^[0-9]{14}$/.test(excludeVersion)) {
    throw new Error('INVALID_MIGRATION_VERSION');
  }
  return `select version, encode(sha256(convert_to(to_jsonb(m)::text, 'UTF8')), 'hex') as row_sha256
    from supabase_migrations.schema_migrations m
    ${excludeVersion === null ? '' : `where version <> '${excludeVersion}'`} order by version`;
}

export function sqlProcessFailure(error) {
  const code = ['ENOBUFS', 'ENOENT', 'ETIMEDOUT'].includes(error?.code) ? error.code : 'PROCESS_EXIT';
  // Never include argv, database URL, stdout, environment or arbitrary message.
  return `LOCAL_SQL:${code}:status=${Number.isInteger(error?.status) ? error.status : 'NONE'}:` +
    String(error?.stderr ?? '').slice(0, 900);
}

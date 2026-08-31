# Migration reconstruction and provenance proof

## Current Repair 1 checkpoint

- Canonical repository: `Uskoci1/USKOCI-CLEAN`
- Canonical branch: `clean-alpha-backend`
- Verified starting HEAD: `a30092fd21205a331834ab61abc3efa65f6f9417`
- Live Supabase project: `leqcwgzvjsxugfgzdmth`
- Starting live history: 43 migrations, ending at `20260830194000_clean_p2_read_layer_repair`
- Repair 1 live history: 44 migrations, ending at `20260830202733_clean_pre_p4_provenance_reconciliation`

## 191500 classification

`20260830191500_clean_p0_authoritative_fixes.sql` is a
`RECORDED_STATEMENT_RECONSTRUCTION`, not an exact historical mirror.

Physical evidence:

- The live history contains seven recorded statements.
- Their per-statement byte lengths and MD5 values are recorded in
  `migrations/MIGRATION_PROVENANCE.json`.
- The prior manifest claimed `c4f62aa4521410dd3f85934bb98474a7`.
- A 24,576-candidate separator search and a separate 2,352,980-candidate
  BOM/newline/semicolon search did not reproduce that checksum.
- The canonical reconstruction has raw-file MD5
  `95eaf115b60f4ff1fb477c1697264cf5`.
- The original bytes therefore remain unknown. The old checksum is retained only
  as historical evidence; it is not presented as a checksum of the restored file.

The existing applied history row was not edited, repaired, renamed, or re-applied.

## Undocumented live delta and forward closure

The recorded 191500 publisher ended `ai_conversations.status` as
`PUBLISHED`. Immediately before Repair 1, live `pg_get_functiondef` ended it
as `COMPLETED`. Migration 194000 does not replace that function. No physical
record identifies the actor or timestamp, so the delta remains classified
`UNDOCUMENTED_OR_DIRECT_DDL`.

Forward migration
`20260830202733_clean_pre_p4_provenance_reconciliation.sql`:

1. asserts that its predecessor is one of the two physically observed 191500
   lineage variants;
2. replaces the unsafe pre-P4 publisher with an authenticated fail-closed
   `PACKAGE_4_NOT_READY` boundary;
3. preserves `service_role` execution and removes `public`/`anon` execute;
4. performs no business-row DML or backfill.

Fresh rebuilds now execute recorded 191500 semantics and then the explicit
forward closure, deterministically producing the intended fail-closed state.

## Checksum contract

`MD5_MANIFEST.txt` now means one thing only: MD5 of raw physical migration-file
bytes in the canonical Git tree. It does not assert equality with unavailable
original bytes or with Supabase's parsed statement representation.

The previous checker parsed the manifest columns backwards, appended `.sql`
twice, normalized CR bytes, and removed trailing newlines through command
substitution. It could therefore report neither raw-file integrity nor applied
history parity. The replacement checker fails on:

- malformed, duplicate, missing, or extra migration files;
- raw-byte MD5 mismatch or CR bytes;
- mismatch between the canonical file set and the captured 44-entry live history;
- any attempt to relabel 191500 as an exact-byte mirror.

LF policy is explicit in the repository `.gitattributes`.

## Rollback implication

Repair 1 is forward-only. Restoring either unsafe publisher predecessor or
rewriting the 191500 applied record is not an acceptable rollback. Any future
change must be a new forward migration.

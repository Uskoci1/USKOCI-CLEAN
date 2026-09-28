# Round43 — P6 spatial continuation and count guards

## Problem / user impact and cause

The quarantined PLACES decoder accepted an unrelated continuation tuple and even an empty page with hasMore=true. Future paging could repeat or skip localities. MAP accepted a bucket population that spent point-free rows and repeated the same task UUID under different bucket keys. PLACES accepted facet totals beyond Everywhere. Eight malformed-input regressions reproduce acceptance on the exact predecessor; three positive/existing-control regressions preserve valid cases.

## Product / UX decision and implementation

Refuse contradictions at the existing strict decoder boundary; never silently repair, sort, duplicate or display fabricated counts. Cursor count+text+key must equal the last emitted row. Short valid continuing pages remain valid. Bucket sums cannot exceed mapped minus withoutPoint; duplicate TASK IDs are refused. Locality counts cannot exceed the exact whole-filter total.

Files: src/data/discoveryV1SpatialContract.ts, src/data/__tests__/discovery-v1-spatial-contract.test.ts. No screen, TaskCard/Peek, production reader, navigation, account, dependency, payment or motion change.

## Backend / applied or not

No SQL candidate changed or applied. P6 remains quarantined. The read-only canonical DEV check at 2026-09-28T14:38:29.918002Z found rpc_discovery_v1(jsonb) absent, covered_slots body MD5 cbeb8f2a3da7d08965ef0386cfc437ba, and Serbian ICU collation present. Reader role was supabase_read_only_user. This is a metadata check, not Auth/PostgREST, database proof or live state mutation.

## Checks / exact source

Tested commit: c43c078188633bf022e13489bc9eb5379e142457; Actions run 36439653581. Before: 8 failed assertions, 0 runtime-suite errors. After: TypeScript PASS; 347 focused suites / 7299 tests PASS; full Jest 347 suites / 7299 tests PASS. See ROUND_43_P6_SPATIAL_CHECKS.json for hashes. Source is committed before checking. The same workflow generates the existing tracker and refuses a non-fast-forward or moved-branch push.

## Device / provider proof and limits

No APK, Android/iOS device, provider, latency, scale, exact push, email delivery or live matching proof. Historical native evidence stays bound to its old binary. SOURCE/CI PASS does not close P6, the native FULL-return gate or any store gate.

## Control / publication / next action

Existing B04/B05 rows are reconciled; node scripts/control/osvezi.mjs must run before committing generated views. Hosted Claude publication remains unverified. The highest remaining P6 work is the complete PAGE+EXACT+MAP+PLACES server candidate, disposable SQL and Auth/PostgREST proof, query-cost evidence, paging owner and native adapters. This is engineering work, not a ready migration waiting only for approval. No owner input is needed for that preparation; live apply and additional provider/native-dependency permissions remain separate.

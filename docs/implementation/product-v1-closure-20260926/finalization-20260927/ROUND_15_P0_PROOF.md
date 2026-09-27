# Round 15 — exact public publication landing proof

Status: first dedicated disposable CI run reached P0 but failed fixture setup; corrected-source rerun pending. **Not applied and not client-wired. Explicit `primeni` is still required for canonical application.** No frozen migration, client, dependency, DEV data, Edge function or certificate was changed by this work.

The unchanged candidate replaces only `rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamptz,uuid)`. Fresh read-only DEV metadata at **2026-09-27 15:22:48.669517 UTC** matches its pinned predecessor: definition MD5 `8a47d061da5f9bd65b5e3cc6c947d5d7`, normalized body MD5 `18b5518140c519b96728d1e25fa3c29d`, SECURITY INVOKER, STABLE, `search_path=pg_catalog`, authenticated EXECUTE and no anon EXECUTE. This read is a function-catalog check, not whole-DEV attestation or application permission.

## Runnable proof

Workflow: [discovery-p0-exact-public-proof.yml](../../../../.github/workflows/discovery-p0-exact-public-proof.yml). It registers on the integration branch when that workflow changes, and supports manual dispatch. It reuses the previously successful historical source147/dev-alpha replay through PKG050, A1 and B3a/B3b. **PKG051 is excluded**, as in the prior B3 proof; this is not a replay of every current DEV migration. The exact P0 predecessor is independently pinned before the candidate executes. Existing locked dependencies are installed only in CI; no dependency manifest changes are included.

The P0 step runs:

```sh
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -v discovery_disposable=true \
  -f supabase/proofs/discovery/discovery_p0_exact_public_landing_proof.sql
```

The JavaScript guard requires loopback API/database targets; SQL independently checks host `127.0.0.1`, port `54322`, database/user `postgres`, and explicit disposable admission. The candidate runs verbatim. Its proof rolls back all synthetic fixtures and restores the predecessor after success; a failed disposable environment is discarded. Raw setup output that may contain local keys is excluded from artifacts. Source binding, stage/failure logs and `discovery-p0-report.json` are retained.

First run [36329640103](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36329640103) at `98ce628a` passed the complete predecessor replay and P0's exact-candidate/authority check, then failed at SQL fixture line 134: `permission denied to set parameter "session_replication_role"`, from `set_config` inside the seed DO block. No P0 behavioral pass is claimed. The correction splits actor creation from task fixture insertion and uses the same **top-level `SET LOCAL session_replication_role = replica/origin`** form already exercised successfully by the inherited PKG042/B3 disposable proofs. There is no new role/parameter grant, permanent trigger change or candidate change. Origin is restored before reads and transaction rollback restores it on any setup error. The failed run and its artifacts remain evidence; only a successful corrected-source rerun can supersede its result.

Nine proof groups cover exact source/authority; ordinary empty/filter/map/cursor parity; a target beyond the first 200 rows; positive revision and at-most-one result; public fields and remote/point-free rows; draft/closed/completed/missing exclusion; malformed/mixed filters and page bounds; owner/cross-world isolation; authenticated-without-user and anon refusal; and predecessor/ACL/certificate restoration (some groups combine related assertions). P0 uses SQL roles and synthetic JWT subject settings: **it does not claim actual Auth/PostgREST, device, provider or query-cost proof**. The inherited B3 setup's own Auth tests remain separately scoped evidence.

Local validation passed: YAML parsing, five Bash run-block syntax checks, four embedded Node script syntax checks, candidate/predecessor body hash checks and nine report markers. No local Docker, psql or Supabase CLI is available; therefore no local SQL runtime success is claimed. The root integrator owns committing/pushing and CI dispatch; no commit/push was made by this proof worker.

Candidate SHA256: `a3bef95c68b38a57b51a1509edabe1385999577516123c504061e1fa54048182` (unchanged). Candidate new normalized body MD5: `602113d52d64c775893752ff74bfc324`. The proof and workflow hashes are captured from their exact committed bytes by CI.

## Client contract after approved application

Call the same endpoint with `{p_bbox:null,p_filters:{needId:<UUID>},p_limit:1,p_before_at:null,p_before_id:null}`. The UUID string accepts canonical upper/lowercase text, without whitespace. `needId` cannot be combined with any search filter, bounding box or cursor. The response remains `{items,hasMore,asOf}`: zero or one allowlisted public row, `hasMore:false`, and a valid server timestamp. Both exact and ordinary items now include positive integer `revision`. Public visibility, row-level security and the ordinary projection stay authoritative; a missing row does not authorize a private fallback or invented map point.

Current client work needed, read-only reviewed here:

- `src/data/supabaseIzvor.ts`: add a dedicated exact lookup port using the shared public projection/enrichment; preserve `revision` (currently dropped by `openTaskRow`), validate the response bound, exact ID, `hasMore:false`, timestamp and positive revision. Keep AbortSignal and account/accountRevision fences before/after RPC and enrichment. Do not walk the ordinary 25-page loop for publication landing.
- `src/data/ports.ts` and the other source implementations: provide the same exact lookup contract and distinguish an empty public result from transport/validation failure.
- `src/app/(app)/zadaci.tsx`: replace publication's full-list refresh/find with the one-ID read. Require a matching public ID and `revision >= handoff.needRevision`; a newer public revision is legitimate, an older one cannot prove the publication. Keep existing focus/background/account/source ownership, later-user-intent retirement, one-shot consumption and retry fences. Merge the proven public row into the map/list dataset by ID if the current ordinary page lacks it; retain existing task cards. Remote/point-free results use the list path. Current `publicationHandoff.ts` already binds the canonical publication to account revision and rejects route parameters without its in-memory receipt.

This package closes neither overall Discovery paging/count/query cost nor the native publication journey. Current client remains compatible with the predecessor; unapproved exact-ID calls must not be enabled on DEV.

Supabase's [database-function guidance](https://supabase.com/docs/guides/database/functions) was checked for invoker/search-path/ACL behavior. The [changelog](https://supabase.com/changelog) and [September PostgreSQL minor-release notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) were reviewed; this candidate does not create extensions, operators or indexes.

# Round72 — P6-03 world boundary through the readers, and the RLS helper's cost model

Status: **PENDING CI RUN.** Source only: the proof, its workflow and this record are written; nothing below is a result until the workflow has run and its
receipt is quoted here. P6 stays OPEN. Nothing here touches canonical DEV, the rollout candidates or any existing proof/workflow.

## Why this exists
Master plan row **P6-03** (`docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html`, the P6 table): "check the visibility semantics — REAL/TEST/OPERATOR,
unclassified and closed account, anon, owner/participant and a non-private result; output: equality/negative tests against the old rule, plans/BUFFERS in the
relevant roles; stop: no acceleration by removing RLS or widening private reads." An independent server review of the rollout applied to canonical DEV on
2026-09-30 (`supabase/candidates/p6_discovery_rollout_v3.sql`, blob sha256 `ec92c2ee…cecc9`) found two gaps that the existing proofs leave open:

1. **The REAL/TEST boundary was never exercised end-to-end with real rows.** Every runtime fixture so far (`p6_load_30k.sql`, the P0/round proofs) holds two
   unclassified accounts, i.e. two REAL accounts in the same world; canonical DEV holds only TEST-world accounts (`p6_rollout_v3_live_observation.json`:
   `accountVisibilityWorldCounts {TEST: 5}`); and the only semantic check of v3 is the in-transaction truth table at candidate lines 602–615
   (`private.accounts_same_world` against the helper set, all account pairs). The v3 proof's limits text says real-client behaviour "is covered by the separate
   native journey" — for the world boundary that is not true: the native journey runs against a restricted disposable server with one world.
2. **The helper's cost model is unmeasured.** `rls_private.p6_discovery_test_world_accounts()` (candidate lines 548–558) is
   `select array_agg(l.account_id) from private.account_lineage_v5 l where private.account_visibility_world(l.account_id)='TEST'`: one nested SECURITY DEFINER
   classifier call per lineage row, referenced by `needs_public_discovery` as an uncorrelated InitPlan (lines 568–577), i.e. evaluated once per statement on
   every authenticated read of `public.needs`. Canonical DEV has 5 lineage rows; production could carry many `REAL_USER` rows, every one of which is scanned
   and classified only to be excluded. Round71 measured the deployed composition with the 5-row table and said so in its limits.

## What was built (ownership: this session, files only)
- `supabase/proofs/discovery/p6_world_boundary_proof.mjs` — Node ESM, psql via `spawnSync`, the same admission, catalog, apply and receipt patterns as
  `p6_rollout_v3_candidate_proof.mjs`. `node … --print-sql` prints the generated SQL of every stage without touching a database (review aid).
- `.github/workflows/p6-world-boundary-proof.yml` — the v3 workflow's structure, pinned actions, live79 reconstruction, historical replay through PKG045b in
  its P0 form (`p0aware045`), teardown and upload; its own name, concurrency group and triggers (only its three files); `timeout-minutes: 240`.
- this record.

## Target and fixture
The disposable target is exactly the v3 proof's: live79 + the replays pkg027…pkg042 (the pkg029 replay applies PKG-029e, so the classifier treats
`OWNER_PERSONAL`/`OWNER_BUSINESS` as TEST, as on canonical DEV) + the P0-aware PKG045b restriction. Preconditions asserted before anything is seeded: P6 absent,
helper absent, whole-table `needs` SELECT revoked from authenticated and anon, the three internal columns unreadable, certificate = erasure = digest and ready,
6 `needs` policies whose `needs_public_discovery` / `v5_closed_account_visibility` predicate md5s equal canonical DEV's recorded values, the legacy reader in its
P0 form (body md5 `602113d52d64c775893752ff74bfc324`, SECURITY INVOKER, no anon EXECUTE).

Accounts (`auth.users` rows created the way `seedDevShapedLineage` creates them; lineage rows inserted directly into `private.account_lineage_v5`, the same
route the v3 proof and the Round71 harness use):

| key | lineage | world on DEV (PKG-029e) | world with PKG-029e taken back | owns tasks |
| --- | --- | --- | --- | --- |
| ownerPersonal | OWNER_PERSONAL | TEST | REAL | yes |
| ownerBusiness | OWNER_BUSINESS | TEST | REAL | no (viewer) |
| qa | DEV_ACCEPTANCE_QA | TEST | TEST | yes |
| fixtureA | SYNTHETIC_ACCEPTANCE_FIXTURE | TEST | TEST | yes |
| fixtureB | SYNTHETIC_ACCEPTANCE_FIXTURE | TEST | TEST | no (viewer) |
| realUser | REAL_USER (row inserted after the rollout, see order) | REAL | REAL | yes |
| unclassifiedOwner | none (UNCLASSIFIED) | REAL | REAL | yes |
| unclassifiedViewer | none (UNCLASSIFIED) | REAL | REAL | no (viewer) |

The five lineage rows present at apply time are exactly canonical DEV's shape (OWNER_PERSONAL 1, OWNER_BUSINESS 1, DEV_ACCEPTANCE_QA 1,
SYNTHETIC_ACCEPTANCE_FIXTURE 2; asserted against `p6_rollout_v3_live_observation.json`). Every owner gets seven tasks inserted the way `p6_load_30k.sql` inserts
them (`session_replication_role=replica`, the loader's column list plus `remaining_search_closed_at`): PUBLISHED with a public point, PUBLISHED without a point,
PUBLISHED REMOTE, SELECTION with a point (all four discoverable), and a DRAFT (`published_at` null), a CANCELLED, and a PUBLISHED task whose remaining search is
closed (all three must never appear). TEST-lineage owners sit around Beograd, REAL owners around Novi Sad, with a per-world locality (`… TEST kvart …, Beograd` /
`… REAL kvart …, Novi Sad`). Every description carries a random private token; every point task has a `public.need_sensitive` row whose exact address carries a
second random token.

**Order matters and is deliberate:** accounts (5 lineage rows) → tasks → apply the deployed rollout (its truth table is quadratic in lineage rows and must
see the DEV shape) → cost at the DEV shape → insert the REAL_USER lineage row → boundary assertions (current classifier, then the changed classifier) → anon →
bulk lineage rows → cost at 10 000 and 100 000.

## What is asserted (each failure names the viewer, the scenario and the check)
For **each of the eight viewers**, impersonated as every existing proof does (`set local role authenticated`, `request.jwt.claim.sub` and
`request.jwt.claims`), RLS active, in one transaction that is rolled back:
1. `rpc_discovery_v1` PAGE (scope ALL, empty filter, limit 100, every page through `anchor`/`nextCursor`) — the id set equals, as a set, the **old rule**:
   `private.accounts_same_world(requester_account_id, viewer)` over every discoverable row of the whole table, evaluated as postgres; no id repeats across pages.
2. The legacy reader `rpc_list_open_tasks_v3` (no bbox, `{}` filters, limit 200, every page through `sortAt`/`id`) — the same set equality against the old rule,
   hence PAGE = legacy for every viewer (the plan's "equality against the old rule").
3. On the fixture: exactly the discoverable tasks of the viewer's world (computed from the plan's lineage rule in JS, without the database); no task of the other
   world; no DRAFT / CANCELLED / closed-remaining-search task; an owner sees its own published tasks.
4. `counts.listed`, `counts.mapped`, `counts.withoutPoint` of PAGE equal the viewer's own totals.
5. MAP over `[-180,-90,180,90]`: `counts.mapped` / `withoutPoint` equal the viewer's totals; the sum of bucket task counts equals the visible tasks with a point;
   every TASK bucket names a visible task; every bucket point is a visible task's point; `wholeBounds` equals the visible points' bounds; every CLUSTER
   `memberBounds` lies inside them; at most 256 buckets. (Both worlds fall into the same 16×16 world-grid cell, so a cross-world merge would show.)
6. PLACES (no prefix, no facet area, every page): the `{key: count}` facets equal the viewer's own localities (recomputed with `public.p6_discovery_key` /
   `public.p6_discovery_area` as postgres); `counts.everywhere` equals the viewer's total; `inArea` is null for scope ALL.
7. EXACT_PUBLIC: a same-world task is found (one item, that id); a cross-world task, a cross-world remote task, and the DRAFT / CANCELLED / closed task of the
   viewer's own world (for owners: their own DRAFT too) answer **an empty `items` list** with the ordinary six top-level keys
   (`asOf, hasMore, items, mode, nextCursor, version`) — never a hollow item; the legacy exact landing (`{"needId": …}`) agrees.
8. Nothing private crosses: every item key of both readers is in the 33-key public projection; no key matches
   `account|description|close_reason|closed_by|exact|sensitive`; no answer text of any mode contains any fixture account id, the description token or the exact
   address token.

Across viewers: the union of what everybody sees covers exactly the 20 discoverable fixture tasks and none of the 15 hidden ones; TEST and REAL viewers share no
task; an explicit `REAL_USER` and an unclassified account see the same REAL world; on DEV's classifier the owner lineage sees the TEST world (PKG-029e).

**Changed classifier** (what taking PKG-029e back looks like, the v3 proof's `HELPER_FOLLOWS_A_CHANGED_CLASSIFIER` now taken through the readers): inside one
transaction `private.account_visibility_world` is redefined to its PKG-015B list and all eight viewers are re-run with the same eight checks (the old-rule and
plan-rule oracles follow the change by construction); additionally the owner-world tasks are seen by every REAL viewer (unclassified, REAL_USER, and the two
owner accounts themselves) and by no TEST viewer, and an owner-lineage viewer sees exactly the REAL world; the transaction is rolled back and the helper set is
shown unchanged afterwards.

**Anon** (`set local role anon`, one psql session per call): the six P6 helpers, `rpc_discovery_v1` (EXACT_PUBLIC and PAGE), the RLS helper, the legacy reader
and a direct `select count(*) from public.needs` are all refused with SQLSTATE **42501**. **Authenticated without a JWT**: `rpc_discovery_v1` and the legacy
reader raise `AUTH_REQUIRED` (28000); the direct table read is 42501 (PKG045b).

**Apply readback**: certificate/erasure/digest and the Need ACL unchanged; 6 policies; `rpc_discovery_v1` body md5 `1c60224483697732c496df5b9207f08f` and the
helper definition md5 `4ee16169f4ee6ba7f79f4bd11b172ad8` — the values canonical DEV read back after the apply (Round71's admission constants) — so the local
stack under test is the deployed one; every P6 function SECURITY INVOKER, `search_path=pg_catalog`, authenticated-only; the helper the one SECURITY DEFINER.

## The cost measurement (GAP 2) and how to read its table
Sizes: the DEV shape (5 lineage rows, measured right after the apply and before the REAL_USER row), then 10 000 and 100 000 rows (REAL_USER rows in bulk,
10 000 per transaction, `auth.users` first so the FK holds, the profile trigger active, then the lineage rows; `analyze` before measuring). At each size, in one
backend, server-side `clock_timestamp()` around each call, 3 warm-ups then 15 samples (median, min, p95, max reported):

| column | what is timed | role |
| --- | --- | --- |
| helper | `select rls_private.p6_discovery_test_world_accounts()` | postgres (the SECURITY DEFINER body runs as its owner either way) |
| scan | `select count(*) from private.account_lineage_v5` — the pure scan, to separate the per-row classifier call from reading the table | postgres |
| page | one `rpc_discovery_v1` PAGE, limit 50, empty filter, scope ALL | the unclassified (REAL) viewer, RLS active |
| legacy | one `rpc_list_open_tasks_v3` page, limit 50 (1 warm-up + 5 samples, because at 100 000 rows it is the slowest call) | the same viewer |
| plan | `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` of the helper's body query, once per size | postgres |

Functional assertions during the measurement (these do fail the proof): the helper's cardinality stays the five TEST-world accounts at every size; the REAL
viewer's `counts.listed` stays its expected total. **Timings never fail the proof.** Environment recorded: Postgres version, `jit`, `work_mem`,
`shared_buffers`, `max_parallel_workers_per_gather`, CPU model/count from `/proc/cpuinfo`, runner name, lineage relation size.

How to read it: if `helper` grows roughly ×2 000 from 5 to 10 000 rows and ×10 from 10 000 to 100 000 while `scan` stays small, the cost is linear in the number
of lineage rows and dominated by the per-row classifier call, not by I/O. `page` should exceed `helper` by about two helper evaluations (the policy references
the helper in two uncorrelated sub-selects; one scan of `needs` in PAGE), `legacy` by up to six (three `union all` scans of `needs` in the legacy list branch, RLS
quals evaluated before the parameter-only branch predicates) — the ratios `page/helper` and `legacy/helper` at 100 000 rows are the observation; the plan JSON
shows the Seq Scan, the filter's per-row function call and the buffers touched.

Recommendation (analysis only; NOT written, NOT applied, no candidate): the classifier is today a function of the lineage value alone
(`private.account_visibility_world` → `private.account_lineage` → the row's `lineage`), so a set-based equivalent needs no hard-coded lineage list: probe the
classifier once per **distinct lineage value present** through one representative account of that value (`select distinct on (lineage) lineage, account_id …`),
keep the lineages whose representative classifies TEST, and aggregate `account_id` for rows whose `lineage` is in that set (with an index on `lineage`, an
index scan over the TEST rows only). That evaluates the classifier ≤ 6 times per statement instead of once per row, stays derived from the classifier by
construction, and would need its own truth-table proof and a formal candidate (P6-05), because it changes the rollout's helper body.

## What this does NOT cover (read before quoting)
- Disposable local target only; canonical DEV is neither read nor written. No PostgREST/HTTP, no native client, no OPERATOR lineage (absent on canonical DEV),
  no closed/restricted viewer account (the `v5_closed_account_visibility` predicate is present but not exercised with a closing account here).
- The bulk rows are inserted directly, not through `rpc_admit_account_lineage_service`; the service writer's own behaviour is PKG-015's proof.
- Timings are one warm backend on a GitHub runner; no concurrency, no cold cache, no hosted-project measurement, no SLA. The DEV-shape row is measured before the
  fixture's REAL_USER lineage row exists (5 rows exactly), the larger sizes include it.
- The old-rule oracle includes any rows the replayed target already held; a pre-existing row with a future `published_at` would make the legacy reader differ
  from both oracles (the legacy reader has no `published_at <= now` predicate; P6 has) — that would be a real discrepancy, reported as a failure, not hidden.

## Places where the proof could need a CI iteration (guesses made explicit)
- **Bulk seeding time:** 100 000 `auth.users` rows run the profile trigger (`handle_uskoci_auth_user_created`: `app_accounts` + two `app_profiles` rows each,
  with their guard triggers). The v3 proof creates 5 such rows the same way; 100 000 is untested. Each 10 000-row transaction has a 45-minute psql budget and
  the job 240 minutes. If CI shows it too slow, the fallback is `session_replication_role=replica` for the bulk `auth.users` rows only (the lineage FK still
  holds; nothing reads their profiles) — a documented change, not applied blind.
- **Measurement time at 100 000 rows:** 18 helper calls + 18 PAGE calls + 6 legacy calls; if the per-row classifier cost is far above the estimate the 90-minute
  psql budget of one measurement call would be hit (`P6_WB_SQL_REFUSED` with `signal: SIGTERM` in the receipt). Reduce `SAMPLES` only with a note in this record.
- **`EXECUTE 'explain …' INTO plan`** inside a DO block: EXPLAIN's single JSON row is captured as text; if the local Postgres refuses it, the stage
  `HELPER_COST_DEV_SHAPE` fails with the SQLSTATE in the receipt and the EXPLAIN moves to its own psql call.
- **Pre-existing rows on the replayed target:** the proof tolerates pre-existing lineage rows (the helper-cardinality assertion adds the pre-existing TEST-world
  count) and pre-existing needs (oracles are computed over the whole table); it assumes none of them has a future `published_at`.
- **DO blocks as `authenticated`/`anon`:** the 30k harness already runs DO blocks as `authenticated`; anon calls are single statements, no DO needed.

## Result
**PENDING CI RUN.** When the workflow has run: record the run id, source sha, `stages.txt`, the receipt `p6-world-boundary-receipt.json` (public artifact) —
`result`, `worldBoundary`, `changedClassifier`, `anon`, `authenticatedWithoutJwt`, `postApply`, `environment` and the `helperCost.rows` table — here, and update
`docs/control/redovi.json` through the documented registry procedure; the HTML plan is a projection.

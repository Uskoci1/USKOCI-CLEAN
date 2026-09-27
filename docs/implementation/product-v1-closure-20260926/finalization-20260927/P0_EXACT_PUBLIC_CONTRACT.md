# P0 exact public landing contract — 2026-09-27

Status: **REVIEWABLE SOURCE ONLY / NOT APPLIED / NOT EXECUTED / NOT CLIENT-WIRED**. This prepares one bounded lookup for a task just published. It is not the complete Discovery server-filtering, map-cluster, count or growth package.

The existing P0 client continues to use its completed public-list read. Round 03 client work is separate in commit `a1fe01e4edf7d91da4dcb6a02d55500cc82982bb`. No existing client file, applied migration, control file or P3 file is changed by this candidate package.

## Files and concrete problem

- `supabase/candidates/discovery_p0_exact_public_landing.sql`: replaces one existing invoker function after exact predecessor/certificate checks.
- `supabase/proofs/discovery/discovery_p0_exact_public_landing_proof.sql`: unexecuted disposable proof source, with an old-body behavioral oracle and synthetic fixture rollback.
- This document: contract, publication integration boundary, evidence and deferred verification.

The review route already confirms an owned task at the published revision and creates an account-revision-bound in-memory handoff. Discovery then waits for a fresh public collection and finds that ID in the collection (`pregled-zadatka.tsx:102`, `publicationHandoff.ts`, `zadaci.tsx:93`). When Discovery eventually returns only its first page, a real task outside that page cannot be called missing. Looking up its exact public item avoids downloading preceding pages just to establish the landing target.

The existing `rpc_read_task(uuid)` is not that public-membership proof. It selects by ID under RLS, which can admit an owner's draft/history, and returns the richer detail projection. The candidate uses the same public-list predicates and the same public-list JSON builder for normal and exact reads.

## Pinned predecessor and provenance

Canonical DEV project: `leqcwgzvjsxugfgzdmth`. Exact function:

`public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamp with time zone,uuid)`.

The latest read-only catalog observation was at **2026-09-27 07:12:19.517218+00**, returned by server `statement_timestamp()` through the connected Supabase metadata tool.

| Hashed source | MD5 |
| --- | --- |
| Full stored predecessor definition, `md5(pg_get_functiondef(oid))` | `8a47d061da5f9bd65b5e3cc6c947d5d7` |
| Predecessor `pg_proc.prosrc`, CRLF normalized to LF | `18b5518140c519b96728d1e25fa3c29d` |
| Prepared candidate function body, normalized source bytes; **not deployed** | `602113d52d64c775893752ff74bfc324` |

The two predecessor hashes cover different representations of the same function. The body matches `supabase/operations/dev-alpha/ledger/20260922_pkg045a_application.receipt.json` and `supabase/candidates/pkg045a_task_read_contract.sql`. The candidate was derived from that exact stored-body source; its hash was calculated from file text, without parsing or executing SQL. Any later source change must update the candidate's postcondition hash and this evidence.

A separate read-only observation at **2026-09-27 07:15:49.678028+00** confirmed `public.rpc_read_task(uuid)`: full-definition MD5 `abd68dacd327eeb6bd65956ed38db661`, normalized-body MD5 `1e01db5140248f27ab374187f01fded3`. That function is unchanged.

No task/account records, secrets or server-side files were read during preparation. No fresh closure-readiness execution or whole-project attestation is claimed by the catalog reads.

## Additive request and response

Suggested future client call, only after the server contract has been separately authorized, proven and applied:

```ts
rpc_list_open_tasks_v3({
  p_filters: { needId },
  p_limit: 1,
  p_bbox: null,
  p_before_at: null,
  p_before_id: null,
})
```

The `needId` key selects an exact-landing mode. It is deliberately exclusive, so this small package does not pretend to define arbitrary combinations with search filters.

| Input | Result |
| --- | --- |
| A canonical hyphenated UUID string; uppercase hex accepted | At most one matching public item |
| Unknown ID, RLS-invisible task, draft/history, unpublished or remaining search closed | `items: []`, `hasMore: false`; no distinct existence/reason disclosure |
| Null/non-string/malformed/whitespace-padded UUID | `INVALID_FILTER` / `22023` |
| `needId` plus any other filter key, even a normally valid key | `INVALID_FILTER` / `22023` |
| `needId` plus any non-null bbox | `INVALID_FILTER` / `22023` |
| Only one cursor field supplied | Existing `INVALID_PAGE` / `22023` |
| A complete cursor pair supplied with `needId` | `INVALID_FILTER` / `22023` |
| Limit outside existing 1–200 range, including null | Existing `INVALID_PAGE` / `22023` |
| Any valid limit in exact mode | Still at most one item and `hasMore: false` |
| No `needId` key | Existing list/map/filter/cursor behavior, plus additive row revision |

All returned items gain `revision: n.revision` in the existing shared JSON builder. ID, revision, point, status and other facts therefore come from the same statement. The envelope remains `items`, `hasMore`, `asOf`. `asOf` is still a statement timestamp, not a multi-page snapshot token.

## Query, authority and privacy boundaries

Normal list and bbox branches retain their filters, bounds behavior, `published_at DESC,id DESC` order, cursor predicate and page limits. Parameter-only gates disable them only when exact mode is active. The third branch uses `m.id = v_need_id`, the existing valid primary key and `LIMIT 1`; it admits only:

- status `PUBLISHED` or `SELECTION`;
- non-null `published_at`;
- null `remaining_search_closed_at`;
- whatever the existing authenticated RLS policies allow.

The one shared JSON builder preserves public approximate coordinates and point-free records. This package does not generate coordinates, expose descriptions/private addresses/account IDs, change accepts-applications semantics or broaden the owner's relationship authority. A full task can remain discoverable under current server behavior; the existing application guard still decides whether a response may be submitted.

The function remains STABLE, SECURITY INVOKER, `search_path=pg_catalog`, with the same owner and exact ACL. There is no new table, column, index, policy, function signature, grant or dependency. Logical exact-ID output is bounded by the primary key; planner cost and runtime latency remain unmeasured.

Before replacement, the candidate requires the exact prior definition/body, existing reader security envelope, a valid single-column primary key on `needs.id`, a ready closure certificate and equal source/erasure certified digest. After replacement, it requires the exact new body and unchanged owner/ACL, closure source digest, both complete certificate rows and readiness-function definition. It never rewrites a certificate or readiness constant. Any drift raises an exception and rolls back the candidate transaction.

## Future P0 client boundary

No wiring is included. When separately authorized, the client should retain the current trusted publication handoff and require:

1. The same account ID/revision and current focus before and after the lookup.
2. A valid exact-mode envelope containing exactly the handoff task ID and expected task revision before claiming that publication's public landing.
3. The returned public point alone for the map; point-free work remains in the existing list flow.
4. Deduplication against any ordinary page containing that ID. A selected/landing row is not permission to add one to a server total count.
5. Existing missing/error/owned-detail recovery when the row is absent, the revision differs or the read fails. No inferred pin and no republish.
6. The existing one-shot camera acknowledgement and retirement behavior.

A later concurrent edit/closure can change visibility immediately after the read. This contract proves the item's public projection at that statement, not permanent membership. A revision mismatch must not silently use a stale owner handoff as proof of newer facts.

## Proof source and execution boundary

The proof has **not been run**. It requires an explicit disposable flag and psql connection metadata fixed to `127.0.0.1:54322/postgres` as `postgres`. It refuses different settings. It must only run against the existing isolated replay with the exact canonical predecessor; it does not build, reset, provision or connect to canonical DEV.

When execution is separately authorized, the source is designed to:

- retain the untouched predecessor as a session-temporary invoker oracle;
- replay the exact candidate file, including all its pre/postconditions;
- compare ordinary list, category/price/remote/time/urgent, bbox and second-page output to that oracle, stripping only the additive revision and per-call `asOf`;
- create 205 recent filler rows and an older target, proving the target is absent from a full first page but exact landing returns its same public item and revision;
- cover pinned, remote, other point-free and SELECTION tasks, missing IDs, closed search, draft/history even for the owner, other-world isolation, unsigned callers, anonymous execute denial and incompatible/malformed inputs;
- assert no extra private fields, no invented point, exact 0/1 results for limits 1 and 200, and unchanged certificate/digest/security envelope before and after the fixture phase;
- roll back all synthetic fixture rows and restore the original reader on successful completion.

The fixture transaction is rollback-only. The candidate is replayed verbatim with its own commit on the disposable database, then restored after successful assertions. **An early proof error may leave the candidate on that disposable database.** Discard that environment; never use this proof's restore section against canonical DEV. Session-temporary oracle/helpers are not product functions.

This SQL proof is not real Auth/PostgREST, query-plan/cost, native, provider, certificate execution, 1,000+ load or whole-product acceptance. Those checks remain separately gated. Source review cannot establish that the proof parses or passes.

## Current review state and next step

Only file-text/source review and source hash calculation occurred. Root and the independent P3 agent reviewed the prepared source. Two findings were corrected:

- The proof's remote fixture used null location text, but `needs.approximate_city` and `approximate_area` are NOT NULL. It now uses empty strings and retains null coordinates. Replica mode does not bypass those constraints.
- Candidate/proof readiness guards now use `IS DISTINCT FROM TRUE`, so an unexpected null readiness result also refuses the operation.

P3's completed source review found no further concrete defect in exact-mode validation/error precedence, mutually exclusive query branches, shared public projection/revision, invoker/ACL/certificate checks, old-body parity oracle, second-page target, exclusion/world fixtures or successful restore. Root also reviewed the exact branch/projection. The corrected files are frozen for integration. These source-only corrections do not change the candidate function body or its recorded MD5; parsing/runtime/query cost remain unverified.

No migration was added to the frozen applied inventory, no workflow or proof was dispatched, and no DEV/Edge/provider data or configuration was changed. This is **NOT READY FOR APPLY**. The next decision is review of this concrete contract; subsequent proof execution, client wiring, forward migration promotion and canonical application remain separate authorized steps.

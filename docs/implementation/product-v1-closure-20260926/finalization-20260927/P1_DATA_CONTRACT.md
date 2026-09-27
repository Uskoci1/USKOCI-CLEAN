# P1 Discovery data contract — 2026-09-27

Status: **CLIENT SOURCE PREPARED / VERIFICATION NOT RUN**. The bounded client change refuses malformed or non-progressing pages instead of presenting a partial or duplicated result as complete, and binds the entire read to its starting account revision. Server-side search, paging/count parity and growth remain open. No appearance or approved navigation changes belong to this patch.

Baseline: `6bf4e0a06b870d5277cef9b0011c6ac76dacb05c` in the existing integration checkout. Root owns the concurrent presentation performance work. This note and the Discovery reader section of `src/data/supabaseIzvor.ts` are this subtask's only edits.

## Evidence and boundaries

Read AGENTS, PLAN, ROUND_02_P0 and the Supabase skill. Fresh canonical DEV metadata was read through the connected Supabase tool for project `leqcwgzvjsxugfgzdmth`: function names/signatures, `pg_get_functiondef`, function settings/grants, and the two existing index definitions. No application RPC was executed, no task/account data was selected, and no key, secret or server-side file was read. No SQL, migration, Edge, dependency or provider mutation occurred.

The live public reader is:

```text
public.rpc_list_open_tasks_v3(
  p_bbox jsonb = null,
  p_filters jsonb = {},
  p_limit integer = 50,
  p_before_at timestamptz = null,
  p_before_id uuid = null
) -> jsonb
```

| Metadata | Fresh observation |
| --- | --- |
| Latest metadata observation | `2026-09-27 07:12:19.517218+00`, server `statement_timestamp()` |
| Exact identity | `public.rpc_list_open_tasks_v3(jsonb,jsonb,integer,timestamp with time zone,uuid)` in canonical DEV `leqcwgzvjsxugfgzdmth` |
| Definition MD5 (`md5(pg_get_functiondef(oid))`) | `8a47d061da5f9bd65b5e3cc6c947d5d7` |
| Body MD5 (CRLF normalized to LF) | `18b5518140c519b96728d1e25fa3c29d` |
| Security / volatility / search path | INVOKER / STABLE / `pg_catalog` |
| Execute grants checked | `anon=false`, `authenticated=true`; function also requires non-null `auth.uid()` |
| Page range | 1–200; both cursor fields supplied or neither |
| Sort and next-page predicate | `published_at DESC, id DESC`; tuple strictly less than the prior tail |
| Output envelope | `items`, boolean `hasMore`, `asOf=statement_timestamp()` |
| Existing indexes | Partial GiST on `approx_geog`; partial btree on `(published_at DESC,id DESC)`, both predicate `status IN ('PUBLISHED','SELECTION')` |

These are two different digests of the same function, not contradictory versions: `8a47...` hashes the full `pg_get_functiondef` output (signature, options and body), while `18b...` hashes only `pg_proc.prosrc` after CRLF normalization. Both were re-read together at the timestamp above through the connected Supabase `execute_sql` metadata read, using the exact `regprocedure` signature. The body digest agrees with the recorded PKG-045 receipt; the definition digest agrees with ROUND_01. No fresh index validity, query plan, query cost, closure-certificate or full server security audit is claimed. The narrowly named search/open-task/count catalog inventory found the existing reader and `rpc_close_remaining_search`; that mutation was not called.

The Supabase changelog and its September 25 PostgreSQL upgrade notice were reviewed. This package neither upgrades PostgreSQL nor recreates extensions/operators. That documentation read is not a compatibility certification of the live project. References: [changelog](https://supabase.com/changelog.md), [PostgreSQL upgrade notice](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).

## Round 13 update — 2026-09-27

`ROUND_13_PUBLICATION_AND_READ_LIFETIME.md` supersedes the historical cancellation and deferred-client-check statements below: the two Discovery read ports now accept an optional signal, propagated through pages, relationship batches and optional enrichment. Blur, background and the existing timeout retire the reader. Focused checks are recorded in `ROUND_13_CHECKS.json`. The collection contract, missing server predicates/counts/facets and deferred native/load acceptance below remain open; cancellation does not turn the full collection walk into bounded Discovery.

## Current source of truth

1. `src/data/ports.ts:50` still exposes `otvorenePrilike(): Promise<PrilikaProjekcija[]>`, a completed collection, with no cursor/count input or output.
2. `src/data/supabaseIzvor.ts:178` reads keyset pages of 200 with only limit and cursor arguments. It passes neither `p_bbox` nor `p_filters`. At most 25 pages can complete; needing page 26 raises `OPPORTUNITIES_TOO_MANY_PAGES`, never a successful first-5,000 subset. Profile/urgency hydration follows the page walk.
3. `src/app/(app)/zadaci.tsx:68` has the existing 15-second resource read and recovery. Its independent relationship read at line 111 changes labels/destinations, not public membership or counts. The complete loaded ID set is supplied to relationship batches, not just the native visible rows.
4. `src/data/marketplaceView.ts` owns the shared local predicates and public geography. Search is Serbian-locale lowercase substring over title, area and requirements. Price, execution mode, known remaining places, chosen public locality and task-local time/date overlap are local filters. Unknown capacity remains visible; unknown schedule does not match a selected day. A remote-only scope clears geographic restrictions.
5. `discoveryShown` derives map and list from that same filtered public collection. Map points stay independent of the current visible box. The list contains points in the area (or selected public point), followed by all point-free rows. No area means original read order. Root's concurrent memoization refactor preserves these semantics.
6. `DiscoveryPresentation` derives the visible count from the resulting list length, plus the existing in-area/point-free explanation. It is not a server market-total estimate. P0's publication ordering can move the proven public row first without changing membership/count.

## Prepared client patch

The page-envelope handling in `src/data/supabaseIzvor.ts` previously checked only that `items` was an array. Missing/nonboolean `hasMore`, or `hasMore:true` with an empty/malformed tail, could stop the walk successfully. Duplicated/non-progressing pages could also accumulate duplicate cards and counts before the 25-page refusal.

The prepared patch now:

- requires an object envelope, at most 200 rows, boolean `hasMore` and a valid exact `asOf` timestamp;
- refuses `hasMore:true` with no rows;
- validates every row's UUID and exact `sortAt` instant before the collection can reach hydration;
- requires strict descending `(instant, UUID)` order within and across pages;
- tracks normalized UUIDs to reject a repeated task even if its timestamp differs;
- retains `OPPORTUNITIES_RESPONSE_INVALID` and the existing read-error/retry presentation, plus the existing maximum-page refusal.

`calendarInstant` preserves PostgreSQL microseconds and offset equivalence. UUIDs are normalized for comparison; fixed-position hexadecimal UUID strings have PostgreSQL's byte order. No locale collation or millisecond-only `Date` ordering is used. The server's `asOf` is validated only as a timestamp; it is not treated as a snapshot token.

The reader also captures `sesijaSada().user.id` and `accountRevision` once at entry. An absent account refuses with the existing `AUTH_REQUIRED` code. The same identity is checked before and after each awaited page and before and after combined profile/urgency enrichment; a change refuses with the existing `AUTH_ACCOUNT_CHANGED` code. `src/store/sesija.ts` increments this revision on identity changes, including logout and A→B→A, but preserves it across token refresh. `safePublicProfiles` and `readNeedUrgencies` already retain account/revision guards for their internal requests; the new outer guard binds their start and final acceptance to the original page walk rather than whichever account is active after paging.

The existing route resource already suppresses stale results; this additional data-layer guard prevents further page/enrichment stages after a changed identity is observed. It does not abort an already dispatched HTTP request, and does not cancel an unchanged-account walk merely because the route's 15-second timeout or blur occurred. Those cancellation semantics need a separate scoped signal through the read port.

No filter is pushed to the server, no new successful/empty state is introduced, no page is silently discarded and no partial read is emitted. The real canonical response shape is unchanged. This does not validate every business field in a task projection or solve mutation-between-pages consistency.

## Missing server contract before genuine bounded Discovery

| Concern | Live contract and required next contract |
| --- | --- |
| Query | Whitelist contains only `category`, `priceMode`, `urgentOnly`, `remote`, `startsFrom`, `startsTo`. Add explicitly versioned query semantics with parity for current title/area/requirements matching and normalization. Filtering one returned page locally would miss matches on later pages. |
| Time | Current SQL compares `starts_at` only. Define task-timezone civil-day overlap for fixed windows, flexible/open-ended/end-only schedules and relative schedule kinds, including unknown-schedule exclusion/count. Existing `startsFrom/startsTo` is not equivalent. |
| Geography | Current bbox requires positive spans no larger than 5° longitude/3° latitude, and rejects antimeridian wrap/equal edges. SQL numeric predicates retain a 0.01° margin, unlike exact comparison with rounded public pins. Define broad/wrapped/edge behavior using the same approved public precision. |
| Point-free work | Current bbox requires a spatial point; an explicit remote filter with bbox must be `EXCLUDE`. The current UI keeps remote and other point-free tasks after local rows. A new contract needs separate local and point-free scopes with stable order/cursors and no duplicates, while remote-only discards geography. |
| Locality | Current `Gde` suggestions are loaded public area labels, normalized for spacing/case and counted under the other conditions. No current server locality/facet contract supplies these labels/counts independently of downloading all tasks. |
| Capacity and eligibility | No remaining-places predicate exists. Preserve unknown-versus-known capacity and current n-person filter semantics. `acceptsApplications` is returned but does not filter membership and is not consumed by this list mapper; application authority stays with the existing server guard. |
| Taxonomy | Existing category is a text equality predicate. Stable canonical taxonomy/subcategory/skills support is separate V1 contract work; do not infer node IDs from free text. |
| Count | Envelope has no total or approximate count. Specify `exact/approximate/unknown`, its filter/query version and whether it counts local, point-free or their union. Count and list/map membership must use one predicate definition. |
| Paging consistency | Keyset is stable in sort order, but `asOf` is per-statement and not accepted on later pages. Define snapshot/cursor lifetime, filter binding, concurrent publish/close/update behavior and stale cursor response. Page size or loaded-row count must not masquerade as market total. |
| Publication | Current P0 requires fresh public-row membership, while the public reader omits the owned task revision. A future bounded first page must retain an authorized exact-task public lookup/landing strategy; it cannot assume the published row falls on the current page. |
| Map and facets | The map presently represents all matching public pins while the list follows the visible area. Replacing the array with one list page requires a bounded pin/cluster projection and explicit offscreen/facet semantics; otherwise pins and filter suggestions disappear with pagination. |

Do not wire the current bbox/starts filters into the existing UI as a supposed transparent optimization. Their predicates and scope differ from the approved client behavior. The next server package needs a concrete predicate/cursor/count proposal, isolated proof and the owner's separate server approval before apply. This note does not create or approve that package.

## Deferred verification

Tests, TypeScript, build, device, provider and query-cost exercises were not run, per the owner gate. Historical passes do not cover this source. Static diff/source inspection is the only client review performed in this subtask; root's independent review is recorded separately.

When authorized, cover valid empty/one/multiple pages, null/nonboolean `hasMore`, true+empty, oversized pages, malformed rows/timestamps/UUIDs, within-page and cross-page ordering, equal-time UUID ties, equivalent timestamp offsets, distinct microseconds, duplicate IDs, 25 valid pages then more, and an error after an earlier valid page. Confirm no profile/urgency hydration or partial success after refusal, and route recovery uses the existing error state. Existing reader fixtures use non-UUID IDs (`need-1`) and the page-ceiling fixture repeats the same row; they must be made contract-valid before their intended assertions can run. No fixture was modified or test executed now.

Also cover signed-out entry, logout/account switch/A→B→A while a page is pending, and those changes while enrichment is pending. No later page or new enrichment stage may start after an observed change and no collection may return afterward. A token refresh with unchanged account revision must continue. Verify the pre-existing inner enrichment guards retire their own further reads, and the original collection cannot be returned even when optional enrichment otherwise degrades gracefully.

P1/P6 growth, 0/1/1,000+ server behavior and native map/list acceptance remain **OPEN / UNVERIFIED**.

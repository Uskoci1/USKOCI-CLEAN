# P6 bounded Discovery — proposed contract

2026-09-27. **CONTRACT ONLY / NOT IMPLEMENTED OR APPLIED.** Read P1_DATA_CONTRACT.md and current client/source SQL. This proposal replaces neither the running client nor an existing RPC. No DEV observation, query-cost result, performance readiness, certificate change or P0 deployment is implied.

## Decision

Use bounded live keyset pages, an independent bounded map projection, and paged locality suggestions. Fix the query and its time anchor for a browsing session; evaluate current public membership on each request. Counts describe current matching rows at their recorded observation time. They are not a promise that every page forms a database snapshot.

Do **not** hash every matching task, create a snapshot table, or invalidate every cursor when a city gains/loses a task. A market-content digest would require extra scanning and repeatedly restart a busy list. Only a changed request, expired anchor or incompatible contract invalidates its cursor.

## Proposed wire API

One additive `public.rpc_discovery_v1(p_request jsonb) -> jsonb`, with strictly validated modes below. Proposed implementation: `STABLE`, `SECURITY INVOKER`, `search_path=pg_catalog`, authenticated EXECUTE only, non-null `auth.uid()`, unchanged table RLS and column grants. No ownership, eligibility, ranking or urgency predicate is added.

Common request:

```ts
type Filter = {
  text: string;
  price: 'all' | 'MY_PRICE' | 'OFFERS';
  where: 'any' | 'onsite' | 'remote';
  places: number; // integer 1..10
  when: 'any' | 'today' | 'tomorrow' | 'week' | 'weekend' | 'next7';
  dates: null | { from: string; to: string }; // inclusive valid civil dates
  place: null | string; // normalized public locality, never a geocoder input
};
type Anchor = {
  version: 'DISCOVERY_V1';
  filterKey: string; // digest of normalized request only, NOT market contents
  timeAt: string;   // server time selected on first request
  publishedThrough: string; // same initial instant
  expiresAt: string; // proposed 30-minute browsing lifetime
};
```

First request has `anchor:null`. Continuations echo the returned anchor. Server validates its version, finite timestamp ranges, maximum lifetime and normalized filter binding. It is a consistency coordinate, not a permission token; every call still applies current RLS. Client cancellation and account/revision/focus ownership remain mandatory. Changing filters starts a new anchor. A map move changes the list scope/cursor but can retain the shared filter/time anchor.

| Mode | Additional input | Bounded output |
| --- | --- | --- |
| `PAGE` | `scope:ALL\|AREA(bounds)\|POINT_LIST(point)\|POINT_MEMBERS(point)`, `limit:1..100`, `after:null|{scopeKey,section,sortAt,id}` | Allowlisted public `items`, `hasMore`, `nextCursor`, counts below. Bounds are `[west,south,east,north]`; point is `{lat,lng}`. Each item includes public `revision`. |
| `MAP` | `bounds:[west,south,east,north]`, requested grid detail | At most 256 buckets covering the entire queried box, independent of list pages; effective grid detail, whole-filter public bounds and mapped/point-free counts. |
| `PLACES` | `prefix:string`, `limit:1..30`, `after:null|{count,key}`, optional `facetArea` | Public locality `key/text/count` rows, `hasMore/nextCursor`, and exact Everywhere / map-area counts under the shared non-geographic conditions. |
| `EXACT_PUBLIC` | `needId:uuid` only; no filter, anchor or cursor | At most one row from the same public predicate and allowlist, including revision, `hasMore:false`, `asOf`. It may not return a private owner row. |

All successful responses carry `version`, canonical `filterKey` where applicable, and `asOf`. Counts use `{kind:'exact_live', observedAt, ...}`. Failure yields no fabricated zero or complete page. No profile, avatar, relationship or optional urgency reads are needed to establish membership/counts. Those enrich only bounded displayed IDs afterwards.

`EXACT_PUBLIC` is a proposed mode in this new contract. It does not call or assume deployment of the P0 candidate. Existing publication landing is unchanged until a separately proved client integration chooses an available exact public reader.

## Predicate parity

| Current behavior to preserve | Server rule / proof requirement |
| --- | --- |
| Public membership | RLS-visible `needs`, status `PUBLISHED/SELECTION`, non-null `published_at`, null `remaining_search_closed_at`. Ownership and `acceptsApplications` do not exclude rows. |
| Text | Serbian-locale lowercase substring over the displayed title, public area text, skills/tools/vehicles joined with spaces. Preserve literal `%`/`_`, Unicode, whitespace and cross-field substring behavior; do not replace with token/full-text matching. Licenses/category are not currently in this search. |
| Public locality | Match `unwrapQuotes` + `podrucjeTekst`: remove only a valid outer quote pair, avoid repeating a city already present as a comma-delimited area component, preserve display text. `placeKey` trims, collapses whitespace and lowercases in Serbian Latin locale. Remote/no-location labels are not locality choices. PostgreSQL collation/case/whitespace parity needs disposable vectors before implementation is accepted. |
| Capacity | Use existing canonical covered-slots authority and `max(0, required-covered)`. A known count below `places` is excluded; unknown capacity remains visible and is never labelled sufficient. Current public mapper defaults required/covered to 1/0; the new typed wire must not silently reinterpret malformed values as unknown. |
| Work mode | `REMOTE` is remote; another named mode is onsite; null is unknown and matches neither explicit choice. Remote-only discards locality, viewport and chosen-point restrictions. |
| Time | Dates override `when`. Use each task's timezone, UTC only when absent. A complete interval overlaps civil days; a fixed start alone is one day, a flexible start alone is open-ended, a flexible end alone starts unbounded, and a fixed interval without a start is unknown. No endpoints: today/tomorrow/week use task-local anchor day; FLEXIBLE/REMOTE_ANYTIME match any day. `week` ends Sunday; weekend means remaining Saturday/Sunday, or only Sunday on Sunday; next7 includes anchor day plus six. |
| Midnight/unknown dates | Preserve current `calendarInstant` → floor-to-milliseconds → task-local day conversion, including end-at-midnight exclusion. Do not replace with `starts_at >= from`. Unknown schedules are excluded only for an active time filter, and counted separately. Test microseconds near midnight and DST transitions. |
| Map scope | Inclusive comparison against existing numeric(scale 2) public coordinates, without the old RPC's 0.01-degree margin. Accept broad boxes, equal edges and antimeridian wrap. Never read private/resolved pins. |

Counts for PAGE: `mapped` (shared conditions, before geographic list scope), `listed`, `inArea`, `withoutPoint`, and `undated` (otherwise-matching rows omitted solely by a selected time filter). ALL retains global publication order and no separate point-free section. AREA/POINT_LIST section 0 is matching public points and section 1 is **all** matching point-free work, globally, ordered within each section. Client normalization maps a chosen pinPlace to POINT_LIST even when an area is retained. No task belongs to both sections. POINT_MEMBERS is only the chosen-place sheet: its items/count contain that exact point's tasks, with no point-free rows; its cursor cannot be reused for POINT_LIST.

PLACES removes text/place/area/pinPlace while preserving time/work-mode/people/price conditions, then groups displayed public locality by `placeKey`. Display spelling comes from the newest matching `(published_at,id)` row, as the current ordered collection's first occurrence does. `prefix` searches the locality keys, independently of full task text. Sort count descending, then Serbian-locale display text, with normalized key as a deterministic final tie-break. Counts for Everywhere / facetArea use those same non-geographic conditions. Facet paging is live: count/rank changes can move a locality across the cursor; deduplicate keys and refresh the first facet page when conditions change. The selected locality remains removable even when no longer returned.

Global filter-availability flags (`hasKnownWorkMode`, `hasKnownSchedule`, present price modes) describe the anchored public collection before current conditions, matching the current UI's availability checks. They do not depend on the first list page.

## Live pagination and refresh

- Sort descending by exact `(published_at, id)` with UUID tie-break; retain timestamp microseconds. A geographic list cursor also carries its section and normalized scope key. A continuation strictly follows that tuple/section; it never uses OFFSET.
- `publishedThrough` excludes later publications until explicit refresh. It does not freeze task fields, capacity, visibility or deletions. Existing source resets `published_at` during edit-to-draft and assigns it again on republication: the key is stable within a publication, **not immutable for a task's lifetime**. A republished generation after the anchor is seen on refresh.
- Counts are freshly evaluated under the same filter/time/publication cutoff and current RLS on each response. Each response is internally coherent; different responses may disagree. “No more” means no later matching row at that request, not that the client accumulated the last count exactly.
- Withdrawn/closed rows can disappear; edits can enter/leave conditions or move a row between geographic/point-free sections. A row moving before an already-consumed cursor may be missed until refresh; a row moving into a later section may recur. Client deduplicates UUIDs within a traversal and rechecks public detail before acting. It does not repeatedly restart because of unrelated updates.
- Explicit refresh, filter application or anchor expiry starts at page one and replaces rows/counts together. A scope change resets that list cursor. Preserve scroll/selection only when still supported by fresh public results; never merge a new anchor into old pages. Counts do not equal loaded-row length during paging.
- Anchor expiry is a bounded restart condition, not a content-change condition. The proposed 30-minute lifetime must be finalized in the client integration; expiry is shown as refresh required, never an empty market.

## Map coverage and drill-down

MAP uses the shared predicate and publication/time anchor, **not** the PAGE result or its cursor. The box is camera bounds with agreed bounded overscan; each new camera query replaces that coverage. Whole-filter coarse bounds allow initial fit without downloading all tasks. Offscreen markers are obtained when their area is queried; absence outside returned coverage is not an empty-area claim. Remote-only returns no spatial buckets and keeps remote tasks in PAGE.

Choose a deterministic global grid detail whose intersecting cells cannot exceed 256 for the supplied box (wrapped boxes handled as two longitude intervals). Report any coarsening. Group all matching points in that box; never `LIMIT 256` raw pins and call it complete. Bucket anchor is the actual public/coarse point of the newest `(published_at,id)` member, not a centroid or invented task location.

- `TASK`: exactly one task, its public ID/point and bounded pin label fields. The ID is a task ID; a fresh exact public read supplies its card/details.
- `PLACE`: multiple tasks at one identical coarse point. Return the point/key and task count, **not** an array of all IDs. Tap requests bounded POINT_MEMBERS pages. “Show all in list” uses POINT_LIST, which also includes the global point-free section.
- `CLUSTER`: multiple distinct coarse points. Return actual representative point, task count, distinct-point count and member bounds. A cluster key is not a task ID. Tap zooms/queries finer coverage; it cannot open an arbitrary member. At maximum useful detail, identical points become PLACE.

The count is tasks, not buckets or known IDs. Native re-clustering must not sum one per bucket and display that as a task total. This is a new map wire adapter and requires separate native acceptance; no drop-in compatibility with today's full GeoJSON task array is claimed. Optional urgent/owner glyphs must not be inferred from the representative or from a partial overlay.

## Exact source dependencies and smallest next slice

Read dependencies, not an assertion of fresh DEV state:

- `src/data/marketplaceView.ts`: `marketplaceItems`, `workDays`, `whenDays`, `remoteDiscoveryScope`, `discoveryMapScope`, `placeSuggestions`, `undatedCount`.
- `src/lib/location.ts`: `unwrapQuotes`, `podrucjeTekst`; `src/lib/calendarTime.ts` and calendar presentation helpers for exact civil-time conversion.
- `src/ui/v2/DiscoveryPresentation.tsx` and `discovery/DiscoverySearchPanel.tsx`: count scopes, facet queries, whole-collection filter availability and point-free ordering. `DiscoveryMap.tsx` currently expects per-task features and native clustering.
- `src/data/supabaseIzvor.ts`: `openTaskRow`, `publicTaskContext`, coverage defaults; `needClientService.ts:readPublicNeedDetail` for the public schedule/location/capability contract.
- `supabase/candidates/pkg045a_task_read_contract.sql` public allowlist and PKG045b's column-grant boundary; frozen need-foundation columns and existing discovery RLS. `need_geography.public_topology` and `need_requirement_details.critical_conditions` remain under their existing RLS.
- `public.covered_slots(needs)` is the existing coverage authority (PKG045 pins normalized body MD5 `cbeb8f2a3da7d08965ef0386cfc437ba`). Do not replace it with caller-visible selection counts. Relationships remain `rpc_get_my_task_relations(uuid[])`, bounded to requested public/displayed IDs, separate from counts.
- P0 source is reference evidence for public revision/exact-ID projection only. This proposal neither requires its runtime deployment nor changes it. No PKG051/B3c dependency is introduced.

Smallest next implementation slice: a separate candidate/proof for the shared normalized predicates plus `PAGE`/`EXACT_PUBLIC`, keysets and live counts. Prove SQL results against current client fixture vectors before adding `PLACES` and MAP buckets to the same versioned contract. It remains unwired and is **not bounded Discovery completion** until facets/map coverage and their client adapter are proved. Root can keep P4 taxonomy/matching independent: no canonical categories, skills expansion, eligibility or ranking are added here.

Proof must cover 0/1/1,000+ rows, equal-time UUID ties and microseconds, every time kind/DST/end boundary, literal/Unicode text and quoted locality, unknowns, wrapped/equal/global boxes, point-free ordering, own/applied rows, changing capacity/visibility/geography between pages, republication, anchor expiry and filter/scope mismatch. Map proof must reconcile bucket task counts against the same filtered box without leaking private coordinates; dense same-point and sparse global data must both stay bounded. Assert existing functions, policies, grants, both closure certificates/digest/readiness and publications unchanged; roll back every disposable fixture.

Residual cost: bounded responses do not prove bounded database work. Exact counts, locality aggregation, per-task timezone predicates and coverage calls may scan or amplify work; existing publication/GiST indexes do not prove those paths cheap. Before any runtime adoption, capture EXPLAIN (ANALYZE, BUFFERS) on disposable sparse/dense/skewed 1k and larger fixtures, first/deep keysets, selective/unselective text/time filters, world/wrapped map scopes and concurrent changes. Record execution time, buffers, rows examined and coverage-call plans against the route deadline. A timeout/error stays unknown; no truncated map/facets or approximate count may claim exactness.

# Round70 — P6 native acceptance on the disposable restricted server (working document; completed at the end of the round)

Status: **IN PROGRESS.** P6 stays OPEN until every gate below is proven. This file is rewritten to its final form (with run ids, receipts and the
closing statement) only when they are.

## What the native journeys found, and what was changed

Journeys ran on a CI-hosted API-35 x86_64 emulator against a DISPOSABLE Supabase stack with PKG045b (P0 form) + the frozen P6 rollout +
visibility + PLACES layers (real local Auth, RLS on, statement log capture). Each defect below was invisible to Jest; each fix has a test that
fails on the previous source where the logic is testable in Jest.

| # | Native finding | Cause | Change |
| --- | --- | --- | --- |
| 1 | `DISCOVERY_V1_OWNER_MAP_COVERAGE_DRIFT` after a deep return or after clearing a filter | Postgres runs with `extra_float_digits=0`: numeric→float8→jsonb echoes 15 significant digits, so `decoded.coverageBounds !== request.bounds` | `wireBounds` (6 decimals) for everything sent and compared; the comparison uses the wire form |
| 2 | Server buckets never drew (`viewToBitmap ... must not be null`, an offscreen 0×0 container) | MapLibre RN 11.3.10 renders a `ViewAnnotation` child into a bitmap; a queued/early annotation loses layout on Android | One GeoJSON source `p6-buckets` with native layers (halo, discs, counts, marks); taps arrive as source presses |
| 3 | Dimmed empty screen with only the "Mapa" pill after the first open of the list and after a return | Gorhom bottom sheet 5.2.14: the `index` effect returns early while `animateOnMount` is set and the mount animation has not finished; nothing re-runs it, so a later detent request is lost | The P6 screen never uses `animateOnMount` (it is rebuilt on every return); the legacy first draw keeps it |
| 4 | Hundreds of PLACES/PAGE previews while the search panel was open | `mapArea` was a fresh array on every render, so the panel's draft effect fired again after every answer | The effect is keyed by the joined bounds; the search owner suppresses an identical asked key while loading or fresh (20 s) |
| 5 | A place applied from the search was read away | The presentation builds its next change on the view it was last handed, and the P6 view is committed one read behind | The view the person just asked for is handed back at once until its read settles |
| 6 | Cluster tap moved no list; markers stale after programmatic moves | No camera command for a P6 cluster; nothing re-read the buckets after a camera move that is not the person's | `openServerCluster` fits the members as the person's own move; a quiet `refreshMap` (tolerance 0.02) follows every other settled move |
| 7 | (journey #3) After a cluster tap the list kept its 100 tasks | The CI emulator reported the settle of the camera flight later than the 1.5 s intent window, so it was classified as "not the person's" | The settle that shows the members' bounds within 10 s is the person's own move; a gesture or an app camera command retires the open; DEV trace `settled` names the branch (verified natively in journey #6: `OWN_CLUSTER`) |
| 8 | (journeys #5/#6) After a return the list sheet was sometimes a dimmed empty screen with only the "Mapa" pill (uiautomator: no sheet nodes) | Android keeps the Gorhom body at opacity 0 / off-screen until Reanimated's synchronous style write reaches the mounted view; when Fabric has not mounted the view yet the write is lost (Reanimated's Java side only logs it) and nothing writes it again | The P6 sheet is nudged by 0.01 px six times in its first 12 s so Gorhom re-evaluates and Reanimated writes the body's style to a view that is there (DEV trace `kick`). Journey #6: no blank return |
| 9 | (journey #6, cycle 2) The restore of the saved end of a 100-row list stopped 2000 px short and waited for ever | React Native measures rows as the list is scrolled; the estimate stopped growing, no acknowledgement came and no further request was made | A P6 restore that sees no new row measured for 4 s asks for the tail (`scrollToEnd` renders it), twice, then settles where the list is (DEV trace `stall`) |
| 10 | (journey #6, search) After a place was applied the list rose from its top line to half over the pins the camera had fitted above the top line; no marker was visible | A commit made in the middle of a read (the map's quiet refresh finishing, the overlay loading) published the owner's emptied state (no rows, no markers); the presentation reads an empty, not-loading list as "nothing found" and raises the list | The coordinator keeps the last complete picture while a read replaces it (the view is always the live one) and the new one lands whole; a read that drops the peek drops it at once |
| 11 | (journey #8, cycles 13–20) A deep return of the 100-row list sometimes never completed: the person's position and the saved one drifted apart until the saved end was asked for, and the picked card was no longer where it had been | The last EXACT restore request lands while the native list is still shorter than React Native's layout says: it clamps to the position the list already holds, no offset event follows, and the restore waited for that event for ever (4 of 21 returns in the trace, all with the identical ending). Not a harness fault | The restore watchdog covers every P6 restore request: the same request again after 4 s; the tail (`scrollToEnd`) only while the target is NOT reachable, because it would overshoot a reachable saved offset; then it settles on the saved offset. Two reproducers fail before the change and pass after |
| 12 | (P6-10) A touch on a pin gave no answer until the exact read returned | The selected key reached the map only from the coordinator, after the read (the Peek needs the server) | The touched bucket's halo shows at once (the map layer's own filter: no geometry, no card change); the newest touch owns it; a read that does not apply takes it away; the DEV package traces touch → halo → card data (`pin`) |

Driver-only corrections found by the same runs: the Peek's accessible label is a whole sentence (the title is its first part); a next page that
was asked for can be drawn seconds late on the emulator; the sheet counts as full only when it physically stands in the upper part of the screen; the count is the
visible top-line text, not the spoken sentence (which starts with a part of it under an area or one point); a returned list is judged once its card holds still; a
cycle whose card never returns is a failed check with what the list did show; each cycle records tap → detail and Back → list times; a focused run (named steps only,
`p6_native_journey_steps.txt`) exists for iterating a harness step or a fix in minutes and is labelled as such — it never counts as the acceptance run.

## Known noise that is NOT a P6 defect
On the CI emulator, Reanimated logs `synchronouslyUpdateUIProps failed ... Unable to find SurfaceMountingManager for tag` in bursts of ~1000/s for
2–4 s after every screen mount (and list growth), with a full stack trace each, which stalls the emulator's UI thread (`Davey!` up to 8.4 s). The
same flood is present in all journey runs, including those before any P6 map change, and is upstream (Reanimated retries updates for views Fabric has
not mounted yet). The driver waits for it; no dependency or Reanimated setting was changed (the rejected global Reanimated flag stays rejected).

## PKG045b client compatibility record (2026-09-30)
The restriction removes table-wide SELECT on `public.needs` for `anon`/`authenticated` and keeps a 38-column allowlist; three columns become private:
`requester_account_id`, `remaining_search_closed_by_account_id`, `remaining_search_close_reason`.
- Production client reads of the table are exactly two: `ru4Production.remainingSearchState` (`remaining_search_closed_at`) and the embedded
  `needs!inner(id,revision,mode,requester_price_rsd,price_basis,required_slots)` of `myApplicationsClientService`. Both are inside the allowlist,
  identically at HEAD and at `b589994e` (the source of the APK installed on the owner's phone, preview 35). No client source names a private column.
- `__tests__/needsColumnBoundaryContract.test.ts` (4 tests; it fails on a probe that reads a private column, a whole row or a wildcard) keeps this true
  and keeps its allowlist equal to the candidate's grant.
- Fresh read-only DEV preflight (2026-09-30 04:12 UTC, ledger 210): all six body pins of the P0-form candidate, `covered_slots`, the policy pins
  and the 41-column inventory match; PKG045b is not applied and `rpc_discovery_v1` is absent.

(Journey evidence, DEV application receipts, cutover and the closing statement are added below as each gate is proven.)

# R19 — map, geographic discovery, and remote work

Date: 2026-09-25. Scope: source audit and bounded client implementation. No DEV, server, Edge, provider, dependency, payment, or device changes by this subtask.

## User outcome

Find nearby work using the visible map area, while remote work remains reachable independently of the remembered city, map bounds, or selected public point. Preserve truthful counts, public location precision, and map attribution.

## Implemented in this package

- Remote discovery clears only geographic scope (`area`, `place`, `pinPlace`) when it is selected, restored, or applied from the search draft. Search words, date, price, capacity, and the remembered camera remain. Unknown location is never relabelled as remote.
- The remote quick choice comes before date choices. Remote results use the list without a meaningless map or nearby-location control, and the search title says `Na daljinu`. The search panel does not offer geographic place choices for remote work. Draft edits remain unapplied until confirmation.
- Map attribution is one compact, readable control rather than a horizontal row of three large links. Both required names remain visible: `© OpenStreetMap · © OpenMapTiles`. It opens an existing action sheet with all three original destinations, including OpenFreeMap. Text remains at the existing readable size, touch height is at least 48, and wrapping is measured rather than clipped.
- Price/count annotations use the existing bundled USKOČI mark as an image and explicitly refresh the native annotation after that image loads. Multiple load callbacks coalesce into one animation frame; retirement cancels the frame and rejects late callbacks. The public-point source, clustering, fallback native logo markers, 40-rich-label limit, and selected-pin logic remain intact.
- Park, woodland, and water map colors have stronger separation. App-wide surface tokens and provider have not changed.
- The full list now fills the available screen below the measured search header. Lower stops and pin previews still reserve the credit band. A subtle real dim follows the sheet's position on the UI thread; no blur is simulated. Search stays undimmed. At the physical full stop the map is visually covered, but remains mounted with the same camera. Actual animated position, never the requested index, drives both visual coverage and the touch/accessibility boundary; a partially visible map remains usable during a drag. `Mapa`, Android Back, list position, and the existing empty-state behavior are preserved.

## Attribution evidence

Official sources checked on 2026-09-25:

- [OpenFreeMap attribution](https://openfreemap.org/): its instructions for alternate integrations require the OpenStreetMap and OpenMapTiles attribution; the OpenFreeMap part is described as optional. We retain that provider link inside the source panel as well.
- [OpenStreetMap copyright and licence](https://www.openstreetmap.org/copyright): credit OpenStreetMap and make the licence available through its copyright page.
- [OSMF attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines): attribution must remain legible and accessible near the interactive map. Our implementation keeps the two required names visible on the map surface and makes their links one tap away. The full list covers the map itself, as well as its controls.
- [OpenFreeMap quick start](https://openfreemap.org/quick_start/): official integration guidance for MapLibre, including mobile integrations.

The decision is to reduce chrome, not remove credits. OpenMapTiles-specific documentation could not be fetched in this audit; its retained credit is based on OpenFreeMap's explicit provider instructions, not an invented exemption.

## Pin evidence and limits

Installed SDK documentation in `node_modules/@maplibre/maplibre-react-native/src/components/annotations/view-annotation/ViewAnnotation.tsx` documents that Android renders view annotations offscreen into an image, and recommends `refresh()` after `Image#onLoad`. The SDK's native point annotation implementation snapshots children into a bitmap. The prior SVG child had no explicit ready/refresh handshake.

The existing PNG asset was visually inspected and contains the real brand mark. Reusing it plus the documented refresh is a concrete mitigation for incomplete annotation snapshots. This does **not** establish that every blank pin seen on a phone had this cause. Source and mocked-native tests are complete; a native build and visual check by the integrating session are still required before calling the visible pin problem resolved.

## Preserved map/list semantics

- A person's settled pan, zoom control, or cluster movement updates the list's geographic area after the existing 450 ms settle period. Programmatic initial fit and pin focus retain their existing semantics.
- The map source continues to contain filtered public tasks; the local list is bounded by the visible geographic area. Counts distinguish geographic matches from tasks without a public point.
- In the default mixed view, remote and unknown-location tasks still follow local matches in a separate no-point section. This package makes the explicit remote view geographically independent. It does not equate all no-point tasks with remote work or silently discard unknown-location tasks.
- No change to public coordinate rounding, RPC arguments, initial camera, point selection, pan ownership, or account retirement.

## Remaining requirements and server limits

1. **Full-height sheet is implemented; native acceptance remains.** `DiscoveryPresentation` reclaims the old attribution band only at the full list stop, where the map is covered. The lower stops and pin preview retain it. `DiscoveryListSheet` supplies the UI-thread dim below search, and the parent provides the opaque search backing and map accessibility boundary. The ordinary empty state intentionally stays half open over the map so its action is reachable without a competing `Mapa` action; an oversized filter header can still scroll at full height. Existing Gorhom/Reanimated only; no blur dependency or fake blur. Native gesture/large-text review remains part of integration.
2. **Fetching is still all pages.** `src/data/supabaseIzvor.ts` reads pages of 200 and rejects after 25 pages with `OPPORTUNITIES_TOO_MANY_PAGES`; it does not silently show a truncated success. It currently passes neither geographic bounds nor filters to the RPC. Successful local counts describe the complete loaded read, not a new server count aggregate.
3. **Do not blindly move country-wide discovery to the old bbox contract.** The checked-in `supabase/candidates/pkg023d_marketplace_bounded.sql` contract limits a bbox to 3 degrees latitude by 5 degrees longitude; bbox results require public points and exclude remote work. Remote-only is a separate no-bbox query. Its time filters read starts, whereas the client also handles flexible dates and intervals. A server-filtered/paged country view therefore needs a separately reviewed contract and proof. The present client change adds no such request and does not change DEV.
4. **Mixed local/unknown/remote presentation can still become clearer.** A dedicated remote choice is now functional. A future default-local-only composition needs an explicit home for unknown-location tasks and corresponding truthful counts; it must not hide them accidentally.
5. **AI welcome was audited, not changed here.** `AiConversationShell` already provides the brand and opening content for an empty transcript; task and worker routes provide their own welcome/suggestion content. Starters populate the draft and do not make a paid AI call. Their visual composition can be improved separately without changing conversation receipts or recovery.
6. **Native acceptance remains.** Check actual logo rendering at first load, selected/grouped pins, credit-panel accessibility, repeated pan/list movement, remote switching, large text, and full app navigation on the integrating session's device. This audit made no native performance claim.

## Verification

Targeted command:

```text
npx jest src/data/__tests__/discovery-view.test.ts src/data/__tests__/discovery-search-panel.test.tsx src/data/__tests__/discovery-search-bar.test.tsx src/data/__tests__/discovery-presentation.test.tsx src/data/__tests__/discovery-map.test.tsx src/data/__tests__/discovery-map-pills.test.tsx -w 2 --testTimeout=30000
```

Final result: **6 suites, 201 tests passed**. Coverage includes remote geographic normalization, retained shared filters, credit links/measurement, annotation refresh coalescing/retirement, full-height geometry, UI-thread dim values, preserved camera and list offset, blocked covered-map accessibility, and remote without a backdrop. Large-text/tall-header, empty-state, Android Back, and pin-preview tests remain.

One deterministic local fixture contains 1,000 tasks: 300 Novi Sad, 350 Belgrade, 100 outside Serbia, 200 remote, and 50 unknown-location. Repeated narrow/wide areas assert exact local membership/counts, disjoint no-point membership, no duplicated rows, all 200 remote tasks independent of stale geography, and a single searched remote result. This is a pure correctness test, not a network-load test, a native frame-rate test, or proof of 1,000 concurrent users.

Final `npx tsc --noEmit -p tsconfig.json` passed, as did `git diff --check` on this subtask's changed files. The integrating session will run the final combined full-suite checks. No commit or dashboard update was made by this subtask.

### Interrupted sheet return — integration correction

Independent integration review identified a concrete latch: the previous `onAnimate` callback set a JS `sheetMoving` flag, but a half-to-full spring interrupted back to the original half stop does not produce a clearing callback. Installed Gorhom 5.2.14 `BottomSheet.tsx` returns early from `handleOnAnimate` when the target equals `animatedCurrentIndex` (line 484), and `animateToPositionCompleted` skips `onChange` for that same index (line 556).

Removed the moving flag and its callback plumbing rather than assuming a completion event. The full-list accessibility boundary remains; the partially visible map stays usable during a drag. The regression reproduces the real sequence: start `1 -> 2`, move partway, return to `1`, and deliberately send no finish callback. It checks pointer events, accessibility visibility, camera preservation, and opening a pin afterward. Full-height hiding, dimming, Android Back, and scroll/camera restoration remain covered by the existing tests.

Correction verification: `npx jest src/data/__tests__/discovery-presentation.test.tsx -w 1 --testTimeout=30000` passed **61/61**; `npx tsc --noEmit -p tsconfig.json` passed. No native/device or server action was performed by this correction.

### Button interruption — physical coverage is authoritative

The first latch correction did not cover a button request: the parent sets requested index `2` before the spring starts, so interruption back to native index `1` can leave that requested value stale. The final implementation therefore derives coverage exclusively from the published animated position: a measured body and `position <= listTop + 0.5`. The initial shared position is the window height, matching the library's initial off-screen position rather than treating an unmeasured zero as full coverage.

`useAnimatedReaction` schedules the JS touch/accessibility update only when this boolean changes (or once for a new scope/focus owner). There is no per-frame bridge traffic. The visual opacity uses the same physical condition. Queued callbacks carry their own owner closure; a retired scope, blurred/refocused lifetime, or unmount rejects late deliveries. The native map and camera remain mounted. The shared Jest stand-in gains only a no-op API export; the focused test supplies an explicit reaction registry and queued RN deliveries.

New tests request full height with the actual count button, retain the stale requested `2`, and interrupt back to native `1` without any `onChange`. Both never-reaching-full and touching-full-before-cancellation cases restore map touch/accessibility and allow opening a pin. They also verify one callback per physical boundary rather than per intermediate frame, and rejection of old scope/focus deliveries. Final correction checks: **2 suites / 75 tests passed** (`discovery-presentation` and `zadaci-guards-from-marketplace`), and `npx tsc --noEmit -p tsconfig.json` passed. Native gesture acceptance remains with the integrating session.

Exact remaining limitation: this closes the physical map-coverage bug, not general requested-versus-settled sheet state synchronization. After a button-triggered interruption with suppressed callbacks, requested index `2` can still keep the `Mapa` shortcut and remembered view in the full state while native height is half. The count header can likewise remain in its full-state presentation. No same-index completion callback is invented. The map itself is visible, touchable, and accessible again because its boundary no longer depends on that stale requested state; further settled-state reconciliation needs its own native behavior proof.

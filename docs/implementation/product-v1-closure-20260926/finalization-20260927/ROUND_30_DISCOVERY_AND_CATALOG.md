# Round30 — joined Discovery and selective Catalog27 integration

2026-09-27. Client source based on 2c4b6e84. Exact-build native acceptance recorded separately.

## Problem and cause

The owner reports slow pin-to-card response, unclear pinless tasks, a list that appears to stop halfway, a pale map, and asks to retain the catalog's icons/motion in one coherent system. Source confirms the count action first requested HALF, FULL retained a floating gap/edge, and the unbounded/global list did not separate missing-point rows. Remote work and missing public geography are different facts.

The public map-style loader could leave an already-mounted map using the gray fallback after a late valid colored style arrived. The installed phone did already show colored parks/water, so that fallback defect is not asserted as the cause of its pale appearance. Palette refinement is separate.

## Product / UX / UI decision

One count tap opens the complete list beneath search and quick filters. Dragging retains lower stops; FULL becomes the same white surface as the tools. Empty results may also expand fully. Pinless-only results expand without requiring another tap. The same filtered collection supplies real groups: mapped tasks, remote tasks, and tasks without a marked place. Grouping never invents remote status or hides public tasks based on ownership.

The existing TaskCard, DiscoveryPeek, brand marker, selected-pin treatment and business commands are preserved. Water and green areas gain contrast; the rest stays quiet. Four exact supplied illustrations are introduced at 32 dp in help/privacy/legal, not as a global icon replacement. One support animation is restricted to the inert DEV trial until native quality is observed.

## Implementation / files

- marketplaceView + DiscoveryPresentation + DiscoveryListSheet: stable location groups, direct FULL, connected FULL geometry, empty/pinless behavior; no server-filtering change.
- location/mapStyle + system/tokens: observable late-style completion without map remount, bounded public read retirement, six map colors.
- CatalogArt + CatalogMoment + legal/privacy/support presentations: four original decorative PNGs, disabled tone, event-owned animation with matching static fallback.
- Exact rs.uskoci.dev-only /dizajn-katalog27: explicit one-shot animation trial, no data/command fixture writes. See CATALOG27_IMPLEMENTATION.md for asset hashes and boundaries.

## Backend / RPC / state sync

No server, Edge, certificate, dependency, payment, AI prompt, private location, push activation or business-data mutation. Live remains the independently recorded DEV210/Edge22, exact transport flag OFF. Shared public map style contains no user input. Published-task positioning and existing viewport/scroll/owner admission remain covered by the focused Discovery checks.

## Checks

Map style: 3 suites / 22 PASS. Catalog: 5 suites / 118 distinct PASS. Integrated TypeScript passed after the client edits; the exact-package gallery refinement is type-equivalent. Final Discovery result and any diagnostic-only addition are recorded in the check receipt before commit. No full Jest repetition.

## Device observations before this build

Phone preview35/b589994e: map loaded, pale urban base with colored park/water; actual nine tasks, four without a public point. A non-atomic XML/PNG pair after a pin touch disagreed about the visible card; possible concurrent user navigation means it is not a latency measurement or a proved automatic dismissal.

Emulator5556/04b66de6: map error survived one retry and an app-only restart. No fatal/native MapLibre/network error was found in bounded logs. Source has a 15-second load deadline and refuses late ready after failure; available logs cannot distinguish deadline from native callback error. The list remained usable: initial gesture reached HALF, then count opened FULL, with a visible gap under quick filters. No full-stop stall was reproduced. No account data was cleared and no paid AI/provider action was triggered.

## Status / next step

Source fixes and focused checks are not whole-product acceptance. Consolidate this with Round29 AI location and Round28 B3c client in one phone/emulator checkpoint. Verify direct FULL/group headers, pin-to-card response, colored map stability, compact AI location in inert scenes, and Catalog27 native still/playback. Pin latency remains OPEN until measured. Voice, exact provider push, P6 bounded server filtering, iOS and overall release remain separately open.

Control is regenerated locally; the prior supported dashboard upload failure remains pending. Do not claim hosted publication from local generation.

## Final focused source results

Discovery3 suites194PASS (first wider run193/194 had an obsolete combined-section test identifier, corrected to actual remote group). Catalog5 suites118 distinctPASS. Map-style3 suites22PASS. Additional exact-DEV diagnostic6 selectedPASS/27 unrelated skipped, no behavior change: at most six fixed event names plus elapsed milliseconds; no coordinates, IDs, URL or task data. New build can distinguish native error from a late ready rejected after the deadline. Final TypeScript result belongs to ROUND_30_CHECKS.json.

## Independent review correction

A reviewer found that allowing empty FULL while hiding its map shortcut removed gesture-free return to the covered map. Corrected with a quiet white Map action, preserving search/area/viewport and issuing no refresh. The regression was reproduced then fixed; affected DiscoveryPresentation suite139/139PASS. Initial builds36350517837/36350521107 were cancelled before installation and superseded, not accepted. Independent Catalog review found no concrete regression; native fidelity remains separate.

Bounded connectivity observations: emulator has validated internet, resolves the public style host and opens TCP443 in530ms; no emulator HTTPS response was measured. Host standard HTTPS GET of the configured style returned403 twice. This is not proof of the emulator cause or a provider outage. [OpenFreeMap official guidance](https://openfreemap.org/quick_start/) supports the same styles in MapLibre Native and customization; it does not establish current endpoint availability.

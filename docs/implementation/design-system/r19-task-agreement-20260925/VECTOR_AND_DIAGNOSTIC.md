# R19 next native iteration — vector annotations and measured diagnosis

This follows the failed scroll/logo replay of exact source `46c87a38`, documented in NATIVE_REVIEW.native-return.md.
It must not be described as a completed scroll fix. Checks and rebuilt-device observations are separate.

## Rich pin

PricePill now uses the existing BrandMark/native SVG paths rather than the asynchronous PNG image. No dependency
or new brand asset is introduced. The current MapLibre Android BitmapUtils snapshots using `View.draw(canvas)`;
the installed react-native-svg SvgView draws original paths into that canvas when its cached bitmap is absent.
Its detach path clears that cache. The existing entry-splash provenance test binds BrandMark paths/colors/transforms
to the original brand SVG. Annotation refresh still requires positive child layout, a rendered map frame and a
live current owner, with one coalesced RAF. There is no image-load latch, fabricated load event or retry timer.
Actual selected/unselected pin pixels after detail/Back remain required.

## Selection success

The one receipt-confirmed SuccessMark/text moves from the bottom of the scrolling offer into the existing pinned
footer immediately above Open Agreement. The mark retains its fresh-only rule; the user still explicitly opens
the Agreement. Terms, command ownership, pending/unknown recovery and navigation are unchanged. Existing ProductSheet
uses a stable footer component/context, so a footer update does not itself remount the success mark.
The focused successful/unknown/stale/account-change cases verify exact-once placement and no false confirmation.
Native clipping/large-text acceptance is separate from those tests.

## Temporary bounded DEV scroll diagnosis

Only exact Android package `rs.uskoci.dev` plus explicit `uskociapp://zadaci?discoveryTrace=1` opts in. Default and
store-package behavior produce no trace. No UI command, stored setting, credentials, account/task IDs, titles,
coordinates, message text or full native event is logged. The route admits a fixed event allowlist and only finite
numbers/booleans, clamped to a bounded range. A session is limited to 120 records; noisy scroll/geometry/measurement
sampling is capped separately to preserve the lifecycle/restore events. Log prefix: `[USKOCI_DISCOVERY_TRACE]`.

Record one existing-task read-only sequence: expand, scroll, open, Back. Compare saved route/ref offsets before
opening, focus ownership, native readiness, actual content/window measurements, clamp/request/ack and zero events.
This discriminates lost persistence, transient geometry and post-acknowledgement reset. It changes no scroll rule.
Remove the temporary diagnosis after the measured corrective package; never call passing trace-unit tests a native fix.

### Trace field order

Each array starts with sequence and fixed event name. `-1` means absent. Sheet index is peek 0 / half 1 / full 2;
native state is CLOSED 0 / OPENED 1 / EXTENDED 2 / OVER_EXTENDED 3 / FILL_PARENT 4.

| Event | Remaining fields |
| --- | --- |
| route-trace / route-focus / route-blur | savedOffset, sheet |
| route-open | current, navigating, loading, error, savedOffset, sheet |
| route-view | accepted, previousOffset, nextOffset, nextSheet |
| focus / blur | visit, savedOffset, refOffset, scrolled, sheetIndex, hasRows, loading, error |
| preopen | savedOffset, refOffset, scrolled, sheetIndex, pendingTimer |
| write-offset | savedOffset, roundedRefOffset |
| seed | visit, savedOffset, previousRefOffset, hasRows, scrolled, sheetIndex |
| ready | ready, nativeState, currentSheet, restore, refOffset, physicalPosition, focused, ownerActive, ownerMatches |
| geometry | bodyHeight, toolsBottom, listTop, peek, chipsRoom, scrolled, sheetIndex, listHeight, contentHeight |
| index | nextIndex, previousIndex, currentSheet |
| content | currentSheet, newHeight, oldContentHeight, listHeight, restore |
| layout | currentSheet, newHeight, oldListHeight, contentHeight, restore |
| restore-check | currentSheet, hasRows, ready, restore, attempted, listRefPresent, listHeight, contentHeight |
| clamp0 | restore, contentHeight, listHeight, savedOffset |
| request | restore, target, contentHeight, listHeight |
| ack | nativeY, restore, target |
| scroll0 | currentSheet, ready, restore, target, attempted, refOffset, scrolled, focused, ownerActive, ownerMatches |
| scroll | nativeY, savedOffset, scrolled |
| scroll-reject | nativeY, focused, ownerActive, ownerMatches, ready |
| search-change | savedOffset, refOffset, restore |
| fold | true, nativeY, frame, contentHeight, chipsRoom; or false, nativeY |
| drag | currentSheet, ready, restore, refOffset |
| refresh | currentSheet, restore |

No server, Edge, payment, dependency, provider call or real business mutation belongs to this iteration.

Integrated source checks: TypeScript clean; full Jest 320 suites / 6,274 tests passed, exit 0, with the existing
worker-teardown warning. CHECKS.vector-diagnostic.json binds source-file hashes and actual log hashes. Build/native
acceptance is separate; this passing run does not close the measured scroll defect.

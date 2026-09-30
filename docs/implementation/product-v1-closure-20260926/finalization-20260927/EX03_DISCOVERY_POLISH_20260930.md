# EX-03 — Discovery polish (card at once, warm return): BEFORE on the quiet database, 2026-09-30

Status: **BEFORE MEASURED; AFTER NOT YET.** P6 stays CLOSED; this is product polish under the owner's approval of 2026-09-30 (message item 4: timing, caching, prefetch, local-first display, state retention, mount/remount, request strategy, skeleton/loading, how the existing Peek/TaskCard gets and keeps its data, Back restore, unnecessary PAGE/MAP re-reads). **Not approved and not touched: the visual design of TaskCard and the Peek card** (a separate UI/UX physical-device pass). Every change needs a BEFORE/AFTER on the HONOR; this document is the BEFORE and will carry the AFTER.

## Goal, in the owner's words
Pin → the existing card reacts practically at once from Discovery data the client already knows, more data may refresh in the background; Back does not remount and re-read PAGE + MAP when the previous valid Discovery state can be kept safely.

## What the code does today (read, not assumed)
- **Pin → card** (`src/data/discoveryV1ScreenSession.ts`, `selectMarker`): a TASK marker does `await owner.readExact(marker.taskId)` and only then sets `peek`; `DiscoveryPresentation` shows the card only when `peek.item` exists. A PLACE marker awaits `owner.firstMembers(point, 50)` the same way. Nothing is shown from what is already loaded, although **PAGE and EXACT_PUBLIC return the identical `DiscoveryV1Item` shape** (`src/data/discoveryV1Contract.ts`: `items: DiscoveryV1Item[]` in both), so a loaded PAGE row carries everything the card prints, including `revision` to detect a stale copy.
- **P6 map and the camera** (`DiscoveryPresentation.tsx`): `selectedId={props.p6Seam ? null : …}` and `selectedPlace={props.p6Seam ? null : …}`, so the map's own "move the camera so the chosen pin stays in the free area above the card" (`DiscoveryMap.tsx`, the `pendingFocus` effect, keyed on `props.selectedId`) **never runs on the P6 path**. Not yet reproduced on the phone: a pin tapped low on the map may end up under the card. A separate, smaller check for the next phone window.
- **Back** (`DiscoveryPresentation.tsx` comment at the sheet "kick"): the P6 screen is rebuilt on every return and nudged five times up to 8 s after it mounts; the coordinator re-opens (`restore`, up to 8 pages) and re-reads PAGE and MAP.

## BEFORE — focused run on the quiet database (the DEV retry loop was ended at 16:43Z)
Device and build: HONOR VKP-NX9, Android 16, arm64, APK `dfd6130034be…` (P6 candidate, tag `p6-closed-20260930`), canonical DEV ledger 212, 7 tasks. Run 2026-09-30 19:13:15 → 19:20:12 local (phone inputs until 19:19:41, **about 26 s over the 6-minute window**; the last half minute was read-only health reads). The app process had been started at 19:12:35, about 40 s before the run: a young process. Script: `scripts/p6_dev_emulator_check.py --device physical --reader p6 --focused --taps 12 --cycles 8`; evidence `ex03-physical-honor/before_quiet_focused_20260930_1913/` (serial withheld).

| Measure | Quiet DB, this run (n) | Earlier run, DEV retry loop still burning (n) |
| --- | --- | --- |
| Feedback, JS clock (touch → halo committed) | p50 63 / p95 **75** / max 75 ms (12) | 68 / 86 / 93 ms (30) |
| Pin → **card data committed**, JS clock (includes the exact read) | p50 **402** / p95 **683** / max 683 ms (12) | 477 / 1,503 / 1,848 ms (30) |
| Back → `restored`, JS clock | p50 **462** / p95 **582** / max 582 ms, min 399 (8) | 481 / 822 / 858 ms (20) |
| Frames, pin phase | 1,311 frames, 2.82 % janky, p99 **1,100 ms**; slow UI thread 25, slow bitmap uploads 19 | 3,291 frames, 2.43 %, p99 450 ms; 60 / 28 |
| Frames, Back cycles | 1,685 frames, 3.8 % janky, p99 34 ms | 3,875 frames, 2.68 %, p99 38 ms |
| Frames over 700 ms (`Davey!`) | **11**, each 1.10–1.17 s | 0 |
| ANR / crash / process death | 0 / 0 / 0 | 0 / 0 / 0 |
| PSS | 584 → 539 MB after idle | 700 → 762 → 723 MB |

Gateway view of the same window, phone requests only (`rpc_discovery_v1`, all HTTP 200): EXACT_PUBLIC n = 9 (12 touches; three needed no request) upstream **p50 127 / p95 187 / max 209 ms**, origin p50 172 / p95 226 ms; the other modes n = 29 upstream p50 31 / p95 182 / max 314 ms. Earlier, with the loop: EXACT_PUBLIC p50 217 / p95 1,063 / max 1,670 ms, other modes p50 58 / p95 361 / max 629 ms. **Ending the loop removed the tail (exact read p95 1,063 → 187 ms; card data p95 1,503 → 683 ms) and trimmed the medians (217 → 127 ms; 477 → 402 ms).**

## What the JS-clock numbers hide: one slow frame per pin
The app's trace logs `["pin","feedback/cardData"]` when the card data is committed. In this run **11 of the 13 such events in the trace (the first tap and one other were spared) were followed by one HWUI `Davey!` frame of 1.10–1.17 s that started 80–90 ms after the commit** (`timeline-pin-events-and-slow-frames.txt`: for example commit 19:15:03.408, frame 1,139 ms ending 19:15:04.637). That frame is the one that draws the card, so **what the person sees is roughly the data time plus about 1.1 s**, not the 402 ms the trace reports. The earlier warm run (process 28 minutes old, 30 touches) had no frame over 700 ms (p99 450 ms). What differs between the two is not known: the process age, the device state, or both; the AFTER run under the same conditions, plus `dumpsys gfxinfo framestats` for one pin open, will say whether the time is layout/mount on the UI thread, bitmap upload or the render thread.
Consequence for the targets: **feedback ≤ 100 ms is met in the JS clock (p95 75 ms) and NOT demonstrated at the pixel level**; pin → card ≤ 200 ms is not met, in data time (402 ms) and more so in drawn time.

## Plan (each item measured BEFORE/AFTER on the phone, tests first)
1. **Card from known data.** On a TASK marker whose id is in the loaded PAGE rows, publish the peek at once from that row (same `discoveryV1Opportunities` adapter, same card), then let `readExact` confirm: replace only if the revision or a shown field differs; the selection sequence already fences late answers. For rows not loaded, keep the exact read and show the card-shaped loading state that already exists in the design system, never an empty wait. PLACE markers likewise from the loaded rows of that point when the bucket's count equals the known rows, else `firstMembers`.
2. **Make the card's first frame cheap.** Find what the 1.1 s frame contains (framestats, then a targeted experiment: keep the Peek sheet mounted and hidden with its last content, or warm its fonts and icons once at mount) without changing what the card looks like.
3. **Warm return.** Keep the last valid Discovery snapshot (PAGE rows, MAP markers, view) per signed-in account in memory across route blur, seed the screen from it on focus, revalidate in the background within the server anchor's 30 minutes, drop it on sign-out/account change; fewer or no sheet "kicks" when nothing was rebuilt.
4. **Camera on selection on the P6 path**, if the phone shows a pin hidden under the card (to be checked first, a real regression against the legacy map if it reproduces).
Targets, unchanged: feedback ≤ 100 ms, pin → card ≤ 200 ms (excluding a separate missing-data read), warm return ≤ 350 ms, < 5 % janky frames, no ANR.

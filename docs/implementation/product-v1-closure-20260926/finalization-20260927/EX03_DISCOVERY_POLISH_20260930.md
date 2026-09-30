# EX-03 — Discovery polish (card at once, warm return): BEFORE on the quiet database, 2026-09-30

Status: **BEFORE MEASURED; AFTER MEASURED ON THE HONOR FOR EX-03a + EX-03c (2026-09-30, small sample); halo-first and the remaining frames are next.** P6 stays CLOSED; this is product polish under the owner's approval of 2026-09-30 (message item 4: timing, caching, prefetch, local-first display, state retention, mount/remount, request strategy, skeleton/loading, how the existing Peek/TaskCard gets and keeps its data, Back restore, unnecessary PAGE/MAP re-reads). **Not approved and not touched: the visual design of TaskCard and the Peek card** (a separate UI/UX physical-device pass). Every change needs a BEFORE/AFTER on the HONOR; this document is the BEFORE and will carry the AFTER.

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

## Implemented in source (2026-09-30) — AFTER on the HONOR is still to be measured
No visual change to TaskCard or the Peek card. Everything below is in `src/` with tests written first; the client check (run 36755903728 on `e6bbee52`: TypeScript, 34 focused suites / 677 tests, full Jest 366 suites / 7,533 tests) is green for EX-03a and EX-03c; the PLACE change came after it (19 discovery-v1 suites / 221 tests locally).

| Item | What changes | Commit |
| --- | --- | --- |
| **EX-03a** card from known data (single task) | A TASK pin whose id is in the loaded PAGE rows exposes its existing card in the touch's own turn (PAGE and EXACT_PUBLIC return the same public item). The exact read still goes out and only confirms or refreshes it: the card is replaced only when the answer differs, a failed read keeps the known card, an answer without the task removes it, a task that is not loaded waits for the read as before, newer touches fence older ones. The trace's card-data time now ends at that turn. | `94792c79` |
| **EX-03a′** card from known data (place) | Same rule for a point several tasks share, when the bucket's count equals the loaded rows at that point (so the set cannot be larger); the POINT_MEMBERS read still goes out and feeds the place's own paging. | `d9708c45` (not in the APK below) |
| **EX-03c** warm return | The Zadaci route keeps the coordinator of the screen that left for the next screen of the same account and source (a holder the route owns, so sign-out and account change drop it with the route). Inside 5 minutes (the server anchor lives 30) the return shows the same picture at once, with its selected pin and card, and reads neither PAGE nor MAP: attaching only asks the optional overlay (relations, urgency, profiles) again in the background. Anything else reads like a first visit: a read that was replacing the list, a screen that left in its error state, another search intent, another account or source, an older park. The existing `restored` trace line is kept for comparability; a new `warm` line (age seconds / rows) marks the return. | `6f6cf333` |

Safety of the warm return: `detach()` aborts every read in flight and moves every owner's sequence on, so nothing that began before the screen left can land after it returns (owner, overlay, search and selection fences, each with its own test); a coordinator is kept only when its picture is whole (nothing replacing it, no traversal being restored, a first page read); what is retained is the public discovery picture plus the account's own overlay, in memory, inside the route's own holder; the holder retires it on route unmount and before it is replaced.

What the AFTER run will show: `Back → restored` (BEFORE p50 462 / p95 582 ms) and the count of `warm` lines in the cycle window (every Back should be warm, since each cycle is seconds long); pin → card data (BEFORE p50 402 / p95 683 ms); and, new in the script, a framestats split of every pin frame over 500 ms (`pinTiming.slowFramesOver500ms`: waited before start / input / animation / layout / record / sync / render / swap), so the ~1.1 s frame can be attributed before anything is changed for it. Open by design: camera on selection on the P6 path (not changed), the first-frame cost itself (needs the split), the place card (no place on the DEV fixture to tap).

## AFTER on the HONOR — EX-03a + EX-03c (2026-09-30, the owner's "SAD" window)
Build: ARM64 DEV APK `ca1de4989c1b…bff97` (source `dab06e31`, run 36756318455; it contains the card from known data for a task and the warm return, not the place card), installed with `adb install -r` (session kept, installed hash equals the artifact). Same script, same phone, same quiet database as the BEFORE (`scripts/p6_dev_emulator_check.py --device physical --reader p6 --focused --restart --taps 4 --cycles 4`); the sample is small because the window is 6 minutes: the trace shows **five** pin touches (the script counts four, its mark starts after the first) and **four** Back returns. The first attempt (21:00:51) stopped after 25 s at the script's foreground guard: `adb install -r` had killed the app and that run had no `--restart`; nothing was sent. The second ran 21:01:37-21:06:06; the phone was in use 5 min 15 s in total. Evidence: `ex03-physical-honor/after_quiet_focused_20260930_2101/` (report, console, frame statistics, timeline, and `gateway-rpc_discovery_v1.json`: the server-side request list of the run).

| Measure | BEFORE (n) | AFTER (n) |
| --- | --- | --- |
| Halo committed, JS clock p50 / p95 / max | 63 / 75 / 75 ms (12) | **140 / 156 / 156 ms** (script: 4; all five traces 128-156) |
| Card data handed to React, JS clock | 402 / 683 / 683 ms (12) | **42 / 56 / 56 ms** (five traces 30-56) |
| Back → `restored`, JS clock | 462 / 582 / 582 ms (8) | **162 / 166 / 166 ms** (4); `warm` trace line on 4 of 4 returns |
| Back → cards seen by a UI dump | 5.74 / 5.96 s | 6.53 / 6.69 s: a tooling figure (two dumps and polling are inside it), not faster, not a product latency |
| Frames, pin phase | 1,311 frames, 2.82 % janky, p99 1,100 ms, slow UI thread 25, slow bitmap uploads 19 | 369 frames, 4.88 % janky, p99 450 ms, 7, 2 |
| Frames, Back phase | 1,685 frames, 3.8 % janky, p99 34 ms | 796 frames, 4.9 % janky, p99 34 ms |
| Frames over 700 ms (`Davey!`) | **11**, each 1.10-1.17 s | **0** |
| Frames over 500 ms (framestats) | not measured | 2 (517 and 501 ms, taps 3 and 4), both in display-list recording (472 and 475 ms), none in layout, animation, sync or render |
| ANR / crash / process death | 0 / 0 / 0 | 0 / 0 / 0 |
| PSS | 584 → 539 MB | 562 → 574 (peak) → 505 MB after idle |
| Requests of the Back returns (gateway) | PAGE and MAP reads on every return | **none**: no `rpc_discovery_v1` request of any mode during the four returns |
| Requests per pin touch | one exact read for about 9 of 12 touches | one exact read for each of the 5 touches (26-191 ms upstream); the card was already on screen |

What this shows, and what it does not:
- **Warm return works on the phone:** four of four returns were warm, nothing was read, and the JS-side return time fell from p50 462 to 162 ms (target ≤ 350 ms met in the JS clock). The native remount of the map, the sheet and the list is still there and is not in that number; the `--visible-return` screenshot burst is the pixel measure and was not run.
- **The card is on screen earlier but the halo is not:** the card data is handed over in the touch's own turn, and the halo and the card now commit in one batch, so the halo (the first visible reaction) moved from 63 to 140 ms. Card in about 140 ms instead of about 500 ms (402 + its render) meets pin → card ≤ 200 ms in the JS clock; the feedback target ≤ 100 ms, met before, is missed now. Planned: the halo commits alone first and the card one frame later, and the trace reads the peek without building a whole snapshot (three snapshots per touch today).
- **The ~1.1 s frame per pin is gone** (no frame over 700 ms in this run, 11 before, same tooling). Why is not proved; the likely reason is that before, the card's first render coincided with the exact read's own commit, which no longer redraws anything (the known card object is kept). Two frames of about 500 ms remain, both in display-list recording on the UI thread; what they draw is not attributed yet.
- Limits: four to five samples, one pin, a process about a minute old both times, the JS clock is not pixels, no place card measured (no place on the DEV fixture), janky share 4.9 % is under the 5 % target but higher than before on far fewer frames.

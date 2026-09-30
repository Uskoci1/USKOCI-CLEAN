# EX-03 — Discovery polish: closure receipt (2026-10-01)

**Status: CLOSED WITH LIMITS.** Closed on the owner's order of 2026-10-01 ("formally close the remaining technical/performance scope of EX-03; carry purely visual UI/UX items to the UI/UX package; do not hold EX-03 open for design"). P6 stays CLOSED WITH LIMITS (tag `p6-closed-20260930`); no P6 round is opened and no new audit or prototype is started. The work, the BEFORE/AFTER measurements and the exact numbers are in [EX03_DISCOVERY_POLISH_20260930.md](EX03_DISCOVERY_POLISH_20260930.md); this receipt only closes it, keeps the levels apart and names every limit with the package that carries it.

## What the owner approved (2026-09-30) and what was built
Approved: timing, caching, prefetch, local-first display, state retention, mount/remount behaviour, request strategy, skeleton/loading, how the existing Peek/TaskCard receives and keeps its data, Back restore and unnecessary PAGE/MAP re-reads. **Not approved and not touched: the visual design of TaskCard and the Peek card.**

| Item | What it does | Commit |
| --- | --- | --- |
| EX-03a | A task pin whose task is already in the loaded PAGE rows shows its existing card in the touch's own turn; the exact read only confirms or refreshes it | `94792c79` |
| EX-03a′ | The same for a place whose every task is loaded | `d9708c45` |
| EX-03c | Warm return: inside five minutes the Zadaci route shows the picture the screen left, reads neither PAGE nor MAP, and asks only the optional overlay again | `6f6cf333` |
| EX-03d | The halo commits alone and the card one frame later; a warm return does not ask profiles it already holds; a pin card opening or closing no longer re-creates every list row | `ffb6b697`, `e18aef01`, `e87ed466` |

## Levels (never mixed)
- **SOURCE:** on the work branch, tests first, no visual change to TaskCard/Peek.
- **CI:** client final check run 36770243152 on `bb8d3a9b` — TypeScript clean, 34 P6/Discovery suites / 686 tests, full Jest 366 suites / 7,542 tests. Re-run on 2026-10-01 at the voice checkpoint head: 376 of 377 suites pass; the one failing suite (`discovery-presentation`) fails only on the 5 s default timeout when the whole suite runs in parallel on this machine and passes alone (159 tests, 37 s), as already recorded for the old code.
- **APP WIRED / APK BUILT:** ARM64 DEV APK `11574c02…9f39edd` (run 36770245365, source `bb8d3a9b`).
- **PHYSICAL DEVICE (HONOR VKP-NX9, owner windows "SAD"):** BEFORE 2026-09-30 19:13; AFTER EX-03a+c 21:00; AFTER EX-03d 22:25. Small samples (10 touches, 7 returns, 3 visible returns), one phone, one account, one quiet database, `adb install -r` with the session kept.
- **EMULATOR / iOS / RELEASE:** not part of this closure.

## The owner's targets against the last measurement (EX-03d, HONOR)
| Target | BEFORE | AFTER (EX-03d) | Verdict |
| --- | --- | --- | --- |
| Feedback (halo) ≤ 100 ms | 63 / 75 ms | **85 / 91 ms** | met (JS clock) |
| Pin → card ≤ 200 ms | 402 / 683 ms, plus a ~1.1 s frame per pin | **71 / 78 ms**, no pin frame over 500 ms, p99 frame 1,100 → 24 ms | met (JS clock and frames) |
| Warm return ≤ 350 ms | 462 / 582 ms, one PAGE+MAP read per return | **162 / 218 ms**, zero PAGE/MAP reads on 7 of 7 returns | met (JS clock; 6 of 7 returns matched) |
| Janky frames < 5 % | 2.82 % / 3.8 % | 4.84 % pins / 4.24 % cycles | met, barely |
| No ANR | 0 | 0 (frames over 700 ms: 11 → 0; Reanimated failed-update lines per frame about 12.4 → 1.2) | met |

## Limits carried (nothing below is hidden; each has an owner package)
| Limit | What is open | Carried to |
| --- | --- | --- |
| **EX03-L1 visible return in pixels** | By the pixel measure (3 returns, an upper bound with about 0.9 s granularity) the list is on screen 1.0–2.0 s after Back. The JS clock does not include the native remount of map, sheet and list. Cause read in source: `DiscoveryV1Route` renders a skeleton instead of `DiscoveryV1Screen` when the route loses focus, so the native views are rebuilt on every return. A technical option (not started): keep the screen mounted and inert while blurred, with an explicit blur/focus attach in the coordinator instead of unmount-park-claim; it changes a fenced P6 lifecycle and needs a pixel BEFORE/AFTER on the HONOR. There is no pixel BEFORE for the old behaviour, so no improvement is claimed. | The UI/UX physical-device pass (the HONOR is used there anyway), as its first performance item, with the pixel measure (`--visible-return`) before and after |
| **EX03-L2 camera on selection (P6 path)** | `selectedId` is null on the P6 path, so a pin tapped low on the map may sit under the card. Not reproduced on the phone, never started. A visual behaviour of the map and card. | UI/UX package (check it first in the device pass; a real regression against the legacy map if it reproduces) |
| **EX03-L3 janky share near 5 %** | 4.84 % / 4.24 %, under the target but not better in percent than before, although the long frames are gone. | Re-measured in the UI/UX pass with the final visuals; the budget stays 5 % |
| **EX03-L4 place card** | Unit-tested only; no place exists on the DEV fixture to tap, so it was never measured on the phone. | The two-device test or a place fixture |
| **EX03-L5 sample** | One phone, one account, one quiet database, ten touches and seven returns; no background, long-session or two-device evidence. | The two-device test |
| **EX03-L6 card design** | TaskCard and the Peek card are visually unchanged by rule (owner 2026-09-30: do not change their visual design before the UI/UX pass). | UI/UX package |

RNR-01 (Reanimated failed-update lines from other screens and sign-in, about 2,800 per run) is **not** part of this closure: the owner decided on 2026-09-30/10-01 not to introduce `patch-package`; it reopens only on a concrete reproduced crash, ANR or UX problem the current fix does not solve.

## What this closure does not claim
No pixel-level improvement of the return, no place-card measurement, no two-device proof, no iOS proof, no release-candidate status, and no claim that the DEV APK measured here equals a future build. It changes no code, no server object and no device.

## Next (the owner's order)
EX-04 Posao / personal lists per `EX04_PERSONAL_LISTS_PLAN_20260930.md` (source, client, tests and disposable proof first; a server candidate is prepared and proven and only its DEV application waits for his `primeni`), then EX-06 AI/worker/matching/dispatch.

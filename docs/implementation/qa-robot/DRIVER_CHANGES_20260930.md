# QA robot driver changes (2026-09-30): what changed in `scripts/p6_native_journey.py`, why, and how each change was verified

Scope: ONLY `scripts/p6_native_journey.py` changed (plus this page). Nothing under `.github/`, `supabase/`, `src/`, `docs/control/`,
`AGENTS.md` or the pointer files under `supabase/proofs/discovery/` was touched. Base: `216b8387` on `work/uskoci-ui-unification-20260924`.
Commits, in order: `faf5e837` (change 1), `5646b24b` (change 2), `43ea9ccb` (change 3), `f5f03e0f` (change 4), `1c212c96` (`fix(p6): journey
driver - a rule's own ok key is not spread into check(name, ok, ...)`, a slip found while reviewing the call sites; see section 6), then this page.

Verification method for every change: the driver was **never imported or executed** (the `__main__` guard and the CI-only refusal stay exactly
as they were; `launch_clean()` is still called only in `s_login`). Each function or constant under test was extracted from the file with `ast`
(only the named `FunctionDef` / `Assign` nodes are `exec`ed into a namespace with stubbed `adb`, `time`, `screen_size`, `parse_bounds`, `print`),
and `python -m py_compile` plus `pyflakes` (ignoring the names the driver borrows from the RU5 helper at runtime) ran on every commit. No emulator,
docker, adb, network or GitHub call was made. **97 extraction cases pass on the final file** (14 + 14 + 24 + 39 + 6). The only pyflakes note is
the pre-existing unused `xml.etree.ElementTree as ET` import, left as it was.

What extraction cannot test — everything that touches the device — is listed in section 7 so one CI run (`P6N_STEPS=cycles paging detail_back
filters flood_compare` on a `proof` APK, or the whole journey) can confirm it.

## 1. Memory checks (`s_repeat_cycles`) — commit `faf5e837`

**Before:** one rule, `NO_OBVIOUS_MEMORY_GROWTH`: `kb[-1] <= kb[0] * 1.35 + 20000` over before / cycles 1, 5, 10, 15, 20. It passed the strictly
monotonic curve of journey #9 (470,776 → 568,399 KB), i.e. a linear leak.

**After:** every sample is still recorded in `REPORT['mem']`; the peak is data; an explicit idle sample is added (`after_cycles_idle`: the app
stands untouched for `IDLE_AFTER_CYCLES_S = 20` s after the last cycle, then `dumpsys meminfo` TOTAL PSS is read once more); two pure rules
replace the single bound (all units KB as `meminfo` reports them; "20 MB" = 20,000 KB, "15 MB" = 15,000 KB):

- `MEMORY_RETURNS_TO_BASELINE_AFTER_IDLE` — rule (a): `idle <= before_cycles * 1.15 + 20,000`. A missing sample (no idle sample, or `mem_kb()`
  returning -1) **fails**: nothing passes on a measurement that was not taken.
- `MEMORY_GROWTH_FLATTENS_OVER_THE_CYCLES` — rule (b): `first = max(0, cycle_10 - cycle_1)` (growth over the first half, from the **warm**
  baseline after the first cycle has allocated what a visit needs), `second = min(max(cycle_15, cycle_20), idle) - cycle_10` (growth over the
  second half that **persists**: the second half's peak, but no higher than what remained after idle), pass iff `second <= 0.6 * first + 15,000`.

Arithmetic on the two real curves (the extraction test asserts exactly these numbers):

| Journey | before | c1 | c5 | c10 | c15 | c20 | idle | (a) | (b) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #9 | 470,776 | 496,657 | 515,595 | 528,369 | 535,671 | 568,399 | none | FAIL (no sample; 568,399 as idle would also fail: allowed 561,392) | FAIL: first 31,712 → allowed 34,027; second 40,030 |
| #11 | 478,789 | 507,807 | 506,093 | 503,946 | 508,024 | 582,687 | 482,508 | PASS: allowed 570,607 | PASS: first clamps to 0 → allowed 15,000; persisting second half 482,508 − 503,946 = −21,438 |

**Two interpretation choices, made so that both requested expectations hold (journey #9 → FAIL, journey #11 → PASS); please confirm them:**
1. The first half is measured from **cycle_1** (warm), not from `before_cycles`. Measured from `before_cycles`, journey #9 would PASS rule (b)
   (first 57,593 → allowed 49,556 ≥ 40,030), contradicting the requested outcome.
2. The post-idle sample **participates in rule (b)** (the second half's end value is `min(peak, idle)`): journey #11's 582,687 KB spike at cycle 20
   was released after idle (482,508). Under the literal "cycle_10 → cycle_20 peak" reading, journey #11 would FAIL rule (b) (78,741 > 30,094 or
   15,000 under either baseline), contradicting the requested outcome. The peak itself is still reported (`peak_kb`, `second_half_peak_kb`).

What the rules catch: a linear leak of ≥ ~4.2 MB/cycle fails (b) on its own; total growth above 15 % + 20 MB fails (a); a warm-up that flattens or
is released after idle passes both. A slow linear leak around 3 MB/cycle over 20 cycles passes both (that is what the requested thresholds allow).

Verified by extraction (`test_change1_memory.py`, 14 cases): the two rows above, a synthetic 5 MB/cycle leak (fails both), a flattening warm-up
(passes both), missing/negative samples (fail). Not testable here: the 20 s idle wait and the extra `dumpsys meminfo` on the device.

## 2. Stray-open strictness and the swipe gutter (`s_paging`) — commit `5646b24b`

- `LIST_OPENED_NO_TASK_BY_ITSELF_WHILE_PAGING` passes only with **zero** stray opens (the first one is red). The recovery (Back, continue)
  stays, so a run still yields the paging evidence. Each stray open keeps a bounded reproduction record in `REPORT['paging']['strayOpens']`
  (at most 5): `swipe` index, `swipeStart` / `swipeEnd` (x, y of the swipe that preceded it), `titlesBefore` (the visible titles before that
  swipe), `detailTitle` (the task the detail shows), `titlesAfter` (after the return), and `trace` = the last 40 `USKOCI_` app trace lines
  (`app_trace_tail(40)`). The check carries the records without the trace.
- `NO_RUNAWAY_PAGE_REQUESTS` is `len(cursor) <= pages * 2`, **not** widened by stray opens any more (`strayOpens` stays a fact).
- Detail recognition is one shared helper, `looks_like_task_detail(root)`: no list top line (`list-count` / `list-count-words`), no card, and
  one of `DETAIL_MARKERS = ('Sastavi prijavu', 'Mesto zadatka', 'O zadatku', 'Lokacija:', 'Termin:')`; `detail_title(root)` reads the
  fixture title (`P6N nnn KIND`) from the detail's own text node.
- Gutter: `PAGING_SWIPE_X = 0.985`. Arithmetic (also in the source comment): the card's press area with its hit slop ends near x = 1049 px on the
  1080 px CI screen; `0.975 * 1080 = 1053` px left ~4 px; `0.985 * 1080 = 1063.8` px leaves ~15 px of gutter and is 16 px inside the screen edge
  (3-button navigation, no edge gesture zone). `scroll_list` now returns `(x, y_start, y_end)` so the record can hold the real swipe geometry.

Verified by extraction (`test_change2_strays.py`, 14 cases) **against the real saved uiautomator dumps**: journey #11's detail (`P6_05_detail.xml`,
recognised; title `P6N 099 NOPOINT`), full list and top-line list (not a detail), the task Peek over the map (not a detail), and journey #10's
paging closing screen (`P6_04_paged_to_end.xml` of run 36704063863 — the stray detail: recognised, title `P6N 051 DENSE`, matching ROUND_70
finding 20's `preopen` for P6N 051). `scroll_list` with stubbed adb issues `swipe 1063 1920 1063 840 800`. Not testable here: whether 0.985 is
far enough on the CI emulator (a stray open would now be a red check with its record).

## 3. Vacuous / weak checks — commit `43ea9ccb`

| Check | Before | After |
| --- | --- | --- |
| `DETAIL_SHOWS_TITLE` | `check(..., True)` | the tapped title must be among the settled detail's own labels **and** the screen must be a task detail (`looks_like_task_detail`); facts: matched labels, `detailTitle` |
| `MAP_MARKERS_VISIBLE_AT_PEEK` | `bool(pills) or sheet_full` | if the route opened with the sheet full, `ensure_peek()` lowers it first (recorded as `sheetLoweredForMarkers`, snapshot `P6_02b_route_lowered`), then `bool(pills)` with no escape |
| `MAP_LAYER_SHOWS_A_MAP` | `zoom or credits or sheet_full` | `zoom or credits` (after the lowering) |
| `P6_MAP_READER_CALLED` | only when the sheet was not full | always: waits up to 30 s for a MAP read since the route opened |
| `EVERY_RETURN_SHOWED_THE_SHEET` | `all(s <= 45)`, blank count recorded only | `all(s <= 45)` **and** at most 2 blank first looks; every return now records its index and the step it happened in (`CURRENT_STEP`), the check lists `blankReturns` and `blankSteps` |
| filters race | both taps in one shell command, gap unknown; the driver already issued `input tap … ; input tap …` in ONE adb shell (the review's "two invocations" is right in the sense that each `input` is its own Java process, 0.3–1 s each) | the device clock is read **before, between and after** the taps in the same shell command (`echo T=$(date +%s%N)`; probed once — toybox `%N`, else mksh `$EPOCHREALTIME`, else seconds); `tap_gap_from_stamps` reports `firstTapCommandMs`, `secondTapCommandMs`, `estimatedTouchGapMs` (= second command's duration: each `input` injects its touch just before it exits), `upperBoundMs`; new check `RACE_TAP_GAP_MEASURED` (three stamps, sub-second resolution); the race checks carry `touchGapMs`, `bothIntentsReachedServer` (both `remote` and `onsite` PAGE bodies harvested) and `secondTouchBeforeFirstAnswerLikely` (gap < the remote filter's measured answer time) — recorded, not gated |
| `PAGING_SAW_ALMOST_EVERY_TASK` (`>= TOTAL - 3`) | renamed `PAGING_SAW_EVERY_TASK`: all TOTAL indexes seen, `missingIndexes` named |
| cursor continuity | none | `PAGING_CURSORS_STAY_IN_ONE_SCOPE` (when cursor requests exist): every harvested cursor body (`after`, the exact JSON the app sent, kept in full by the harvest) carries the first cursor's `scopeKey` and is whole (`section` 0/1, `sortAt`, `id`); `brief()` gains `afterScope`; the bounded cursor sequence is in `REPORT['paging']['cursors']` |

Verified by extraction (`test_change3_checks.py`, 24 cases): clock resolution by magnitude (ns/us/ms/s, fractional `EPOCHREALTIME`), gaps from
real-shaped stamp output (612/568 ms), seconds-only output is *not* a measurement, `%N` unsupported (`…N`) is not, digits outside `T=` markers
are ignored, the probe picks the finest clock with a stubbed adb, `cursor_continuity` (same scope passes; another scope, a non-object cursor, an
impossible section, a missing id fail; bounded output), `brief()` with/without a cursor. Not testable here: the real toybox `date +%s%N` output,
whether the detail's labels match `DETAIL_MARKERS` for the viewer account on the proof APK (the P6_05 dump says yes for the production flavour).

No existing check was weakened; two were renamed (`NO_OBVIOUS_MEMORY_GROWTH` → the two memory checks, `PAGING_SAW_ALMOST_EVERY_TASK` →
`PAGING_SAW_EVERY_TASK`) and four were added (`RACE_TAP_GAP_MEASURED`, `PAGING_CURSORS_STAY_IN_ONE_SCOPE`, plus the eight `FLOOD_COMPARE_*` of
section 4 in the proof flavour).

## 4. Flood comparison step `flood_compare` — commit `f5f03e0f`

Purpose: settle "no new freeze" with data: the SAME scenario on the legacy reader and on the P6 reader, same build, same emulator session, same
log harvest. Runs only in the `proof` APK flavour (the ordinary Zadaci tab = legacy reader, `uskociapp://zadaci?p6Proof=1` = P6 reader); in the
`production` flavour the step records `REPORT['floodCompare'] = {'skipped': …}` and a `FLOOD_COMPARE_SKIPPED` note, adds no check, and passes.
It is appended **after `final`** in `main()`'s step tuple, so the existing order is unchanged; a focused run names it in
`supabase/proofs/discovery/p6_native_journey_steps.txt` (not edited here). Constants near the top: `FLOOD_CYCLES = 10`,
`FLOOD_REPEAT_BUDGET_S = 45 * 60`, `LEGACY_ROUTE = 'uskociapp://zadaci'`, `DRIVER_STARTED`.

Per phase (`flood_phase`): `reader_calls()` baseline → the route (legacy: press the bottom-most "Zadaci" tab like `s_ordinary_route`; if within
45 s no `rpc_list_open_tasks_v3` call followed — the tab can still carry the earlier proof parameter — the ordinary deep link **without** the
parameter is opened and recorded as `routeFallback`; P6: `LIST_URL`) → list at full height (`flood_ensure_full`, whose recovery re-opens the
phase's own route, never the proof link from a legacy phase) → PSS and pid → `dumpsys gfxinfo <package> reset` → remember the size of
`ARTIFACT_DIR/logcat.txt` → 10 × (second visible card → its detail: `looks_like_task_detail` + title, 45 s → Back → `back_to_list` waiting for the
same card → `settled_card`), each cycle recording `tapToDetailS`, `backToListS`, `cardBack`, `settled`, `fullAfterReturn` → `dumpsys gfxinfo` parsed
(`parse_gfxinfo`: frames, janky and %, p50/90/95/99; the `gpu percentile` lines are excluded) and saved as `flood_<phase>_gfxinfo.txt` → the
appended logcat bytes scanned **streaming** in 8 MB chunks (`read_file_span_chunks` + `scan_logcat_chunks`: a line split across chunks counts
once; never the whole file) for `Davey! duration=Nms` (count, count ≥ 700 ms, longest; for every process AND for the app's own pids — the real log
shows Davey lines from the launcher/system UI pids too, so the app's pids decide, recorded as `daveySource`, all-process counts kept as data) and
`synchronouslyUpdateUIProps failed` lines → reader-call deltas from the route on → PSS after. `launch_clean` is never called.

Order: legacy → P6 → verdict checks → legacy again (`legacyRepeat`, only while the driver has run less than 45 min; judged by the same rate rules
as `legacyDrift`, information only, an exception there is recorded and never fails the step). In a whole-journey run the driver is usually past
45 min at this point, so the repeat is skipped and the step adds about two phases (≈ 15–20 min on the CI emulator: journey #11/#12 returns took
15–33 s each); a focused run gets the third phase.

Checks, declared before measuring, each with all its numbers and a `rule` string (`flood_verdicts`, pure):
- `FLOOD_COMPARE_LEGACY_COMPLETED_ALL_CYCLES`, `FLOOD_COMPARE_P6_COMPLETED_ALL_CYCLES`: completed (detail reached AND list back with the card) = planned = 10.
- `FLOOD_COMPARE_LEGACY_USED_THE_LEGACY_READER_ONLY`: `rpc_list_open_tasks_v3 >= 1 and rpc_discovery_v1 == 0` from the route on;
  `FLOOD_COMPARE_P6_USED_THE_P6_READER_ONLY`: the reverse.
- `FLOOD_COMPARE_P6_LONGEST_FREEZE_NOT_LONGER_THAN_LEGACY`: `p6_max <= max(1.25 * legacy_max, legacy_max + 1000)` ms.
- `FLOOD_COMPARE_P6_FREEZES_PER_CYCLE_NOT_MORE_THAN_LEGACY`: `p6_over700 / p6_cycles <= 1.25 * (legacy_over700 / legacy_cycles) + 1`.
- `FLOOD_COMPARE_P6_JANKY_FRAMES_NOT_MORE_THAN_LEGACY`: `p6_janky_percent <= legacy_janky_percent + 5` points.
- `FLOOD_COMPARE_P6_DEAD_TAG_LINES_PER_CYCLE_NOT_MORE_THAN_LEGACY`: `p6_dead / p6_cycles <= 1.5 * (legacy_dead / legacy_cycles) + 100`.
- A missing number (no gfxinfo line, no log counts, zero completed cycles) fails the rule that needs it.

Verified by extraction (`test_change4_flood.py`, 39 cases): `parse_gfxinfo` on the **real** dump saved by the local check
(`Temp/p6dev_final2/gfxinfo.txt`: 5704 frames, 1800 janky = 31.56 %, p50 31 / p90 53 / p95 77 / p99 300 ms; the gpu block not taken); the
streaming scan on the **real line shapes** of journey #11's log (HWUI Davey from pids 945/1408/2401, Reanimated from 2401) cut at chunk sizes 1, 7,
64 and 1 MB (identical counts: all 5/4/1917, app 2/1/1917, dead-tag 3 / app 2), a last line without newline, no pid known; the span reader on a
growing file; `verdict_counts`; the verdicts for equal phases (all pass), P6 within tolerance (2999 ms, 2.2/cycle, 36.4 %, 240/cycle pass), P6
worse on every rule (all four rate rules FAIL, completion/reader pass), each bound just exceeded (3001 ms, 2.3/cycle, 36.6 %, 251/cycle fail),
legacy without freezes (P6 may show ≤ 1000 ms and ≤ 1 per cycle), missing gfx/log, incomplete phases, reader discipline (a "legacy" phase that ran
on the P6 reader fails). Not testable here: everything device-side of `flood_phase` (section 7).

## 5. Module docstring — in commit `f5f03e0f`
The docstring now lists every step in order with one line each, including `flood_compare`.

## 6. The slip found in review — commit `1c212c96`
The memory and cursor-continuity checks were written as `check(name, verdict['ok'], **verdict)`; the verdict dicts carry their own `ok`, so
Python would have raised `TypeError: check() got multiple values for argument 'ok'` the first time the cycles or paging step reached them.
`facts_of(verdict)` drops the key at the three call sites. `test_change5_callsites.py` (6 cases) reproduces the TypeError, runs the exact call
pattern through the extracted `check`, and scans the driver's AST so that no `check(...)` spreads a rule result directly.

## 7. Not tested here — needs the CI emulator (one focused run confirms all of it)
1. The legacy Zadaci screen exposes the same `list-count` / `list-count-words` / `discovery-sheet-background` testIDs and `Otvori priliku|Zadatak
   P6N …` card labels as the P6 screen. Basis: `src/app/(app)/zadaci.tsx` renders `DiscoveryPresentation` for both readers. No saved journey ran
   the proof flavour, so no legacy inventory exists yet.
2. Pressing the "Zadaci" tab after the journey's `?p6Proof=1` deep link: whether the tab keeps the proof parameter (then the recorded fallback,
   the parameterless deep link, must mount the legacy screen; `selectDiscoveryReader` reads `useLocalSearchParams` on every render).
   `FLOOD_COMPARE_LEGACY_USED_THE_LEGACY_READER_ONLY` judges the outcome either way.
3. toybox `date +%s%N` on the API-35 emulator (else `$EPOCHREALTIME`, else `RACE_TAP_GAP_MEASURED` fails honestly with `resolution: s`).
4. `dumpsys gfxinfo rs.uskoci.dev reset` and the read-back format on API 35 (the parser was shaped on an Android 16 dump).
5. Whether the viewer's detail on the proof APK carries one of `DETAIL_MARKERS` (`Sastavi prijavu`, `Lokacija:`, `Termin:`, `O zadatku` are in the
   production-flavour dump; `Mesto zadatka` is kept for older builds).
6. The run time of a whole journey with `flood_compare` (about +15–20 min; the workflow allows 90 min; journey #12 took ≈ 47 min of driver time
   plus ≈ 15–18 min of setup) — if it does not fit, the step is best run focused, as the pointer file already allows.
7. The two new memory checks, the idle sample, the stray-open zero tolerance at x = 1063 px, the lowered-sheet marker check, the cursor
   continuity on real cursors, and the blank-return bound, on a real run.

Extraction test files (scratchpad, not committed): `harness.py`, `test_change1_memory.py`, `test_change2_strays.py`, `test_change3_checks.py`,
`test_change4_flood.py`, `test_change5_callsites.py`, `run_all.py`, `flakes.py`.

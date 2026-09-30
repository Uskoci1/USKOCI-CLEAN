# USKOČI QA robot — what it is, what it proves, and its modes

Owner directive (2026-09-30): **keep the QA robot; develop FAST / FOCUSED / FULL / physical-device modes later; run the FULL journey only at checkpoints.**
This page is the single description of the robot so that it is preserved, not rebuilt. It is not a second tracker (status stays in `docs/control/redovi.json`).

## 1. What exists today

| Piece | Path | What it does | Where it runs |
| --- | --- | --- | --- |
| Native journey driver | `scripts/p6_native_journey.py` (borrows input/ANR helpers from `scripts/ru5_android_device_ui_journey.py`) | Real UI input only (uiautomator + `adb input`): sign-in through the app's own sheet, 12 steps (`login`, `ordinary_route`, `route`, `open_full`, `paging`, `detail_back`, `cycles`, `filters`, `map_pins`, `search_places`, `map_gestures`, `final`), ~91 named `check(...)` results, per-step snapshots (PNG + XML + inventory), memory/ANR/Davey/dead-tag log summary, the exact `rpc_discovery_v1` request bodies read back from the disposable database's statement log (incremental `docker logs --since`) | GitHub Actions only |
| Journey workflow | `.github/workflows/p6-native-journey.yml` | Boots a DISPOSABLE Supabase (live79 → replay → PKG045b P0 form → rollout), seeds `supabase/proofs/discovery/p6_native_fixture.mjs` (2 real Auth users, 100 published tasks), installs the proof APK on an API-35 x86_64 emulator, runs the driver, uploads artifacts, enforces the evidence gate. Refuses when `src/ assets/ app.json package*.json` differ from the recorded APK's source | Push on its own paths (pointer files below) |
| APK builder | `.github/workflows/p6-native-apk.yml` (flavour `proof` or `production` in `p6_native_apk_flavor.txt`) | x86_64 APK bound to the disposable endpoint (10.0.2.2:54321) | Push on `p6_native_apk_build.txt` / flavour file |
| Pointer files | `supabase/proofs/discovery/p6_native_apk_run.txt`, `p6_native_journey_mode.txt` (`probe`/`full`), `p6_native_journey_steps.txt` (empty = whole journey) | Select which APK run, which mode and which steps a push runs | Repo |
| Client final check | `.github/workflows/p6-client-final-check.yml` | `tsc` + the full Jest suite in CI | Push on its marker |
| Server proofs | `p6-four-mode-proof`, `p6-http-boundary-proof`, `p6-rollout-v3-proof`, `p6-round71-load-v3`, the 30k load workflows | SQL-role, real Auth/PostgREST, exact-body, revert round trips, 30k screening | CI, disposable databases |
| Local device check (read-only) | `scripts/p6_dev_emulator_check.py` (the name predates the phone; kept so that references stay valid) | adb + uiautomator against a signed-in build talking to canonical DEV: list count, pan/zoom, fast flings, N open/Back cycles, PSS memory, pin timing (30 touches, JS-clock trace `USKOCI_P6_TRACE`), health (ANR, crash, exit-info, Davey, dead-tag lines) and frame statistics PER PHASE. Device chosen by `--serial` / `--device physical\|emulator\|auto`, `--reader p6\|legacy`, `--label`, `--restart`, `--route`; one report per run with the device profile and the installed APK's SHA-256 | The owner's PC: the physical HONOR first, the AVD second |
| Device targeting | `scripts/qa_device.py` | Choose a device by serial (explicit, `QA_SERIAL`, `ANDROID_SERIAL`, or the only device of a kind), read-only device/app profile, the UI tree over stdout, the app's log streamed by uid to a local file, the foreground app; `--selftest` needs no device | Local scripts (the CI journey driver adopts it later) |

## 2. The modes (target design)

| Mode | Purpose | Budget | Runs | Evidence it must produce |
| --- | --- | --- | --- | --- |
| **FAST** | Catch logic errors before any native run | minutes | every change; no emulator | `tsc`, the focused Jest files for the changed paths (impact map first), contract tests (`needsColumnBoundaryContract`), SQL/contract proofs when a server file changed |
| **FOCUSED** | Reproduce or verify ONE native behaviour | 10–25 min | on demand, on the CI emulator | The named steps only (`login` always), their checks, snapshots, the report JSON. **To build:** `workflow_dispatch` inputs (`apk_run`, `flavour`, `steps`) so a focused run needs no pointer-file commit and no cancellation of a full run (separate concurrency group) |
| **FULL** | Acceptance of a checkpoint | ~65 min | **checkpoints only**, on an APK whose source equals HEAD's client source; a closure wants two consecutive PASS | All 91 checks, every step's snapshots, memory cycles, request log; accepted evidence copied out of CI retention |
| **PHYSICAL DEVICE** (owner rule 2026-09-30: the PRIMARY local device; the AVD is secondary/regression) | The measurements an emulator cannot certify (responsiveness, gestures, microphone, permissions, push) and, from now on, the everyday FAST/FOCUSED native checks | minutes per focused run, ~10 min for the whole local check | the owner's HONOR, one build at a time, installed with `adb install -r` only | Reference phone/OS/build hash/network, ≥ 30 repetitions of pin feedback, loaded pin → card and warm return with p50/p95/max, frame statistics per declared phase, 20-cycle memory (baseline/peak/final after idle), ANR/freeze count. `scripts/p6_dev_emulator_check.py` with `--device physical` (parametrise the package: `--package rs.uskoci.dev` / `rs.uskoci.preview`) |

## 3. Known hazards and the fixes to build in

1. **Never `import` the driver.** It runs its journey at import and `launch_clean()` does `adb shell pm clear <package>` on whatever emulator is attached (this wiped a signed-in local session on 2026-09-30). Build in: a `__main__` guard, and refuse the destructive clear unless the serial is an emulator, the disposable database is reachable and `P6N_ALLOW_CLEAR=1` is set.
2. **A slow swipe on a stalled CI emulator can arrive as a press** (journey #10). Swipes start in the gutter right of the cards; a step that finds itself on a task detail comes back and counts it (fail above three).
3. **The statement log is huge** (hours of `log_statement=all`): read it incrementally; never `Read` the 2 GB `logcat.txt`, `grep -a` it once.
4. **Pointer-file commits start runs and cancel a running one** (one concurrency group): the `workflow_dispatch` mode above removes the need.
5. **A differential mode is missing:** run the SAME scenario on the legacy reader and on the P6 reader in one build (the `proof` flavour has both) and compare Davey/dead-tag/return/pin numbers, to settle "no new freeze / no regression" with data instead of an argument (`ROUND_70_P6_NATIVE_ACCEPTANCE.md`, noise section).

## 4. What each mode may claim

FAST: logic and contracts. FOCUSED/FULL: behaviour on the CI emulator against a disposable server (software GL: timings are NOT phone timings). PHYSICAL DEVICE: the only mode that may state responsiveness numbers or certify the runbook's interaction targets. iOS needs its own device/simulator lane and is not covered by any mode above.

## 5. Devices, serials and the two-device lane (owner direction 2026-09-30, standing)

**Policy.** The physical HONOR is the primary local Android QA device where that is technically safe and sensible; the AVD `USKOCI_V5_TEST` is the secondary / regression device; the disposable CI journey is for checkpoints and releases, not for daily work.
FAST and FOCUSED P6 checks run on the HONOR first. Phone numbers and emulator numbers (local AVD, CI emulator) are recorded in separate, labelled columns of a receipt and are never mixed: a receipt names the device profile and the APK's SHA-256 (`report.json → device`).

**Choosing a device (no hard-coded serial).** `--serial S`, else `QA_SERIAL` / `ANDROID_SERIAL`, else `--device physical|emulator|auto` (`auto`: the one physical phone, else the one emulator; an ambiguous or missing choice is an error that lists what is attached).
Every adb call of the local check goes through `qa_device.Device` with `-s`. The CI journey driver still calls plain `adb` (one emulator per runner): `ANDROID_SERIAL` selects its device for a local disposable run; it adopts `qa_device.Device` when its next change window opens (the file is a CI trigger path, see §3.4).

**Safety on a phone that is somebody's own (all enforced by the local check, none of it optional).**
- Input is taps, swipes and Back only, and NEVER while another app has the screen: every input is preceded by a foreground check (`guard()`); a launcher, a lock screen or another app in front ends the run with `foregroundLost` in the report (only the foreign package name is recorded, nothing is captured of that screen).
  This exists because a phone in use changes its front app at any moment (found on the first phone runs: the app was removed from Recents mid-run and blind swipes reached the home screen).
- Nothing is typed, sent, cleared, uninstalled or reconfigured: no `pm clear`, no sign-out, no `settings put`, no `logcat -c` / `-G`. The UI tree comes out over stdout (no file on the phone) and the log is streamed by the app's uid to a local file.
- The process is restarted (a force-stop; data and the session stay) only with `--restart`. An update of the build is `adb install -r` after the signing certificate matches; anything destructive on the phone needs the owner's explicit OK first.
- Numbers are only as good as the build: the installed APK's version, install time and SHA-256 are in every report, and a build that is not the candidate is labelled as such (the first phone baseline ran on the ROUND58 proof build, `3e933f37…`, LEGACY reader).

**Two devices, one scenario (later; built incrementally, never a second harness).** HONOR = person A, emulator = person B, two separate test accounts in the TEST world, one scenario:
Task → Discovery → Application → Selection → Agreement → Chat → Push → Completion → Rating. Design: a small orchestrator in this same robot runs two `qa_device.Device` sessions with named barriers ("A published", "B sees the task", "B applied", "A selected", "agreement", "message A→B", "push seen on B", "completion", "ratings");
each side uses only the UI (no server shortcuts) and the receipt lists which side saw what and when, with each device's own clock. Stages: **E2E-0** device targeting and per-device receipts (done for the local check); **E2E-1** the same journey driver runs on either device by serial;
**E2E-2** two devices, one account each, the publish → discover → apply half; **E2E-3** selection → agreement → chat; **E2E-4** push (needs a push-capable package on both devices, `rs.uskoci.preview`) → completion → rating.
Preconditions that are NOT met yet and are owner-side or server-side: two signed-in TEST-world accounts on two devices (the AVD's session was lost on 2026-09-30), the current P6/product build installed on the phone (an ARM64 build has to be produced first), push configuration for the package under test.

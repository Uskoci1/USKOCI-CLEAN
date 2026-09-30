# Round73 — physical HONOR phone: what was measured on 2026-09-30, and what was not

Status: **PHYSICAL HONOR BASELINE OF THE LEGACY READER + LEGACY SMOKE AGAINST CANONICAL DEV: RECORDED. THE P6 CANDIDATE HAS NOT RUN ON THE PHONE.** The 100 / 200 / 350 ms interaction targets are therefore NOT measured on a phone; they stay the mandatory later step
(`docs/control/redovi.json` row `P6-FIZ`). Nothing here certifies P6 performance; it fixes what a phone shows today and what the phone runs need.

## Device and build (the receipt's conditions; every number below belongs to this pair only)
| | |
| --- | --- |
| Device | HONOR VKP-NX9 (MagicOS, Android 16 / SDK 36), arm64-v8a, SM8750, 1264 × 2728 at 560 dpi, 11.5 GB RAM, panel 60/90/120 Hz (the display service reported 60 Hz during input), Europe/Belgrade; battery 52–77 %, charging, thermal status 0 throughout; USB, owner's phone, owner's session (signed in, TEST-world account) |
| Package / build | `rs.uskoci.dev` versionCode 35, installed 2026-09-29 15:03, APK SHA-256 `3e933f37096a9f0e583d8a0656805e8e4c47b62ec8928f201839d03226d88de1` = the ROUND58 guarded proof build, source `176dddda`, CI run 36560382420. **Not the P6 candidate:** 15 client commits behind HEAD, no `USKOCI_P6_TRACE` lines, the ordinary Zadaci route is the LEGACY reader |
| Backend | canonical DEV, ledger 212 (PKG045b applied 2026-09-30 10:28Z, P6 rollout v3 11:06Z); 7 tasks in the list, 3 with a map point, 4 without |
| Tool | `scripts/p6_dev_emulator_check.py` (device-agnostic since this round) driven over adb: taps, swipes, Back only; no typing, no data cleared, no sign-out, no install; UI tree over stdout, log streamed by uid to a local file; `--reader legacy` |
| Evidence | `round73-physical-honor/` (report.json per run, per-phase `gfxinfo_*.txt`, `exit-info.txt`, console output, two screenshots with the status bar cropped; the device serial is withheld; the raw device log stays local) |

## Run 6 — twenty FULL → detail → Back cycles, pan/zoom, flings (legacy reader), RESULT PASS, 16 checks
| Measure | PHYSICAL HONOR (legacy reader, ROUND58 build) | CI emulator (x86_64 API-35, software GL, P6 candidate 650d340d, journey #12) | local AVD (host GPU, P6 candidate 42371918, canonical DEV, Round 70 local section) |
| --- | --- | --- | --- |
| ANR | **0** (exit-info 0; log 0) | **1** (paging step, 5,005 ms input wait, see the classification in `P6_CLOSURE_RECEIPT.md`) | 0 |
| Frames over 700 ms (Davey) | 9, max **919 ms** | 205, p50 1,000 ms, p95 3,963 ms, max **10,116 ms** | 25, max 3,351 ms |
| Reanimated dead-tag failures | 17,637 lines in about 6 min (about 49 per second) | 111,623 failed updates (up to 462 per second) | 16,534 lines (20 cycles) |
| Janky frames (system `gfxinfo`) | pan/zoom 0.51 % of 197 frames, p99 15 ms; flings 2.78 % of 108, p99 21 ms; **cycles 4.08 % of 2,180, p50 5 / p90 13 / p95 20 / p99 65 ms**, 8 missed vsyncs, 71 slow UI thread | not comparable (software GL) | 31.6 % of 5,704 |
| Return time, Back → cards seen | 2.67–4.46 s, p50 3.43 s, p95 4.15 s — **an upper bound, not the target's metric**: it is polled through `uiautomator dump` (about 1.3 s per read on this phone) | median 28.7 s (driver-judged) | JS clock: p50 0.745 s, p95 1.054 s (n = 20) |
| PSS memory | 559 MB before, 595 → 640 MB over the 20 cycles (+7.6 % from cycle 1), 583 MB after 10 s idle (+4.3 % over the start) | 470 → 568 MB monotonic (journey #9, no idle sample) | 320 → 453 peak → 426 MB idle |
| Process | one process, no death, no crash | one ANR, process survived | one process |

**What the phone says about the CI numbers.** The multi-second freezes of the CI emulator are the emulator: the same Reanimated failure mechanism exists on the phone (17,637 lines) but the longest frame is 0.9 s and there is no ANR. The dead-tag flood is real on real hardware and is not a P6 thing (see below).

## Run 7 — the older client's reads against canonical DEV after PKG045b and rollout v3 (P6-06 legacy smoke), RESULT PASS
Home, Zadaci tab, Dogovori tab, Moji zadaci, a task's detail and Moje prijave each opened without any error text (6 of 6). The installed build predates the P6 rollout and the restricted `needs` column grants, so this is the "an old client keeps working after the database change" evidence, on a real phone against the real DEV project.

## Run 5 — nine clean cycles, then the detail's own error state
On the tenth open the task's screen appeared and showed the app's own state **"Zadatak nije dostupan — Zadatak trenutno nije moguće učitati. Proveri vezu i pokušaj ponovo."** (the detail read failed; the device log shows nothing about it). One in 30 detail opens over runs 5 and 6 (run 6 had none in 20). This is the LEGACY detail route on the ROUND58 build; it is recorded as an observation, not classified as a P6 defect (the detail route is shared, and no request trace exists in that build). The check script now records this state as `CYCLE_n_DETAIL_READ_FAILED` and goes on.

## Findings about the measuring, kept because the phone is somebody's own
1. **The app was removed from Recents twice by something other than the script** (exit-info reason `USER REQUESTED / REMOVE TASK` at 15:52:59 and at 16:07:11) and the script's blind swipes then reached the launcher's home screen once (a page swipe, nothing opened or changed). Every input is now preceded by a foreground check and the run ends at once with `foregroundLost` (package name only, no screenshot of a foreign screen). The owner was asked not to touch the phone during a run.
2. **The fourth run's taps pressed the floating "Mapa" pill**: on this phone the FULL list shows two very tall cards and the lowest card's centre lies under the pill. Tap points now avoid other clickable controls. A driver flaw, not an app defect.
3. `logcat -c` / `-G` are no longer used; nothing on the phone was cleared, resized or reconfigured.

## What is NOT measured (each is an explicit limit, none is relaxed)
- **Feedback ≤ 100 ms, loaded pin → card ≤ 200 ms, warm return ≤ 350 ms on the phone**: not measured. The installed build has no JS-clock trace and is not the candidate. The local AVD (JS clock, candidate) gives p95 296 ms / 1,040 ms (includes the exact read over the internet) / 1,054 ms, i.e. the targets are not met on an emulator, and they are stated for the reference phone.
- The P6 reader, the candidate's pin → Peek, filters/search, paging (DEV has 7 tasks: one page), selection restore: not run on the phone.
- Long lists on the phone (the CI fixture has 100 rows, DEV 7): the dead-tag failure count grows with row churn, so the phone's number at 100+ rows is unknown.

## How the missing phone run is made (needs the owner)
The ARM64 build of the candidate is one workflow run: `gh workflow run build-android-dev-apk.yml --ref tmp/cutover-apk3 -f target=phone` (client source identical to the branch head's, `EXPO_PUBLIC_P6_DISCOVERY_READER=1`; it publishes nothing, the release step runs only on `clean-alpha-backend`).
The auto-mode classifier refused that dispatch on 2026-09-30 ("Production Deploy") and it is not worked around; the owner can allow it, dispatch it himself, or supply an ARM64 APK. After that: `adb install -r` (the signature digest 51ed3f60 matches, the session stays), then
`python scripts/p6_dev_emulator_check.py --out DIR --device physical --reader p6 --label "PHYSICAL HONOR | candidate <sha>"` (about 10 minutes, JS-clock feedback / card / return in the report next to the runbook targets).

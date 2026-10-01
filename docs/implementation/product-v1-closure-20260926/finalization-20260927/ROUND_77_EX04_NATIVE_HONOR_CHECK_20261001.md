# Round 77 - EX-04 native check on the physical HONOR (S1 own tasks, S2 own applications, S4 candidates, S3 rating state)

**Status (2026-10-01): FUNCTIONALLY PROVEN ON THE HONOR for the existing-data paths of all four slices; PAGE-BOUNDARY, ERROR, LOADING and RATING-DUE-POSITIVE paths NOT proven (no data / no fixture); two stability loops only partly run (interrupted by an incoming call on the owner's phone).**
Levels (LIVE plan 4.2): SOURCE yes | CI-PROVEN yes | DEV-APPLIED yes (round 76 receipt) | APP WIRED in the DEV APK **yes (three flags ON, DEV workflow only)** | APK BUILT yes | PHYSICAL DEVICE **yes for the paths listed below** | EMULATOR n/a | iOS no | RELEASE no.

## 1. Authority and scope
Owner, 2026-10-01 (verbatim scope): turn on EXACTLY the three proven EX-04 flags for S1, S2 and S4 in the DEV profile only; build a verified ARM64 DEV APK; keep the existing session and data on the HONOR; install with an update that deletes nothing; check EX-04 on the physical HONOR. Do not change the final visual design; no reset, no data deletion, no log-out, nothing on PROD; a state-changing DEV fixture or any new DEV change needs a question first. **Not approved and not done:** B09/PKG-049, the written comment D12, any revert, any DEV write, any PROD action, any dependency.
What this round did NOT touch: `eas.json`, `app.json`, any other workflow, any server object. The only source change is the three environment lines in `.github/workflows/build-android-dev-apk.yml` (commit `bf48a5db`).

## 2. Build and install
| | |
| --- | --- |
| Flags (DEV workflow only) | `EXPO_PUBLIC_EX04_OWN_TASKS_PAGED=1` (S1), `EXPO_PUBLIC_EX04_OWN_APPLICATIONS_PAGED=1` (S2), `EXPO_PUBLIC_EX04_CANDIDATES_PAGED=1` (S4); S3 has no flag (the data shape decides, the old per-Dogovor path stays as the fallback). Kill switch = remove the three lines and rebuild. |
| Source | `bf48a5dbb771e2907d22fa7fc3b4c61f67e1847b`, tree `38262c27ae319c6b030dd4f82ae001cc779947bb`, workflow run `36859811107` |
| APK | `USKOCI-DEV.apk`, 71,251,730 bytes, sha256 `93e487991a010812c7158827d156fc1cf914a234e14f6885d8d7ae5dc840247c`; icon and recovery attestations PASS |
| Installed | `adb install -r` over the existing debug-signed install (same signer `fac61745...`), 2026-10-01 14:52:31 phone time (UTC+2); `pm path` pulled back from the phone is **byte-equal** to the built APK (same sha256); versionCode 35; `firstInstallTime` unchanged (2026-09-29), i.e. no uninstall |
| Baseline | the previously installed legacy APK `11574c02f46b4e4002c73d0feddc27557a286efbdb60bbc77afe69c1b9f39edd` was pulled BEFORE the update and the same screens were collected with it first (flags off) |
| Session and data | kept: the app opened signed in as the same account (label `95db282d`); no data clearing, no sign-out, no uninstall, no setting changed, no `logcat -c`/`-G` |

## 3. Method (taps, swipes, Back and reads only)
Device chosen by adb serial `A8QDVB6522001205`; every input preceded by a foreground guard (any other app in front = no input) and a wake check; UI read through `uiautomator dump` (the native Filteri sheet gives no tree, so it was driven by screenshot coordinates); frame statistics from `dumpsys gfxinfo` reset per phase; process exits from `dumpsys activity exit-info`; uid-filtered logcat; **network behaviour from the DEV `pg_stat_statements` call counters** (reliable) - the Supabase edge_logs were lossy and were not used as proof. Counters are global: only the paged functions are specific to the new build; the other counters also move with background activity.

## 4. Results by slice

### S1 - Moji zadaci (A09), flag ON
* Same content as the legacy build: **Aktivni 2 = 2, Istorija 17 = 17**, identical set AND identical order and text (collected by scrolling to the end of the list in both builds); Nacrti: empty state "Nema zadataka u ovom prikazu" in both; no duplicate and no lost item; the header count ("2 zadatka", "17 zadataka") and the tab counts come from the server and agree with the lists.
* Tabs, search and the native Filteri sheet (the offers filter inside Istorija) behave; the filtered set was an 11-item subset of the 17 (no foreign item, no duplicate).
* Open a task deep in Istorija (after scrolling) and Back: the same three rows were in view at the same positions, i.e. tab and scroll position were kept (no screen recording, so a sub-second flicker is not excluded).
* Network (`pg_stat_statements`, global counters sampled between passes): `rpc_list_my_needs_page` **16 -> 22** over the new-build run (one keyset read per scope visited; every scope is below one page), while the legacy whole-list `rpc_list_my_tasks` kept moving at the same low rate as in the legacy phase (644 -> 653 over the legacy passes, 653 -> 660 over the new-build run, about one per Home visit) - Home still reads the whole list (open item 1).
* Stability loop (open task, Back, x10): **10/10 cycles completed**, no crash, no ANR, no failed cycle; frame stats of the loop 512 frames, 11 janky (2.15 %), p50 5 ms, p90 8 ms, p95 12 ms, p99 19 ms, missed vsync 0.

### S2 - Moje prijave (B10), flag ON
* Tabs and counts from the server: **Sve 4, Čeka te 1, Aktivne 2, Završene 1**; the same four applications as the legacy build (status Izabrana / Poslata / Poslata / Povučena, price and basis of price, number of people "1 osoba" / "Dolazi 1 osoba", area, message), same order.
* **One intended difference:** the term text. Legacy build: "Fleksibilno" for all four. New build: "Fleksibilan termin" and "Fleksibilan raspon · Do 31. dec" - the full term written the way the task card writes it. This is the designed behaviour (`src/data/applicationClientService.ts:98-101`: with the task facts the card says the full term, remote is "Na daljinu"; the whole-list read keeps its older wording), it is the "complete term" the page read was built to carry, and `cdl-a03-need-read-equivalence` pins the text. It is not a regression; it is visible content that changed, recorded here so it is not a surprise.
* Network: `rpc_list_my_applications_page` **12 -> 23** over the new-build run (four tabs plus returns); the 4-argument signature is gone from DEV (round 76 receipt) and the 5-argument one answered every call. The whole-list `rpc_list_my_applications` kept moving with Home only (969 -> 976).
* Stability loop (open, Back, x10): **only 4 cycles ran** (open -> marker 2.31-2.38 s, Back -> home 2.24-2.33 s, both including the UI-dump polling, so they are an upper bound and NOT a latency measure); then an incoming call on the owner's phone locked the screen at 15:21 and the loop stopped on "tap target not found" - the screenshot taken then is the lock screen with the call (`foreground` was no longer `rs.uskoci.dev`). Not an app fault: the process was never restarted (pid 12065 for the whole run, no new exit-info entry). The remaining 6 cycles were NOT run.

### S4 - Kandidati (A11), flag ON
* Task "Pomoć pri nošenju ormara": "2 prijave · 0 za izbor", the two applications in whole-list order (Redom pristizanja), prices 2.000 RSD and 5.000 RSD, the first one marked "Izabrana prijava"; sort "Najniža cena" reorders correctly; Uporedi shows the same two applications with the price and the term of the task; the counts line stays "2 prijave · 0 za izbor" through sort and compare.
* Network: `rpc_list_need_candidates_page` **4 -> 5** for the one visit; the whole-list `rpc_list_need_candidates` stayed at **42 (0 whole-list reads)** from the first new-build sample to the last (the legacy phase made 1 whole-list read, 41 -> 42).
* Not provable on this data: a second page (2 candidates against a page of 50), the mixed-revision refusal ("Zadatak se upravo promenio. Učitaj Prijave ponovo."), the "Prikaži još" foot, the paging error row.

### S3 - Početna and Dogovori (RC-03 rating state), no flag
* Dogovori: **Aktivni and Istorija 5 = 5, identical set, order and text** versus the legacy build; every row renders as before.
* Početna: the same tiles, "Aktivni Dogovor", "Moji zadaci. 2 aktivna", "Moje prijave. 2 aktivne"; no regression of the existing display.
* Network: `rpc_get_my_agreement_review` (the per-Dogovor eligibility read that `ratingDue` replaces) moved **2062 -> 2086 = +24 over the legacy-build passes** (12:46:54 -> 12:52:10 UTC, before the update at 12:52:31 UTC) and stayed **flat at 2086 (+0) over the whole new-build run** up to the 13:08:40 UTC sample, which includes the Dogovori passes and Home visits.
* Not provable on this account: a Dogovor that is actually rating-due (positive path of the one "Oceni" prompt and of `dueAgreementId`) - it needs the other account or a fixture.

## 5. Crash, ANR, performance
* **Crash/ANR:** none. `dumpsys activity exit-info` for `rs.uskoci.dev` has no entry after "PACKAGE UPDATED" (14:52:31, our own update); the app process pid 12065 lived from the first launch of the new build through the final check (15:24); uid-filtered logcat has no `FATAL EXCEPTION`, no `ANR in`, no `am_crash`/`am_anr`. One burst of a Reanimated dead-tag warning was seen in the logcat (not an exit; its origin was not analysed here).
* **Frames (new build, per phase, small windows):** Dogovori pass 4098 frames, 1 janky (0.02 %), p99 6 ms; S2 tabs pass 227 frames, 5 janky (2.20 %), p99 30 ms, 4 slow-UI; S1 collection with 8 scroll swipes 1051 frames, 27 janky (2.57 %), p99 16 ms, 18 missed vsync; open/Back loop 2.15 % (above). No window had a p99 over 30 ms. These are single runs on one phone with the UI-dump tool polling in the background, so they show **no jank regression signal**, not a budget pass; the EX-03 numbers (round 74/EX-03d) stay the reference for the budget.
* **Memory:** total PSS 428 MB after the 10-cycle S1 loop, 375 MB after the 4 S2 cycles and 329 MB at the final check while the app was in the background after the call (the system trims backgrounded apps): a few samples only, no growth seen, not a leak test.
* **Flicker:** none observed in screenshots of the tab switches and Back returns (screenshots in the scratchpad `shots/`, not committed: they carry the account's real task titles).

## 6. What could NOT be proven (and why)
1. **Page boundary.** The live data is too small (at most 19 tasks, 6 applications, 2 candidates against pages of 30 / 30 / 50): a second page was never requested, so "Prikaži još", stable cursor across a page boundary, the duplicate/loss check at the boundary and the paging-error row are proven only by the disposable CI chain and the Jest suites, NOT on the phone. Options (need the owner): a test-only page-size build variable and a new APK, or a state-changing DEV fixture.
2. Mixed-revision refusal (S4) and the epoch/stale-answer fencing under a real concurrent edit by a second device.
3. Loading skeleton (too fast to catch) and the error/offline state (would need airplane mode or a server fault = a settings change on the owner's phone).
4. Rating-due positive path (S3) - needs the other account.
5. The HTTP/JWT level of the new RPCs through PostgREST as a separate observation (the app's own calls to them succeeded and are visible in `pg_stat_statements`, which is the stronger fact; the schema-cache pickup is therefore proven by use).
6. Remaining stability loops (S2 6 more cycles, Kandidati loop) and a pull-to-refresh duplicate check - interrupted by the incoming call and the owner's own use of the phone; a ~4-minute window would finish them.
7. The two-phone scenario (second person on the emulator) - not part of this approval.

## 7. What EX-04 still has open
* A01 Home counts still read the whole lists of tasks and applications (`rpc_list_my_tasks` and `rpc_list_my_applications` kept moving with every Home visit): a client-only bounded read from the S1/S2 first pages (their counts equal the rules of the client) - not done, the canonical card A01 names the rating addition (S3), not the counts.
* Page-boundary proof on the phone (6.1) and the leftover stability loops (6.6).
* Owner decisions that stay with him and were NOT touched: B09 / PKG-049 (the server enforcing the requester's price - LIVE 9.2: no invented policy) and the written comment D12; both come as separate approval blocks; no revert is approved.
* The flags stay ON only in the DEV workflow; nothing flows to a release profile.

## 8. Next canonical step (LIVE plan)
EX-06 canonical scope check (workflow `ex06-canonical-scope-check`, read-only) -> its scope document -> source -> test -> disposable proof up to the first owner boundary. EX-04 itself waits only on the owner's choice in 6.1 and on a phone window for 6.6.

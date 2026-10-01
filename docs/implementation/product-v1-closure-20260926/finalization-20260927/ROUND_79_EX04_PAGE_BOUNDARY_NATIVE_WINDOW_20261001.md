# Round 79 - EX-04 page-boundary check on the physical HONOR (owner window 2026-10-01, test APK with PAGE_LIMIT=2)

**Status (2026-10-01): PARTIALLY PROVEN. The page boundary was crossed on the phone for S1 and S2 with correct content and order and no duplicate, crash or ANR; S4 (Kandidati), pull-to-refresh, the first six S1 cards of the final walk and the candidate stability loop were NOT proven (a navigation step failed and a check in my script was wrong). EX-04 is NOT closed.**
Levels (LIVE plan 4.2): SOURCE yes | CI yes | DEV-APPLIED yes | APP WIRED yes (DEV workflow only) | APK BUILT yes | PHYSICAL DEVICE partial (below) | RELEASE no.
`PAGE_LIMIT=2` was a **test instrument, never a product value** (owner decision 2026-10-01, option A). The line `EXPO_PUBLIC_EX04_TEST_PAGE_LIMIT: '2'` is **removed from the normal build configuration** in the same session (guard test 8/8 still green with the variable absent). The test APK stays installed on the HONOR until the next normal DEV build replaces it; that APK is a test artifact and is not to be treated as a product build.

## 1. Authority and what was done
Owner, 2026-10-01 ("SAD"): up to 4.5 minutes of exclusive HONOR use for the prepared, verified test APK; keep session and data; no reset; nothing outside the EX-04 test; afterwards remove the test line and record the result. A first attempt found the phone visible to Windows (HONOR 600 Pro) but with **no ADB interface** (empty `adb devices`, USB debugging off); nothing was sent to the phone and the window was not spent. After the owner enabled USB debugging ("sad je telefon povezan, sad može") the run went ahead.
* APK `9ef10b67...18ab` (run 36873169662, source 52a66a76) installed with `adb install -r`: `Success`, `versionCode` 35 unchanged, `firstInstallTime` 2026-09-29 15:03:05 **unchanged** (no uninstall), `lastUpdateTime` moved; session and data kept (the app opened signed in). No clear, no sign-out, no setting change.
* Script `ex04_boundary.py` (taps, swipes, Back, reads and the one install; hard budget 270 s): finished in **274 s**, the last input at about 273 s (the final read-only scan ran 1 s past the budget).

## 2. Results
| Check | Result |
| --- | --- |
| Crash / ANR | **None.** No `FATAL EXCEPTION`, no `ANR in` in the uid log; no process-exit entry during the window. The newest exit-info entry (17:55 phone time, before the window) is a plain `SIGNALED 9` kill of the cached process by the system, the same kind as the earlier ones. |
| Frames (whole window, 2652 frames) | janky 95 (3.58 %), p50 5 ms, p90 10 ms, p95 11 ms, p99 19 ms, missed vsync 57, slow UI 24. Memory PSS 333 MB. |
| **S1 Moji zadaci, Istorija** | The foot control "Prikaži još" was on screen at the first page of 2 and one tap loaded the next page; the rest of the list then grew by itself while scrolling (`onEndReached`), so the foot was needed once. The final walk read **11 cards = baseline positions 6..16 of 17, contiguous, same order, no duplicate, no anomaly, no error row, ending on the baseline's last card**. The first six cards (positions 0..5) were NOT read in that walk (my "back to top" check matched the sticky tab header and returned at once, so the walk began mid-list and the pull-to-refresh did not start from the top). |
| S1 Aktivni | 2 of 2, same order as the legacy build (at 2 per page the whole tab is exactly one page: no boundary to cross). |
| **S2 Moje prijave, Sve** | 4 of 4, **same order and text as the paged baseline, no duplicate**; 4 cards at 2 per page means the second page was read. The foot control was not needed (the second page loaded at once). |
| Back after a deep position (S1) | After Back the list showed other cards than before (the list had grown to the end, then re-read **at most 5 pages = 10 cards at this page size**, so the old scroll offset landed near card 7..10). This is the designed `reloadPages = 5` bound (150 cards at the product page of 30), not a defect, but it means "same viewport after Back" is only guaranteed within 5 pages. |
| **S4 Kandidati** | **NOT PROVEN.** The navigation step to the task and its candidate screen failed with an `AssertionError` (cause not captured: my assertion carried no message). DEV counters confirm no candidate read happened (`rpc_list_need_candidates_page` 5 -> 5, `rpc_list_need_candidates` 40 -> 40). |
| Pull-to-refresh | **NOT PROVEN** (see S1: it did not start from the top). |
| Stability loop Home -> Moje prijave -> Back | **6 of 6 cycles**, no failure. Open to marker 5.07-5.25 s, Back 2.77-3.56 s (both include the UI-dump polling, an upper bound, not a latency). The earlier legacy-page loop measured 2.3 s for the open; the extra time is expected at 2 per page (two page reads instead of one, plus the reconcile read) and was **not** separated from the test instrument. |
| Candidate stability loop (x10) | **NOT RUN** (same navigation failure). |

## 3. Network behaviour (DEV `pg_stat_statements`, global counters, sampled before and after the window)
`rpc_list_my_needs_page` +33 (S1: first pages, tab changes, the 5-page re-read after Back, the walk), `rpc_list_my_applications_page` +13 (S2: about 2 per open x 6 cycles + the walk), `rpc_list_need_candidates_page` +0, `rpc_list_need_candidates` +0, `rpc_get_my_agreement_review` **+0**; the whole-list `rpc_list_my_tasks` / `rpc_list_my_applications` / `rpc_home_attention` each +10 (Home visits only; Home still reads the whole lists - open item A01). Counters are global; only the page functions are specific to this build.

## 4. What is still open for EX-04 (recorded exactly)
1. **S4 page boundary and the candidate stability loop** - needs a second short window (about 3 minutes) with a corrected script (a messaged assertion, a screenshot on failure, the true-top check, pull-to-refresh from the real top, the first six S1 cards). The test APK is still installed, so no new build is needed.
2. **Pull-to-refresh** restart from the first page and no duplicate after it.
3. **S1 cards 0..5 after a boundary crossing**, to close the order check on the full list.
4. Unchanged from round 77: mixed-revision refusal (needs a concurrent edit), loading and error states, the rating-due positive path (needs the other account), Home counts still on whole-list reads.
5. The Back-after-deep-scroll bound (5 pages) is a design limit to remember, not a defect.
Nothing here changes the server, the data or any other build profile.

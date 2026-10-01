# EX-04 (personal lists) - closure receipt (2026-10-01)

**Status: CLOSED WITH LIMITS.** Closed on the owner's word: asked "EX-04: zatvoriti sa granicama, da ili ne?" he answered "DA" (2026-10-01, night). "Closed" means exactly the scope of `EX04_PERSONAL_LISTS_PLAN_20260930.md` (A09 Moji zadaci, B10 Moje prijave, A11 Kandidati and the rating state RC-03 = A01 + D01): paged reads, server and client, applied on DEV, proven on the phone at the test page sizes. It does NOT mean that the wider EX-04 measure of the LIVE plan (5.4: both participants finish a job and recover; 27 P2 flows; 9.3 two-device scenario) has been met - that stays open (limit EX04-L0). The paging error row seen once is recorded (EX04-L2) and reopens EX-04 if it reproduces. B09 is a separate row (closed ZERO-CHANGE, see `b09/B09_ZERO_CHANGE_CLOSURE_20261001.md`); D12 is a separate package.

## What was built and applied (all on canonical DEV, certificate `58447d77...` unchanged, nothing on PROD)
| Slice | What | CI proof | DEV application (owner PRIMENI 2026-10-01) |
| --- | --- | --- | --- |
| S1 A09 | `rpc_list_my_needs_page` completed in place + `private.own_task_counts`; client behind `EXPO_PUBLIC_EX04_OWN_TASKS_PAGED` | run 36836659746 (green again 36846103774) | migration 20261001113449, ledger 216 |
| S2 B10 | `rpc_list_my_applications_page` + `private.own_application_rows`; client behind `EXPO_PUBLIC_EX04_OWN_APPLICATIONS_PAGED` | run 36839658547 (green again 36846103943) | migration 20261001113629, ledger 217 |
| S4 A11 | `rpc_list_need_candidates_page` + `private.need_candidate_states_v5(uuid, uuid[])`; client behind `EXPO_PUBLIC_EX04_CANDIDATES_PAGED` | run 36846103824 | migration 20261001113815, ledger 218 |
| S3 RC-03 | rating state in the Agreement page and in `rpc_home_attention` (added keys only); client without a flag (the data decides, the old per-Agreement path stays as fallback) | run 36846103770 | migration 20261001113949, ledger 219 |

The three flags are ON only in the DEV APK workflow (`.github/workflows/build-android-dev-apk.yml`); removing them and rebuilding is the kill switch. The test-only `EXPO_PUBLIC_EX04_TEST_PAGE_LIMIT` was a test instrument and is NOT in the normal build configuration (guard test `ex04-test-page-limit-guard.test.ts`).

## Levels (never mixed)
SOURCE yes | CI yes (disposable chain, real Auth and PostgREST) | DEV-APPLIED yes | APP WIRED yes (DEV workflow) | APK BUILT yes | PHYSICAL DEVICE yes, partly (below) | iOS no | RELEASE no.

## Phone evidence (HONOR, owner windows)
* ROUND_77 (APK `93e48799`, source `bf48a5db`): same sets, order and content as the legacy build, 0 whole-list candidate reads, review reads per Agreement +24 -> +0, no crash or ANR.
* ROUND_79 sections 1, 5 and 6 (test APK `9ef10b67`, page limit 2 / candidates 1): S1 and S2 crossed the page boundary with correct content and order and no duplicate; pull-to-refresh from the real top restarts at the first page; S1 Istorija 17 of 17 cards in baseline order; S4 2 of 2 candidates and the comparison; 10 of 10 candidate cycles; no crash or ANR over three windows; janky 0.44 % in window 3; DEV counters `rpc_list_need_candidates_page` +22, `rpc_list_need_candidates` +0. Evidence files and the frozen scripts: `ex04-physical-honor/`.

## Limits carried (nothing below is hidden; each has an owner package or a reopening rule)
| Limit | What is open | Carried to / reopens when |
| --- | --- | --- |
| **EX04-L0 the wider row measure** | Both participants finishing a job and recovering (27 P2 flows, plan 9.3 two-device scenario) was never part of the personal-lists scope and is not proven here | The two-device test and the P2 flows; not closed by this receipt |
| **EX04-L1 mixed revision** | The refusal of a page whose revision differs from the first page is proven by CI and unit tests, not on the phone (needs a concurrent edit) | Two-device test |
| **EX04-L2 paging error row** | "Nije uspelo ucitavanje jos zadataka." was seen once in 3 full walks (window 2), not in window 1 or 3; cause undetermined (DEV answered 200, no server error, no concurrent change; the client maps every failure to one message); the "Pokusaj ponovo" control was never exercised on the phone; the loading skeleton was not observed | Reopens EX-04 if it reproduces; otherwise the two-device test |
| **EX04-L3 rating-due positive path** | Needs the other account (an Agreement due for a rating) | Two-device test |
| **EX04-L4 Home counts (A01)** | Home still reads the whole lists for two numbers (page 1 gives the same numbers, proven equal to the client rules); not done because the canonical card A01 names the rating supplement, not the counts | A Home package |
| **EX04-L5 page sizes** | The phone ran the TEST sizes 2 / 2 / 1; the product sizes (30 / 30 / 50) cannot be crossed with the present data (at most 19 tasks, 6 applications, 2 candidates) | A state-changing fixture (needs the owner's word) or real data |
| **EX04-L6 Back after a deep scroll** | Returning to a list re-reads at most 5 pages (150 cards at the product size), a designed bound | Design limit, not a defect |
| **EX04-L7 the installed APK** | CLOSED 2026-10-02 00:19: the test artefact `9ef10b67` was replaced on the HONOR by the normal DEV build `81b8a833...bcf5` (run 36931086522, source `fb865dd7`) with `adb install -r`, `firstInstallTime` unchanged, session and data kept; the lists now load at the product page sizes | Nothing; the product page sizes (30 / 30 / 50) are still not crossed (EX04-L5) |
| **EX04-L8 sample and platform** | One phone, one account, one quiet database; no long session, no second Android device, no iOS; the HTTP/JWT call of the new readers as a separate observed event and the cost at production scale are not proven | Two-device test, release candidate |

## What this closure does not claim
That the lists are fast at production scale, that the error row of window 2 is harmless, that the 27 P2 flows work for both participants, or that anything is ready for release. It changes no code, no server object and no device.

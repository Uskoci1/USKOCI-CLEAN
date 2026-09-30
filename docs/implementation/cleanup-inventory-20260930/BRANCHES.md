# BRANCHES - remote branch inventory (read-only)

> Cleanup pass **C0 preparation**, plan chapter 7 (`docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html`, 7.2-7.6). Inventory only: no branch, tag, PR, release or repository setting was touched. Every DELETE/ARCHIVE below is a **proposal that needs individual owner approval** (plan 7.3: "obrisati samo pojedinacno odobrene, integrisane ili proveren sacuvane reference"). P6 is OPEN, so nothing here should be executed before the owner closes P6.

## 0. Pin, sources and method

| Item | Value |
|---|---|
| Pinned canonical reference | `work/uskoci-ui-unification-20260924` @ `fc58f411598338c8589f5f177626a2790c92fb13` (tip when this inventory started, 2026-09-30 11:24 local). All ahead/behind, merged and patch-equivalence numbers are computed against this fixed SHA. |
| Drift during the run | 5 commit(s) were added to the canonical branch after the pin (tip now `c9071a2f`): `8fb6a9a7` test(p6): evidence collector for native journey artifacts; compact evi; `c184bdd6` docs(plan): live master plan at the current P6 state (journey #8 root ; `c88f897f` fix(p6): independent-review findings (restore watchdog, read deadline,; `650d340d` ci(p6): rebuild the native proof APK (14) and run the full client chec; `c9071a2f` ci(p6): run the FULL acceptance journey on the APK with the review fix. 53 files touched (docs/implementation x37, src/data x7, supabase/proofs x3, scripts/ x2, __tests__/ x1, docs/control x1, docs/current x1, src/ui x1); INCLUDES app/workflow/server/asset files: re-check the findings that cite them. |
| Default branch | `clean-alpha-backend` @ `a047bc0e` ("V5: connect native AI-first flows to the CLEAN engine (#102)"): 1 commit that adds no content vs canonical, 773 commits behind; merge-base `c6edef33` (2026-09-21). |
| Remote branches | 187 (GitHub API `branches` list = 187; SHAs of all 187 matched the local tracking refs at collection time except the canonical branch, which moved). None is protected; no rulesets. |
| Pull requests | 109 total: 13 open (10 drafts), 94 merged, 2 closed. |
| Tools | `git for-each-ref / rev-list --left-right --count / branch -r --merged / cherry / merge-base / diff --raw / grep -w -F`, `gh pr list`, `gh api repos/Uskoci1/USKOCI-CLEAN/branches`. Nothing installed, nothing fetched (tracking refs were already current). |

### Evidence codes

| Code | Meaning | Strength |
|---|---|---|
| `ANC` | branch tip is an **ancestor** of the pinned canonical commit: 0 unique commits, deleting the ref loses nothing | proof |
| `PR#N(m)` | PR #N merged (squash or merge commit) and that merge commit **is in canonical history**; if the tip also equals the PR head there is no post-merge work | strong |
| `CHP` | every non-merge commit is patch-equivalent (`git cherry` "-") to a commit already in canonical (cherry-picked) | strong |
| `UNQn` | n commits whose patch-id is **not** in canonical (`git cherry` "+"): unique work unless a squash-merged PR covers it | needs care |
| `DUP` | several branch names point at the same commit | info |

Limits: `ANC`/`PR#N(m)` prove history, not that the *file content at canonical HEAD* still equals the branch content (later edits supersede it, which is expected). Nothing was fetched from GitHub-only refs (`refs/pull/N/head` stays on GitHub after a branch is deleted, but it is not proven here).

## 1. Result in numbers

| Decision | Count | Meaning |
|---|---:|---|
| KEEP | 11 | protected, active P6 work, owner-deferred privacy branches, bases of open PRs |
| REVIEW | 13 | open PRs / live worktree branch / scale-test tooling: owner decides first |
| ARCHIVE | 44 | unique commits not in canonical: keep in one verified bundle (or `archive/` tag), then remove the ref |
| DELETE | 119 | fully preserved by canonical history / merged PR / cherry-pick: ref-only removal, no content lost |
| **Total** | **187** | |

Storage reality check (measured with `git bundle create ^fc58f411 <refs>` into scratch, `git bundle verify` = ok): the unique objects of **all** ARCHIVE candidates fit in a single bundle of **730 KB**; DELETE set 326 KB; REVIEW set 1093 KB. Preserving every non-protected tip therefore costs about 2 MB - branch cleanup is a navigation/noise task, not a size task (plan 7.6: it does not shrink the clone).

## 2. Protected / do not touch

| Branch | Tip | +/- vs pin | Why it is protected |
|---|---|---|---|
| `work/uskoci-ui-unification-20260924` | pin `fc58f411` (tip keeps moving; 2026-09-30 evening `c9071a2f`) | pin | Canonical work branch (all P6 work, control tracker, workflows). Never touch. |
| `clean-alpha-backend` | 2026-09-21 `a047bc0` | +1/-773 | GitHub default branch and base of 8 open PRs; changing/retiring it is a separate controlled repo action (plan 7.3 C0), not part of this inventory. |
| `repair/ru0-ru1-backend-20260902` | 2026-09-02 `d19902a` | +2/-2011 | Quarantine branch (AGENTS.md, plan 2.2): never merge, cherry-pick or apply; keep isolated. |

Also KEEP while P6 is OPEN: `tmp/cutover-apk`, `tmp/cutover-apk2` (created 2026-09-30, P6 DEV-cutover builds; `build-android-dev-apk.yml` last ran on `tmp/cutover-apk2` 0 days ago), `wip/r6fix-izmene` (unique WIP, 2026-09-25). Owner-deferred: the two privacy branches (`work/legal-privacy-ai-context-minimization-20260927` = PR #108, `work/legal-privacy-processor-inventory-truth-20260927` = PR #109), recorded in AGENTS.md as NOT INTEGRATED.

Bases of open PRs (KEEP until those PRs are closed): `feat/owner-completion-20260911` (#101), `feat/w03-ai-owned-intake-20260910` (#95, #96), `work/html-home-native-20260920` (#106). Note: **8 open PRs use `clean-alpha-backend` as base**; retargeting or retiring the default branch would touch all of them, which is why it stays a separate owner decision.

## 3. Open pull requests (13) - decisions belong to the owner

10 of 13 are drafts. All predate the current canonical line except the two privacy PRs. Deleting a branch with an open PR closes the PR, so the PR decision must come first.

| PR | Head branch | Base | Opened | +/- lines, files | Head vs canonical | Proposed |
|---|---|---|---|---|---|---|
| #109 Privacy P0-02: reconcile current processor inventory | `work/legal-privacy-processor-inventory-truth-20260927` | `clean-alpha-backend` | 2026-09-27 (draft) | +320/-0, 3 | +4/-773 | KEEP (owner-deferred privacy pass) |
| #108 Privacy P0: minimize persisted private location facts sent t | `work/legal-privacy-ai-context-minimization-20260927` | `clean-alpha-backend` | 2026-09-27 (draft) | +388/-21, 9 | +12/-773 | KEEP (owner-deferred privacy pass) |
| #107 UI: premium AI chat composer and intake polish | `work/ui-unification-20260923` | `clean-alpha-backend` | 2026-09-23 (draft) | +185/-81, 8 | +44/-773 | Owner: merge or close; if closed, ARCHIVE tip (43 unique patches) |
| #106 Remove the internal AI test cap without discarding usage his | `work/ai-reservation-unblock-20260920` | `work/html-home-native-20260920` | 2026-09-20 (draft) | +4459/-112, 49 | +9/-815 | Owner: merge or close; if closed, ARCHIVE tip (9 unique patches) |
| #101 Pre-HTML stabilization: retained intent, second Task, safe l | `work/pre-html-stabilization-20260911` | `feat/owner-completion-20260911` | 2026-09-11 (draft) | +814/-633, 44 | ancestor (0 unique) | Close PR (content already in canonical), then DELETE branch |
| #98 Restore original SPOJ V2 native Entry and Auth identity | `feat/v2-signature-entry-auth-20260910` | `feat/v2-agreement-messages-20260910` | 2026-09-10 (draft) | +1436/-298, 31 | ancestor (0 unique) | Close PR (content already in canonical), then DELETE branch |
| #96 feat: connect SPOJ V2 native marketplace through agreement c | `feat/v2-agreement-messages-20260910` | `feat/w03-ai-owned-intake-20260910` | 2026-09-10 | +4859/-2114, 69 | ancestor (0 unique) | Close PR (content already in canonical), then DELETE branch |
| #95 Bind LocationIQ reverse geocoding to V2 native pin confirmat | `feat/locationiq-reverse-20260910` | `feat/w03-ai-owned-intake-20260910` | 2026-09-10 (draft) | +226/-44, 13 | ancestor (0 unique) | Close PR (content already in canonical), then DELETE branch |
| #69 Fix SVG accessibility warning in web navigation logo | `fix/svg-web-accessibility-20260908` | `clean-alpha-backend` | 2026-09-08 | +3/-1, 1 | +1/-1505 | Owner: merge or close; if closed, ARCHIVE tip (1 unique patches) |
| #68 Show complete public task material through the existing read | `feat/public-task-material-20260907` | `clean-alpha-backend` | 2026-09-07 (draft) | +10161/-448, 88 | +11/-1505 | Owner: merge or close; if closed, ARCHIVE tip (7 unique patches) |
| #67 Connect shared task List and Map with account-safe discovery | `feat/shared-exploration-ui-20260907` | `clean-alpha-backend` | 2026-09-07 (draft) | +12525/-405, 80 | +9/-1505 | Owner: merge or close; if closed, ARCHIVE tip (6 unique patches) |
| #59 AI intake: typed human review and accurate saved draft card | `fix/ai-vertical-recovery-20260907` | `clean-alpha-backend` | 2026-09-07 | +6824/-468, 52 | +6/-1536 | Owner: merge or close; if closed, ARCHIVE tip (2 unique patches) |
| #17 RU-5 C01: public-safe profile projection | `proof/ru5-c01-public-profile-20260905` | `clean-alpha-backend` | 2026-09-05 (draft) | +557/-1, 8 | +13/-1836 | Owner: merge or close; if closed, ARCHIVE tip (13 unique patches) |

## 4. KEEP and REVIEW (24)

| Branch | Tip | +ahead/-behind | Evidence | PR | Notes / blockers |
|---|---|---|---|---|---|
| `clean-alpha-backend` | 2026-09-21 `a047bc0` | +1/-773 | protected | - | **KEEP** - GitHub default branch and base of 8 open PRs; changing/retiring it is a separate controlled repo action (plan 7.3 C0), not part of this inventory. [push-trigger of 3 workflow(s); named in active docs: AGENTS.md, HANDOFF.md, USKOCI_MASTER_PLAN_DIZAJNA.md, docs/control/redovi.json; same tip as work/legal-privacy-retention-scopes-20260927] |
| `feat/owner-completion-20260911` | 2026-09-11 `df16754` | +0/-1284 | ANC PR#100(m) | #100 merged | **KEEP** - Base branch of open PR(s) #101; delete only after those PRs are closed. |
| `feat/w03-ai-owned-intake-20260910` | 2026-09-10 `6a0c784` | +0/-1377 | ANC PR#94(m) | #94 merged | **KEEP** - Base branch of open PR(s) #96, #95; delete only after those PRs are closed. |
| `repair/ru0-ru1-backend-20260902` | 2026-09-02 `d19902a` | +2/-2011 | protected | - | **KEEP** - Quarantine branch (AGENTS.md, plan 2.2): never merge, cherry-pick or apply; keep isolated. [named in active docs: AGENTS.md, HANDOFF.md, docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html] |
| `tmp/cutover-apk` | 2026-09-30 `9d418db` | +1/-14 | UNQ1 | - | **KEEP** - P6 DEV-cutover APK build branch created 2026-09-30 while P6 is OPEN; owner of P6 decides when it is disposable. |
| `tmp/cutover-apk2` | 2026-09-30 `fdedabd` | +1/-1 | UNQ1 | - | **KEEP** - P6 DEV-cutover APK build branch created 2026-09-30 while P6 is OPEN (latest build/android run 0 days ago). |
| `wip/r6fix-izmene` | 2026-09-25 `6976f96` | +1/-367 | UNQ1 | - | **KEEP** - Unverified WIP for the "Izmene" flow (2026-09-25); unique commit, not integrated: needs owner triage before any removal. |
| `work/html-home-native-20260920` | 2026-09-20 `131c851` | +0/-782 | ANC PR#105(m) | #105 merged | **KEEP** - Base branch of open PR(s) #106; delete only after those PRs are closed. |
| `work/legal-privacy-ai-context-minimization-20260927` | 2026-09-27 `d18e830` | +12/-773 | UNQ11 | #108 open | **KEEP** - Owner-deferred privacy branch (open PR #108, NOT INTEGRATED); integrate only in the final whole-app privacy pass. [named in active docs: docs/control/redovi.json] |
| `work/legal-privacy-processor-inventory-truth-20260927` | 2026-09-27 `1ab01e7` | +4/-773 | UNQ3 | #109 open | **KEEP** - Owner-deferred privacy branch (open PR #109, NOT INTEGRATED); integrate only in the final whole-app privacy pass. [named in active docs: docs/control/redovi.json] |
| `work/uskoci-ui-unification-20260924` | 2026-09-30 `c184bdd` | pin (moving: +2 at collection, +5 at the end) | protected | - | **KEEP** - Canonical work branch (all P6 work, control tracker, workflows). Never touch. [push-trigger of 50 workflow(s); named in 7 workflow(s) (non-trigger); named in active docs: AGENTS.md, USKOCI_MASTER_PLAN_DIZAJNA.md, docs/control/redovi.json, docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html; checked out in local worktree …/.claude/worktrees/uskoci-kompletan-audit-2e715e] |
| `build/combined-20260920` | 2026-09-20 `2fb0172` | +2/-806 | CHP | - | **REVIEW** - Patch-equivalent to canonical (1 of 1 non-merge patch already there) but it is the branch of the live local worktree C:/ucb (Codex combined-build workspace): owner confirms the worktree is retired, then DELETE. [checked out in local worktree C:/ucb] |
| `feat/locationiq-reverse-20260910` | 2026-09-10 `4dabe6b` | +0/-1378 | ANC | #95 open | **REVIEW** - Open PR #95 (base feat/w03-ai-owned-intake-20260910) but every commit is already in canonical history: stale PR. Owner closes the PR, then DELETE (ref only; nothing lost). |
| `feat/public-task-material-20260907` | 2026-09-08 `da7ce1d` | +11/-1505 | UNQ7 | #68 open | **REVIEW** - Open PR #68 (base clean-alpha-backend, opened 2026-09-07, draft=true) with 7 patch(es) not in canonical: owner decides merge vs close; if closed, ARCHIVE the tip. |
| `feat/shared-exploration-ui-20260907` | 2026-09-08 `37a8ec9` | +9/-1505 | UNQ6 | #67 open | **REVIEW** - Open PR #67 (base clean-alpha-backend, opened 2026-09-07, draft=true) with 6 patch(es) not in canonical: owner decides merge vs close; if closed, ARCHIVE the tip. |
| `feat/v2-agreement-messages-20260910` | 2026-09-10 `1ec86c6` | +0/-1350 | ANC | #96 open | **REVIEW** - Open PR #96 (base feat/w03-ai-owned-intake-20260910) but every commit is already in canonical history: stale PR. Owner closes the PR, then DELETE (ref only; nothing lost). |
| `feat/v2-signature-entry-auth-20260910` | 2026-09-10 `aabe29a` | +0/-1341 | ANC | #98 open | **REVIEW** - Open PR #98 (base feat/v2-agreement-messages-20260910) but every commit is already in canonical history: stale PR. Owner closes the PR, then DELETE (ref only; nothing lost). |
| `fix/ai-vertical-recovery-20260907` | 2026-09-07 `663b69b` | +6/-1536 | UNQ2 | #59 open | **REVIEW** - Open PR #59 (base clean-alpha-backend, opened 2026-09-07, draft=false) with 2 patch(es) not in canonical: owner decides merge vs close; if closed, ARCHIVE the tip. |
| `fix/svg-web-accessibility-20260908` | 2026-09-08 `c07dad9` | +1/-1505 | UNQ1 | #69 open | **REVIEW** - Open PR #69 (base clean-alpha-backend, opened 2026-09-08, draft=false) with 1 patch(es) not in canonical: owner decides merge vs close; if closed, ARCHIVE the tip. |
| `proof/ru5-c01-public-profile-20260905` | 2026-09-05 `4b2d305` | +13/-1836 | UNQ13 | #17 open | **REVIEW** - Open PR #17 (base clean-alpha-backend, opened 2026-09-05, draft=true) with 13 patch(es) not in canonical: owner decides merge vs close; if closed, ARCHIVE the tip. |
| `test/mass-user-chaos-harness-20260916` | 2026-09-17 `6a35296` | +28/-1004 | UNQ28 | - | **REVIEW** - 28 unique patches of scale/chaos test tooling never integrated; test tooling counts as a dynamic consumer (plan 7.2). Decide reuse for P6/P7 scale checks vs ARCHIVE. |
| `work/ai-reservation-unblock-20260920` | 2026-09-20 `88af02e` | +9/-815 | UNQ9 | #106 open | **REVIEW** - Open PR #106 (base work/html-home-native-20260920, opened 2026-09-20, draft=true) with 9 patch(es) not in canonical: owner decides merge vs close; if closed, ARCHIVE the tip. [checked out in local worktree …/2026-09-19/supabase-app-store-ios-apple-store/work/uskoci-html-native] |
| `work/pre-html-stabilization-20260911` | 2026-09-11 `1138d4f` | +0/-1280 | ANC | #101 open | **REVIEW** - Open PR #101 (base feat/owner-completion-20260911) but every commit is already in canonical history: stale PR. Owner closes the PR, then DELETE (ref only; nothing lost). |
| `work/ui-unification-20260923` | 2026-09-24 `42f69cf` | +44/-773 | UNQ43 | #107 open | **REVIEW** - Open PR #107 (base clean-alpha-backend, opened 2026-09-23, draft=true) with 43 patch(es) not in canonical: owner decides merge vs close; if closed, ARCHIVE the tip. |

## 5. ARCHIVE candidates (44)

Unique commits exist that canonical does not contain (older RU-0..RU-5 proof/promotion chains of 2026-09-03..09-07, pre-v3 verifier/runner experiments of 09-11..09-13, AI PoC/council branches, closed PRs). **Proposed handling:** create one verified bundle (`git bundle create branch-archive-20260930.bundle ^fc58f411 <these refs>`, 730 KB, `git bundle verify` ok), store it outside the repo in the owner-approved place together with `BRANCHES_SHA.tsv`, and only then remove the refs. Two names point at each of the `DUP` tips, so the bundle carries fewer distinct commits than names.

| Branch | Tip | +ahead/-behind | Evidence | PR | Notes / blockers |
|---|---|---|---|---|---|
| `ai-conversation-poc` | 2026-09-11 `cad80b1` | +8/-1299 | UNQ8 | - | - |
| `ai-uskoci-council` | 2026-09-11 `9de6535` | +17/-1299 | UNQ17 DUP | - | same tip as chat5-phase2-candidate-20260911 |
| `automation/ru3-b05-live-reconcile-20260904` | 2026-09-04 `fe1a205` | +1/-1912 | UNQ1 | - | - |
| `automation/ru3-b05-promote-20260904` | 2026-09-04 `932b058` | +5/-1913 | UNQ5 | - | - |
| `automation/ru3-b06-live-reconcile-20260904` | 2026-09-04 `fd93354` | +4/-1910 | UNQ4 | - | - |
| `automation/ru3-b06-promote-20260904` | 2026-09-04 `2a8d9a4` | +1/-1911 | UNQ1 | - | - |
| `chat5-phase2-candidate-20260911` | 2026-09-11 `9de6535` | +17/-1299 | UNQ17 DUP | - | same tip as ai-uskoci-council |
| `chore/execution-ledger-v20-20260915` | 2026-09-15 `6e706e3` | +1/-1117 | UNQ1 | - | - |
| `continuity/ru4b-live71-20260905` | 2026-09-05 `a4f4f09` | +6/-1892 | UNQ6 | - | - |
| `feat/v2-agreement-changes-20260911` | 2026-09-11 `60a3ce6` | +3/-1288 | UNQ3 | - | - |
| `feat/v2-push-foreground-20260911` | 2026-09-11 `cba0a26` | +1/-1287 | UNQ1 | - | - |
| `feat/w02-regional-country-authority-20260910` | 2026-09-10 `f1f1834` | +1/-1409 | UNQ1 | #87 closed | - |
| `fix/w00-proof-prefix-continuation-20260908` | 2026-09-09 `661e16a` | +1/-1463 | UNQ1 | #81 closed | - |
| `promotion/ru4b-foundation-20260905` | 2026-09-05 `795f325` | +3/-1893 | UNQ3 | - | - |
| `proof/android-visual-proof-20260905` | 2026-09-05 `f22b6ed` | +10/-1895 | UNQ10 | - | - |
| `proof/p0d02-live-transport-diagnostic-20260906` | 2026-09-06 `36bec21` | +1/-1707 | UNQ1 | - | - |
| `proof/pre-v3-pr101-exact-baseline-20260911` | 2026-09-11 `85a42fa` | +3/-1280 | UNQ3 | - | - |
| `proof/ru0-disposable-ci-20260903` | 2026-09-03 `6496065` | +4/-2009 | UNQ4 | - | - |
| `proof/ru1-disposable-ci-20260903` | 2026-09-03 `1d62a61` | +8/-2006 | UNQ8 | - | - |
| `proof/ru2-promotion-integrity-20260904` | 2026-09-04 `239d421` | +1/-1923 | UNQ1 | - | - |
| `proof/ru2-promotion-integrity-20260904b` | 2026-09-04 `16dc09f` | +1/-1921 | UNQ1 | - | - |
| `proof/ru3-admission-infra-20260904` | 2026-09-04 `b7d57b5` | +11/-1913 | UNQ11 | - | - |
| `proof/ru3-b05-policy-bundle-20260904` | 2026-09-04 `edd8525` | +1/-1913 | UNQ1 | - | - |
| `proof/ru3-b06-decision-20260904` | 2026-09-04 `082d4d3` | +3/-1911 | UNQ3 | - | - |
| `proof/ru3-b07-canonical-publish-20260904` | 2026-09-04 `7351198` | +16/-1909 | UNQ16 | - | named in active docs: HANDOFF.md |
| `proof/ru3-d0140-rs-publication-v1-20260904` | 2026-09-04 `363354e` | +8/-1909 | UNQ6 | - | - |
| `proof/ru4-clean-ai-isolation-final-20260905` | 2026-09-05 `3e215c6` | +1/-1894 | UNQ1 | - | - |
| `proof/ru4-clean-promotion-20260905` | 2026-09-05 `34ec172` | +3/-1894 | UNQ3 | - | - |
| `proof/ru4-live-transfer-reconcile-20260905` | 2026-09-05 `73e2118` | +2/-1894 | UNQ2 | - | - |
| `proof/ru4-material-revision-20260904` | 2026-09-04 `d5e2cda` | +15/-1899 | UNQ15 | - | - |
| `proof/ru4-owner-edit-lock-20260904` | 2026-09-05 `eeb8a29` | +34/-1895 | UNQ34 | - | - |
| `proof/ru4-promotion-metadata-20260905` | 2026-09-05 `0ac9516` | +35/-1895 | UNQ35 | - | - |
| `proof/ru4b-public-preselection-qa-20260905` | 2026-09-05 `bb3677d` | +10/-1893 | UNQ10 | - | - |
| `proof/ru5-application-integrity-20260905` | 2026-09-05 `7b4bebb` | +4/-1849 | UNQ4 | - | - |
| `proof/ru5-continuity-generator-20260907` | 2026-09-07 `36de48e` | +1/-1624 | UNQ1 | - | - |
| `proof/ru5-readonly-source-snapshot-20260907` | 2026-09-07 `dc6b580` | +1/-1625 | UNQ1 | - | - |
| `proof/ru5-source-readonly-export-20260906` | 2026-09-06 `c48f96b` | +1/-1630 | UNQ1 | - | - |
| `tmp/ru2-md5-20260903` | 2026-09-03 `85f43ea` | +1/-1929 | UNQ1 | - | - |
| `work/owner-completion-runner-20260911` | 2026-09-11 `30080d9` | +3/-1285 | UNQ3 | - | - |
| `work/pre-v3-exact-verifier-20260911` | 2026-09-12 `745996b` | +34/-1280 | UNQ34 | - | - |
| `work/pre-v3-proof-runner-20260911` | 2026-09-13 `a3e3c93` | +122/-1280 | UNQ122 | - | - |
| `work/ru4-clean-promotion-build-20260905` | 2026-09-04 `99bb6f7` | +2/-1895 | UNQ2 | - | - |
| `work/ru4-live-continuity-reconcile-20260905` | 2026-09-05 `a225734` | +1/-1894 | UNQ1 | - | - |
| `work/ru4-live-continuity-reconcile-v2-20260905` | 2026-09-05 `bd0d03b` | +4/-1894 | UNQ3 | - | - |

Notable: `proof/ru3-b07-canonical-publish-20260904` is named in `HANDOFF.md`; `work/pre-v3-proof-runner-20260911` holds 122 unique patches (the largest), `proof/ru4-promotion-metadata-20260905` 35, `proof/ru4-owner-edit-lock-20260904` 34, `work/pre-v3-exact-verifier-20260911` 34: these are proof-runner/verifier scaffolding of the pre-V3 engine chain, useful only as history.

## 6. DELETE candidates (119) - ref-only removal, nothing is lost

Basis: `ANC` (tip inside canonical history, 93 branches), merged PR whose merge commit is in canonical history (21), patch-equivalent `CHP` (4), identical-to-default (1).

**Blockers to resolve first** (all are *notes* in the table): 27 branches are the `on.push.branches` trigger of one or more workflow files (see WORKFLOWS.md: after removal those workflows can only be started by `workflow_dispatch` or by editing their branch filter; `work/pre-v3-engine-integration-20260911` alone is the filter of 32 proof workflows and is named in AGENTS.md); 8 branches are checked out in local worktrees (deleting the remote ref does not touch the local checkout, but the owner should remove/repoint those worktrees); `fix/r04-need-edit-route-20260908` is the branch the **main checkout** (`USKOCI-CLEAN`) is currently parked on.

| Branch | Tip | +ahead/-behind | Evidence | PR | Notes / blockers |
|---|---|---|---|---|---|
| `chore/w00-pending-proof-hardening-20260909` | 2026-09-09 `a353a42` | +6/-1440 | PR#82(m) UNQ6 | #82 merged | - |
| `closure/ru5-p0c02-live-20260905` | 2026-09-05 `9d46993` | +0/-1808 | ANC PR#19(m) | #19 merged | - |
| `closure/ru5-p0c03-live-20260905` | 2026-09-05 `d8f979d` | +0/-1779 | ANC PR#21(m) | #21 merged | - |
| `closure/ru5-selection-eligibility-final-status-20260906` | 2026-09-06 `516bebe` | +0/-1726 | ANC PR#25(m) | #25 merged | - |
| `closure/ru5-selection-eligibility-live-20260906` | 2026-09-06 `3a37f31` | +0/-1731 | ANC PR#24(m) | #24 merged | - |
| `docs/ai-live87-provenance-20260907` | 2026-09-07 `07251f2` | +0/-1539 | ANC PR#63(m) | #63 merged | - |
| `docs/checkpoint-label-fix-20260906` | 2026-09-06 `97ba400` | +0/-1665 | ANC PR#31(m) | #31 merged | - |
| `docs/continuity-reconcile-20260904` | 2026-09-04 `e17591f` | +0/-1901 | ANC | - | - |
| `docs/d03-live86-20260907` | 2026-09-07 `1f6db1e` | +0/-1553 | ANC PR#60(m) | #60 merged | - |
| `docs/n07-live84-20260907` | 2026-09-07 `58eb2f9` | +0/-1598 | ANC PR#50(m) | #50 merged | - |
| `docs/n08-live85-20260907` | 2026-09-07 `42cf1b6` | +0/-1580 | ANC PR#54(m) | #54 merged | - |
| `docs/notifications-closure-state-20260907` | 2026-09-07 `899b545` | +0/-1603 | ANC PR#47(m) | #47 merged | - |
| `docs/notifications-n02-n03-continuity-20260907` | 2026-09-07 `f8a6dcb` | +0/-1615 | ANC PR#42(m) | #42 merged | - |
| `docs/p0d02-selection-semantic-idempotency-live-closure-20260906` | 2026-09-06 `4fcc95f` | +0/-1705 | ANC PR#27(m) | #27 merged | - |
| `docs/p0d03-postmerge-status-normalization-20260906` | 2026-09-06 `cc65804` | +0/-1668 | ANC PR#30(m) | #30 merged | - |
| `docs/p0d03-requester-connection-live-closure-20260906` | 2026-09-06 `364e4cf` | +0/-1673 | ANC PR#29(m) | #29 merged | - |
| `docs/ru3-b07-live-reconcile-20260904` | 2026-09-04 `93935a2` | +2/-1900 | PR#3(m) UNQ2 | #3 merged | - |
| `docs/ru5-fastest-autofill-live-closure-20260906` | 2026-09-06 `b9965b0` | +6/-1649 | PR#33(m) UNQ6 | #33 merged | - |
| `docs/ru5-two-account-proof-closure-20260906` | 2026-09-06 `1c04110` | +6/-1646 | PR#36(m) UNQ6 | #36 merged | - |
| `docs/safe-handoff-20260911` | 2026-09-11 `146daf0` | +0/-1286 | ANC | - | - |
| `docs/uskoci-confirmed-three-zone-navigation` | 2026-09-08 `4dd2387` | +0/-1503 | ANC PR#71(m) | #71 merged | - |
| `feat/batch-execution-ci-20260910` | 2026-09-10 `1daf690` | +0/-1406 | ANC PR#88(m) | #88 merged | - |
| `feat/cb1-qa-need-lifecycle-binding-20260908` | 2026-09-08 `9e4c657` | +0/-1500 | ANC PR#78(m) | #78 merged | checked out in local worktree <workspace>/USKOCI-CLEAN-cb1 |
| `feat/d0140a-policy-bundle-registration-20260908` | 2026-09-09 `73f992c` | +0/-1442 | ANC PR#79(m) | #79 merged | checked out in local worktree <workspace>/USKOCI-CLEAN-d140a |
| `feat/expo-push-transport-20260910` | 2026-09-11 `75348db` | +0/-1300 | ANC PR#97(m) | #97 merged | - |
| `feat/figma-entry-20260907` | 2026-09-08 `331ce82` | +0/-1506 | ANC PR#66(m) | #66 merged | push-trigger of 1 workflow(s) |
| `feat/p1-legal-consent-20260908` | 2026-09-08 `0bc15ac` | +0/-1483 | ANC PR#74(m) | #74 merged | checked out in local worktree <workspace>/USKOCI-CLEAN-p1 |
| `feat/p2-data-export-20260908` | 2026-09-09 `df79d5a` | +20/-1441 | PR#77(m) UNQ16 | #77 merged | checked out in local worktree <workspace>/USKOCI-CLEAN-p2 |
| `feat/p2-export-delivery-20260910` | 2026-09-10 `314189d` | +0/-1390 | ANC PR#92(m) | #92 merged | - |
| `feat/p3-retention-execution-20260910` | 2026-09-10 `8400345` | +0/-1387 | ANC PR#93(m) | #93 merged | - |
| `feat/p3-retention-schedule-20260908` | 2026-09-08 `03053ae` | +0/-1467 | ANC PR#76(m) | #76 merged | checked out in local worktree <workspace>/USKOCI-CLEAN-p3 |
| `feat/p4-processor-map-20260908` | 2026-09-08 `4de9f42` | +0/-1474 | ANC PR#75(m) | #75 merged | checked out in local worktree <workspace>/USKOCI-CLEAN-p4 |
| `feat/v2-native-journey-closure-20260911` | 2026-09-11 `58e842e` | +0/-1287 | ANC PR#99(m) | #99 merged | - |
| `feat/w00-w01-account-recovery-20260908` | 2026-09-08 `b75477b` | +0/-1452 | ANC PR#80(m) | #80 merged | - |
| `feat/w02-availability-20260909` | 2026-09-09 `0a00254` | +0/-1417 | ANC PR#84(m) | #84 merged | - |
| `feat/w02-calendar-authority-20260909` | 2026-09-09 `5a33a02` | +0/-1421 | ANC PR#83(m) | #83 merged | - |
| `feat/w02-location-native-completion-20260910` | 2026-09-10 `e44cdf3` | +0/-1401 | ANC PR#89(m) | #89 merged | - |
| `feat/w02-location-shared-20260909` | 2026-09-09 `ff82226` | +0/-1413 | ANC PR#85(m) | #85 merged | - |
| `feat/w02-resolved-location-20260910` | 2026-09-10 `f2388d7` | +0/-1398 | ANC PR#90(m) | #90 merged | - |
| `feat/w02-shared-capability-validation-20260910` | 2026-09-10 `22803b5` | +0/-1410 | ANC PR#86(m) | #86 merged | - |
| `feat/w05-publication-admission-20260910` | 2026-09-10 `3b50eaa` | +0/-1394 | ANC PR#91(m) | #91 merged | - |
| `fix/action-pins-20260907` | 2026-09-07 `698063b` | +0/-1601 | ANC PR#48(m) | #48 merged | - |
| `fix/ai-draft-authority-20260907` | 2026-09-07 `f5b9550` | +0/-1547 | ANC PR#57(m) | #57 merged | push-trigger of 1 workflow(s) |
| `fix/ai-provider-selector-20260907` | 2026-09-07 `49fe98a` | +0/-1539 | ANC PR#62(m) | #62 merged | - |
| `fix/ai-server-context-20260907` | 2026-09-07 `655973d` | +0/-1541 | ANC PR#58(m) | #58 merged | - |
| `fix/d03-chat-recovery-20260907` | 2026-09-07 `d521c6b` | +0/-1524 | ANC PR#61(m) | #61 merged | push-trigger of 1 workflow(s) |
| `fix/d03-message-retry-20260907` | 2026-09-07 `eb28d61` | +0/-1561 | ANC PR#55(m) | #55 merged | push-trigger of 1 workflow(s) |
| `fix/dependency-security-20260907` | 2026-09-07 `7c208d5` | +0/-1599 | ANC PR#51(m) | #51 merged | - |
| `fix/existing-eas-identity-20260907` | 2026-09-07 `98061d1` | +0/-1555 | ANC PR#56(m) | #56 merged | - |
| `fix/intent-shell-20260907` | 2026-09-07 `1133a88` | +0/-1568 | ANC PR#49(m) | #49 merged | push-trigger of 1 workflow(s) |
| `fix/n08-notification-preferences-20260907` | 2026-09-07 `8777c14` | +0/-1583 | ANC PR#53(m) | #53 merged | push-trigger of 1 workflow(s) |
| `fix/p0e-completion-guards-20260908` | 2026-09-08 `6cde7b4` | +0/-1497 | ANC PR#72(m) | #72 merged | push-trigger of 1 workflow(s); checked out in local worktree <workspace>/USKOCI-CLEAN-p0e |
| `fix/r04-need-edit-route-20260908` | 2026-09-08 `4ac53fc` | +0/-1501 | ANC PR#73(m) | #73 merged | checked out in local worktree <workspace>/USKOCI-CLEAN |
| `fix/task-detail-recovery-20260907` | 2026-09-07 `35cfabe` | +0/-1513 | ANC PR#64(m) | #64 merged | push-trigger of 1 workflow(s) |
| `fix/url-decoder-security-20260907` | 2026-09-07 `6e5af6b` | +0/-1594 | ANC PR#52(m) | #52 merged | - |
| `fix/windows-metro-cache-20260907` | 2026-09-07 `7d8cbc6` | +0/-1535 | ANC PR#65(m) | #65 merged | - |
| `promote/ru3-b07-canonical-publish-20260904` | 2026-09-04 `00b7f14` | +6/-1901 | PR#2(m) UNQ6 | #2 merged | - |
| `promotion/ru1-worker-readiness-20260903` | 2026-09-03 `e998761` | +0/-1992 | ANC | - | - |
| `promotion/ru3-b05-live-reconcile-20260904` | 2026-09-04 `ee0a089` | +0/-1911 | ANC | - | - |
| `promotion/ru3-b05-policy-bundle-20260904` | 2026-09-04 `ac70e1e` | +0/-1912 | ANC DUP | - | same tip as tracking/ru3-b05-live-reconcile-20260904 |
| `promotion/ru3-b06-decision-20260904` | 2026-09-04 `4d73539` | +0/-1910 | ANC | - | - |
| `promotion/ru4-owner-edit-lock-20260905` | 2026-09-05 `a271d60` | +0/-1894 | ANC DUP | - | same tip as proof/ru4-clean-ai-final-20260905, proof/ru4-clean-ai-isolation-20260905, proof/ru4-clean-ai-isolation-20260905-rerun |
| `proof/client-data-agreement-mutations-20260905` | 2026-09-05 `de8d4af` | +8/-1886 | PR#5(m) UNQ8 | #5 merged | - |
| `proof/client-data-agreement-read-20260905` | 2026-09-05 `0b84c3b` | +11/-1891 | PR#4(m) UNQ11 | #4 merged | - |
| `proof/client-data-ai-command-shadow-20260905` | 2026-09-05 `e85017b` | +5/-1849 | PR#13(m) UNQ5 | #13 merged | - |
| `proof/client-data-ai-conversation-shadow-20260905` | 2026-09-05 `53441d8` | +4/-1843 | PR#14(m) UNQ4 | #14 merged | - |
| `proof/client-data-ai-publish-shadow-20260905` | 2026-09-05 `2d57f41` | +8/-1842 | PR#15(m) UNQ8 | #15 merged | - |
| `proof/client-data-completion-mark-20260905` | 2026-09-05 `43e7c95` | +6/-1861 | PR#10(m) UNQ6 | #10 merged | - |
| `proof/client-data-exact-location-20260905` | 2026-09-05 `f940ffb` | +6/-1856 | PR#11(m) UNQ6 | #11 merged | - |
| `proof/client-data-need-reads-20260905` | 2026-09-05 `0aeed66` | +8/-1881 | PR#6(m) UNQ8 | #6 merged | - |
| `proof/client-data-phone-grants-20260905` | 2026-09-05 `f95631d` | +6/-1871 | PR#8(m) UNQ6 | #8 merged | - |
| `proof/client-data-problem-report-20260905` | 2026-09-05 `9952ab0` | +6/-1866 | PR#9(m) UNQ6 | #9 merged | - |
| `proof/client-data-response-viewed-20260905` | 2026-09-05 `ecf7e77` | +6/-1876 | PR#7(m) UNQ6 | #7 merged | - |
| `proof/client-data-worker-profile-20260905` | 2026-09-05 `ca941c4` | +7/-1854 | PR#12(m) UNQ7 | #12 merged | - |
| `proof/notifications-n01-message-events-20260907` | 2026-09-07 `96b39ec` | +0/-1621 | ANC PR#39(m) | #39 merged | push-trigger of 1 workflow(s) |
| `proof/notifications-n02-selection-event-20260907` | 2026-09-07 `3022ffb` | +0/-1619 | ANC PR#40(m) | #40 merged | push-trigger of 1 workflow(s) |
| `proof/notifications-n03-inbox-20260907` | 2026-09-07 `c7aae94` | +0/-1619 | ANC PR#41(m) | #41 merged | push-trigger of 1 workflow(s) |
| `proof/notifications-n04-inbox-mobile-20260907` | 2026-09-07 `576e56b` | +0/-1615 | ANC PR#45(m) | #45 merged | push-trigger of 1 workflow(s) |
| `proof/notifications-n05-agreement-change-20260907` | 2026-09-07 `3a0b90a` | +0/-1614 | ANC PR#43(m) | #43 merged | push-trigger of 1 workflow(s) |
| `proof/notifications-n06-push-registry-20260907` | 2026-09-07 `fabd580` | +0/-1613 | ANC PR#44(m) | #44 merged | push-trigger of 1 workflow(s) |
| `proof/notifications-n07-forward-promotions-20260907` | 2026-09-07 `8a6075b` | +0/-1605 | ANC PR#46(m) | #46 merged | push-trigger of 1 workflow(s) |
| `proof/p0d02-selection-semantic-idempotency-20260906` | 2026-09-06 `c3ada42` | +0/-1708 | ANC PR#26(m) | #26 merged | push-trigger of 1 workflow(s) |
| `proof/p0d03-requester-connection-activation-v1-20260906` | 2026-09-06 `01b5142` | +0/-1684 | ANC PR#28(m) | #28 merged | push-trigger of 1 workflow(s) |
| `proof/ru2-need-v2-r07-20260903` | 2026-09-03 `d7eb80b` | +0/-1929 | ANC DUP | - | push-trigger of 1 workflow(s); same tip as work/ru2-edge-rn-20260903 |
| `proof/ru4-clean-ai-final-20260905` | 2026-09-05 `a271d60` | +0/-1894 | ANC DUP | - | same tip as promotion/ru4-owner-edit-lock-20260905, proof/ru4-clean-ai-isolation-20260905, proof/ru4-clean-ai-isolation-20260905-rerun |
| `proof/ru4-clean-ai-isolation-20260905` | 2026-09-05 `a271d60` | +0/-1894 | ANC DUP | - | same tip as promotion/ru4-owner-edit-lock-20260905, proof/ru4-clean-ai-final-20260905, proof/ru4-clean-ai-isolation-20260905-rerun |
| `proof/ru4-clean-ai-isolation-20260905-rerun` | 2026-09-05 `a271d60` | +0/-1894 | ANC DUP | - | same tip as promotion/ru4-owner-edit-lock-20260905, proof/ru4-clean-ai-final-20260905, proof/ru4-clean-ai-isolation-20260905 |
| `proof/ru5-fastest-autofill-retirement-20260906` | 2026-09-06 `e7b5ce5` | +0/-1656 | ANC | - | - |
| `proof/ru5-p0c01-public-profile-20260905` | 2026-09-05 `4841067` | +25/-1836 | PR#16(m) UNQ25 | #16 merged | push-trigger of 1 workflow(s) |
| `proof/ru5-p0c02-atomic-application-20260905` | 2026-09-05 `2d6b1a6` | +0/-1815 | ANC PR#18(m) | #18 merged | push-trigger of 1 workflow(s) |
| `proof/ru5-p0c02-atomic-application-20260905-tempcheck` | 2026-09-05 `b815e5b` | +0/-1828 | ANC | - | - |
| `proof/ru5-p0c03-my-applications-20260905` | 2026-09-05 `bffc533` | +0/-1788 | ANC PR#20(m) | #20 merged | push-trigger of 1 workflow(s) |
| `proof/ru5-p0d01-candidate-projection-20260905` | 2026-09-05 `bc4dacb` | +0/-1761 | ANC PR#22(m) | #22 merged | push-trigger of 1 workflow(s) |
| `proof/ru5-physical-continuity-20260907` | 2026-09-07 `fe092b6` | +0/-1623 | ANC PR#38(m) | #38 merged | - |
| `proof/ru5-physical-device-ui-journey-20260906` | 2026-09-07 `6544368` | +0/-1625 | ANC PR#37(m) | #37 merged | push-trigger of 1 workflow(s) |
| `proof/ru5-selection-eligibility-revalidation-20260906` | 2026-09-06 `d71c6e0` | +0/-1744 | ANC PR#23(m) | #23 merged | push-trigger of 1 workflow(s) |
| `proof/ru5-two-account-auth-journey-20260906` | 2026-09-06 `bedca53` | +5/-1647 | PR#35(m) UNQ5 | #35 merged | push-trigger of 1 workflow(s) |
| `reconcile-live-migration-20260831120157` | 2026-08-31 `5d85917` | +0/-2103 | ANC PR#1(m) | #1 merged | - |
| `repair/ru5-fastest-autofill-retirement-20260906` | 2026-09-06 `500ba0c` | +0/-1650 | ANC PR#32(m) | #32 merged | - |
| `ru5/w03-w04-route-closure-20260906` | 2026-09-06 `4ff28bf` | +1/-1648 | PR#34(m) CHP | #34 merged | - |
| `stage/ru2-canonical-promotion-20260903` | 2026-09-04 `47ce475` | +0/-1921 | ANC | - | - |
| `stage/ru2-live-closure-20260904` | 2026-09-04 `60afa00` | +0/-1913 | ANC | - | - |
| `tmp-ru0-tracking-closure-20260903` | 2026-09-03 `1c14e9b` | +0/-2007 | ANC DUP | - | same tip as tmp-ru0-tracking-closure-20260903b, tmp-ru0-tracking-closure-20260903c |
| `tmp-ru0-tracking-closure-20260903b` | 2026-09-03 `1c14e9b` | +0/-2007 | ANC DUP | - | same tip as tmp-ru0-tracking-closure-20260903, tmp-ru0-tracking-closure-20260903c |
| `tmp-ru0-tracking-closure-20260903c` | 2026-09-03 `1c14e9b` | +0/-2007 | ANC DUP | - | same tip as tmp-ru0-tracking-closure-20260903, tmp-ru0-tracking-closure-20260903b |
| `tmp-unused-do-not-use` | 2026-09-03 `9e7415c` | +0/-1958 | ANC | - | - |
| `tracking/ru3-b05-live-reconcile-20260904` | 2026-09-04 `ac70e1e` | +0/-1912 | ANC DUP | - | same tip as promotion/ru3-b05-policy-bundle-20260904 |
| `tracking/ru3-b06-live-20260904` | 2026-09-04 `7d2ad4a` | +0/-1909 | ANC | - | - |
| `work/legal-privacy-retention-scopes-20260927` | 2026-09-21 `a047bc0` | +1/-773 | UNQ1+ DUP | - | same tip as clean-alpha-backend |
| `work/pkg002-strict-boundaries-20260915` | 2026-09-15 `7f823ea` | +0/-1132 | ANC PR#103(m) | #103 merged | - |
| `work/pkg002-ts-fix-20260915` | 2026-09-15 `690bece` | +0/-1130 | ANC PR#104(m) | #104 merged | - |
| `work/pre-v3-engine-closure-20260911` | 2026-09-11 `94bda94` | +0/-1270 | ANC | - | - |
| `work/pre-v3-engine-integration-20260911` | 2026-09-23 `019eb52` | +0/-462 | ANC PR#102(!m) | #102 merged | push-trigger of 32 workflow(s); named in active docs: AGENTS.md |
| `work/pre-v3-proof-repair-20260911` | 2026-09-11 `e557980` | +1/-1280 | CHP | - | - |
| `work/ru2-edge-rn-20260903` | 2026-09-03 `d7eb80b` | +0/-1929 | ANC DUP | - | push-trigger of 1 workflow(s); same tip as proof/ru2-need-v2-r07-20260903 |
| `work/uskoci-r6-dodaci-20260924` | 2026-09-24 `edf1969` | +4/-391 | CHP | - | - |
| `work/uskoci-r6-objava-20260924` | 2026-09-24 `1ebebe8` | +4/-391 | CHP | - | - |
| `work/uskoci-r6-prijava-20260924` | 2026-09-24 `47ca91f` | +3/-391 | CHP | - | - |
| `work/uskoci-ui-unification-20260924-poazkl` | 2026-09-24 `b3cd577` | +0/-373 | ANC | - | - |

## 7. Tags and releases

10 tags, all attached to DEV APK pre-releases: `dev-latest` (`a047bc0e`, mutable pointer recreated by `build-android-dev-apk.yml` only on `clean-alpha-backend`) and `pkg020-*` / `pkg022-*` (2026-09-17/18). No other tags exist.

| Release/tag | Created | Assets | Size | Downloads | Proposed |
|---|---|---:|---:|---:|---|
| `dev-latest` | 2026-09-20 | 4 | 65.4 MB | 0 | KEEP (mutable pointer used by the default-branch build; last refreshed 2026-09-20/21) |
| `pkg022-c76decd` | 2026-09-18 | 4 | 65.5 MB | 1 | ARCHIVE the APK + attestations to owner storage if still wanted, then DELETE release+tag (needs owner approval) |
| `pkg022-b9231a3` | 2026-09-18 | 4 | 65.5 MB | 2 | ARCHIVE the APK + attestations to owner storage if still wanted, then DELETE release+tag (needs owner approval) |
| `pkg022-632afce` | 2026-09-18 | 4 | 65.5 MB | 1 | ARCHIVE the APK + attestations to owner storage if still wanted, then DELETE release+tag (needs owner approval) |
| `pkg022-48f0690` | 2026-09-18 | 4 | 65.5 MB | 2 | ARCHIVE the APK + attestations to owner storage if still wanted, then DELETE release+tag (needs owner approval) |
| `pkg022-2ee998a` | 2026-09-18 | 4 | 65.5 MB | 1 | ARCHIVE the APK + attestations to owner storage if still wanted, then DELETE release+tag (needs owner approval) |
| `pkg022-11f757a` | 2026-09-18 | 4 | 65.5 MB | 6 | ARCHIVE the APK + attestations to owner storage if still wanted, then DELETE release+tag (needs owner approval) |
| `pkg020-f1401ff` | 2026-09-17 | 4 | 65.5 MB | 4 | ARCHIVE the APK + attestations to owner storage if still wanted, then DELETE release+tag (needs owner approval) |
| `pkg020-cb5a0b2` | 2026-09-17 | 5 | 65.5 MB | 2 | ARCHIVE the APK + attestations to owner storage if still wanted, then DELETE release+tag (needs owner approval) |
| `pkg020-6b7e6a2` | 2026-09-17 | 5 | 65.5 MB | 2 | ARCHIVE the APK + attestations to owner storage if still wanted, then DELETE release+tag (needs owner approval) |

Risk note: the repository is **PUBLIC**, so these APKs (DEV builds pointing at the live DEV Supabase URL with the publishable client key, by design) are downloadable by anyone; total ~0.65 GB. Removing old ones reduces exposure and Releases clutter; it does not affect git history.

## 8. Local state that is not on GitHub

- 110 local branches; 96 have no upstream configured; **39 local branches have tips that no remote ref contains** (unpushed work), all dated 2026-09-24 (`g-round1..5*`, `r6fix-*` cloud-handoff design rounds). `git cherry` against the pin shows 35 of them are patch-equivalent to canonical; 4 still carry a unique patch: `g-round2-sheets`, `g-round2-tokens-motion`, `g-round3-detail`, `g-round3b-detail`. Before any local prune, bundle these tips (they are the only copy).
- 18 local branches are fully merged into the pin.
- 19 registered worktrees (none prunable right now). Notable: the **main checkout** `USKOCI-CLEAN` is on `fix/r04-need-edit-route-20260908` (old, merged); canonical work is checked out only in `.claude/worktrees/uskoci-kompletan-audit-2e715e`; `C:/ucb` holds `build/combined-20260920`; `USKOCI-CLEAN-{cb1,d140a,p0e,p1,p2,p3,p4}` are seven package worktrees of 2026-09-08 whose branches are all merged; three `wf_*` worktrees hold `g-round5-*`; three Codex worktrees (one on `work/ai-reservation-unblock-20260920`, two detached); two `worktree-agent-*` helper worktrees (locked, other agents - do not touch). A worktree can only be removed with the owner's explicit go-ahead because unpushed commits live in the shared `.git`.

## 9. Proposed C0 branch pass (after P6 is closed and the owner approves)

1. Owner decides the 13 open PRs (section 3): close the five stale stacked PRs (#95, #96, #98, #101 and the content-identical #17) or merge; #107/#106 are real unmerged work.
2. Create the verification bundle of ARCHIVE + REVIEW tips (~1.9 MB) and copy `BRANCHES_SHA.tsv`; verify with `git bundle verify`; store outside the repo.
3. Retire the workflow push filters that name branches about to disappear (WORKFLOWS.md), or accept that those workflows become `workflow_dispatch`-only.
4. Delete DELETE-group refs in batches of at most 25 (owner runs `git push origin --delete`); after each batch, list `git ls-remote --heads origin` and re-run the workflow smoke listed in WORKFLOWS.md section 13 (`pre-p4-integrity` on a scratch PR, one `pkg010-system-contracts-proof` dispatch).
5. Delete ARCHIVE-group refs only after step 2 succeeded.
6. **Rollback** for any single branch: `git push origin <full-sha>:refs/heads/<name>` (full SHAs in `BRANCHES_SHA.tsv`); the bundle restores the ARCHIVE objects if the remote ever loses them; merged PR heads stay reachable through GitHub `refs/pull/N/head`.
7. Do **not** change the default branch, protect/unprotect branches or force-push in this pass.
8. Prevent re-accumulation (owner repo-setting decision, not executed here): `gh api repos/Uskoci1/USKOCI-CLEAN` reports `delete_branch_on_merge: false`, which is why 94 merged PRs left their head branches behind. Turning it on is a one-line setting; it only affects future merges. (Observed read-only, same call reports secret scanning and push protection ENABLED, Dependabot security updates disabled, repository public.)

## 10. Limits of this inventory

- Content equivalence is by history (`ANC`, merged-PR merge commit, patch-id), not by a file-by-file semantic diff. `UNQn` numbers overstate uniqueness for squash-merged PRs (they are classified DELETE via the PR evidence, not via `UNQ`).
- Branch names were searched in workflows, scripts, `supabase/functions`, package/app config and a fixed list of active docs (AGENTS.md, HANDOFF.md, README.md, docs/current, docs/control/redovi.json ...). Historical docs under `docs/**` may still cite branch names; that is acceptable for DELETE (history) but is why ARCHIVE keeps a bundle.
- The canonical branch is moving (P6 owner pushes every few minutes). Re-run the counters before executing; SHAs in `BRANCHES_SHA.tsv` are authoritative for rollback.

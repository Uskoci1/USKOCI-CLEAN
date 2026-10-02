# Handoff to Codex - USKOČI, 2026-10-02 (from Claude Code, Sonnet 5.5)

The owner ordered this handoff on 2026-10-02 around 12:00 (Belgrade time): "Ajde polako završavaj ono što radiš, zapamti sve, evidentiraj, daj živi presek stanja i daj komandu i pripremu da Codex nastavi dalji rad od tačke gde si stao."
Claude Code has stopped. Every helper agent it started was wound down (list in section 5). **This checkout is now yours** ("one agent per checkout", AGENTS.md 3.3.3): do not run a Claude session in it at the same time.

This page is a reading list plus a work queue. It carries no rules (the rulebook is `AGENTS.md`, which Codex loads by itself) and no registry (the only status registry is `docs/control/redovi.json`).

## 0. Read this first (five minutes)

1. `AGENTS.md` in full. The five rules that bite hardest today are repeated in section 3.
2. This page, sections 1, 5, 6, 7.
3. `docs/implementation/product-v1-closure-20260926/finalization-20260927/OWNER_DECISIONS_20261002_ALL75.md` - what the owner decided on 2026-10-02 11:02 (he accepted all 75 proposals) and, in its last sections, **what that does NOT authorize**.
4. Before writing to the checkout, make sure no Claude session is active in it. On 2026-10-02 at about 12:04 a second interactive Claude session named `uskoci-kompletan-audit-2e715e-82` showed up in the session list for a few minutes and was gone again; this page does not know what it was and nothing in the repository changed because of it. Re-check for a running `claude` process against this directory before you commit; if there is one, ask the owner what it is.
5. Read-only first: `git status -sb`, `git log --oneline -20`, then the DEV snapshot of section 1.2. If the ledger is above 221 or the certificate differs from `0579191d...`, somebody applied something after this page was written: stop and ask the owner.
6. The plain-Serbian summary the owner received (numbers, what is solved, what is not, open questions with defaults): `PRESEK_STANJA_20261002.md` in this folder.

The owner writes Serbian (Latin script, informal, many typos). Answer him in plain Serbian Latin, short, evidence-labelled. He decides: real money and prices, paid keys and accounts, legal texts and company data, deleting production data, a store release, and every DEV/PROD state change (his exact word `PRIMENI <ime paketa>`).

## 1. State at the handoff

### 1.1 Git
- Repository `Uskoci1/USKOCI-CLEAN`, working branch `work/uskoci-ui-unification-20260924` (the GitHub default branch `clean-alpha-backend` is older and is NOT the working line). Tag `p6-closed-20260930`.
- Claude committed today with explicit pathspecs and **pushes as the very last step**. If `git status -sb` shows the branch ahead of origin, pushing it is step 6.A below. A bot commit `docs(control): regenerate tracker views` can land on the remote between your fetch and your push; if it conflicts in `docs/control/stanje.json` / `docs/control/out/tabla.html`, cherry-pick your commit onto the new tip, `git checkout --theirs` those two generated files, re-run `node scripts/control/osvezi.mjs`, `GIT_EDITOR=true git cherry-pick --continue`, and verify with `git rev-list --left-right --count HEAD...origin/work/uskoci-ui-unification-20260924`.
- Existing files are CRLF in the working tree (index LF, `core.autocrlf=true`); new files written by agents are LF. `.gitattributes` forces LF for `supabase/proofs/**`, workflows and (since today) the new `supabase/candidates/ex06b_*.sql` / `ex07_*.sql`.

### 1.2 Canonical DEV `leqcwgzvjsxugfgzdmth` (read-only check 2026-10-02T09:51:32Z, after the last application)
- Ledger 221 (73 `dev_alpha`), last migration `dev_alpha_d12_review_comment_application` (version `20261002044950`).
- Closure certificate **`0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431`**, live = certified, `retention_ai_source_ready()` true. (History: `58447d77` before D12, `707af7fc` B24, `9205c7df` older.)
- cron: 2880 runs / 24 h, 0 failed. RPCs `rpc_*` in `public`: 246, executable by `authenticated`: 173. `private.agreement_review_comments_v1`: 0 rows, so the D12 revert window is still open (it closes at the first stored comment or the first account closure).
- Edge: 11 functions, all ACTIVE (media v14, push-transport v22 with verify_jwt false, worker-interview v17, ai-interview v50, ...). Nothing was deployed today.
- Re-read it with `docs/control/dev_snapshot.sql` (read-only SELECT through whatever read-only DEV access your environment has) and `list_edge_functions`; the committed copy is `docs/control/dev_snapshot.json` (04:55Z).
- Applied today on the owner's exact words: **D12** (`PRIMENI D12 PISANI KOMENTAR`, receipt `supabase/operations/dev-alpha/ledger/20261002_d12_review_comment_application.receipt.json`) and **EX-06 ex06a** (`PRIMENI EX-06 ex06a`, migration `20261002022631`, certificate unchanged). Applied 2026-10-01: EX-04 S1-S4 (ledger 219), Voice B1 (ledger 215). **Nothing else is applied and nothing is authorized** (`primeni` is per package).

### 1.3 Builds and devices
- HONOR (serial `A8QDVB6522001205`, 361 dp, font 1.15): APK `71697bf2` = UI wave 1, built from head `72d64fc4` (run 36963044604). Seen once (window 7). The phone is the owner's: only on his word "sad" (about 6 minutes), never clear data, never sign out.
- Emulator `USKOCI_V5_TEST` (`emulator-5554`, android-36.1 x86_64, 1080x2424 with `wm density 480` = 360 dp, font scale 1.15, time zone Europe/Belgrade): APK `1f909660` = UI wave 1 + the patched Reanimated (run 36987905823, attestation `patched` / `pass`), app already signed in by the owner. **Since 2026-10-02 the emulator is the everyday native QA device** (owner: "SAD radi na android emulatoru"; AGENTS.md 3.2.1). Emulator numbers stay labelled AVD and are never mixed with phone numbers.
- **No build contains** wave 2 (tab bar, Glyph), the Moji zadaci fix, the D12 client, the EX-07 S02 copy or the EX-07 S06 client. Anything about them on a device needs a new build from this head: `gh workflow run "Build Android development APK" --repo Uskoci1/USKOCI-CLEAN --ref work/uskoci-ui-unification-20260924 -f target=emulator -f reanimated_patch=apply` (use `-f target=phone` for the ARM64 phone build). Install with `adb -s <serial> install -r` only (never uninstall, never `pm clear`).

### 1.4 The control table (62 flows, from `docs/control/stanje.json`, head 942d075c)
- Lights: nacrt green 59 / grey 3; ekran green 58 / missing 4; kod green 57 / red 2 / missing 3; server green 52 / red 2 / missing 8; test green 57 / yellow 1 / missing 4; **telefon yellow 37 / grey 24 / green 1**.
- 50 of 62 flows have all five non-phone lights green (Put A 15 of 16, Put B 12 of 13, Dogovor 12 of 13, Početna i obaveštenja 3 of 5, Nalog/bezbednost/podaci 8 of 11, Sistem i pouzdanost 0 of 4). Verdicts: 41 PROBLEM, 21 "NA TELEFONU NIJE PROVERENO", **0 DONE** (DONE needs phone or emulator evidence for the current build, by design).
- Red rows: A16 HITNO (out of V1 by the owner's decision), B05 Pretraga i filteri, P05 Podsetnik (deferred). Rows with a missing light: D13, P04, P05, N01, N02, N03, S01, S02, S03, S04.
- Blockers B01-B24: closed or accepted B01, B04, B06, B17, B18 (accepted debt), B23, B24 (applied); partial B05, B07, B09, B10, B11, B15, B19, B22 (measured, not closed); open B12 (iOS), B13 (legal/stores), B16 (old versions), B21 (signing); B02 and B14 "PROVERITI".

### 1.5 Regression gate at the handoff (2026-10-02, 12:15-12:19, after all code commits and before the docs-only commits)
- `npx tsc --noEmit -p tsconfig.json`: exit 0, no output.
- `npx jest --maxWorkers=4 --testTimeout=120000`: **422 suites passed of 422, 9,236 tests passed, 9 skipped, 6 snapshots passed** (222 s). This is JEST on the authoring machine, not CI and not a device. The pushed head started about 13 workflows (list with `gh run list`); none had finished when this page was written.

## 2. What was done on 2026-10-01 and 2026-10-02 (short)

- **D12** (written review comment): server applied and verified (79 of 79 read-only checks); client written behind the OFF flag (section 5).
- **EX-06 ex06a** applied; EX-04 closed with limits; B09 zero-change; **B22**: the Reanimated patch (`patch-package`, owner "uskoci zakrpu") removes the logging flood (failed lines 2,699 -> 0 on the HONOR); probes P1, P2, P4 still not run (section 6.I), B22 not closed.
- **75 owner questions** answered by "accept all" (decision record above); AGENTS.md amended (3.1.5 expo-audio approved / expo-location conditional, 3.1.7 push sentence corrected, 3.2.1 emulator-first, 3.5.5 V1 scope). The edit that would have added the 19 UI decisions U01-U19 as AGENTS.md 3.6 item 9 was refused by the auto-mode classifier and was **not retried**; they live in the decision record and in `docs/implementation/ui-ux-pass-20261002/UIUX_PLAN_AND_STATUS_20261002.md`.
- **UI/UX pass** (ordered by the owner 2026-10-02, "kreni sad"): plan W1-W12 in the repo; wave 1 built and seen on both devices; wave 2 in source; emulator critique of wave 1 (61 findings, top ten for the next wave) saved.
- Commits made today by Claude on top of `942d075c` (oldest first):

| Commit | What |
| --- | --- |
| `2f21c211` | EX-07 S02 sign-in failure classes (six plain messages) - reviewed OK |
| `553f5f9f` | `.gitattributes` LF for the new server candidates |
| `c16f09c4` | UI wave 2: tab bar capsule + closed `Glyph` registry + Phosphor-import ratchet |
| `9a1f37a3` | Moji zadaci: tabs get the whole row, toolbar, counts on tabs (first-look defect 1) |
| `fa45c62d` | EX-07 S06 safety target name (server candidate NOT applied + client behind OFF flag) |
| `85339a90` | EX-07 S03 auth callbacks disposable proof (provider HTTP + emulator) |
| `6c979c12` | EX-06 S06 ex06b alias registry candidate (NOT applied) + p5 patch-chain test extended |
| `72564945` | D12 review comment client behind the OFF flag |
| `b0858f11` | EX-05 S01 chat server legs re-proof (updated proof copies, pin gate, evidence matrix) |
| `2c21e61b` | EX-06 S04 dispatch lifecycle negative-case proof (50 scenarios, 9 probes, predicted findings) |
| `e9aada75` | emulator critique of UI wave 1 (UX + VISUAL) |
| `3a73bfe6` | emulator drivers `emu.py`, `emu_tour1.py` |

Later commits of this handoff (EX-05 S02, legal drafts fix, registry and plan, this page) follow in `git log`.

## 3. The rules that bite hardest (read AGENTS.md for the rest)

1. **No DEV/PROD change without the owner's exact `PRIMENI <ime paketa>`** after an approval block (AGENTS 3.1.2, 3.1.8). The bare word "Primeni" names no package and authorizes nothing. Read-only diagnostics need no approval. Nothing on PROD, ever, from this repository today (the production project does not exist yet).
2. **Evidence honesty** (3.2): SOURCE, JEST/OFFLINE, CI (disposable chain), DEV APPLIED, APP WIRED, APK BUILT, EMULATOR, PHYSICAL DEVICE, iOS, RELEASE are different levels; never label unverified code READY; a disposable chain is not DEV; keep failed evidence. "Telefon" is green only with phone evidence for the current build.
3. **A deterministic server conflict raises errcode `PT409`, never SQLSTATE `40001`** (PostgREST 14 retries 40001 without end; B24).
4. **No new dependency, no paid AI call, no new account/key, no invented legal/operator/retention facts, no secrets.** Approved: `lottie-react-native`, `@gorhom/bottom-sheet`, `expo-blur`, `patch-package` (B22 patch only), `expo-audio` ~57.0.4 (decision A03, after a compatibility check, no parallel audio stack). Not approved: `expo-speech`.
5. **UI rules** (3.6): white reading surfaces; the primary action is green with a white label, orange only for what waits; no eyebrow or orientation copy; text never below 12 px at ordinary size; one `vreme()` time format; copy in the "ti" voice without grammatical gender; no "server" wording; Reduce Motion honoured; B22 constraint: no new Reanimated layout/entering/exiting animation, avoid animated SVG draws. **LOCKED**: `src/ui/entry/**`, `src/ui/referenceEntry/**`, EntryWelcome, the mascot, the HOME signature and the original assets.

Subagents (if you use any): they run on your own model; say which model each runs on; Fable 5.1 only after the owner says yes (AGENTS 3.1.9). A reusable rule sheet for helpers is `COMMON_AGENT_RULES_20261002.md` in this folder (written for Claude subagents; adapt the commit rule: you are the integrator).

## 4. Authority map (what to read for what)

| For | Read |
| --- | --- |
| The newest owner words and decisions | `finalization-20260927/OWNER_DECISIONS_20261002_ALL75.md`, `OWNER_ACTIONS_20261002.md`, `OWNER_QUESTIONS_AND_PROPOSALS_20261002.md` (all under `docs/implementation/product-v1-closure-20260926/`) |
| The operative plan (a projection) and the registry | `docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html`, `docs/control/redovi.json`, `docs/control/README.md` |
| UI/UX pass | `docs/implementation/ui-ux-pass-20261002/` (`UIUX_PLAN_AND_STATUS_20261002.md`, `UIUX_PLAN_20261002.json`, `UIUX_AUDITS_20261002.json`, `UIUX_W1_RESULTS_20261002.json`, `OWNER_START_AND_COMPLAINTS_20261002.md`, `EMULATOR_CRITIQUE_W1_20261002.md` + the two JSON files) and the design rules in AGENTS.md 3.6 |
| B22 (Reanimated) | `finalization-20260927/b22/B22_REANIMATED_PATCH_20261002.md` (section 9 = probes), `b22/scripts/` |
| D12 | `supabase/proofs/d12/README_D12_CANDIDATE.md`, `finalization-20260927/d12/` (`D12_CI_PROOF_AND_APPROVAL_BLOCK_20261002.md`, `D12_WRITTEN_REVIEW_DESIGN_20261001.md` section 23 = client plan) |
| EX-05 / EX-06 / EX-07 / EX-09 | the four `EX0x_CANONICAL_SCOPE_20261001.md` files in `finalization-20260927/` and the unit docs in `ex05/`, `ex06/`, `ex07/` |
| Media and push | `docs/implementation/release-hardening-20260926/MEDIA_PUSH_PREFLIGHT.md` and `CODEX_HANDOFF.md` (P1A-P1C: the single-target push isolation), `VOICE_AUDIO_STACK_DECISION_20260930.md` |
| AI prompts | `docs/implementation/v5-ai-first/ai-conversation-audit-20260922/REPORT.md` |
| Release | `docs/implementation/RELEASE_CHECKLIST_GOOGLE_PLAY_20260923.md`, `docs/implementation/release-prep-20260930/` |
| QA devices | AGENTS 3.2.1, `docs/implementation/qa-robot/README.md`, `finalization-20260927/b22/scripts/` (HONOR and emulator drivers) |

## 5. Units delivered today and what is still unproven

Level words: SOURCE = written; JEST/OFFLINE = ran on the authoring machine; CI = ran on a disposable chain in GitHub Actions; none of them is DEV, device or release evidence.
**"Unreviewed" means no independent read-only review has been done yet. Do the review before you promote an approval block, add a flag to a workflow or build a release.**

| Unit | Level now | Independent review | First thing to do |
| --- | --- | --- | --- |
| EX-07 S02 sign-in failure classes (`2f21c211`) | SOURCE + JEST (165 tests) | **Done: OK** (17 of 20 mutants caught, 2 rows added) | Owner decision F4 (section 8); S10 checks on a disposable account against the real DEV provider (wrong password = `invalid_credentials`; banned answer order) |
| UI wave 2: tab bar, `Glyph`, chrome (`c16f09c4`) | SOURCE + JEST (255 + 600) | Unreviewed | Build a DEV APK from this head, check it on the emulator, then the HONOR in a window; follow `verifyOnPhone` of wave W2 in `UIUX_PLAN_20261002.json` (item 2.2 stays deferred) |
| Moji zadaci tabs fix (`9a1f37a3`) | SOURCE + JEST (414) | Unreviewed | Look at it on the emulator (three whole labels at 360 dp x 1.15, spread tabs, toolbar); plan item 8.1 second half (Moje prijave tabs, fadingEdgeLength, filter sheet, ListSwap) is open |
| EX-07 S06 safety target name (`fa45c62d`) | SOURCE + OFFLINE (jest 188, PGlite 89/89) | Unreviewed | Read the CI run of `ex07-s06-proof.yml` (never run); only after a green run is the approval block promotable; wire the Dogovor entry in `src/app/dogovor/[id].tsx` (~line 506) |
| EX-07 S03 auth callbacks proof (`85339a90`) | SOURCE + OFFLINE (python 158, jest 22) | Unreviewed | Read `ex07-s03-auth-callbacks-proof.yml` (60-90 min; first run will probably need emulator iteration); results are DISPOSABLE EMULATOR evidence only |
| EX-06 ex06b alias registry (`6c979c12`) | SOURCE + OFFLINE (38 node tests) | Unreviewed | Read `ex06b-alias-proof.yml` (90-120 min, about 1000 Auth accounts); fill the CI section of the approval block only after a green run |
| D12 client behind the OFF flag (`72564945`) | SOURCE + JEST (561, flag-off snapshot recorded BEFORE the change) | Unreviewed | Review; wire `PublicProfileSheet` (the notice promises visibility the UI does not yet deliver); add `EXPO_PUBLIC_D12_REVIEW_COMMENT: '1'` to `build-android-dev-apk.yml` only after the review |
| EX-05 S01 chat re-proof (`b0858f11`) | SOURCE + OFFLINE (137 + 158) | Unreviewed | First CI cycle with `pin_gate_mode=report`; new finding: the PKG-010 chain driver does not plan on the head |
| EX-06 S04 dispatch lifecycle proof (`2c21e61b`) | SOURCE + OFFLINE (114) | Unreviewed | First run with input `pins=report`; the eight findings F5-F12 are HYPOTHESES from a simulated world - only a real run decides |
| EX-05 S02 RC-02 media-cancel lock order | see `git log` (finished after this page was started) | A reviewer was running at the handoff | Read `finalization-20260927/ex05/EX05_S02_RC02_ROUND_NOTE_20261002.md` |
| EX-07 S04 legal drafts (`docs/implementation/legal-drafts-20260930/`) | DRAFTS (technical, not legal advice) | **Review: FIX REQUIRED** (the drafts predate the owner decisions A30, A04, A05, A09/A10/A11, R06, R11, R12) | A fixer pass was STOPPED mid-way (the owner ran out of credits): treat the 13 fixes in `S04_LEGAL_DRAFTS_REVIEW_FINDINGS_20261002.md` as UNVERIFIED, finish them, and correct the "Review fixes" section of `legal-drafts-20260930/CHANGELOG_20261002.md`; fill no placeholder (`[[OPERATER]]`, `[[PROVERITI]]`, `[[ODLUKA VLASNIKA]]`) |

All helper agents that did this work ran on Sonnet 5.5 (the parent's model); Fable 5.1 was not used.

## 6. Work queue, in order

**6.A Push and read CI (first action).** `git push origin work/uskoci-ui-unification-20260924` (after the fast-forward/cherry-pick rule of 1.1). The push starts, by path filter, these workflows (all disposable-chain or client proofs, none touches DEV): `EX05-S01 chat server proofs re-proof`, `EX-05 S02 RC-02 media cancel lock order proof`, `EX-06 S04 dispatch lifecycle proof`, `EX-06 ex06b alias registry proof`, `EX-07 S03 auth callbacks proof`, `EX-07 S06 safety target name proof`, probably a duplicate `EX-06 S03 matching contract proof` (its path filter is `supabase/proofs/ex06/**`) and the ordinary CI. Several run 60-120 minutes. Read each with `gh run list --repo Uskoci1/USKOCI-CLEAN --branch work/uskoci-ui-unification-20260924 --limit 30` and `gh run view <id> --json status,conclusion` (always request `conclusion`; a wait loop that only reads `status` ends too early). The first run of a new proof is expected to be red or partial for harness reasons: classify (harness / chain fidelity / product), fix the generator or harness, **never hand-edit a generated file**, keep the failed run as evidence, record run id + exact head in the unit's doc and in the registry row. `ex07-s03-auth-callbacks-proof.yml` can be re-run without a code change by editing `supabase/proofs/ex07/s03/run_marker.txt`.

**6.B Independent review of the unreviewed units** (section 5), before any approval block is promoted or any flag is turned on. Use a read-only reviewer with mutation checks where useful; the S02 review is a good model (it reproduced mappings with the real auth-js client and mutated the code).

**6.C UI next wave.** Source of the work: `EMULATOR_CRITIQUE_W1_20261002.md` (ten items from the UX critic, ten from the VISUAL critic) + `UIUX_PLAN_20261002.json` waves W3+ + the accepted decisions U01-U19 (single brand tone, UI green `#076E4E`, green titles stay, white Dogovor surface, flat tab icons, visible "Poruke" tab, haptics only for outcomes, U04 docked tab bar, ...). Highest-value first: tab rows that fit at 360 dp x 1.15 (Moji zadaci done in source; Moje prijave still open), own task cards and Pregled tell the truth about state, the right primary action by state on the own task detail, one meaning of "Čeka te" with honest counts, the Dogovor workspace (Poruke tab, term line, rare actions), one AgreementRow, Zadaci pill/chips/card/sheet, Početna composition. Loop per screen (AGENTS 3.2.2): implement -> types/tests -> build -> emulator screenshot -> separate UX and VISUAL critique -> fix -> screenshot. Keep coherent batches, not an APK per style edit. Screenshots show the owner account: never commit them.

**6.D D12 follow-ups.** (1) Review the client, wire `PublicProfileSheet` with a slot (callers: `src/app/(app)/potrebe/[id]/kandidati.tsx`, `src/app/(app)/prilike/[id].tsx`, the discovery overlay), add the flag to the DEV APK workflow, native two-account proof on a really completed Dogovor (irreversible write: owner window). (2) **D12a** (not written): a function-only follow-up that unmasks the comment for the reviewed person with the author's face masked, plus a role-scoped list (decisions A09/A11); public aggregate stays; client ON only in DEV APKs. Write it by the D12 method (generator, guarded atomic DO, exact revert, read-only preflight/postflight, CI proof on a disposable chain, DRAFT approval block ending with the owner's exact words). The D12 revert window closes at the first comment or closure.

**6.E EX-06 remainder.** ex06b is prepared (section 7). Not written: **ex06c** (F4 one-bound match; "sutra" computed on the server from the publication day) and the D7 client fix ("sutra" from the publication day). Decisions already taken: electrical/plumbing and the four new work kinds stay "unknown"; no paid AI without provider/model/count/ceiling/accounts; synthetic corpus; HITNO out of V1; P05 deferred. EX-06 S04 findings F5 (applied worker is still sent the opportunity) and F10 (closed-search task fails every tick after an agreement cancellation) are the two major predictions: confirm or remove them with a real run before writing any fix.

**6.F Push (EX-05).** Decision: no push in the first release. A single-target admission package (EX-05 S06, "P1B") is to be PREPARED for its own approval: read `release-hardening-20260926/CODEX_HANDOFF.md` P1A-P1C and `EX05_CANONICAL_SCOPE_20261001.md` S06; the G22 decision (push ON, in-app OFF: options A/B/C) is in the EX-05 S01 round note. Nothing about push is activated, no device registered, no event created without the owner's word.

**6.G N10 closure discovery (EX-07 S07).** A certificate-moving candidate; prepared for its own approval only (isolated recertification, AGENTS 3.1.4). Not written.

**6.H Voice B2-b/B2-c.** `expo-audio` ~57.0.4 is approved (A03) after a compatibility check against the current Expo SDK and the existing audio code; install with `npx expo install expo-audio` only when no jest run is active; no parallel audio stack. Hold-to-talk sends on release; mic text draft approved; text-only group chat; support cannot hear a reported voice in V1.

**6.I B22 probes.** P1 (sheet spring), P2 (Mapa pill exit), P4 (pin peek) on the emulator when the machine is quiet (protocol: `B22_REANIMATED_PATCH_20261002.md` section 9; drivers: `b22/scripts/emu.py`). Report AVD numbers labelled AVD. B22 closes only with the probes passing **and the owner's word**; afterwards set the repository variable `RNR01_PUBLISH_PATCHED=yes` (accepted decision T02).

**6.J EX-09 release preparation** (S00-S15 in `EX09_CANONICAL_SCOPE_20261001.md`): Android first (iOS an explicit limit), free launch at 0 RSD, package `rs.uskoci` (permanent), Serbia first and 18+, production = a NEW separate Supabase project (the owner's account and cost), privacy pass after the UI pass, paid resources approved one by one. Owner-gated: accounts, operator data, domain, legal texts, store listing, signing. `pkg029e` (owner accounts in the TEST world) must be removed before real users (AGENTS 4.6); the B24 candidates must be applied to any future production project before its first real user (AGENTS 4.4).

**6.K Bookkeeping after every closed unit** (section 9).

## 7. Prepared server packages (nothing applied, nothing authorized)

Every package needs: CI proof green on a disposable chain -> independent review -> approval block (what changes, certificate effect, fresh read-only DEV preflight, what the person sees, what the owner accepts, what is not proven) -> the owner's exact words -> the guarded apply -> read-only postflight `problems: []` -> ledger receipt under `supabase/operations/dev-alpha/ledger/` -> registry + LIVE plan. A connector `apply_migration` wraps the text twice: use the marker-based guard (`supabase/proofs/d12/wrap_apply_migration.py`, or the generator's `--wrap-migration`), not the absolute-position guard.

| Package | Files | State | Exact owner words (only after a green CI proof) |
| --- | --- | --- | --- |
| ex06b alias registry (Cyrillic fold, IKEA declensions, `sklapanje` fix, stems as data) | `supabase/candidates/ex06b_alias_registry.sql` (+ `_revert.sql`), `supabase/proofs/ex06/` (`README_EX06B.md`, generator `build_ex06b.py`), approval block draft `finalization-20260927/ex06/EX06B_APPROVAL_BLOCK_DRAFT.md` | DRAFT; CI never run; certificate-neutral by catalog read | `PRIMENI EX-06 ex06b` |
| EX-07 S06 safety target name (N06/N07) | `supabase/candidates/ex07_safety_target_name.sql` (+ `_revert.sql`), `supabase/proofs/ex07/` (`build_ex07_s06.py`, `s06/`), draft `finalization-20260927/ex07/EX07_S06_TARGET_NAME_APPROVAL_BLOCK_DRAFT_20261002.md` | DRAFT; CI never run; function-only, digest-neutral by catalog; flag `EXPO_PUBLIC_EX07_SAFETY_TARGET_NAME` (add `'1'` to the workflow env only after a green run and the apply) | `PRIMENI EX-07 S06` |
| D12a, ex06c, N10 closure discovery, EX-05 S06 push admission, N06 policy mechanism (EX-07 S09) | not written | to be PREPARED (decisions are in `OWNER_DECISIONS_20261002_ALL75.md`) | each needs its own block and words |

**Stale pins**: proof pin tables written against the old certificate (`pkg049_pins.mjs`, `supabase/proofs/ex06/lib/pins.mjs`, earlier postflights) are stale for DEV since D12 moved the certificate to `0579191d`. Refresh them from a fresh read-only DEV read before the next package; the EX-05 S01 and EX-06 S04 pin files are 2026-10-02 snapshots (60 pins each, equal to DEV at 10:00 UTC).

## 8. Owner decisions still open (each with its default)

1. **EX-07 S02, F4 (privacy, AGENTS 3.1.1)**: should the sign-in message for a banned account (`user_banned`) stay distinct ("Pristup ovom nalogu je ograničen...")? Reviewer's recommendation and default: **keep** (the provider already answers it; the class is dormant because nothing in the repo sets `banned_until`). If he says fold: change one line in `src/data/authFailureClasses.ts` (case `user_banned` returns `BAD_CREDENTIALS`) and the tests that expect `RESTRICTED_ACCOUNT`. Wording of the second sentence ("kada se ograničenje ukloni" implies temporary) is his call too. He must say yes in his own words.
2. Wire the stranger-facing public profile before the D12 flag goes on anywhere (engineering decision, default yes).
3. ex06b: reading of "ELEKTRO and VODOINSTALATER must not appear" (kept their two existing rows, added nothing - question A15), a twelfth kind (default no), whether the classification version must travel in the delivery payload (separate slice, default no), acceptance of the `sklapanje ormara/kreveta` recall loss (default accept).
4. G22 options A/B/C for push ON / in-app OFF (in the EX-05 S01 round note) - only if the CI run records the gap.
5. AGENTS.md 3.6 item 9 (the 19 UI decisions as a rule paragraph): refused by the classifier once; offer it to the owner, do not retry silently.
6. B22 closing word after the probes.
7. Everything in `OWNER_ACTIONS_20261002.md` (accounts, keys - including rotating the two leaked Google keys -, devices, the production project, domain, legal).

## 9. Bookkeeping ritual after every closed unit

1. Edit `docs/control/redovi.json` (slice statuses, evidence, rows) - the only registry. Lights stay computed; do not turn a phone light green without phone evidence for the current build.
2. `node scripts/control/osvezi-master-plan.mjs --html docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html --redovi docs/control/redovi.json --state docs/control/master-plan-live-state.json`, then the same command with `--check`, then `node scripts/control/osvezi.mjs`. Refresh `docs/control/dev_snapshot.json` first if DEV changed.
3. Commit with explicit pathspecs (never `git add -A`), push, verify `git rev-list --left-right --count HEAD...origin/work/uskoci-ui-unification-20260924` is `0 0`.
4. The dashboard `docs/control/out/tabla.html` is also published as a Claude artifact (https://claude.ai/artifact/VxTvL3VpwhYv8cxJCWzD5t, last version 43 at the time of writing; the file is tracked but ignored, so `git add -f`). Only a Claude session can republish it: if you are Codex, leave it stale and say so in your report.
5. Commit trailer: end your commit messages with the attribution for the model you really run on; do not reuse Claude's trailer.

## 10. Traps and tooling notes (learned the hard way)

- **Connector transports**: `apply_migration` wraps the text twice (`begin; ... -- apply sql from post body <text> ...; -- track statements ... array[$TAG$<text>$TAG$] ... commit;`), so `current_query()` holds the text twice and the first copy starts at position 37. A stock absolute-position guard is refused there; the marker-based guard in `supabase/proofs/d12/wrap_apply_migration.py` (and the generators' `--wrap-migration`) reproduces the applied text. A connector deploy of an Edge function resolves literal `\u` escape sequences: read it back and byte-compare; the owner's CLI deploy is the byte-exact route.
- **Chain harness**: raw `db reset` never works; the harness admits the exact source147 manifest plus recorded successor deltas; pause the pg_cron marketplace tick in proofs; workflows need `fetch-depth: 0`; the closure digest of a chain differs from DEV's (never compare them); GoTrue soft delete leaves a phone token, never empty. Workflow files must be LF and their paths bracket-free (bracket paths break workflow files).
- **Jest**: screen suites crash if a screen transitively imports `supabaseClient` (follow the existing mocking pattern); a variable used inside a `jest.mock` factory must be prefixed `mock`; heavy router/discovery suites exceed the 5 s default under load (`--testTimeout=120000`); the ratchets in `src/ui/system/__tests__` (`one-token-source`, `glyph-import-guard`) are tight both ways. Android font scale 1.3 is 1.2999 (use `src/ui/system/textScale.ts`).
- **Windows/Git Bash**: heredocs with many quotes fail (write scripts with a file tool); never create a file named `nul`; a stale `.git/worktrees/.../index.lock` with no git process can be removed; `python -P` avoids a local `bisect.py`-style module shadowing the standard library; `gh` needs `--repo Uskoci1/USKOCI-CLEAN` outside a git directory.
- **Emulator**: a System UI ANR dialog under host load is dismissed by tapping "Wait" (about x321 y1383); check `mCurrentFocus` before every screenshot (a notification shade can sit over the app while `topResumedActivity` still reports it); incoming calls show `mCallState=1` on one of two SIM entries (check all); never import the P6 journey driver (it `pm clear`s the app); tabs are tapped by position, never by label. If the AVD is not running, start `USKOCI_V5_TEST` from Android Studio's Device Manager (or `emulator -avd USKOCI_V5_TEST`) and re-apply `adb -s emulator-5554 shell wm density 480`, `settings put system font_scale 1.15`, `cmd alarm set-timezone Europe/Belgrade`.
- **Certified closure**: patching a certified function body moves the digest: it needs the three-place re-bind (certified row, erasure source, live) inside one atomic statement and the owner's word (AGENTS 3.1.4).
- **Not in git on purpose**: emulator screenshots (they show the owner account), the QA account credentials (machine-local, DPAPI), downloaded APKs (re-download from the run). The earlier Claude-only scratch scripts (answering-page generators) are not needed.

## 11. How to start

The prompt to paste into Codex is `START_PROMPT_CODEX.md` in this folder. Open this directory (`.claude/worktrees/uskoci-kompletan-audit-2e715e`, branch `work/uskoci-ui-unification-20260924`; it has `node_modules`, so no `npm ci`) as the project, paste the prompt, and Codex continues from section 6.A. If you prefer a fresh checkout, create a worktree from `origin/work/uskoci-ui-unification-20260924` on a NEW branch (the same branch cannot be checked out twice), run `npm ci`, and merge back by cherry-pick.

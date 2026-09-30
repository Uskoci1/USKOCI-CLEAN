# DOCS - documentation inventory and proposed archive layout (read-only)

> C0 preparation, plan 7.3 "C0 - cista radna povrsina": "Aktuelna dokumentacija dobija kratak pocetni indeks. Arhivirati zastarele audit/round izlaze uz popravljene linkove." Nothing was moved, edited or deleted; `AGENTS.md` was **not** edited (the proposed replacement is text inside this file). Archiving inside the repository tidies the working set but **does not shrink the clone** and never rewrites history (plan 7.6). P6 is open: every path that a P6 workflow writes stays where it is until P6 ZAVRSEN.

## 0. Pin and method

| Item | Value |
|---|---|
| Pinned tree | `fc58f411598338c8589f5f177626a2790c92fb13` (drift since the pin: only evidence/plan files under `docs/` plus one new script `scripts/p6_collect_journey_evidence.py`, so no finding below changes) |
| Population | every tracked file under `docs/` (2,278) plus the root files `AGENTS.md`, `HANDOFF.md`, `README.md`, `CLAUDE.md`, `USKOCI_MASTER_PLAN_DIZAJNA.md`, `OVERNIGHT_PROGRESS.md`, `project_inventory.txt`, `remote_*.json`, `missing_remote_statements.json` |
| Classification | each docs file is placed in one class by four independent signals: (1) member of the active entry set; (2) **hard code input** (read/asserted/triggered by a script, test, workflow or build step; both `docs/...` literals and path-segment builds such as `path.join(root, 'docs', 'reference', ...)` were searched); (3) written by an open-P6 record step; (4) referenced by `docs/control/redovi.json` / the live master plan (registry links), by code as a soft citation, by active docs, or by nothing |
| Reference scan | 302 active docs were read at the pin and scanned for `docs/...` paths and relative markdown links (296 references into archive candidates found); `git log`/`ls-tree` history sizes for generated files |

## 1. Shape and size

`docs/` holds **2,278 files, 206.8 MB = 85 % of all tracked bytes (242 MB)**. PNG screenshots alone are **147 MB in 610 files**; the rest is JSON (14 MB, 705 files), HTML (12 MB), two ZIPs (11 MB), Markdown (7.5 MB, 535 files), 200 XML uiautomator dumps, 72 logs, 2 MP4.

| Folder | Files | Size | First - last commit | Comment |
|---|---:|---:|---|---|
| `docs/implementation/evidence` | 741 | 84.4 MB | 09-07 - 09-21 | `spoj-entry-20260907` alone is 72 MB / 361 files of screenshots and XML |
| `docs/implementation/design-system` | 491 | 53.9 MB | 09-23 - 09-28 | design rounds r1..r21, emulator/phone screenshots (28 files are cited by `redovi.json`) |
| `docs/implementation/design-audit-20260923` | 94 | 20.5 MB | 09-23 | one-day forensic UI audit |
| `docs/implementation/product-v1-closure-20260926` | 308 | 11.2 MB | 09-26 - 09-30 | runbook + PLAN (active) + `finalization-20260927/` (196 `ROUND_*` files) |
| `docs/implementation/functional-audit-20260922` | 79 | 9.9 MB | 09-22 - 09-23 | 15 files cited by the registry |
| `docs/authority/sources` | 144 | 9.2 MB | 09-11 | source packages hashed by `AUTHORITY_MANIFEST.json` |
| `docs/implementation/v5-ai-first` | 165 | 6.7 MB | 09-13 - 09-24 | pkg contracts/receipts; **hard proof inputs live here** |
| `docs/implementation/release-hardening-20260926` | 53 | 3.2 MB | 09-26 | R18 evidence; two files are read by R18 workflows |
| `docs/implementation/execution` | 68 | 1.6 MB | 09-15 - 09-19 | contains the required `CURRENT_ENTRY_MAP_20260916.md` |
| `docs/reference` | 3 | 1.4 MB | - | **the HTML is a build input (section 5)** |
| `docs/implementation` (66 loose files) | 66 | 1.2 MB | - | 9 `NEXT_AI_HANDOFF_*`, `CURRENT_IMPLEMENTATION_*`, RU/N/D03 notes |
| `docs/current`, `docs/control` | 2 + 22 | 1.2 + 1.2 MB | 09-26 - 09-30 | active start point and the only status registry |
| `docs/implementation/pre-v3`, `audit-20260924`, `research`, `ru3`, `ru4` | 20 | 0.7 MB | 09-11 - 09-24 | history |
| `docs/product-design-truth`, `docs/governance` | 11 + 8 | 0.4 MB | - | cited by `AUTHORITY_INDEX.md` |

## 2. Findings that matter most

1. **`AGENTS.md` is 125 KB / 1,001 lines / 159 paragraphs, ~92 % dated history**, and every agent session loads it (`CLAUDE.md` is one line: `@AGENTS.md`, about 31k tokens per session). It holds 132 dated paragraph headings (2026-09-13 .. 09-30), 45 "FINALIZATION ROUND" entries, 8 competing "read ... first" instructions and 21 "supersedes" statements; the undated remainder is ~9 KB, of which only ~3 KB are timeless rules. The plan (7.4) explicitly wants "kratak AGENTS / current index ... bez kontradiktornih pocetnih instrukcija". The project already did this once: the previous long file was archived as `docs/authority/history/AGENTS_PRE_HANDOFF_20260911.md`.
2. **CI edits `AGENTS.md`**: about 16 record scripts under `scripts/proofs/` (`p6-*-record.cjs`, `p6-spatial-hardening.cjs`, `p5-client-package.cjs`) do `write('AGENTS.md', '<new round paragraph>' + old)`, and 19 workflows `git add AGENTS.md ... ROUND_nn_*.md` and push to the canonical branch (71 of the 2,141 commits reachable from the pin are by the bot). The file has **215 versions** in history (11.3 MB uncompressed), `docs/control/stanje.json` 175 versions (34.5 MB), `redovi.json` 163 (25.6 MB), `docs/control/out/tabla.html` 74 (19.3 MB, force-added with `git add -f`), `FINALIZATION_MATRIX.md` 57. Replacing `AGENTS.md` without retiring/redirecting these scripts would re-inflate it.
3. **A CI test pins the docs layout**: `scripts/ci/pkg012-source-authority.test.cjs` (run on every default-branch push/PR by `pre-p4-integrity` via `node --test scripts/ci/*.test.cjs`) requires that `AGENTS.md` contains the string `CURRENT_ENTRY_MAP_20260916.md`, that the entry map exists and names four documents, and that **five historical entry documents open with a `HISTORICAL` banner pointing to the entry map** (`HANDOFF.md`, `docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md`, `CURRENT_IMPLEMENTATION_STATUS.md`, `IMPLEMENTATION_CONTINUITY.md`, `docs/implementation/v5-ai-first/EXECUTION.md`). The convention "banner + pointer, not deletion" already exists; the archive should follow it.
4. **A `docs/` file is a hard input of every `npm install`**: `package.json` `postinstall` runs `scripts/sync-entry-reference-assets.cjs`, which reads **`docs/reference/USKOCI_HTML_REFERENCA_IZGLEDA_APP.html`** (1.4 MB) and generates git-ignored `assets/generated/*` and `src/ui/referenceEntry/entryReferenceData.ts`; `build-android-dev-apk.yml` asserts the result. A plain `grep 'docs/'` does **not** find this (the path is built from segments). It must not be moved (CLIENT_CODE.md finding 3 discusses removing the pipeline itself).
5. **Generated views are the second growth engine**: `control-tracker-refresh.yml` regenerates `docs/control/{stanje.json,FINALIZATION_MATRIX.md,out/tabla.html}` and pushes (about 0.7 MB per regeneration; `out/tabla.html` is 316 KB). Proposal: keep generating, but publish `tabla.html` as an artifact/Artifact instead of committing it; keep `redovi.json` (the sole registry) and the generator scripts.
6. **The biggest, safest win is binary evidence**: `evidence/` (84 MB) needs one index link fixed (`AUTHORITY_INDEX.md`), one script path (`scripts/test_intent_shell_android.py` reads `.../ENTRY_login.xml`, and that script is itself tied to workflows proposed for ARCHIVE) and 5 soft citations (`w02-live101`, `live-readmission` receipts named in provenance). Together with the "truly free" set below that is **177 MB of 207 MB (86 %)** movable without touching a consumer.
7. **Root clutter**: `OVERNIGHT_PROGRESS.md` (an early-September overnight log), `project_inventory.txt` (UTF-16 machine dump with local paths incl. a `.env` name), `remote_migrations.json`, `remote_statements.json`, `missing_remote_statements.json` (early migration reconciliation dumps) have **0 consumers in code, workflows or docs**; `README.md` is still the untouched `create-expo-app` text.
8. **Two open GitHub secret-scanning alerts touch files named in this inventory** (found by a value-free scan; no value is quoted here): alert #1 (type Google API key, validity `active`, publicly leaked, first seen in commit `517d7447`) is the constant `BS_GOOGLE_MAPS_DEMO_KEY` at `docs/reference/USKOCI_HTML_REFERENCA_IZGLEDA_APP.html:11068`; alert #5 is the Firebase client key in `config/firebase/google-services.json` (CLIENT_CODE.md finding 8). Facts that matter for a cleanup: `scripts/sync-entry-reference-assets.cjs` extracts only four regex-matched regions of the HTML (city WebP, font, two animation objects) and checks no whole-file hash, so replacing that one constant with a placeholder would not break `postinstall`; `docs/authority/AUTHORITY_MANIFEST.json` records the file's sha256/bytes with status `..._DO_NOT_DELETE` (no script verifies it, but the record would go stale); and **archiving or editing the file never removes the key from public history**. Order for the owner: restrict or rotate the key in Google Cloud first (only the owner can), close the alert, then optionally redact the constant in a normal commit. Do not rewrite history for it.

## 3. `AGENTS.md`: anatomy and the proposed one-page replacement

### 3.1 Anatomy (pinned file)

| Part | Blocks | Bytes | Nature |
|---|---:|---:|---|
| Before the heading "# USKOCI - repository entry map" | 44 | 30.5 KB | 44 dated FINALIZATION/OWNER/P6 blocks (newest first) |
| After the heading, dated paragraphs | 94 | 85.3 KB | R6..R21, PKG-023..PKG-051, CF02, A1/R20 ... rounds |
| After the heading, undated | 21 | 9.3 KB | ~3 KB timeless rules and read order (blocks 153-158); ~6 KB are undated status paragraphs (design direction, PKG-027/030 notes, client follow-ups) |

### 3.2 Proposed replacement text (about 4.3 KB) - to be reviewed by the owner, not applied

````markdown
# USKOČI - agent entry (one page)

Existing Expo/React Native marketplace with Supabase authority (GitHub `Uskoci1/USKOCI-CLEAN`, canonical DEV/ALPHA project `leqcwgzvjsxugfgzdmth`). Do not restart it, create a second product master or a second status tracker.

## Current state (the only block edited in place; keep it dated)
Updated 2026-09-30. Work branch: `work/uskoci-ui-unification-20260924`. The GitHub default branch `clean-alpha-backend` is older and is not the source of truth.
- **P6 (Discovery map/list) is OPEN.** The owner handed the closing of P6 to the local Claude session: follow the operational master plan until everything is resolved, verified, cleaned up and optimized, testing on the Android **emulator, never the phone**. The 30k SQL screening is GREEN (67ffd458, run 36632921473) and is not re-opened. Order: disposable PKG045b + frozen P6 + cost layers + x86_64 proof APK on a CI-hosted emulator (FULL->detail->Back, scroll/viewport/selected pin, memory/ANR) -> controlled DEV rollout/cutover **only with the package-specific owner authorization (stop and report at that gate)** -> write P6 ZAVRSEN -> STOP for the owner.
- One P6 writer at a time; fetch before touching P6 files. No new audit, no P7, no new prototype.
- Deferred by the owner to the final whole-app privacy pass (keep NOT INTEGRATED / NOT APPLIED): AI context minimization (`d18e830a`, PR #108) and processor inventory (`1ab01e78`, PR #109).

## Read in this order
1. The owner's latest instruction in chat (the latest explicit owner decision wins; a historical proposal is never an approval).
2. `docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html` and the README beside it.
3. `docs/control/redovi.json` - the ONLY status registry (62 flows); HTML/markdown views are generated projections. After each closed package run `node scripts/control/osvezi-master-plan.mjs --html docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html --redovi docs/control/redovi.json --state docs/control/master-plan-live-state.json`, then the same command with `--check`.
4. `docs/implementation/product-v1-closure-20260926/FINAL_PRODUCT_EXECUTION_RUNBOOK_20260928.md` and `PLAN.md` (P0-P7 contract).
5. `docs/authority/AUTHORITY_INDEX.md` and `docs/implementation/execution/CURRENT_ENTRY_MAP_20260916.md` (the current entry map).
6. `HANDOFF.md` and `docs/archive/` are history. The dated round-by-round log that used to fill this file is `docs/archive/agents-log/AGENTS_LOG_20260911-20260930.md`.

## Boundaries (binding)
- Server/DEV/Edge/certificate application needs the explicit, package-specific owner word ("primeni ..."). Already applied packages are not re-approved; ordinary source approval does not cover pending server packages. New dependencies, paid services, data deletion, production resources and public/store submission each need their own permission.
- Never: force-push, blind reset/rebase, delete others' work, mass `db push`, edit an applied migration (forward-only), skip a preflight, merge/cherry-pick/apply `repair/ru0-ru1-backend-20260902`, or bring back the rejected candidate `2b2cf4d7`.
- No passwords, JWTs, service keys, private messages, full addresses or push tokens in the repository, docs, screenshots or CI; do not ask for them.
- Keep the existing engine: Supabase owns business rules; preserve RPC/RLS/revision/idempotency boundaries. TaskCard/DiscoveryPeek stay unchanged unless the owner approves; normal UI/flow work needs no per-image approval.
- Root is the sole integrator/live writer; isolate sub-agent file ownership; targeted checks while developing, full regression/migration/security/CodeQL/device gates at unit ends and release candidates.

## Status hygiene
Do not append status paragraphs here. Put the round report under `docs/implementation/...`, update `docs/control/redovi.json`, and edit only the "Current state" block.
````

### 3.3 Traceability (every line of the proposal comes from an existing statement; nothing new is invented)

| Proposed line | Source in the pinned repository |
|---|---|
| Project identity, "do not restart" | `AGENTS.md` block 153 ("This is an existing Expo/React Native marketplace ... Do not restart it or create another product master"); DEV project id: AGENTS PKG-023/026 entries and plan 2.2 |
| P6 OPEN, handoff, emulator-only, order, gate, STOP, one writer, no audit/P7/prototype | `AGENTS.md` block 0 "P6 OWNERSHIP HANDOFF + LIVE MASTER PLAN (2026-09-30)" and block 10 "OWNER P6 STOP CONDITION" |
| Privacy branches deferred | `AGENTS.md` "OWNER ORDER UPDATE (2026-09-28)" and "BRANCH / FIRST-ENTRY AUDIT (2026-09-28)"; plan 15.1 |
| Default branch older | "BRANCH / FIRST-ENTRY AUDIT (2026-09-28)" |
| Read order items 1-5 | block 155 ("Read in this order"), plan 2.1 (document authority table), block 0 (plan, registry, refresh command), runbook/PLAN entries |
| Registry rule + refresh command | block 0 (exact command with `--check`) |
| `CURRENT_ENTRY_MAP_20260916.md` | required string of `scripts/ci/pkg012-source-authority.test.cjs`; AGENTS "Current entry (PKG-012, 2026-09-16)" |
| Boundaries: owner word "primeni", no re-approval, dependency/paid/deletion/production/store permissions | AGENTS Rounds 07/08/14/15 (server/Edge/certificate application requires explicit "primeni"; dependency approval separate), plan 2.2 (G03) |
| Never-list, quarantine branch, rejected `2b2cf4d7` | AGENTS blocks 157 and "FINALIZATION ROUND32 FINAL", plan 1.4 and 2.2 |
| No secrets | AGENTS block 156 ("No secrets in client/repository/logs/tests. Do not request passwords/JWT"), plan 2.2 |
| Engine, TaskCard/Peek, UI approval | block 153/156; AGENTS Rounds 06-08 ("normal UI/flow work no longer requires per-image approval; TaskCard/DiscoveryPeek remain unchanged") |
| Integrator/test cadence | block 156 |

Items to **confirm with the owner before adopting**: whether the TaskCard/Peek freeze still applies after P6; whether the P6 handoff paragraph should stay in the one-pager or move to `docs/current/` once P6 closes.

### 3.4 Companion changes required (none may be done while P6 is open)

1. Keep the string `CURRENT_ENTRY_MAP_20260916.md` in the new file (already included) and leave the five HISTORICAL banners as they are, or update `scripts/ci/pkg012-source-authority.test.cjs` in the same commit.
2. Move the current `AGENTS.md` **verbatim** to `docs/archive/agents-log/AGENTS_LOG_20260911-20260930.md` (precedent: `docs/authority/history/AGENTS_PRE_HANDOFF_20260911.md`).
3. Retire or redirect the `write('AGENTS.md', ...)` step of the ~16 P6/P5 record scripts and the `git add AGENTS.md` steps of the 19 workflows that stage it (they are already `workflow_dispatch`-only for round 53-58 and marked HISTORICAL; the remaining ones follow WORKFLOWS.md). Otherwise the next run of any of them prepends a round paragraph to the new page.
4. Replace `README.md` (still the Expo starter text) with a 20-line pointer to the one-pager and `docs/current/`.

## 4. Active entry set (proposed KEEP in place)

| Path | Size | Role |
|---|---:|---|
| `AGENTS.md` (new one-pager), `CLAUDE.md`, `README.md` | small | agent/human entry |
| `docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html`, `README_USKOCI_LIVE_MASTER_PLAN.md` | 1.24 MB | the live operational plan (generated projection of the registry) |
| `docs/control/redovi.json` | 279 KB | **the only status registry (62 flows)** |
| `docs/control/{README.md, master-plan-live-state.json, tabla.template.html, dev_snapshot.*, izvori/r4-20260922/*}` | 0.3 MB | control inputs; `izvori/` = the frozen R4 forensic package verified by manifest |
| `docs/control/{stanje.json, FINALIZATION_MATRIX.md, out/tabla.html}` | 0.7 MB | generated views (keep generating; stop committing `out/tabla.html`, section 8) |
| `docs/implementation/product-v1-closure-20260926/{FINAL_PRODUCT_EXECUTION_RUNBOOK_20260928.md, PLAN.md, NOTIFICATION_MATRIX.md, CHAT_VOICE_CONTRACT.md}` | 0.11 MB | runbook and contracts (the last two are also workflow triggers) |
| `docs/authority/{AUTHORITY_INDEX.md, AUTHORITY_MANIFEST.json, sources/**}` | 9.4 MB | authority index; `sources/` is hash-verified by the manifest: do not move |
| `docs/implementation/execution/CURRENT_ENTRY_MAP_20260916.md` | 18 KB | required by the pkg012 test |
| `docs/reference/USKOCI_HTML_REFERENCA_IZGLEDA_APP.html` (+2 small `.md`) | 1.4 MB | build input of `npm install` |
| `docs/product-design-truth/*`, `docs/governance/*` | 0.4 MB | product truth cited by the authority index |
| `docs/implementation/product-v1-closure-20260926/finalization-20260927/` P6 `ROUND_43..58` + checks, `round4x/5x/6x` dirs | 5.8 MB | **P6-OPEN**: written by P6 records/workflows; archive only after P6 ZAVRSEN |

## 5. Class summary of all 2,278 docs files (pin)

| Class | Files | Size | Meaning / rule |
|---|---:|---:|---|
| ENTRY | 31 | 2.6 MB | section 4 |
| HARD-CODE-INPUT | 44 | 1.8 MB | 43 files read/asserted/triggered by code, tests, workflows or scripts **plus the postinstall HTML** (originally missed by the literal scan) |
| P6-OPEN | 76 | 5.8 MB | P6 record outputs, native rounds 30-32 evidence tied to the FULL-return line |
| REGISTRY-LINKED | 129 | 4.4 MB | cited by `redovi.json` / the live plan: move only together with a mechanical path rewrite of the registry (P6 owner edits it constantly: do it in one owner-coordinated commit or leave) |
| CODE-CITED (soft) | 63 | 1.1 MB | named in `MIGRATION_PROVENANCE.json`, ledger receipts, SQL comments, asset provenance: provenance stays valid if the file stays; leave in place or keep a one-line stub |
| HISTORICAL-TEXT-ONLY | 706 | 84.7 MB | mentioned only by `AGENTS.md`/`HANDOFF.md`/`USKOCI_MASTER_PLAN_DIZAJNA.md` (which are themselves being archived) |
| UNREFERENCED | 1,229 | 106.4 MB | mentioned by nothing |

After also removing files still linked by non-root active docs (`AUTHORITY_MANIFEST.json` -> `sources/**`, `AUTHORITY_INDEX.md` -> `evidence/`, ...): **1,011 files / 93.2 MB have no active reference at all** (design-system 50.1 MB, design-audit 20.5 MB, functional-audit 7.8 MB, rounds 4.6 MB, v5-ai-first 4.4 MB, release-hardening 3.2 MB, execution 1.2 MB, ...) and `evidence/` adds 84.3 MB behind one link fix.

### 5.1 Hard code inputs that must not move (selection)

| Path | Read/asserted by |
|---|---|
| `docs/reference/USKOCI_HTML_REFERENCA_IZGLEDA_APP.html` | **`npm postinstall`** (`scripts/sync-entry-reference-assets.cjs`) |
| `docs/control/**` | `scripts/control/osvezi.mjs`, `osvezi-master-plan.mjs`, 2 refresh workflows |
| `docs/implementation/v5-ai-first/PRESELECTION_QA_EXECUTABLE_POLICY.json` | `supabase/proofs/ai/qa_classifier_edge.test.mjs`, `pkg040_proof.mjs`, `pre_v3/v5_qa_owner_activation*.mjs` |
| `.../v5-ai-first/AF22_CLOSURE_INVENTORY_144.json` | `supabase/proofs/pre_v3/v5_account_erasure*.mjs` |
| `.../v5-ai-first/pkg042|pkg045/FUNCTION_PINS_20260922.json`, `LIVE_READONLY_BASELINE.json` | `pkg042_proof.mjs`, `pkg045_proof.mjs`, `scripts/prepare-v5-live-candidate.py` |
| `docs/implementation/ru3/RS_PUBLICATION_POLICY_MINIMUM_OWNER_LOCK_V1.md` | d0140a bundle-registration proof and its tests (also cited in a migration comment) |
| `docs/implementation/release-hardening-20260926/STORAGE_*.json` | R18 workflows (one-shot; archive with them) |
| `docs/implementation/product-v1-closure-20260926/{NOTIFICATION_MATRIX,CHAT_VOICE_CONTRACT,PLAN}.md`, `.../finalization-20260927/{P6_MAP_PLACES_WIRE_20260928.md, worker_profile_licenses_owned_projection_report.md, ROUND_43-58 *}` | workflow `paths:` triggers and record/verify steps |
| `docs/implementation/evidence/spoj-entry-20260907/run34163510260/artifact/ENTRY_login.xml` | `scripts/test_intent_shell_android.py` (archive-tied) |
| the five HISTORICAL-bannered entry docs + `CURRENT_ENTRY_MAP_20260916.md` | `scripts/ci/pkg012-source-authority.test.cjs` |

## 6. Proposed `docs/archive/` layout (moves only; content and hashes preserved)

```
docs/
  current/  control/  authority/  reference/  governance/  product-design-truth/     (unchanged)
  implementation/
    product-v1-closure-20260926/   runbook, PLAN, matrices; finalization-20260927/ keeps P6 ROUND_43+ until P6 ZAVRSEN
    v5-ai-first/  execution/CURRENT_ENTRY_MAP_20260916.md  release-hardening-20260926/    (proof inputs stay until their workflows are archived)
  archive/                                              NEW - frozen, not read at session start
    README.md          index + old-path -> new-path table + REJECTED/FAIL labels (plan 7.6)
    agents-log/        AGENTS_LOG_20260911-20260930.md (verbatim), HANDOFF snapshots
    rounds/            finalization-20260927 ROUND_01..42 (135 files, 1.2 MB), native-round30..32 (REJECTED candidate 2b2cf4d7 evidence stays labelled)
    design/            design-audit-20260923, design-system/* not cited by the registry, board-phone, catalog27-reference
    evidence/          docs/implementation/evidence (84 MB) - or, optionally, a cold bundle outside HEAD
    audits/            functional-audit-20260922, audit-20260924, pre-v3, research, execution/* except the entry map
    handoffs/          CURRENT_IMPLEMENTATION_*, IMPLEMENTATION_CONTINUITY, LIVE_IMPLEMENTATION_NETWORK*, NEXT_AI_HANDOFF_* (keep the 3 banner docs until the pkg012 test is updated)
    root/              OVERNIGHT_PROGRESS.md, project_inventory.txt, remote_*.json, missing_remote_statements.json
    supabase-notes/    supabase/*.md RU-0 era audit notes (SERVER.md section 10)
```

Rules for the move: `git mv` whole folders (relative links inside stay valid); add a `HISTORICAL` banner + pointer to `docs/archive/README.md` only where a required test demands it; write the redirect table before the move; run a link checker (the scan found 296 references into archive candidates: 183 from entry docs, of which 160 are `AUTHORITY_MANIFEST.json` entries pointing at `sources/**` (which **stays**), 9 in `AUTHORITY_INDEX.md`, 7 in the frozen R4 findings and 7 in `CURRENT_ENTRY_MAP_20260916.md`; 86 from `AGENTS.md`/`HANDOFF.md`/`USKOCI_MASTER_PLAN_DIZAJNA.md` (history text that moves or is rewritten with them); 10 from registry-linked docs; 16 code/provenance citations; 1 hard input). Optional second stage (owner decision): move the 147 MB of PNGs out of `HEAD` into a bundle/release asset with hashes recorded in `archive/README.md`; that is the only variant that shrinks checkouts and the `uskoci-source` CI artifact (1.7 GB now).

## 7. Order and rollback

1. After P6 ZAVRSEN and owner go: banner + pointer commit for `AGENTS.md`; archive the verbatim log; retire the record steps (section 3.4).
2. Move the 1,011 free files (design/audit/rounds/v5-ai-first non-inputs/execution/pre-v3/loose) in 3-4 commits per family; run `node --test scripts/ci/*.test.cjs`, the jest suite and `node scripts/control/osvezi-master-plan.mjs --check --html docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html --redovi docs/control/redovi.json --state docs/control/master-plan-live-state.json` after each (only that script has a `--check` mode; `osvezi.mjs` just regenerates `stanje.json`/`tabla.html`, so check it with `git diff --stat` after a run).
3. Move `evidence/` after fixing `AUTHORITY_INDEX.md` (or with the archive-tied mobile-proof workflows).
4. Registry-linked design/audit folders: one coordinated path rewrite of `redovi.json`, then move.
5. Root clutter and README.
6. **Rollback**: each step is a `git mv` commit; `git revert` restores paths exactly; nothing is deleted and no history is rewritten.

## 8. Generated views (control) and root clutter

| Item | Fact | Proposal |
|---|---|---|
| `docs/control/out/tabla.html` | 316 KB, 74 committed versions (19.3 MB uncompressed), force-added | generate in CI, publish as artifact; stop committing - **but only after the P6 record chain is archived**: 22 workflows stage it (`control-tracker-refresh`, `round40-control-refresh`, `p5-client-package`, 16 `p6-*`, 3 `r18-*`; almost all with `git add -f`) and 16 record scripts whitelist it (`allowed=new Set([...,'AGENTS.md','docs/control/redovi.json','docs/control/stanje.json',...,'docs/control/out/tabla.html'])`); a `.gitignore` entry alone would not stop them because they force-add |
| `docs/control/stanje.json` | 325 KB, 175 versions (34.5 MB) | keep committed only if a consumer needs it in git (`osvezi` reads `redovi.json`); otherwise same as above |
| `docs/control/redovi.json` | 279 KB, 163 versions (25.6 MB) | KEEP: the registry; consider compacting fields, not splitting |
| Root: `OVERNIGHT_PROGRESS.md`, `project_inventory.txt`, `remote_migrations.json`, `remote_statements.json`, `missing_remote_statements.json` | 0 consumers | ARCHIVE (`docs/archive/root/`) |
| `USKOCI_MASTER_PLAN_DIZAJNA.md` (40 KB) | design master plan, 21 docs paths cited, no code consumer | ARCHIVE after the owner confirms the live plan supersedes it |
| `HANDOFF.md` (50 KB) | required HISTORICAL banner | KEEP the banner (test), archive the body later |

## 9. Limits

- The classification uses reference signals, not authorship or value: an "UNREFERENCED" file can still be the only proof of an accepted or rejected build (plan 7.1 keeps the last accepted **and** last rejected proof: `native-round32` (REJECTED `2b2cf4d7`) and the P6 receipts must be preserved and labelled, never dropped).
- Path-segment builds and dynamic paths can hide consumers (the postinstall HTML proved it); the 44 HARD files are a lower bound. A cold checkout that runs `npm ci`, `npx tsc`, `jest`, `node --test scripts/ci/*.test.cjs` and the control refresh after the move is the acceptance test (plan 7.5 "cist svez checkout").
- Moving files does not reduce clone size; the 2,141-commit history stays as is.

# Couplings — everything that reads, hashes, stages, greps, asserts or writes `AGENTS.md` (and `HANDOFF.md` / `CLAUDE.md`)

Method: `git grep -n -E "AGENTS\.md|HANDOFF\.md|CLAUDE\.md" 934057d5 -- scripts .github docs/authority __tests__ supabase/proofs package.json jest.config.* tsconfig*.json .gitattributes` (tracked files at the canonical commit), plus a Grep of `docs/current/**`, `docs/control/README.md`, `docs/control/redovi.json`, the runbook, `PLAN.md` and the entry map in the canonical checkout, plus a search for anything that verifies `AUTHORITY_MANIFEST.json` (none). `node_modules` was never searched. Counts: **16 record scripts + 3 evidence scripts write AGENTS.md; 19 workflows stage it and push to the canonical branch (19/19 contain `git push`); 1 CI test asserts its content; 1 test-fixture string, 1 attributes line, 1 manifest pin, ~10 documentary references.**

## 1. Coupling table

### A. Hard assertions (break the build if ignored)

| File | What it does with AGENTS.md | Must change in the SAME commit |
|---|---|---|
| `scripts/ci/pkg012-source-authority.test.cjs` L44–46 | `assert.ok(read('AGENTS.md').includes('CURRENT_ENTRY_MAP_20260916.md'))`. Also L36–42: the five HISTORICAL-bannered docs (`HANDOFF.md`, `docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md`, `CURRENT_IMPLEMENTATION_STATUS.md`, `IMPLEMENTATION_CONTINUITY.md`, `docs/implementation/v5-ai-first/EXECUTION.md`) must keep `HISTORICAL` + the entry-map name in their first 3 lines. Run by `.github/workflows/pre-p4-integrity.yml` L81 (`node --test scripts/ci/*.test.cjs`) on push / pull_request / dispatch. | **Nothing**, provided the slim file keeps the literal `CURRENT_ENTRY_MAP_20260916.md` (`AGENTS.proposed.md` §1.3.4 has it) and none of the five banners is touched. Do not rename/move `AGENTS.md`. |
| `CLAUDE.md` (exactly `@AGENTS.md\n`, 11 bytes) | Loads the root file into every session. | Nothing; the root path `AGENTS.md` must keep existing. |
| `.gitattributes` L37 `AGENTS.md text eol=lf` (L38 `HANDOFF.md`, L41 `CURRENT_IMPLEMENTATION_HANDOFF.md`) | Line-ending pin. | Keep; **add** `docs/authority/history/AGENTS_PRE_SLIM_20260930.md text eol=lf` so the byte-exact archive cannot be CRLF-converted on checkout. |

### B. Scripts that PREPEND a status paragraph to AGENTS.md (the re-inflation engine)

All follow the pattern `write('AGENTS.md', '<ROUND paragraph>' + read('AGENTS.md'))` inside a `record` mode, with an `allowed` set that whitelists `'AGENTS.md'` for the `verify` mode (`git diff --name-only $GITHUB_SHA` must stay inside the set).

| Script | write line | allowed-set line | Same-commit change |
|---|---|---|---|
| `scripts/proofs/p5-client-package.cjs` | L207 (`FINALIZATION ROUND39 …`) | L213 | delete the write; drop `'AGENTS.md'` from `allowed` |
| `scripts/proofs/p6-client-owner-record.cjs` | L38 (ROUND50) | L7 | same |
| `scripts/proofs/p6-cost-compare-record.cjs` | L66 (ROUND47) | L8 | same |
| `scripts/proofs/p6-cost-latest-record.cjs` | L77 (ROUND48) | L8 | same |
| `scripts/proofs/p6-cost-record.cjs` | L70 (ROUND46) | L8 | same |
| `scripts/proofs/p6-four-mode-record.cjs` | L64 (ROUND44) | L8 | same |
| `scripts/proofs/p6-http-record.cjs` | L60 (ROUND45) | L7 | same |
| `scripts/proofs/p6-round53-record.cjs` | L43 | L8 | same |
| `scripts/proofs/p6-round54-record.cjs` | L46 | L7 | same |
| `scripts/proofs/p6-round55-record.cjs` | L47 | L8 | same |
| `scripts/proofs/p6-round56-record.cjs` | L51 | L9 | same |
| `scripts/proofs/p6-round57-record.cjs` | L42 | L7 | same |
| `scripts/proofs/p6-round58-record.cjs` | L43 | L9 | same |
| `scripts/proofs/p6-screen-session-record.cjs` | L34 (ROUND52) | L7 | same |
| `scripts/proofs/p6-spatial-hardening.cjs` | L118 (ROUND43) | L121 | same |
| `scripts/proofs/p6-view-adapter-record.cjs` | L35 (ROUND51) | L7 | same |
| `supabase/proofs/discovery/p6_repeatability.py` | L243–244 (`agents.write_text('OWNER P6 STOP CONDITION + ROUND49 …' + agents.read_text())`) | inline `allowed={…}` in `.github/workflows/p6-repeatability-proof.yml` L125 | delete the two lines; drop `'AGENTS.md'` from the workflow's inline set |
| `scripts/proofs/r18-storage-integrity-20260926.mjs` | L320–322 (`replaceOnce(agents, '# USKOČI — repository entry map\n', heading + 'R18 STORAGE INTEGRITY …')`) | workflow `r18-storage-integrity-20260926.yml` L87 | delete L320–322 (with the slim file the heading still exists as line 1, so this would otherwise insert a paragraph); drop `'AGENTS.md'` from the workflow set |
| `scripts/control/record-r18-refusal-20260926.mjs` | L102–107 (`assert.ok(agents.startsWith('# USKOČI — repository entry map\n\n'))`, then inserts after the heading) | L77 `allowed = p => … \|\| p === 'AGENTS.md'`; workflow set L115 | delete L102–107 and the `'AGENTS.md'` clause; one-shot guard L80 (`assert.ok(!existsSync(CHECKS))`) already stops a re-run, but the writer should not survive. `scripts/control/record-r18-refusal-20260926.test.mjs` does not reference AGENTS.md (no test to update). |

The proposed slim file keeps the H1 `# USKOČI — repository entry map` on line 1, so the two heading assertions above would *pass* and insert text if their steps ever ran again — another reason to delete the writers, not just to rely on one-shot guards.

### C. Workflows that stage AGENTS.md and push to the canonical branch (19)

Common shape (verified on `p6-round55-proof.yml` L15/L59/L61/L73–74 and by the grep of all 19): job `if: github.repository == 'Uskoci1/USKOCI-CLEAN' && github.ref == 'refs/heads/work/uskoci-ui-unification-20260924'` → proof → `node <record script> record` → `git add AGENTS.md docs/control/redovi.json docs/control/stanje.json docs/control/FINALIZATION_MATRIX.md <ROUND doc> …` (often `-f docs/control/out/tabla.html`) → `node <record script> verify` → `git push origin "HEAD:refs/heads/$branch"`. `concurrency: cancel-in-progress: false`, so an in-flight run always completes.

| Workflow | `git add AGENTS.md` line | Trigger at `934057d5` | Hazard for the slimming commit | Same-commit change |
|---|---|---|---|---|
| `p5-client-package.yml` | L94 | `push` on its own paths (workflow file, `scripts/proofs/p5-client-package.cjs`, 4 src/test files) + dispatch | editing the record script or the workflow **fires it** | remove `push:` (keep `workflow_dispatch`), drop `AGENTS.md` from `git add` |
| `p6-client-owner-proof.yml` | L58 | dispatch only | manual only | drop `AGENTS.md` from `git add`; mark HISTORICAL in `name:` |
| `p6-cost-latest-proof.yml` | L133 | `push` on own workflow file + proof inputs (record script not listed) | editing the workflow fires it | remove `push:`; drop `AGENTS.md` |
| `p6-cost-optimization-proof.yml` | L141 | `push` on own paths incl. `scripts/proofs/p6-cost-compare-record.cjs` | editing script or workflow fires it | remove `push:`; drop `AGENTS.md` |
| `p6-current-cost-proof.yml` | L141 | `push` on own paths incl. `scripts/proofs/p6-cost-record.cjs` | same | same |
| `p6-four-mode-proof.yml` | L144 | `push` on own paths incl. `scripts/proofs/p6-four-mode-record.cjs` | same | same |
| `p6-http-boundary-proof.yml` | L124 | `push` on own paths incl. `scripts/proofs/p6-http-record.cjs` | same | same |
| `p6-repeatability-proof.yml` | L136 (+ inline allowed set L125) | `push` on own paths incl. `supabase/proofs/discovery/p6_repeatability.py` | same | same + edit inline set |
| `p6-round53-proof.yml` | L65 | dispatch only | manual only | drop `AGENTS.md`; HISTORICAL |
| `p6-round54-proof.yml` | L65 | dispatch only | manual only | same |
| `p6-round55-proof.yml` | L65 | dispatch only | manual only | same |
| `p6-round56-rollout-proof.yml` | L141 | `push` on own paths incl. `scripts/proofs/p6-round56-record.cjs` | fires | remove `push:`; drop `AGENTS.md` |
| `p6-round57-load-proof.yml` | L138 | `push` on own paths incl. `scripts/proofs/p6-round57-record.cjs` | fires | same |
| `p6-round58-native-proof-build.yml` | L120 | dispatch only | manual only | drop `AGENTS.md`; HISTORICAL |
| `p6-screen-session-proof.yml` | L57 | dispatch only | manual only | same |
| `p6-spatial-hardening.yml` | L69 | `push` on own workflow file + `scripts/proofs/p6-spatial-hardening.cjs` | fires | remove `push:`; drop `AGENTS.md` |
| `p6-view-adapter-proof.yml` | L54 | dispatch only | manual only | drop `AGENTS.md`; HISTORICAL |
| `r18-refusal-evidence-20260926.yml` | L106 (+ allowed set L115) | `push` on its own workflow file + dispatch | editing the workflow fires it (one-shot guard then fails the job) | remove `push:`; drop `AGENTS.md` from `git add` and from the set |
| `r18-storage-integrity-20260926.yml` | L76 (+ allowed set L87) | `push` on own workflow file + `scripts/proofs/r18-storage-integrity-20260926.mjs` + dispatch | fires | remove `push:`; drop `AGENTS.md` from `git add` and from the set |

Why removing `push:` in the same commit is enough: for a `push` event GitHub evaluates the `on:` block of the workflow file **as it is in the pushed commit**, so a file whose `push:` trigger is deleted in that very commit does not run for it. `workflow_dispatch` stays so the historical proofs remain re-runnable by hand (they then no longer touch AGENTS.md).

None of the 19 lists `AGENTS.md` in its `paths:` filter, so a commit that changed only `AGENTS.md` would fire none of them; the hazard comes exclusively from editing the record scripts and workflow files — which the retirement requires. Hence: **never edit a record script or a staging workflow without removing that workflow's `push:` trigger in the same commit.**

### D. Manifest, index, registry and documentary references (no code breaks; honesty and navigation)

| File | Reference | Same-commit change |
|---|---|---|
| `docs/authority/AUTHORITY_MANIFEST.json` L1944–1960 | history entry for `docs/authority/history/AGENTS_PRE_HANDOFF_20260911.md` (`superseded_by: ["AGENTS.md"]`, sha256 `7a6d8e73…`, 45,053 bytes) | keep untouched |
| `docs/authority/AUTHORITY_MANIFEST.json` ~L2820–2834 | root `AGENTS.md` pin: sha256 `605197412c…`, bytes 2579, version 2026-09-11 — **already stale** for 19 days; no script verifies the manifest | update sha256/bytes/version_date to the slim file; add the new history entry (ARCHIVE_PLAN.md §4) |
| `docs/authority/AUTHORITY_INDEX.md` L56 | row "OldAGENTS repeatedcheckpoints andoldmaster autonomy — HISTORICAL; fullpreviousfile preserved inhistory. Shortrootmap/latestSAFE_STOP govern." | add the 2026-09-30 archive to the row (one sentence) |
| `docs/implementation/execution/CURRENT_ENTRY_MAP_20260916.md` L10, L30 | L10 already describes the slim intent ("`AGENTS.md` — repository rules, authority order, what never changes."); L30 lists the 2026-09-11 archive as HISTORICAL | add a row for `AGENTS_PRE_SLIM_20260930.md` |
| `docs/control/redovi.json` L3767, L3844, L3851 | `"dokaz": "AGENTS.md PKG-044"`, `"dokaz": "AGENTS.md CodeQL"` ×2 | PKG-044 evidence moves to the archive → point that string at `docs/authority/history/AGENTS_PRE_SLIM_20260930.md` (or `docs/implementation/v5-ai-first/pkg044/…`); the CodeQL decision stays in the slim file (§3.1.5) so those two may stay. Registry edits belong to the P6 owner (one writer) — coordinate, do not race |
| `docs/implementation/product-v1-closure-20260926/FINAL_PRODUCT_EXECUTION_RUNBOOK_20260928.md` L13 | "AGENTS.md, newest dated entries first; retain applicable stable restrictions below them." | reword to the new layout (rules; dated history in the archive) — doc only |
| `docs/implementation/product-v1-closure-20260926/PLAN.md` L15 | "Read AGENTS.md, …" | no change |
| `docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html` L194, L542, L789, L4203–4205, L4337, L4457, L4556, L5327 | mentions AGENTS.md as first reading; L789 states the C0 goal "Kratak AGENTS/current index …"; L4205 links a fixed historical blob (`…/blob/4f786a1b…/AGENTS.md`) | no change needed for the slim commit (fixed blob link stays valid); after the slim, the P6 owner may update `docs/control/master-plan-live-state.json` "next" and regenerate. `scripts/control/osvezi-master-plan.mjs` and `osvezi.mjs` do **not** read AGENTS.md (grep: no hits), so `--check` is unaffected |
| `docs/authority/sources/**` (`design/USKOCI_MASTER_DESIGN_SYNTHESIS_20260908.md`, `owner/20260910_PRODUCT_COMPLETION_COMMAND.txt`, `spoj-v2/PACKAGE_MANIFEST.json`, `spoj-v2/source/build_docs.py`) | cite "AGENTS.md" as evidence of that date | **do not touch** — frozen sources hashed by the manifest (160 pinned files) |
| `docs/authority/history/AGENTS_PRE_HANDOFF_20260911.md` L260, L272 | internal references of the old file | do not touch |
| `.github/workflows/r18-refusal-evidence-20260926.yml` L75, L89, L95, L144 | writes into `CODEX_HANDOFF.md`/media docs (HANDOFF.md-like names, not the root HANDOFF.md) | covered by removing `push:` above; nothing else |

`HANDOFF.md`: referenced by the pkg012 test (banner), `.gitattributes` L38, `AUTHORITY_INDEX.md` L17 and the manifest (~L2836). It is not part of the slimming; leave it as is (the inventory proposes archiving its body later, with a test update).

## 2. Safe order of changes

Do everything in **one commit** on the canonical branch (or in two commits where commit 1 = retire writers/triggers, commit 2 = archive + slim + pointers — never the other way round). Preconditions: fetch, clean tree, no `p6-*`/`p5-client-package`/`r18-*` run queued or in flight (their concurrency groups do not cancel), one writer on `AGENTS.md`/`docs/control/**`/`docs/authority/**`.

1. Workflows (19): delete the `push:` trigger of the 12 push-triggered files (keep `workflow_dispatch:`); remove the `AGENTS.md` token from every `git add` line; remove `'AGENTS.md'` from the two inline allowed sets (`p6-repeatability-proof.yml` L125, `r18-storage-integrity-20260926.yml` L87, `r18-refusal-evidence-20260926.yml` L115); optionally prefix `name:` with `HISTORICAL —`.
2. Scripts (19): delete the AGENTS write lines listed in B (and the two heading assertions); remove `'AGENTS.md'` from every `allowed` set so `verify` fails loudly if anything writes it again. `node --check` each `.cjs`/`.mjs`, `python -m py_compile` the `.py`.
3. Archive: `git show HEAD:AGENTS.md > docs/authority/history/AGENTS_PRE_SLIM_20260930.md` (or `git update-index --add --cacheinfo 100644,689eab810bd1df63e20739ec6975e5183da384fa,<path>`), `.gitattributes` line, hash checks (ARCHIVE_PLAN.md §3).
4. Slim: copy the reviewed `AGENTS.proposed.md` over `AGENTS.md` (LF); confirm the `CURRENT_ENTRY_MAP_20260916.md` literal.
5. Pointers: manifest (new entry + updated root pin), `AUTHORITY_INDEX.md` L56, `CURRENT_ENTRY_MAP_20260916.md` L30, runbook L13; `redovi.json` `dokaz` (P6 owner).
6. Verify (section 3), commit, push, then watch Actions: only `pre-p4-integrity` (and any unrelated path-triggered workflow) may start; no `p6-*`, `p5-client-package` or `r18-*` run.

Rollback: `git revert` of the commit restores the long file, the writers and the triggers exactly.

## 3. Verification commands (before the commit, then again after `git push`)

```bash
node --test scripts/ci/*.test.cjs                                                     # pkg012 test: AGENTS.md names the entry map; banners intact
node --test supabase/proofs/legal/pending_source_plan.test.mjs supabase/proofs/legal/pending_domain_replay.test.mjs scripts/ci/owned-intake-source.test.mjs   # the rest of pre-p4-integrity L82
for f in scripts/proofs/p6-*-record.cjs scripts/proofs/p6-spatial-hardening.cjs scripts/proofs/p5-client-package.cjs; do node --check "$f"; done
node --check scripts/proofs/r18-storage-integrity-20260926.mjs scripts/control/record-r18-refusal-20260926.mjs
python -m py_compile supabase/proofs/discovery/p6_repeatability.py
node scripts/control/osvezi-master-plan.mjs --check --html docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html
npx tsc --noEmit                                                                       # no TS is touched; run as the standing gate
git grep -n -E "write\('AGENTS\.md'|writeFileSync\('AGENTS\.md'|Path\('AGENTS\.md'\)|git add.*AGENTS\.md|'AGENTS\.md'" -- scripts .github supabase/proofs   # expect 0 hits
grep -c 'CURRENT_ENTRY_MAP_20260916.md' AGENTS.md                                      # >= 1
file AGENTS.md docs/authority/history/AGENTS_PRE_SLIM_20260930.md                      # no CRLF
sha256sum docs/authority/history/AGENTS_PRE_SLIM_20260930.md                           # a29c91b237e443b00ea511ed71e92f034471de788bf73053782ece64db178b77
git hash-object docs/authority/history/AGENTS_PRE_SLIM_20260930.md                     # 689eab810bd1df63e20739ec6975e5183da384fa
# after commit:
git rev-parse HEAD:docs/authority/history/AGENTS_PRE_SLIM_20260930.md                  # 689eab81…
git show HEAD:AGENTS.md | wc -c                                                        # the slim size
```

Optional: `actionlint .github/workflows/p6-*.yml .github/workflows/p5-client-package.yml .github/workflows/r18-*.yml` if the tool is installed (the repository does not pin one).

## 4. Residual risks

- A round paragraph prepended **after** `934057d5` (by a human or a still-live writer) would be missing from `AGENTS.proposed.md`; the apply-time hash check in ARCHIVE_PLAN.md §3 step 0 detects it — classify the delta before slimming.
- The LIVE plan HTML and `redovi.json` still say "read AGENTS.md first" — true after the slim as well (the slim file is the rulebook), so no wording change is required for correctness.
- Any *future* record script that copies the old pattern would re-inflate the file; the slim file's header rule ("do not append status paragraphs here") and the cleaned `allowed` sets are the guards. A cheap extra guard, if wanted later: one more assertion in `scripts/ci/pkg012-source-authority.test.cjs` that `AGENTS.md` is smaller than, say, 40 KB (not part of this proposal; it would be a new rule and needs the owner's word).

# Archive plan for the current AGENTS.md (nothing executed here)

Goal: keep the whole 125 KB dated log **byte for byte** at `docs/authority/history/AGENTS_PRE_SLIM_20260930.md`, then replace the root `AGENTS.md` with the reviewed slim text (`AGENTS.proposed.md` after owner review), in ONE commit together with the coupling fixes listed in `COUPLINGS.md`. The precedent is `docs/authority/history/AGENTS_PRE_HANDOFF_20260911.md` (2026-09-11: "Exact previous file preserved before replacing the root with a short reading map", `docs/authority/AUTHORITY_MANIFEST.json` lines 1944–1960). This file describes the exact commands and the hashes that make the archive verifiable; it does **not** create the archive.

## 1. Identity of the file being archived

| Item | Value (canonical commit `934057d5`, branch `work/uskoci-ui-unification-20260924`) |
|---|---|
| Path | `AGENTS.md` |
| Git blob id (`git rev-parse 934057d5:AGENTS.md`, equals `git hash-object AGENTS.md` on an LF checkout) | `689eab810bd1df63e20739ec6975e5183da384fa` |
| SHA-256 of the bytes (`git show 934057d5:AGENTS.md \| sha256sum`) | `a29c91b237e443b00ea511ed71e92f034471de788bf73053782ece64db178b77` |
| Size | 125,448 bytes; 1,001 lines; LF only (0 CR); `.gitattributes:37` = `AGENTS.md text eol=lf` |
| Blocks | 159 (classified in `CLASSIFICATION.md`) |
| Existing manifest pin of the root file | `AUTHORITY_MANIFEST.json` ~line 2820: `"path": "AGENTS.md"`, `sha256 605197412c25e822bc02587b6b721c54a89768e89342719ab9d990b024f1bf4d`, `bytes 2579`, `version_date 2026-09-11` — **already stale** (that is the 2.5 KB reading map of 2026-09-11). No script or workflow verifies this pin (`git grep AUTHORITY_MANIFEST -- scripts .github supabase/proofs package.json` → no hits). |

The canonical branch moves every few minutes (CI record runs and the P6 owner prepend paragraphs). **At apply time the hashes must be recomputed from the real HEAD** and compared with the values above; if they differ, the blocks added since `934057d5` must be classified first (`git diff 934057d5 HEAD -- AGENTS.md`) and `AGENTS.proposed.md` / `PRESERVATION_MATRIX.md` extended — otherwise a rule added after this analysis could be lost.

## 2. Preconditions

1. One writer: fetch first, no other agent editing `AGENTS.md`, `docs/control/redovi.json` or `docs/authority/**` ("One P6 writer at a time: fetch before touching P6 files" — AGENTS block #1; "one writer per file" — #97).
2. No P6/P5/R18 record workflow queued or in flight: they check out HEAD at run time, prepend a paragraph to whatever `AGENTS.md` they find and push (19 workflows, see `COUPLINGS.md`). Check the Actions queue for `p6-*`, `p5-client-package`, `r18-*` before pushing.
3. Timing is the owner's / P6 owner's decision. The cleanup inventory (`docs/implementation/cleanup-inventory-20260930/DOCS.md` §3.4) placed the companion changes after P6 ZAVRŠEN (C0-A); if the owner orders the slimming earlier, precondition 2 is the only hard technical gate.
4. Working copy clean (`git status --short` empty) on the canonical branch.

## 3. Exact commands (Git Bash, run from the canonical checkout root)

```bash
# 0) sync and identify
git fetch origin
git switch work/uskoci-ui-unification-20260924
git pull --ff-only
git status --short                                   # must be empty
git rev-parse HEAD:AGENTS.md                         # expect 689eab810bd1df63e20739ec6975e5183da384fa
git show HEAD:AGENTS.md | sha256sum                  # expect a29c91b237e443b00ea511ed71e92f034471de788bf73053782ece64db178b77
git show HEAD:AGENTS.md | wc -c                      # expect 125448
#   If any value differs: git diff 934057d5 HEAD -- AGENTS.md ; classify the new blocks; extend the proposal; then continue.

# 1) byte-exact archive straight from the blob (never `cp` the Windows working copy: autocrlf may have CRLF-converted it)
git show HEAD:AGENTS.md > docs/authority/history/AGENTS_PRE_SLIM_20260930.md
sha256sum docs/authority/history/AGENTS_PRE_SLIM_20260930.md          # must print a29c91b2…
git hash-object docs/authority/history/AGENTS_PRE_SLIM_20260930.md    # must print 689eab81…
#   Most robust alternative that cannot be disturbed by line-ending settings: stage the existing blob object itself
#   git update-index --add --cacheinfo 100644,689eab810bd1df63e20739ec6975e5183da384fa,docs/authority/history/AGENTS_PRE_SLIM_20260930.md

# 2) pin line endings for the archive path (next to .gitattributes line 37 `AGENTS.md text eol=lf`)
printf '%s\n' 'docs/authority/history/AGENTS_PRE_SLIM_20260930.md text eol=lf' >> .gitattributes

# 3) replace the root file with the reviewed slim text (LF)
cp docs/implementation/agents-md-diet-20260930/AGENTS.proposed.md AGENTS.md      # after owner review of the text
grep -c 'CURRENT_ENTRY_MAP_20260916.md' AGENTS.md                                # must be >= 1 (scripts/ci/pkg012-source-authority.test.cjs)
file AGENTS.md                                                                   # must not report CRLF

# 4) manifest and pointers (same commit)
#    - docs/authority/AUTHORITY_MANIFEST.json: add the entry of section 4 below; update the stale AGENTS.md entry (sha256/bytes/version_date/supersedes)
#    - docs/authority/AUTHORITY_INDEX.md row "OldAGENTS repeatedcheckpoints …" (line 56): name the new history file
#    - docs/implementation/execution/CURRENT_ENTRY_MAP_20260916.md table (line 30): add the new history file as HISTORICAL
#    - docs/control/redovi.json: 3 `dokaz` strings cite AGENTS.md (lines ~3767 "AGENTS.md PKG-044", ~3844 and ~3851 "AGENTS.md CodeQL");
#      point the PKG-044 one at the archive path; the CodeQL rule stays in the slim file so those two may stay. Registry edit = P6 owner / one writer.
#    - docs/implementation/product-v1-closure-20260926/FINAL_PRODUCT_EXECUTION_RUNBOOK_20260928.md line 13 describes the old
#      "newest dated entries first" layout; reword to "rules; history in docs/authority/history/AGENTS_PRE_SLIM_20260930.md" (doc-only).

# 5) coupling fixes from COUPLINGS.md (16 record scripts, 3 evidence scripts, 19 workflows) in the SAME commit

# 6) verify before committing
node --test scripts/ci/*.test.cjs
node scripts/control/osvezi-master-plan.mjs --check --html docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html
git grep -n 'AGENTS.md' -- scripts .github supabase/proofs        # only the allowed-set entries / .gitattributes may remain; no write()/git add of AGENTS.md
git diff --stat

# 7) commit (one commit; message names both hashes so the archive is verifiable from the log)
git add .gitattributes AGENTS.md docs/authority/history/AGENTS_PRE_SLIM_20260930.md docs/authority/AUTHORITY_MANIFEST.json docs/authority/AUTHORITY_INDEX.md docs/implementation/execution/CURRENT_ENTRY_MAP_20260916.md <coupling files>
git commit -m "docs(agents): slim AGENTS.md to the binding rules; archive the 2026-09-11..30 log byte-exact (blob 689eab81, sha256 a29c91b2) and retire the CI AGENTS.md writers"

# 8) verify the commit
git rev-parse HEAD:docs/authority/history/AGENTS_PRE_SLIM_20260930.md      # 689eab810bd1df63e20739ec6975e5183da384fa
git show HEAD:docs/authority/history/AGENTS_PRE_SLIM_20260930.md | sha256sum   # a29c91b2…
git show HEAD:AGENTS.md | grep -c 'CURRENT_ENTRY_MAP_20260916.md'          # >= 1
```

Rollback: `git revert <that commit>` restores the long file, the scripts and the workflows exactly; nothing is deleted from history and no history is rewritten (the file already has 215 versions in history per the cleanup inventory; the archive adds one path, not a rewrite).

## 4. Manifest entry to add (`docs/authority/AUTHORITY_MANIFEST.json`, same shape as lines 1944–1960)

```json
{
  "path": "docs/authority/history/AGENTS_PRE_SLIM_20260930.md",
  "domain": "execution",
  "authority_level": "HISTORICAL",
  "status": "SUPERSEDED_BY_ROOT_AGENTS",
  "version_date": "2026-09-30",
  "sha256": "a29c91b237e443b00ea511ed71e92f034471de788bf73053782ece64db178b77",
  "bytes": 125448,
  "supersedes": [],
  "superseded_by": ["AGENTS.md"],
  "last_physically_validated": "<ISO timestamp of the apply>",
  "notes": "Exact previous root AGENTS.md (2026-09-11 reading map plus every dated block prepended up to 2026-09-30) preserved before slimming the root to binding rules only. Classification and preservation matrix: docs/implementation/agents-md-diet-20260930/.",
  "original_local_source": "git blob 689eab810bd1df63e20739ec6975e5183da384fa at work/uskoci-ui-unification-20260924",
  "hash_basis": "raw_repo_file"
}
```

And update the existing root entry (`"path": "AGENTS.md"`, ~line 2820): new `sha256`/`bytes` of the slim file, `version_date "2026-09-30"`, `supersedes` += `"docs/authority/history/AGENTS_PRE_SLIM_20260930.md"`, keep `status` `CURRENT_HANDOFF_SNAPSHOT_READMIT_BEFORE_MUTATION`. If the hashes are recomputed at apply time (section 1), write the recomputed values, not the ones above.

## 5. What must NOT happen

- No HISTORICAL banner inside the archive file (that would break byte-exactness); the banner lives in the manifest entry, the AUTHORITY_INDEX row and the entry-map row. (The 2026-09-11 archive has no in-file banner either.)
- No `git mv` of `AGENTS.md`: the root path must keep existing (CLAUDE.md is exactly `@AGENTS.md\n`, 11 bytes; the pkg012 test reads `AGENTS.md`; 19 workflows `git add AGENTS.md`).
- No deletion or rewrite of the 2026-09-11 archive `docs/authority/history/AGENTS_PRE_HANDOFF_20260911.md` (pinned in the manifest with sha256 `7a6d8e73…`, 45,053 bytes).
- No history rewrite (`filter-repo`, force-push): the slimming is an ordinary forward commit.
- No `cp` of the Windows working copy into the archive path (CRLF risk); use `git show HEAD:AGENTS.md >` or `update-index --cacheinfo`.

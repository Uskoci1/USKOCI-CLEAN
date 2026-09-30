# AGENTS.md diet — preparation package (2026-09-30, nothing applied)

Owner's binding rule for this work: **"shorten AGENTS.md ONLY while preserving EVERY currently mandatory instruction; archive the history."** This directory prepares that change; it does not perform it. `AGENTS.md`, `CLAUDE.md`, the scripts and the workflows are untouched.

| File | What it is |
|---|---|
| `CLASSIFICATION.md` | All 159 blank-line-separated blocks of the current `AGENTS.md`, numbered top = 1, each classed RULE / CONDITIONAL / STATE / POINTER, with the exact sentence(s) kept, the superseding block or the document where the state lives, the recurring imperatives absorbed into general rules, the 9 contradictions found inside the file and 5 declared ambiguities. |
| `AGENTS.proposed.md` | The slim replacement: authority and reading order, the one status registry rule, every binding rule by theme (owner wording verbatim), the conditional rules with their end events and a proposed successor for the P6 closure, where the current state lives, the archive pointer. 26,956 bytes vs 125,448 (−78.5 %). |
| `PRESERVATION_MATRIX.md` | One row per RULE/CONDITIONAL sentence (146 rows, R001–R145 with R030 split) → its destination section in `AGENTS.proposed.md`, or `SUPERSEDED:` with the superseding block named. 0 rows without a destination. Plus pointer rows and the absorbed recurring imperatives. |
| `ARCHIVE_PLAN.md` | Byte-exact archive of the current file at `docs/authority/history/AGENTS_PRE_SLIM_20260930.md`: identity (blob `689eab810bd1df63e20739ec6975e5183da384fa`, sha256 `a29c91b237e443b00ea511ed71e92f034471de788bf73053782ece64db178b77`, 125,448 bytes, LF), preconditions, exact commands, manifest entry, what must not happen. |
| `COUPLINGS.md` | Everything that reads, asserts, stages or writes `AGENTS.md`: 1 CI test, 16 record scripts + 3 evidence scripts that prepend paragraphs, 19 workflows that stage it and push to the canonical branch (12 of them push-triggered on their own paths), the stale manifest pin, the registry/doc references; what must change in the same commit, the safe order, the verification commands. |

## Pin and provenance

- Analysed file: `AGENTS.md` at canonical commit `934057d5` (`work/uskoci-ui-unification-20260924`, 2026-09-30). Every quoted sentence is copied from that blob; nothing is invented. Block numbers refer to `CLASSIFICATION.md`.
- This package was written in a helper worktree whose branch was created from the GitHub default branch `clean-alpha-backend` (`a047bc0e`), not from the canonical branch; the package only **adds** this directory, so it applies cleanly on the canonical branch (`git cherry-pick` of its commits, or merge). The base commit of the worktree does not affect the analysis: the analysis reads `934057d5` directly (`git show 934057d5:AGENTS.md`) and the canonical checkout for the coupling greps.
- Inputs consulted: the previous read-only inventory `docs/implementation/cleanup-inventory-20260930/DOCS.md` (§3.2 one-pager proposal, §3.4 companion changes) and `SUMMARY.md` (findings 5 and 9); `scripts/ci/pkg012-source-authority.test.cjs`; the 19 staging workflows and 19 writer scripts; `docs/authority/AUTHORITY_INDEX.md`, `AUTHORITY_MANIFEST.json`; `docs/current/README_USKOCI_LIVE_MASTER_PLAN.md`; `docs/control/README.md`.

## Why the slim file is 27 KB and not 4 KB

The inventory's 4.3 KB one-pager kept about 25 of the ~146 binding sentences. The owner's rule is to preserve **every** currently mandatory instruction, so the proposal keeps them all, in the owner's wording wherever it was already crisp, and drops only status, evidence and pointers that the registry, the LIVE plan and the round documents already carry. Per session that is still roughly a fifth of today's load.

## Before applying (owner / P6 owner decisions)

1. Confirm the 5 ambiguities in `CLASSIFICATION.md` §4 — above all whether the "STOP for the owner after P6 ZAVRŠEN" wording still stands or the later spoken instruction ("otpusti uzde …", recorded only in local memory) replaces it, and whether the TaskCard/Peek freeze survives P6.
2. Re-run the hash check of `ARCHIVE_PLAN.md` §3 step 0 against the real HEAD; classify any block added after `934057d5`.
3. Apply `COUPLINGS.md` §2 in one commit; never slim before retiring the writers.

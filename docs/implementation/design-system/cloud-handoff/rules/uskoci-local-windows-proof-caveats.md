---
name: uskoci-local-windows-proof-caveats
description: "What breaks only on the owner's Windows machine when running USKOCI Jest/ledger proofs locally, plus worktree commit identity and the PR merge-ref candidate gotcha (learned 2026-09-16)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 76affeda-95a8-4142-8648-3324aae3af63
  modified: 2026-09-15T22:47:58.437Z
---

Local Windows proof runs of USKOCI-CLEAN (core.autocrlf=true, node 24, npm 11) differ from the Linux CI that is the only accepted proof:

- Repository blobs are LF; the working tree is CRLF. Tests that search a `\n` substring in a file (e.g. `pkg003-manual-entry-source.test.ts` against `supabase/candidates/*.sql`) fail locally but pass in CI. `supabase/candidates/` has no `.gitattributes` eol rule.
- `scripts/__tests__/firebase-config.test.ts` spawns a node child with a 15 s timeout and returns `status null` locally. `w02-location-native.test.tsx` exceeds Jest's 5 s per-test timeout (suite takes ~27 s here). `auth-entry-surface.test.tsx` fails only inside the full run, passes in isolation.
- Full `npx jest --runInBand` takes ~6 min locally versus ~64 s on the runner; run it detached via PowerShell `Start-Process` and read a log, and do not gate on it.
- Bash heredocs containing many quotes fail to parse in this harness; write long Python to a file with Write and run it.
- Editing repo files from Python: read bytes, keep the file's existing newline convention, never assert LF.

Git identity in `.claude/worktrees/*` is `Agent <agent@uskoci.ai>`; branch history is authored by msljivic031. The integration branch `work/pre-v3-engine-integration-20260911` was not checked out in any worktree, so a local tracking branch can be created there.

Ledger receipts written before 2026-09-16 bound `candidateSha` to `592786a`, which is a GitHub `pull_request` merge ref (branch commit 5dee665 merged onto canonical 916ffb4), not a branch commit; freshness checks must use the real branch commit. Receipts from 2026-09-16 on bind to the pushed branch commit.

**Why:** Twice in one session local failures looked like candidate regressions; all five were environment-only and CI on the exact commit was green. Diagnosing them cost more than the actual fix.

**How to apply:** Treat local Jest as diagnostic only. Reproduce, fix, run targeted suites locally, push, and let the exact-candidate workflow produce the proof. When a local suite fails, first check whether it existed and passed in the last Linux CI run before suspecting the candidate. See [[uskoci-design-session-rules]] for the owner's evidence-labelling expectations.

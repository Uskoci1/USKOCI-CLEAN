# PRE-P4 repair ledger

| ID | Finding | Physical evidence | Severity | Owner/package | Action | Test | Live verified | Git verified | Final status |
|---|---|---|---|---|---|---|---|---|---|
| R1-001 | Applied 191500 absent from Git tree | Live history row exists; starting Git tree had no SQL file | Critical | Repair 1 | Restore recorded statements with explicit non-exact classification | File/history parity checker | Yes | Pending commit/CI | CLOSED_LIVE_PENDING_GIT |
| R1-002 | Legacy 191500 MD5 cannot be reproduced | Two independent candidate searches; per-statement hashes retained | High | Repair 1 | Preserve legacy hash as evidence; set `exact_byte_mirror=false` | Provenance JSON assertions | N/A | Pending CI | CLOSED_PENDING_GIT |
| R1-003 | `rpc_ai_publish_need` had untracked `COMPLETED` delta | Recorded statement says `PUBLISHED`; pre-repair `pg_get_functiondef` said `COMPLETED`; 194000 does not replace it | Critical | Repair 1 / P4 dependency | New forward fail-closed publisher | Live function definition and ACL | Yes | Pending commit/CI | CLOSED_LIVE_PENDING_GIT |
| R1-004 | MD5 checker could not verify its stated invariant | Column order reversed, duplicate extension, CR/trailing-newline normalization | High | Control 0 | Raw-byte Python verifier plus strict shell entrypoint | Syntax + canonical CI | N/A | Pending CI | CLOSED_PENDING_CI |
| C0-001 | Canonical branch had no required checks or protection | Protection disabled; zero contexts/workflow runs at starting HEAD | Critical | Control 0 | Add `pre-p4-integrity` workflow; configure protection after first green run | GitHub workflow/protection readback | N/A | Pending bootstrap | OPEN_UNTIL_GREEN |

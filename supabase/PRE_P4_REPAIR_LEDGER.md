# PRE-P4 repair ledger

Repair 1 implementation commit: `8836477ab24fde232a769f7a9f78dd1799ffb8c9`

Live checkpoint: 44 migrations; last
`20260830202733_clean_pre_p4_provenance_reconciliation`.

| ID | Finding | Physical evidence | Severity | Owner/package | Action | Test | Live verified | Git verified | Final status |
|---|---|---|---|---|---|---|---|---|---|
| R1-001 | Applied 191500 absent from starting Git tree | Live history row existed; starting tree had no SQL file | Critical | Repair 1 | Restored recorded statements with explicit non-exact classification | Remote file/history parity: 44 = 44 | Yes | Yes | CLOSED |
| R1-002 | Legacy 191500 MD5 cannot be reproduced | 24,576-candidate and 2,352,980-candidate searches failed; seven per-statement hashes retained | High | Repair 1 | Preserved legacy hash as evidence; set `exact_byte_mirror=false` | Remote provenance assertions and raw MD5 recomputation | N/A | Yes | CLOSED |
| R1-003 | `rpc_ai_publish_need` had untracked `COMPLETED` delta | Recorded 191500 says `PUBLISHED`; pre-repair `pg_get_functiondef` said `COMPLETED`; 194000 does not replace it | Critical | Repair 1 / P4 dependency | Appended forward fail-closed publisher | Live function definition, ACL, and migration-statement MD5 | Yes | Yes | CLOSED |
| R1-004 | Legacy MD5 checker could not verify its stated invariant | Column order reversed, duplicate extension, CR/trailing-newline normalization | High | Control 0 | Added raw-byte verifier and strict shell entrypoint | Independent fetch of all 44 remote blobs exactly matched all 44 manifest hashes | N/A | Yes | STATIC_PASS |
| C0-001 | Canonical branch has no enforced required check or protection | Starting and post-repair branch reads show protection disabled | Critical | Control 0 | Added `pre-p4-integrity` workflow | Workflow run 33355980954 attempts 1 and 2 both failed before runner assignment: `runner_id=0`, no steps, no logs | N/A | Workflow present | BLOCKER_ACTIONS_RUNNER |
| C0-002 | GitHub-hosted runner does not admit the integrity job | Two identical pre-start failures; verifier, checkout, and tests never executed | Critical | GitHub organization/repository administration | Resolve Actions policy, billing/minutes, or runner availability; rerun; require `pre-p4-integrity` only after green | Green workflow plus branch-protection readback required | N/A | N/A | OPEN |

## Stop condition

Repair 1 schema/provenance closure is physically present in live Supabase and Git.
CONTROL 0 is not complete while GitHub cannot start the job and the branch remains
unprotected. No later repair may claim the full PRE-P4 gate from this checkpoint.

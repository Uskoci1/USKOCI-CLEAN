# Round69 — PKG045b made compatible with the applied Discovery P0, and P6 rollout v2 re-proved on that target

Status: **SOURCE + DISPOSABLE PROOF PASS. NOT APPLIED to canonical DEV.** P6 remains OPEN.

## Finding (fresh read-only DEV preflight, 2026-09-30 ~00:30 CEDT, ledger 210, metadata only)
The proven PKG045b candidate (`pkg045b_task_column_privileges.sql`, HOLD, conditional owner approval of 2026-09-22) is not applicable to the
current DEV as written. Every pin was compared with the live catalog:

| Pin in the candidate | Live DEV now | Result |
| --- | --- | --- |
| `rpc_list_my_needs_page`, `rpc_resolve_activity_event`, `is_my_task`, `rpc_read_task`, `rpc_list_my_tasks` body md5 | identical | match |
| `rpc_list_open_tasks_v3` body md5 `18b55181…` (PKG045a) | `602113d5…` (Discovery P0, ledger 206, one function replacement) | **MISMATCH** → the candidate would refuse with `PKG045_BODY_MISMATCH` (safe abort, no change) |
| five owner-predicate policies (`need_sensitive_owner`, `responses_requester_read`, `response_versions_read`, `need_geography_owner_read`, `need_requirement_details_owner_read`) | identical md5 of `qual|with_check` | 5/5 match |
| 41-column inventory of `public.needs` and the 38-column allowlist | identical set | match |
| closure/erasure certificate, `retention_ai_source_ready()` binding | computed dynamically inside the candidate (no constant to go stale) | n/a |

Only those five policies and the (false-positive) `rpc_resolve_activity_event` mention the three internal columns; no other invoker function,
policy or view depends on them. No client source under `src/` names them (`ru4Production.remainingSearchState` selects an allowed column).

## What was done
- `scripts/proofs/build-pkg045b-p0.mjs` composes `supabase/candidates/pkg045b_task_column_privileges_p0.sql` (sha256 `d34cb5d9fc1c514e31ee67a6adb05a5aa95ec80fab1a7874801f18d7b80a1ff0`)
  from the proven candidate (sha256 `d5e67575f7544be550f2261b9d7ec4aa301b21bacc80918cee7a31543942a743`, LF) with exactly ONE change: the pinned md5 of `rpc_list_open_tasks_v3`
  becomes the P0 body md5, which the P0 candidate itself pins (`--check` proves reproducibility; `--rehearsal` prints a rollback-only variant).
  Header states the provenance; HOLD semantics and the certificate rebind are unchanged. The proven candidate file is untouched.
- `supabase/proofs/discovery/p6_discovery_prepare_p0.mjs` mirrors DEV's real order on the disposable target: 042a → 045a → applied P0 → PKG045b (P0 form).
- Both the P6 rollout-v2 proof and the native journey now start from that target.

## Evidence (run 36641388832, source `dc6aca569bce34352301dfa36fffded7db9bf2c7`)
- P0-aware preparation **PASS**: exact git bytes; PKG045b (P0 form) applies after P0; restricted public-column boundary (no whole-row, no private columns, `id` readable);
  canonical `covered_slots` body; certificate/erasure/binding equal and ready after the certificate rebind.
- Rollout v2 proof **PASS** on that target (`ROUND_69_PKG045B_P0_CHECKS.json`): same exact bodies/policies/helper as the source-only proven stack, certificate and Need ACL unchanged,
  seven P6 functions SECURITY INVOKER with fixed search_path and authenticated-only EXECUTE, repeat application refused without drift.

## Limits
This is a disposable, single-package-chain target (042a → 045a → P0 → 045b); DEV additionally carries packages 046–P4 that do not touch the pinned objects, which the preflight
comparison above covers object by object. The live apply is still a separate, atomic, self-guarding transaction: a stale pin aborts it without change. Nothing here is native acceptance.
The order for DEV stays: native proof on the restricted target → PKG045b (P0 form) → rollout v2, each with fresh preflight and byte/hash/ACL readback, under the owner's 2026-09-30 approval.

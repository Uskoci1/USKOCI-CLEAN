# USKOČI — Codex continuation checkpoint, 2026-09-21

This supplements `NEXT_AI_HANDOFF_20260921_2145.md`; retain all owner boundaries and its reading order.
Work only in `C:/Users/user/Desktop/USKOCI_CANONICAL_WORKSPACE_2026-09-08/USKOCI-CLEAN/.claude/worktrees/uskoci-kompletan-audit-2e715e`.
Branch remains `work/pre-v3-engine-integration-20260911`. No subagents, new dependencies, paid providers or device operations.

## Completed in this continuation

- Read the entire original handoff, AGENTS and deep-read ledger before changes.
- Verified PKG-010 run 35646676736 succeeded. No repair was needed.
- Independently measured DEV ledger 188 (147+41), both active minute cron jobs, 120 successes each in the preceding two hours.
- Baseline types clean and 239 suites/4566 tests passed. APK 35643721833 exists and was not installed.
- Reconciled 29 historical findings against commits; did not blindly assert the old 50-fixed count. Commit `181369a9`.
- PKG-033 candidate and disposable harness committed (`fe2269d1`, fixture correction `0ea4d914`). Proof run
  35651463755 at `0ea4d9140964d649edfad05ae2235e7060b661ca` succeeded: 41/41 checks. Downloaded and inspected.
- Client `b4d5a5a9`: revision-bound price rules on stale application edits; fixed price/headcount controls, real
  refusal mapping. TypeScript and full Jest 240 suites/4596 tests passed; two monetary regression tests fail on
  the former production screen and pass after. No new APK has been built for these changes.

## PKG-033 is NOT applied to DEV

Read `v5-ai-first/pkg033/PKG033_APPLICATION_ADMISSION.md` and `PROOF_SUMMARY_20260921.json`.
Candidate file `supabase/candidates/pkg033a_application_admission_parity.sql` has:

- LF file SHA-256: `94eddcf1a866772a0dbe33d046299e10105ca3c1e74fcd1e5b5df4eb33cd7e22`;
- no-final-LF migration text SHA-256: `ce97b71655fe18168119c8776d108251205d3b7cbcf0a06cd87c9351f0f1b181`.

It patches submit, stale resolve and select, and adds one private price-rule helper. No data backfill, table,
trigger, existing ACL or certificate change. It checks pre/post bodies and certificate atomically. Proof
reconstructed the exact 41 recorded DEV changes and matched every patched predecessor body to current DEV.
The disposable certificate (`8248a4e5…`) remained unchanged and ready; never substitute it for DEV's `65980fce…`.

**Pending prerequisite:** the current Supabase connector returned SQLSTATE 42501 for execution of
`private.closure_source_digest_v5()`. Do not escalate role, grant yourself rights, or route around this denial.
A text question asked the owner to run the following in canonical DEV SQL Editor and return only the nonsecret result:

```sql
select private.closure_source_digest_v5() as live,
       (select sha256 from private.closure_source_v5 where singleton) as certified,
       private.retention_ai_source_ready() as ready;
```

No answer had arrived when this checkpoint was written. The owner already authorizes proven ordinary fixes;
this asks for a missing measurement, not a new blanket authorization. Until it is established, no DEV mutation.
Once confirmed, re-read live predecessors and ledger, follow the original handoff's apply/sha256/receipt method,
verify the post bodies and unchanged certificate, write the applied receipt and update this status. Expected
next ledger would be 189 only if no other approved change has intervened. Do not assume current HEAD pins still match.

Last read-only impact query: 0 stale-review-required applications; 0 current fixed-price mismatches among
SUBMITTED/DELIVERED/VIEWED/SHORTLISTED rows; ledger still188. No existing user data was changed.

## Next findings investigated, not implemented

12.10 / 7.41 / remaining 8.18 need more than removing a client label:

- `private.account_closure_preparation(uuid)` md5 `e4bb4c0d3a7d1ebc682c28a01b605cd4` duplicates older blockers,
  omits worker/Q&A AI turns, and hardcodes execution/auth/media readiness false. It is not in the explicit
  certified function list; prove any change leaves the digest unchanged. Existing clients insist on those false
  flags, so any response contract change needs client compatibility considered, not merely SQL replacement.
- Actual start/review use `private.closure_erasure_hard_blockers_v5`, which wraps the certified
  `private.closure_blockers_v5` and deliberately excludes some scoped holds/media/support cases from hard blocking.
  Do not accidentally replace that distinction with the older blocker list.
- `rpc_get_account_closure(uuid)` is owner-bound but the preparation client rejects restricted states.
- **Additional live-body evidence:** `rpc_closure_api_guard()` admits a restricted account only to
  `rpc_read_account_closure_execution`, `rpc_start_account_closure_execution`, and enumerated support RPCs.
  It blocks both the ordinary closure getter and execution review over REST. A fix using a new/ordinary getter
  on a second phone would therefore fail before reaching that getter.
- `rpc_read_account_closure_execution(uuid,uuid)` currently requires the locally saved START request key and
  returns found=false when that key is absent; it cannot discover execution on another device. That reader AND
  the API guard are certified functions. A proper account-owned recovery read through the permitted path
  therefore needs a proven certificate rebind and the owner's **fresh explicit approval** before DEV application.
  Do not weaken the guard or invent a successful start receipt from discovered execution metadata.
- Full bodies read: preparation, getter, review, start, read execution, hard blockers, document, progress,
  restricted predicate, support authentication and API guard. No closure code changed yet.

Other open findings still need work: 7.17 public task column exposure; 7.32 candidate attention counts;
7.1 RPC refusal audit; AI deadlines 11.1/11.2. Do not mark these fixed from PKG-033.

## Pending owner decision and app plan

A separate text question asks approval for an optional profile phone number, without SMS verification, shared
only by explicit action in a Dogovor and never marked verified. Do not implement 8.4 until the answer arrives.
Show the short Serbian app plan from the original handoff before visual redesign. This turn made functional
price-control changes to the existing editor; no visual direction or design exploration was selected.

## Evidence and local files

- Downloaded CI artifact: `artifacts/pkg033-run-35651463755/` (ignored).
- Local Jest baseline/red/green logs and JSON: `artifacts/pkg033-local-tests/` (ignored).
- Retained compact proof evidence: `docs/implementation/v5-ai-first/pkg033/PROOF_SUMMARY_20260921.json`.
- Local migration integrity refuses the foreign untracked migration, as expected from the frozen inventory.
  Do not delete, edit, commit, or hide it. The CI tracked-source integrity step passed.
- Foreign file remains `supabase/migrations/20260913090000_clean_v5_fix_application_spam_and_resolution.sql`.
- PKG-004 run35651612057 succeeded on client commit `b4d5a5a9`. PKG-006 run35651612168 was still executing
  its full regression when this checkpoint was written; read its final result before claiming it passed.


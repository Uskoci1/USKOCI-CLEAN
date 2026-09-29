# Round56 — deployable P6 server candidate frozen; current DEV intentionally inadmissible

## Product / rollout decision

The proved P6 server stack is now frozen as one deployment candidate: supabase/candidates/p6_discovery_rollout.sql. It is not a live migration and was not applied to canonical DEV. The candidate composes the exact four-mode Round44 source plus the proved cost_v2/cost_v3 deltas, then enforces deployment preconditions and postconditions in the same transaction. Candidate SHA256: ce1dab6bf79051bfb294efec1750299bb231f1b340e30f00cc79b825df3efd6c.

The candidate deliberately requires the PKG045b column-privacy boundary to be already active. It refuses the broad predecessor. That dependency is intentional: the real local Auth/PostgREST proof and all later P6 SQL proofs were run on the restricted target, and P6 must not become a reason to preserve the three directly readable internal Need columns. PKG045b was previously owner-approved only after compatible-device verification; that device condition is still not evidenced here. No duplicate approval is requested and no apply is attempted.

## Exact disposable proof

Tested source 3b2e828d65be3ab084428ae77de0a4a7583c9610; Actions run 36539721158. The workflow reconstructs the approved historical predecessor through PKG045b on a disposable local Supabase stack. The exact base+v2+v3 stack first passes the refreshed real local Auth/PostgREST/current-decoder harness: 11 groups, 3 distinct authenticated sessions and 47 local HTTP requests. Candidate functions are removed by that harness before deployment-candidate testing.

A separate transaction then builds the expected seven normalized function-body MD5 values from the exact proved stack and rolls it back. The frozen deployment candidate is applied normally and committed on the disposable stack. All seven installed body hashes equal that expected stack exactly. Every P6 function remains SECURITY INVOKER with fixed pg_catalog, authenticated EXECUTE only; anon/service_role execute is absent. The Need ACL and closure certificate/digest do not move. A second application is refused as P6_ROLLOUT_ALREADY_INSTALLED, followed by exact no-drift readback. Teardown without backup PASS.

## Fresh canonical DEV observation

Read-only observation 2026-09-29T04:26:28.449181Z: PostgreSQL 17.6, ledger 210, rpc_discovery_v1(jsonb) absent, covered_slots normalized body MD5 cbeb8f2a3da7d08965ef0386cfc437ba, closure source/erasure certificate f66818aa870492e397cb991e5e82f1f3d03262352b7830ce62c0d1aa9691755b. Authenticated still has whole-table Need SELECT and the internal requester/remaining-search columns; therefore PKG045b is not applied. No private rows were read.

This means current DEV is not yet an admissible predecessor for the P6 rollout candidate. The refusal is a safety gate, not a failure to prepare P6. Compatible app/native verification must happen before the already-approved conditional PKG045b application, and P6 live apply still requires its package-specific fresh-precondition/authorization procedure.

## What this does not close

No canonical DEV mutation, ledger row, provider, route switch, APK/IPA or native acceptance occurred. This package does not prove wider distributions/concurrency/30k performance, production map/list/FULL return, or memory/ANR. P6 remains OPEN.

Next P6 work: larger sparse/dense/skewed/capacity/load measurements against the exact rollout bytes and a guarded native-route candidate. Then verify the compatible app condition for PKG045b, obtain/execute the specific P6 server-apply procedure when all apply gates are ready, switch the reader, and run exact native FULL-return/memory/ANR acceptance. Do not move to another major phase.

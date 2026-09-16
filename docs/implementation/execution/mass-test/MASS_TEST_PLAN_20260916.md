# USKOČI — isolated mass / chaos verification plan

Branch: `test/mass-user-chaos-harness-20260916`
Base: PR #102 head `6b0e59ae534c9c1ee177562badda29561f3c61af`

This branch is test infrastructure only. It must not modify PR #102, canonical DEV/ALPHA data, or production runtime.

## Safety boundary

- Canonical Supabase `leqcwgzvjsxugfgzdmth` is hard-blocked by the external mass harness.
- The marketplace journey currently runs only against a local disposable Supabase URL (`127.0.0.1` / `localhost`).
- Service-role/admin authority is fixture-only: account confirmation and disposable setup. Marketplace commands use normal user JWTs.
- AI/provider calls are zero in mass phases unless a later explicitly bounded canary phase opts in.
- Every run writes a machine-readable receipt.

## Phases

1. **Phase 1 — Auth / RLS / read pressure**
   - 2..5000 synthetic Auth users.
   - real password sessions and JWT identity checks;
   - own profile reads;
   - hostile A→B private profile read attempts;
   - concurrent read pressure;
   - p50/p95/p99 latency;
   - cleanup/residue check.

2. **Phase 2 — Full marketplace happy-path journeys**
   - disposable Requester/Worker pairs;
   - fixture-only READY Worker + PUBLISHED Need;
   - real JWT public Need read;
   - `rpc_submit_response` + same-key replay;
   - owner-only `rpc_list_need_candidates`;
   - `rpc_select_response` + same-key replay;
   - foreign Agreement-message read denied;
   - requester + worker Agreement messages;
   - `rpc_mark_work_done`;
   - `rpc_confirm_completion`;
   - bilateral `rpc_submit_agreement_review`;
   - reputation readback;
   - database invariants: exactly one Application, Selection and Agreement per one-seat fixture, COMPLETED Agreement, exactly two Reviews, no duplicate Need/Response agreement binding.

3. **Phase 3 — Selection races / contention**
   - two or more READY Workers per one-seat Need;
   - concurrent independent Selection commands;
   - exactly one winner;
   - no overfill, no duplicate Agreement, no capacity violation;
   - same-key parallel replay remains one semantic command;
   - calendar/capacity races reuse the already proven PKG-006 authorities.

4. **Phase 4 — Fault injection / unknown outcome**
   - transport timeout after server commit;
   - lost acknowledgement;
   - explicit readback + same-key retry only;
   - account A→B→A fencing;
   - stale revisions and changed payload with reused idempotency key;
   - expected known refusal, never silent success.

5. **Phase 5 — Scale ramp**
   - 20 users → 100 → 500 → 1000 → 5000;
   - ramp concurrency separately from user count;
   - report throughput, error classes and p50/p95/p99;
   - stop on any cross-account leak, orphan row, invalid lifecycle state, over-capacity Agreement or duplicate semantic command.

6. **Phase 6 — bounded real-provider canary**
   - separate from mass load;
   - small fixed number of real AI turns only after provider readiness is green;
   - provider cost ceiling enforced;
   - mass runs continue to use zero real AI calls.

## Current implementation

- `scripts/load/mass_user_chaos.mjs` — Phase 1.
- `.github/workflows/mass-user-chaos.yml` — branch syntax gate + manually triggered external isolated target.
- `scripts/load/mass_marketplace_journey.mjs` — Phase 2.
- `.github/workflows/mass-marketplace-local.yml` — disposable local source147 journey runner.

## PASS standard

A mass run is not PASS because the process exits zero alone. PASS requires all explicit invariants to remain true and the report to record `providerCalled=false`, the isolated target, user/journey counts and latency distributions.

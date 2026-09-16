# USKOČI — isolated mass / chaos verification plan and evidence

Branch: `test/mass-user-chaos-harness-20260916`
Original base: PR #102 head `6b0e59ae534c9c1ee177562badda29561f3c61af`.

This branch is test infrastructure only. It must not modify PR #102, canonical DEV/ALPHA data, or production runtime.

## Safety boundary

- Canonical Supabase `leqcwgzvjsxugfgzdmth` is hard-blocked by the external mass harness.
- Local marketplace/Auth/race/fault runs accept only `127.0.0.1` / `localhost` disposable Supabase.
- Service-role/admin authority is fixture-only: account confirmation and disposable setup. Marketplace commands use normal user JWTs.
- AI/provider calls are zero in mass phases unless a later explicitly bounded canary phase opts in.
- Every meaningful run writes or uploads a machine-readable receipt/log.

## Phases

1. **Phase 1 — Auth / RLS / read pressure**
   - real password sessions and JWT identity checks;
   - own profile reads;
   - hostile A→B private profile reads;
   - concurrent read pressure and p50/p95/p99;
   - hard-delete cleanup and residue check.

2. **Phase 2 — Full marketplace happy-path journeys**
   - disposable Requester/Worker pairs;
   - fixture-only READY Worker + PUBLISHED Need;
   - real JWT public Need read;
   - `rpc_submit_response` + same-key replay;
   - owner-only `rpc_list_need_candidates`;
   - `rpc_select_response` + same-key replay;
   - foreign Agreement-message read denied;
   - requester + worker Agreement messages;
   - `rpc_mark_work_done` → `rpc_confirm_completion`;
   - bilateral `rpc_submit_agreement_review`;
   - reputation readback;
   - database invariants for one Application, Selection, Agreement, completion and two Reviews per fixture.

3. **Phase 3 — Selection races / contention**
   - two READY Workers per one-seat Need;
   - concurrent independent Selection commands;
   - exactly one winner;
   - no overfill, duplicate Agreement or duplicate Selection;
   - the existing PKG-006 concurrency authority runs first as the baseline.

4. **Phase 4 — Unknown outcome / lost acknowledgement**
   - server commits but the first successful ACK is deliberately ignored;
   - exact same-key replay must recover the same Application/Agreement/Review;
   - changed payload with the same command identity must be denied;
   - final DB state must contain one semantic command/result only.

5. **Phase 5 — Scale ramp**
   - 20 users → 100 → 500 → 1000 → 5000;
   - ramp concurrency separately from user count;
   - stop on any cross-account leak, orphan row, invalid lifecycle state, over-capacity Agreement or duplicate semantic command.

6. **Phase 6 — bounded real-provider canary**
   - separate from mass load;
   - small fixed number of real AI turns only after provider readiness is green;
   - provider cost ceiling enforced;
   - mass runs continue to use zero real AI calls.

## Implemented harnesses

- `scripts/load/mass_user_chaos.mjs` + `.github/workflows/mass-user-chaos.yml` — external isolated Auth/RLS/load harness and branch syntax gate.
- `scripts/load/mass_auth_rls_local.mjs` + `.github/workflows/mass-auth-rls-local.yml` — disposable local 100-user Auth/RLS pressure.
- `scripts/load/mass_marketplace_journey.mjs` + `.github/workflows/mass-marketplace-local.yml` — complete source147 real-JWT marketplace journey.
- `.github/workflows/mass-marketplace-scale20-local.yml` — 20 complete Requester/Worker pairs, 40 real local Auth users.
- `scripts/load/mass_selection_race.mjs` + `.github/workflows/mass-selection-race-local.yml` — scalable one-seat Selection contention.
- `scripts/load/mass_unknown_outcome.mjs` + `.github/workflows/mass-unknown-outcome-local.yml` — lost-ACK exact-retry proof.

## Executed evidence

### Phase 2 — 4 complete A↔B journeys — PASS

GitHub Actions run `35149548244`, exact branch candidate `0005e9020797f9d6d3026a9ceaf97b5c5fc66ea3`.

- source history reconstructed to `147/20260913081242`;
- 4 Requesters + 4 Workers authenticated with real user JWTs;
- 4 Needs → 4 Applications → 4 Selections → 4 Agreements → 8 Agreement messages → 4 COMPLETED Agreements → 8 bilateral Reviews;
- 4 foreign Agreement-message reads returned zero rows;
- duplicate Need→Agreement bindings: 0;
- duplicate Response→Agreement bindings: 0;
- provider calls: 0.

Observed local disposable p95 latency:

| operation | p95 ms |
|---|---:|
| public Need read | 36.96 |
| Application submit | 134.26 |
| Application exact replay | 8.46 |
| candidate read | 226.60 |
| Selection | 167.83 |
| Selection exact replay | 7.81 |
| foreign message read | 9.10 |
| requester message | 20.09 |
| worker message | 12.65 |
| worker mark done | 10.44 |
| requester completion | 14.88 |
| requester review | 18.69 |
| worker review | 11.10 |
| reputation read | 7.29 |

The first attempt reached the same end state but its final audit query incorrectly named the private Review table as `public.agreement_reviews`. The product uses `private.agreement_reviews`; correcting only that harness query produced the green run above. No application code was changed.

### Phase 3 — 20 one-seat Selection races — PASS

GitHub Actions run `35149201954`.

Before the scale wrapper, the existing PKG-006 authority baseline passed all checks: same-key submit replay, changed-payload denial, same-key Selection concurrency, one-seat different-key race, observed Need row lock, two-Worker no-overallocation, capacity CAS, calendar conflict, and final invariants.

The scale wrapper then reported:

`PASS MASS_SELECTION_RACE races=20 exactly_one_winner=20 invariant_violations=0 provider_calls=0`

### Phase 4 — lost ACK / exact retry — PASS

GitHub Actions run `35149780086`.

- Application first ACK discarded → exact retry returned the authoritative original; changed payload with same key denied; one Application + one command row.
- Selection first ACK discarded → exact retry returned the same Agreement; changed payload with same key denied; one Agreement + one command row.
- Review first ACK discarded → exact retry returned the same Review; changed rating with same request ID denied; one Review row.
- provider calls: 0.

Receipt result: `PASS MASS_UNKNOWN_OUTCOME application=1 selection=1 review=1 duplicate_semantic_commands=0 provider_calls=0`.

### In progress

- Phase 1 local: 100 real Auth users / RLS hostile reads / read pressure / cleanup.
- Phase 5 scale smoke: 20 complete Requester/Worker pairs = 40 local Auth users.

## PASS standard

A mass run is not PASS because the process exits zero alone. PASS requires all explicit invariants to remain true and the report to record the isolated target, the user/journey count, zero unapproved provider calls, and the relevant latency/error distributions.

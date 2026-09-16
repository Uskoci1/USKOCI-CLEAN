# USKOČI — mass / chaos executed results — 2026-09-16

Scope: isolated test branch only. Original runtime snapshot under test: PR #102 head `6b0e59ae534c9c1ee177562badda29561f3c61af`, reconstructed as source history `147/20260913081242` in disposable local Supabase instances. No canonical DEV/ALPHA writes. No AI/provider calls in these mass runs.

The later PR #102 delta through `7288a779061378cec18e99b02b85af1da46ce7ce` changes only the AI provider adapter/acceptance/proof surface and PKG-014 documentation; it does not change the marketplace/Auth/RLS/Agreement runtime exercised below, so these results remain applicable to that later integration head for the tested domains.

## R1 — full marketplace A↔B journeys — PASS

Run: `35149548244`
Candidate: `0005e9020797f9d6d3026a9ceaf97b5c5fc66ea3`

- real local Auth users: 8 (4 Requesters + 4 Workers)
- completed independent journeys: 4
- Needs: 4
- Applications: 4
- Selections: 4
- Agreements: 4
- Agreement messages: 8
- COMPLETED Agreements: 4
- Reviews: 8
- foreign Agreement-message reads: 4, leaked rows: 0
- duplicate Need→Agreement bindings: 0
- duplicate Response→Agreement bindings: 0
- provider calls: 0

p95 ms on the disposable GitHub runner:

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

The preceding red run reached the same business end state; only the harness's final verification query used the wrong schema name `public.agreement_reviews`. Current source intentionally stores Reviews in `private.agreement_reviews`. Correcting that test-only query produced the green run above.

## R2 — Selection contention — PASS

Run: `35149201954`

The existing PKG-006 concurrency proof ran first and passed every baseline check. Then the scale wrapper executed 20 independent one-seat races, each with two valid Workers and concurrent Selection requests.

Result:

`PASS MASS_SELECTION_RACE races=20 exactly_one_winner=20 invariant_violations=0 provider_calls=0`

- races: 20
- exactly one winner: 20/20
- invariant violations: 0
- overfill: 0
- duplicate Agreement: 0
- duplicate selected Selection: 0
- provider calls: 0

## R3 — unknown outcome / lost ACK — PASS

Run: `35149780086`

Application:
- first successful ACK deliberately ignored;
- exact same-key retry recovered the original Application;
- changed price with the same key denied;
- Application rows: 1;
- command rows: 1.

Selection:
- first successful ACK deliberately ignored;
- exact same-key retry recovered the same Agreement;
- changed semantic payload with the same key denied;
- Agreements: 1;
- command rows: 1.

Review:
- first successful ACK deliberately ignored;
- exact same-key retry recovered the same Review;
- changed rating with the same request ID denied;
- Review rows: 1.

Result:

`PASS MASS_UNKNOWN_OUTCOME application=1 selection=1 review=1 duplicate_semantic_commands=0 provider_calls=0`

## R4 — 100-user Auth/RLS/read pressure — PASS

Run: `35149899656`
Candidate: `73caa56150df9d028d6f815eecd22b37cd182fe0`

- real local Auth users: 100
- concurrency: 25
- own profile rows observed: 200
- hostile A→B profile reads: 100
- cross-account leaked rows: 0
- pressure reads: 500
- pressure failures: 0
- cleanup profile residue after hard user deletion: 0
- provider calls: 0

Combined timed request sample (login/getUser/profile hostile/pressure operations; not a pure database-read benchmark):

- samples: 900
- min: 8.29 ms
- p50: 35.14 ms
- p95: 986.28 ms
- p99: 1078.90 ms
- max: 1135.07 ms

## R5 — 20 complete A↔B journeys / 40 Auth users — PASS

Run: `35150173412`
Candidate: `c430174dd2df49e232924d18348260f9214e82f4`
Concurrency: 10 complete journeys.

- Requesters: 20
- Workers: 20
- total real local Auth users: 40
- completed journeys: 20
- Needs: 20
- Applications: 20
- Selections: 20
- Agreements: 20
- Agreement messages: 40
- COMPLETED Agreements: 20
- Reviews: 40
- duplicate Need→Agreement bindings: 0
- duplicate Response→Agreement bindings: 0
- provider calls: 0

Observed p95 ms:

| operation | p95 ms |
|---|---:|
| signup | 597.04 |
| getUser | 279.93 |
| public Need read | 103.51 |
| Application submit | 349.58 |
| Application exact replay | 15.45 |
| candidate read | 583.49 |
| Selection | 466.59 |
| Selection exact replay | 10.01 |
| foreign message read | 13.27 |
| requester message | 43.53 |
| worker message | 31.77 |
| worker mark done | 27.05 |
| requester completion | 33.44 |
| requester review | 44.29 |
| worker review | 32.79 |
| reputation read | 11.83 |

This workflow completed with `success`, including disposable database teardown.

## Running

- `35150395247` — 500 real local Auth users, concurrency 50, 500 hostile cross-account reads + 1500 pressure reads + cleanup.
- `35150533367` — 100 complete Requester/Worker pairs = 200 real local Auth users, concurrency 20.

## Interpretation boundary

These runs prove application/database contracts on a disposable GitHub runner. They do not prove physical-device camera/GPS/voice/push display, mobile radio behaviour, or cloud production capacity. Those remain separate acceptance/load dimensions.

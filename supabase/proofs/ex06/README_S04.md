# EX-06 S04: dispatch lifecycle negative-case proof and probes

Status (2026-10-02): **AUTHORED AND TESTED OFFLINE ONLY. NOTHING HAS RUN ON A DISPOSABLE CHAIN YET.** The first CI run of `.github/workflows/ex06-s04-proof.yml` is the first evidence. Nothing in S04 is applied to DEV or PROD, nothing in S04 changes a function body, nothing is sent.

Levels (never mix them):

| level | what it covers here |
| --- | --- |
| SOURCE | the proof, its libraries, 9 test files and the workflow exist in the checkout |
| OFFLINE (node --test) | the SQL builders, the pins, the verdict mechanics, the case catalogue, the 17 scenario drivers against a SIMULATED world (the product as read from its DEV bodies, and the same with every proposed fix), the report, the orchestration. This proves the harness can pass AND fail; it says nothing about what the chain does |
| CI disposable chain | NOT YET RUN. A disposable chain (source147 -> PKG-050 stages 03-18, then the ex06a candidate) is NOT DEV. The report label says whether the chain's 60 function bodies equal the DEV md5 pins |
| DEV | read-only SELECT on 2026-10-02 of the function bodies (md5), the dispatch config rows (sha256) and the ledger count. Nothing else, nothing written |
| DEVICE / push / provider | not touched: the chain has no push sender and no device; no provider was called |

## What it is

The dispatch lifecycle of the marketplace (a published task is offered to eligible workers in waves; the person sees it in the Inbox) was proved for its POSITIVE path by S03 (the corpus) and ex06a. S04 proves what must NOT happen and probes five inferences nobody had tested. 17 scenarios build people and tasks through the PRODUCT path (the S03 fixtures: real Auth, PostgREST, conversation -> review -> publish) and drive the dispatch itself (`private.dispatch_next_wave`, `private.dispatch_tick`, `private.expire_lifecycle`, `rpc_cancel_need`, `rpc_select_response`, the push claim). Each case states the canonical requirement and what the product did. A disagreement is a **FINDING** (F5 ... F12): never adjusted, never fixed in S04, listed with its failing rows and a proposed fix as TEXT.

"Reached" (the definition of the whole proof) = an event with an IN_APP notification row that is not SUPPRESSED, cross-checked with `rpc_list_inbox` (a disagreement is a harness error). "Delivered" = an `opportunity_deliveries` row exists (a wave slot was spent).

## How to run it (exact)

CI (the only place it can run; it needs the disposable Supabase stack):

1. The root pushes the branch; a push touching `supabase/proofs/ex06/ex06_s04_*`, `supabase/proofs/ex06/s04/**`, `supabase/proofs/ex06/lib/**`, `supabase/candidates/ex06a_flexible_window.sql` or the workflow starts it. README changes do not. Or run it by hand: `gh workflow run ex06-s04-proof.yml --ref work/uskoci-ui-unification-20260924` (inputs below).
2. The job (about 90 minutes): bind the source, `node --check`, `node --test supabase/proofs/ex06/s04/lib/*.test.mjs`, `npm ci`, the live79 stack, the loopback guard, stages 03-18 (the ex04d-proven chain), **stage 19 applies `supabase/candidates/ex06a_flexible_window.sql`** (DEV carries the two ex06a bodies since ledger 220; the pinned CORE bodies `match_detail_without_calendar` and `worker_dispatch_time_admitted` are the ex06a ones), then stage 20 = `node supabase/proofs/ex06/ex06_s04_proof.mjs`, teardown, artifact upload.
3. Read the **RESULT line** and `ex06-s04-report.md` (the job summary carries both). A green job is not evidence by itself.

Offline (any machine with Node 24, no database): `node --test supabase/proofs/ex06/s04/lib/*.test.mjs` and `node --check supabase/proofs/ex06/ex06_s04_proof.mjs`.

Workflow inputs / environment (all optional):

| setting | meaning |
| --- | --- |
| `EX06_S04_ONLY=reach,licence` | focused re-run of the named scenarios (ids below); the others are SKIPPED, their cases NOT_RUN, the result PARTIAL, a warning annotation says so |
| `EX06_S04_PINS=strict` (default) or `report` | strict: a CORE or SUPPORTING pin difference without a named explanation makes the result CHAIN_DIFFERS (exit 1). report: only a CORE difference is fatal; SUPPORTING differences are a loud warning (for an exploratory first run that must still show every case) |
| `EX06_S04_STRICT_FINDINGS=1` | findings exit 2 (default: findings exit 0 and the RESULT line says FINDINGS) |
| `EX06_ARTIFACT_DIR`, `EX06_STAGES_FILE`, `EX06_QUIET=1` | report directory (the workflow sets it), the stage lines file, silence the stack trace |

Results and exit codes (precedence HARNESS_BROKEN > CHAIN_DIFFERS > PARTIAL > FINDINGS > PASS):

| result | meaning | exit |
| --- | --- | --- |
| PASS | every case as required, every probe answered | 0 |
| FINDINGS | the harness worked; the product disagrees with a requirement in the listed cases | 0 (2 with strict findings) |
| PARTIAL | an optional scenario (calendar, search, revision: they rest on fixture paths no CI run has proved) failed, or a focused re-run | 0, with an error / warning annotation naming it |
| CHAIN_DIFFERS | a pinned function body of the chain differs from DEV without a named explanation: the cases are NOT evidence about DEV | 1 |
| HARNESS_BROKEN | a required scenario failed, a control was not reached, a precondition (the named cause of a negative) was not built, the schema contract is not met, the certificate or the catalog moved, the report could not be written | 1 |

## Chain fidelity (the pins)

`lib/pins.mjs`: 60 function bodies, `md5(replace(prosrc, E'\r', ''))`, read read-only on canonical DEV `leqcwgzvjsxugfgzdmth` on 2026-10-02 08:55 UTC (ledger 221) and read again in full, read-only, at 10:00 UTC (one SELECT comparing all 60 with this table: 60 equal, 0 differ, 0 ambiguous, ledger still 221). Tiers: **CORE** (12: the matcher, the wave, the tick, the candidate gate, emit_event, push_suppression, work_kinds, requeue; the bodies the S03 and ex06a proofs already proved equal on the chain; a difference is always fatal), **SUPPORTING** (38: the lifecycle writers, the guards, the inbox and push gate; expected equal but not yet read from any run, except the five availability helpers the ex06a candidate pins; fatal in strict mode), **INFORMATIONAL** (10: helpers and the production tick; listed, never fatal). The only explained difference: a B24 part 1 target whose chain body, with the quoted `'40001'` turned into `'PT409'`, equals the DEV body (B24 part 1 was applied to DEV on 2026-09-30; the chain stops before it). Not pinned: RLS policies, config rows other than the three dispatch rows (their sha256 is read and compared, informational), triggers, grants. `lib/config.mjs` holds the DEV values of the dispatch config (waves `[5,5,10,20]`, window 15 minutes, target 3; read 2026-10-02 09:45 UTC); the scenarios use the CHAIN's own values and the report says whether they equal DEV's.

Refreshing the pins (read-only on DEV only, never a write): run `s04PinQuery()` (lib/pins.mjs) as a SELECT through a read-only DEV connection, feed the rows to `evaluateS04Pins(rows)`; a difference means DEV moved (a package was applied): re-read the body, update `S04_PINS`, the byte-exact captures in `s04/dev_bodies/` and the tests, and check which findings the new body changes.

## Scenarios, cases and probes (the code is authoritative: `lib/cases.mjs`, `lib/scenarios.mjs`)

63 cases (54 cases + 9 probes), 17 scenarios in this order:

| scenario | what it builds | cases / probes |
| --- | --- | --- |
| reach | one task, 17 workers: eligible controls A and B, paused, DRAFT, SUSPENDED, CLOSED profile, TEST-world, proactive off, requester themself, other work kind, excluded kind, far city, blocked by the worker, blocked by the requester, closure-restricted, already applied, opportunities category off | R00a, R00b (controls), R01-R15; probe PB |
| licence | equipped / without licence / without tool | L00 (control), L01, L02 |
| worldReverse | a TEST-world requester | V00 (control), V01 |
| capacity | team capacity below the people needed | C00 (control), C01 (DOCUMENTED split: capacity is enforced at application time, not at dispatch), C02 |
| target | three applications cover the task, a further wave | C03 |
| calendar (optional) | an Agreement over the task window | C04 (control), C05 |
| window | TOMORROW_FLEXIBLE and WEEK_FLEXIBLE stored without a window (the ex06a derived window), FIXED_WINDOW | Z00a, Z01-Z05 |
| waves | 12 ranked workers | W01 order, W02 size, W03 no repeat, W04 one event / one IN_APP / one PUSH with the dedupe key `opp:<need>:<rev>:<account>`, W05 repeated wave and replayed emit create nothing, W06 the unique constraint |
| ticks | idempotent re-dispatch, requeue, a new worker, an expired window, a re-classification | I01-I05; probe PH |
| expiry, cancel, fill | the dispatch closes (rounds, deliveries, queue, pending notification rows) | T01, T02, T03, T03b |
| search (optional) | the remaining search closed, then an agreement cancelled | T04, T04b |
| revision (optional) | a confirmed material edit | T05; probe PF |
| requeue | a manual profile edit | probe PA |
| resolver | the Inbox resolver of a stale opportunity | probe PE |
| push (runs last: its claim closes the pending PUSH rows of earlier scenarios) | emit-time and claim-time push decisions | probes PC, PD1, PD2, PD3 |

Probes answer **CONFIRMED / REFUTED / NOT_REACHED** for the inference and say whether the canonical requirement is **MET / NOT_MET / NOT_APPLICABLE**; each lists the chain body md5 it ran against. (a) a manual edit of skills/tools/vehicles/licences requeues (PA); (b) a blocked, closing or opted-out pair consumes a wave slot (PB); (c) emit-time role inheritance versus the exact-role claim (PC); (d) quiet hours at emit and at claim, and the missing send-time re-read (PD1-PD3); (e) the Inbox resolver for a stale opportunity (PE); (f) a revision re-notifies (PF); (h) a worker write brings the next wave forward (PH).

Negative cases never pass without the named CAUSE having been observed (a worker "never reached" because a fixture silently failed proves nothing): every negative has a PRECONDITION row, and a control that is not reached is a harness error (otherwise every negative would pass vacuously).

## Findings the code expects (read from the pinned DEV bodies; each is a hypothesis until a run shows the failing SQL evidence)

Predicted from the DEV function bodies on 2026-10-02, all eight raised by the simulated AS_BUILT world and cleared by the FIXED world (offline). The CI run decides.

| id | finding | severity | owner decision |
| --- | --- | --- | --- |
| F5 | a worker who already applied is still sent the opportunity (the candidate gate checks deliveries, a Discovery application creates none) | major | no |
| F6 | a blocked, closing or opted-out worker takes a wave slot (the guards suppress the notification rows only after the delivery row exists) | minor | no |
| F7 | push enabled for the other role: emit creates CREATED, the claim answers PUSH_OFF (PKG-029a inheritance versus exact role) | minor | yes |
| F8 | quiet hours suppress a push for good; no deferral | minor | yes |
| F9 | no send-time re-read of the task or the worker; pending notification rows survive a fill and a closed search | minor | no |
| F10 | a closed-search task fails every tick forever after an agreement cancellation (PT-class conflict loop; ERROR, retry every 10 minutes) | major | no |
| F11 | a manual skills/tools/vehicles/licences edit does not requeue (backoff 5 minutes up to 6 hours) | minor | yes |
| F12 | the Inbox opens a live opportunity the worker can no longer act on (ineligible or already applied) | minor | no |

Proposed fixes (TEXT only; the full wording with the pins to quote is in each case's finding in `lib/cases.mjs` and in the report): F5 add the open-application exclusion to `private.dispatch_cheap_candidate_admitted` (body md5 0132fae3); F6 add the block and closure gates (and the category opt-out) to the same function; F7 one rule in both `emit_event` and `push_suppression` (owner decision); F8 design only (a deferral needs a state or a not-before time; owner decision); F9 re-read the task and the worker in `push_suppression` and expire the pending rows in `rpc_select_response` / `rpc_close_remaining_search`; F10 `dispatch_next_wave` returns STOPPED / REMAINING_SEARCH_CLOSED and `dispatch_tick` dequeues on it; F11 a small service RPC after the profile save, or a trigger (a TRIGGER function moves the closure certificate: owner recertification and a compatible APK); F12 `rpc_resolve_activity_event` re-checks eligibility and application (SECURITY INVOKER stays). Every candidate follows the EX-04 template (exact body pin, exact revert, read-only postflight, disposable fail-before / pass-after proof), a deterministic conflict raises `PT409` never `40001`, and none is applied without the owner's word ("primeni").

Not a defect: C01 (team capacity is checked when the worker applies, not when the wave picks candidates) is a DOCUMENTED split with a green application-time gate (C02).

## Honesty section (what is not proved)

- Nothing ran on a chain yet. Everything above is the code and its offline tests.
- The labelled fixtures are not product writers: a closure request row (READY), the stored response deadline (the `p_response_deadline` product parameter is unproved), the re-publication after a confirmed edit (the product re-publishes through a new review), the profile status / rating / exclusions / proactive columns, the Agreement booked for the calendar case. The three optional scenarios rest on such paths. A failure there is PARTIAL and names the scenario, never a silent pass.
- A disposable chain is NOT DEV; RLS policies, config rows, triggers and grants are not pinned; the chain stops before A1, B3, P0, P4, P5, pkg051a, B24, voice B1, EX-04, D12, pkg045b-p0 and the P6 rollout.
- Push: nothing sent; `rpc_begin_push_send` is not on the chain; the claim only suppresses or queues rows. Devices, clients, a real provider, concurrency (two ticks at one instant) and real time (the windows are driven with the `p_at` parameter; pg_cron is paused) are not covered.
- The cases are the scope of THIS run, not a pass rate.

## Files (all new; `supabase/proofs/ex06/` unless stated)

`ex06_s04_proof.mjs` (entry), `README_S04.md`, `s04/lib/` (`main.mjs` orchestration, `scenarios.mjs` the 17 drivers, `cases.mjs` the catalogue and the findings, `judge.mjs` verdict mechanics, `pins.mjs` and `config.mjs` DEV pins, `report.mjs`, `sql.mjs` read and labelled write builders, `db.mjs` `api.mjs` the seams, `observe.mjs`, `runner.mjs`, `clock.mjs`, `world_sim.mjs` and `reference_obs.mjs` the simulated world for the tests, and 9 `*.test.mjs` files: sql, pins, config, judge, cases, clock, scenarios, report, main), `s04/dev_bodies/` (four byte-exact DEV body captures: `dispatch_cheap_candidate_admitted`, `dispatch_next_wave`, `push_suppression`, `marketplace_tick`), `.github/workflows/ex06-s04-proof.yml`, `docs/implementation/product-v1-closure-20260926/finalization-20260927/ex06/EX06_S04_DESIGN_AND_PREDICTED_FINDINGS_20261002.md`. Read-only imports: `lib/fixtures.mjs` and friends (S03), `../pre_v3/closure_runtime.mjs`. Not touched: S06 (`ex06b_*`), the S03 and ex06a files, `supabase/operations/**`, the registry.

## How to continue (for a different agent with no memory of this session)

1. Push the branch (explicit pathspecs) and run the workflow. If stage 19 fails, the ex06a candidate drifted: fix nothing in S04, report it. If a stage before it fails, the chain itself broke (see `stage-failures.txt`).
2. Read `ex06-s04-report.md`. **CHAIN_DIFFERS**: look at the pin table; a SUPPORTING difference on a first run is expected to be possible (those pins were read from DEV but never compared with a chain); decide per pin whether the chain is wrong (an older body) or the pin is (re-read DEV read-only); re-run with `EX06_S04_PINS=report` only to see the cases, never to claim the DEV label. **HARNESS_BROKEN**: the scenario table names the scenario and its error; the usual suspects are the unproved fixtures (see the honesty section) and Auth 429; fix the harness (this directory), not the product. **PARTIAL**: an optional scenario failed; its fixture path needs a fix. **FINDINGS**: for each finding read the failing rows and the evidence; a finding that does not reproduce is a wrong prediction: correct `FINDINGS` and the catalogue, do not keep a hypothesis as a finding.
3. Only then bring the findings to the owner (the three marked "owner decision" need his word on semantics). Package fixes through the EX-04 template; the body pins to quote are in the finding text.
4. Update the registry and the LIVE plan only through the repository's own scripts and only after a real run (this slice touched neither).
5. If DEV moved (ledger above 221, or a pinned body differs on a read-only re-read), refresh the pins first (section above).

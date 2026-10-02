# EX-06 S04 - dispatch lifecycle negative-case proof: design and predicted findings (2026-10-02)

**Status: AUTHORED AND TESTED OFFLINE; NOT RUN ON ANY CHAIN. This document is a design and a set of predictions read from function bodies. It is not evidence. The first CI run of `.github/workflows/ex06-s04-proof.yml` is the first evidence.** Nothing was applied to DEV or PROD, no function body is changed by S04, nothing was sent, no provider and no device was touched. A disposable chain is NOT DEV.

How to run, the result classes, the findings table and "How to continue" for a different agent: `supabase/proofs/ex06/README_S04.md` (the code is authoritative: `supabase/proofs/ex06/s04/lib/cases.mjs`).

## 1. What the DEV bodies say (read-only SELECT on canonical DEV `leqcwgzvjsxugfgzdmth`, 2026-10-02, ledger 221)

Function bodies were read by `pg_proc.prosrc` md5 (carriage returns removed) and, for four of them, byte-exact captures are kept in `supabase/proofs/ex06/s04/dev_bodies/` (md5 equal to the pin; the offline tests re-check it). The dispatch config rows were read as sha256 of the jsonb text (`dispatch_normal` 641f2847..., waves `[5,5,10,20]`, window 15 minutes, target 3). The reading that every case is built on:

- `private.dispatch_next_wave(need)` (1fd8c51e): the task must be open (PUBLISHED / SELECTION), slots remaining, fewer than the target applications covering the remaining slots, waves not exhausted (policy wave number against `waveSizes`), then the candidates of `private.candidate_profile_ids`, each through the cheap gate `private.dispatch_cheap_candidate_admitted` (0132fae3) and the matcher `private.match_detail` (38c7894a), best score first; one `opportunity_deliveries` row per (worker, task, revision) (unique), one durable event with the dedupe key `opp:<need>:<revision>:<account>` through `private.emit_event` (67413eff), which creates an IN_APP and a PUSH notification row. The delivery row is the spent slot; the notification rows are a separate fact.
- The candidate gate checks: profile ACTIVE, schedule admitted (`private.worker_dispatch_time_admitted`, the ex06a body), not the requester, same world, proactive notifications on, skills overlap, licences / tools / vehicles, no excluded kind, no earlier delivery for this revision. It does NOT check blocks, closure restrictions, the opportunities category preference or an existing application.
- `private.dispatch_tick` claims the due rows of `private.dispatch_schedule`, runs a wave each, dequeues on a terminal reason, backs off `least(360, greatest(5, 2^least(attempts,9)))` minutes on a non-terminal one and records ERROR with a 10-minute retry on an exception.
- `private.expire_lifecycle` and `rpc_cancel_need` close rounds, deliveries, the queue and the pending notification rows of the task; `rpc_select_response` (fill) and `rpc_close_remaining_search` do not touch the pending notification rows.
- `private.requeue_open_needs_for_worker_v5` is called by four worker writers only (activation, availability, location, capacity; an unchanged capacity does nothing). The owner UPDATE of skills / tools / vehicles / licences is a plain update.
- The BEFORE INSERT triggers `closure_guard_delivery` and `safety_guard_delivery` suppress NOTIFICATION rows (ACCOUNT_CLOSING / ACCOUNT_BLOCKED); they do not stop the delivery row.
- `private.push_suppression` (0e027760, the sender gate asked by `rpc_claim_push_transport`) looks the EXACT role preferences up, applies quiet hours, closure and block; it never re-reads the task or the worker's eligibility. The claim suppresses permanently and answers NO_ACTIVE_DEVICE when no device exists; it never sends.
- `rpc_resolve_activity_event` is SECURITY INVOKER: what the worker may read is decided by RLS on the task row.

## 2. Design of the proof

- Three seams: `fx` (the S03 fixtures: real Auth, PostgREST, the product path conversation -> review -> publish), `db` (reads and the LABELLED writes of `sql.mjs`), `api` (PostgREST RPCs as a person or the service, every call with a 30 s abort: PostgREST 14 retries SQLSTATE 40001 without end and the chain stops before B24 part 1). The same drivers run offline against a simulated world (`world_sim.mjs`) in two variants (as built, with every proposed fix): a mutation-style test that the proof can fail AND pass.
- A negative case needs three things: the named CAUSE observed (a PRECONDITION row, otherwise HARNESS_ERROR: a fixture that silently failed proves nothing), a CONTROL in the same scenario that IS reached (otherwise every negative would pass vacuously), and the outcome. A worker is "reached" when an event with a non-SUPPRESSED IN_APP row exists, cross-checked with `rpc_list_inbox` (a disagreement is a harness error).
- Verdicts: PASS / DOCUMENTED / FINDING / NOT_RUN / HARNESS_ERROR per case; CONFIRMED / REFUTED / NOT_REACHED with the requirement MET / NOT_MET / NOT_APPLICABLE per probe. Result precedence HARNESS_BROKEN > CHAIN_DIFFERS > PARTIAL > FINDINGS > PASS. A case of a scenario that did not run is NOT_RUN and counts against the result.
- Chain fidelity: 60 pinned function bodies in three tiers (CORE 12 fatal, SUPPORTING 38 fatal in strict mode, INFORMATIONAL 10 listed); the only explained difference is a B24 part 1 target (chain body with `'40001'` turned into `'PT409'` equals DEV). The workflow applies the ex06a candidate after stage 18 so the two ex06a bodies equal DEV.
- Isolation: every foreign worker and every open task of the chain is parked or cancelled before the first scenario (a worker write requeues every open task and a tick claims every due one; foreign deliveries would also change the 7-day fairness term of the score); each scenario retires its own tasks and workers; the closure certificate and a function / trigger catalog fingerprint must be unchanged at the end.
- Three scenarios (calendar, search, revision) rest on fixture paths no CI run has proved (an Agreement booked through a labelled insert, `rpc_close_remaining_search` and `rpc_cancel_agreement`, `rpc_confirm_need_edit` followed by a labelled re-publication). They are optional: a failure is PARTIAL and names the scenario.

## 3. Predicted verdicts (the simulated world as built; the CI run decides)

PASS (50): R00a R00b R01-R13 R15 L00-L02 V00 V01 C00 C02 C03 C04 C05 Z00a Z01-Z05 Z04a Z05a W01-W06 I01-I05 T01 T02 T03 T04 T05. DOCUMENTED (1): C01 (team capacity is enforced at application time, C02, not at dispatch). FINDING (3): R14 (F5), T03b (F9), T04b (F10). Probes all CONFIRMED (9): PA (F11), PB (F6), PC (F7), PD1 and PD2 (F8), PD3 (F9), PE (F12), PF and PH (the inference holds; requirement not applicable).

| id | the claim read from the bodies | what a run must show |
| --- | --- | --- |
| F5 | a Discovery application creates no delivery row, so the next wave admits the applicant | the applicant's event is reached (IN_APP CREATED) after a manual application |
| F6 | the slot is spent before the guards suppress the notification | a blocked / closing / opted-out worker has a delivery row and no reachable event; the two controls move up a wave |
| F7 | emit creates PUSH CREATED from the other role's row, the claim answers PUSH_OFF | PUSH CREATED at emit, `push_suppression` PUSH_OFF, claim SUPPRESSED / PUSH_OFF |
| F8 | quiet hours suppress permanently at emit and at claim | SUPPRESSED / QUIET_HOURS and no later state change when the hours end |
| F9 | no send-time re-read; fill and close do not expire the pending rows | pending IN_APP / PUSH rows of a filled task stay CREATED; the PUSH of a suspended worker passes the gate |
| F10 | `rpc_cancel_agreement` re-enqueues a closed-search task and the wave raises on the first insert | the tick records ERROR and retries in ten minutes, repeatedly |
| F11 | a manual list edit does not requeue | no schedule change after the edit; a requeue writer does requeue |
| F12 | the resolver does not re-check eligibility | OPPORTUNITY for a suspended or already-applied worker whose task is still open |

A prediction that a run does not reproduce is a WRONG PREDICTION: correct the catalogue (`FINDINGS`, the case expectations), never keep a hypothesis as a finding.

## 4. Decisions taken (each is revisable)

1. Team capacity at dispatch is a DOCUMENTED split (C01), not a defect: the application gate (C02) enforces it.
2. "Reached" is defined by the Inbox-visible IN_APP row, not by the delivery row; both are reported.
3. Pins default to strict. `EX06_S04_PINS=report` exists for an exploratory first run and never earns the DEV label.
4. The ex06a candidate is applied by a workflow stage (19), not by the proof, so its log and exit code are a stage of their own.
5. The stored response deadline, the closure request, the re-publication, status / rating / exclusion / proactive columns are labelled fixtures; the product parameter `p_response_deadline` is not used because no run proved it.
6. Product defects are findings with a proposed fix as TEXT. Nothing in S04 changes a function body; every candidate follows the EX-04 template and needs the owner's "primeni"; a deterministic conflict raises `PT409`, never `40001`.
7. The DEV config values (`lib/config.mjs`) are informational; the scenarios use the chain's own wave sizes, window and target.

## 5. Open questions for the owner (only if a run confirms the finding)

F7 (which semantics wins: the PKG-029a role inheritance or exact-role), F8 (should a quiet-hours push be deferred at all), F11 (a trigger on `app_profiles` moves the closure certificate and needs a compatible APK; a small service RPC does not). F5, F6, F9, F10, F12 are defects against the plan's own requirements and need no semantic decision, only the usual package approval.

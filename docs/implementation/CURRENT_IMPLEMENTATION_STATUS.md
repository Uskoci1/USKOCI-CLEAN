# USKOČI current implementation status

Authoritative current status as of `2026-09-06`, after canonical/live/proven FASTEST/AUTO_FILL retirement. Historical closure evidence remains in dedicated closure and continuity documents.

## Current platform checkpoint

- governing master: `USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip` / SHA-256 `e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`
- canonical repo/branch: `Uskoci1/USKOCI-CLEAN` / `clean-alpha-backend`
- FASTEST/AUTO_FILL implementation proof head/run: `e7b5ce501c2b9708bd176075ab4b41575edf0832` / `34034993845` PASS
- implementation PR #32 PRE-P4 / CodeQL: `34038248027` / `34038246172` PASS
- canonical implementation merge: `6ee5c611fadf6861b7cc029ffda77437a847ca8c`
- implementation canonical PRE-P4 / CodeQL / Control-0: `34038380354` / `34038380028` / `34038380360` PASS
- live Supabase project: `leqcwgzvjsxugfgzdmth`
- live Supabase: `79 / 20260906141409_clean_ru5_fastest_autofill_retirement`
- canonical source: `20260906130000_clean_ru5_fastest_autofill_retirement.sql`
- canonical raw MD5 / bytes: `25bf03d6bed27d0d9af27ec65d59a63c` / `7363`
- live recorded MD5 / bytes: `04466b38e780a59a7eab6f4b928544a0` / `6743`
- exact byte identity: `false`
- transport equivalence: removing SQL `--` line comments and whitespace from canonical/live yields identical MD5 `c99a1ded1106ae52f2dbf47289192ce0`; executable semantics are proven equivalent; applied history remains unchanged; no repair migration is required
- live Selection definition MD5: `4c2b68cdee2fe66facf7fe1c46cef43f`
- Candidate projection definition MD5: `1978ce1d5852cef46f94e81468d37bba`
- business counts: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `need_selections=2`, `agreements=2`
- retired inventory: FASTEST Needs `0`; FASTEST V2 AI facts `0`; FASTEST Application snapshots `0`; AUTO_FILL Selections `0`
- live admissible Need/Application price modes: `MY_PRICE | OFFERS`
- live admissible Selection modes: `REQUESTER_SELECTS | BIDDING`
- Edge `uskoci-ai-interview`: `ACTIVE v6`, `verify_jwt=true`, EZBR SHA-256 `012507310cd74cf9e769021aea71f8cfdd4e483406edbff0ee35e0b527e98954`; AI price-mode contract is `MY_PRICE | OFFERS`

## Closed RU-5 constituent state

The following units remain physically closed and must not be redone without a proven regression:

- RU-5 P0C-01 Public-safe profile projection — `CLOSED / LIVE`
- RU-5 P0C-02 Atomic Application submit — `CLOSED / LIVE`
- RU-5 P0C-03 My Applications projection + withdraw — `CLOSED / LIVE`
- RU-5 P0D-01 Requester Candidate Projection — `CLOSED / LIVE`
- RU-5 Manual Selection Eligibility Revalidation — `CLOSED / CANONICAL / LIVE`
- P0D-02 Selection Semantic Idempotency — `CLOSED / CANONICAL / LIVE`
- P0D-03 Requester Connection Activation V1 — `CLOSED / CANONICAL / LIVE / PROVEN`
- RU-5 FASTEST/AUTO_FILL retirement — `CLOSED / CANONICAL / LIVE / PROVEN`

P0D-03 policy remains exactly:

`REQUESTER_SELECTION_V1 / REQUESTER / SELECTION / PROMOTIONAL_FREE / HEADCOUNT / 0 RSD`

`private.connection_activations=0`; no historical activation backfill and no Worker debit were introduced.

## Current locks

- production D0140 ALLOW: `FAIL_CLOSED`; publication policy bundle inventory `0`; publication decision inventory `0`
- RU-4B public Q&A: `ACTIVATION_BLOCKED / DEFERRED`; governed production question/policy/command inventory remains empty
- monetization: `FREE / 0 RSD`; no paid/wallet/checkout/packages activation
- urgent production activation: unchanged/disabled
- raw cross-account `app_profiles`: forbidden
- production fake source fallback: forbidden
- Application AI / RU-5B remains gated
- RU-6A calendar authority / Agreement Snapshot V2 and RU-6B shared multi-person Dogovor remain separate future units

## RU status summary

- RU-0 — `CLOSED / LIVE / DO NOT REDO`
- RU-1 — `CLOSED / LIVE / DO NOT REDO`
- RU-2 — `CLOSED / LIVE / DO NOT REDO`
- RU-3 — `LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED`
- RU-4 — `CLOSED / LIVE / DO NOT REDO`
- RU-4B — `LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED`
- Client Data Layer — `CLOSED / CANONICAL / DO NOT REDO`
- RU-5 — `IN PROGRESS`; constituent closed units stay closed, but aggregate RU-5 is not yet closed
- RU-5B — `NOT STARTED / GATED BY RU-5`
- RU-6A — `FOUNDATION ONLY / GATED BY RU-5`
- RU-6B — `NOT STARTED / GATED BY RU-6A`
- RU-7 — `FOUNDATION ONLY / GATED BY RU-6A/RU-6B`
- RU-8 — `NOT STARTED / MANDATORY PROOF TRACK`

## Remaining RU-5 aggregate blockers

### 1. Bounded / preselection note governance

Frozen RU-5 requires a bounded Application note and denial of contact/payment/exact-private-location bypass content according to current policy.

The current governing sources do not owner-approve a numeric maximum length, regex/block list, moderation threshold or numeric rate for this Application note. Concrete values found only in `06_DRAFT_EVIDENCE` are draft evidence and cannot be promoted into product policy by implementation inference.

Therefore any implementation step that would require inventing those values is `BLOCKED / DECISION-REQUIRED`. Continue only with policy-independent proof/reconciliation work until authority exists.

### 2. Two-account/device Application journey proof

Frozen RU-5 still requires complete journey proof:

`W03 → W04 → W05 → W06 → R05`

Existing unit/DB/integration proofs establish important command properties, but do not by themselves prove the complete aggregate two-identity journey. The next proof must preserve authenticated Worker and Requester authority without service-role substitution, prove retry/replay/stale/atomic/no-partial-write behavior, preserve P0D-02 and P0D-03, and leave zero proof residue. Automated integration proof and physical device/emulator proof must be reported separately.

## Exact continuation cursor

1. finish this docs/provenance closure through normal PR and canonical gates;
2. fresh-read final canonical closure state;
3. search governing/master/legal/history/code for any later owner-approved bounded-note policy; do not invent missing values;
4. reconstruct exact `W03/W04/W05/W06/R05` surface/command/backend mapping;
5. run the strongest available authenticated two-account automated proof and, only if physically available, the separate device/emulator proof;
6. keep aggregate RU-5 `IN PROGRESS` until both governing blockers are physically closed;
7. do not enter RU-5B early.

Explicit non-claims: bounded-note policy values, Application AI, hard calendar authority, immutable Agreement Snapshot V2, shared Dogovor, D0140 production ALLOW, RU-4B public activation, HITNO activation, wallet/checkout/packages or paid monetization.

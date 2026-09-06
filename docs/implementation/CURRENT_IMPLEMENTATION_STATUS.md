# USKOČI current implementation status

Authoritative current status as of `2026-09-06`, after live closure of frozen-governed `P0D-02 — selection_semantic_idempotency`.

## Current platform checkpoint

- canonical repo/branch: `Uskoci1/USKOCI-CLEAN` / `clean-alpha-backend`
- canonical implementation merge: `5faa7b5442d26b2c2d3ece3ed1b48b39a37d00d9`
- exact-head proof: `c3ada4219b9c8427be0c7b35bc36afa30b4302cc` / run `34023168764` PASS
- implementation PR #26 PRE-P4 / CodeQL: `34023318196` / `34023316595` PASS
- canonical PRE-P4 / CodeQL / Control-0: `34023411493` / `34023410485` / `34023411602` PASS
- live Supabase: `77 / 20260906090451_clean_p0d02_selection_semantic_idempotency`
- canonical source: `20260906080000_clean_p0d02_selection_semantic_idempotency.sql`
- canonical raw MD5 / bytes: `065a6a172f1cea50b99c57f6759ef109` / `15516`
- live recorded MD5 / bytes: `c267357c43e2c18448b46268ae458085` / `15513`
- transport: whitespace-only three-LF omission; canonical/live whitespace-stripped MD5 `3433be65f949407f62f751dbf5b57a9d`
- live Selection definition MD5: `b1ca0a03ee075565c71b50f00d61dade`
- Candidate projection definition MD5: `1978ce1d5852cef46f94e81468d37bba`
- business counts: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`
- history preserved: `2 SUBMITTED / 2 SELECTED` responses; `2` selected need_selections; `2` Agreements
- `private.selection_commands`: `0` rows post-migration; RLS ON; zero policies/direct API reads

## P0D-02 closure

- durable private Selection command receipt binds Requester + client request ID to exact semantic payload;
- same key/same payload replays one authoritative Agreement; same key/different payload rejects;
- true same-key concurrency and distinct-key final-seat race are proven;
- R05 retains exact-intent request identity across ambiguous retry;
- historical Selection request hashes are not backfilled/fabricated.

## Current locks

- production D0140 ALLOW: `FAIL_CLOSED`; inventories `0 / 0 / 0`
- RU-4B public Q&A: `ACTIVATION_BLOCKED / DEFERRED`; all five governed inventories `0`
- monetization: `FREE / 0 RSD`
- urgent production activation: unchanged/disabled
- raw cross-account `app_profiles`: forbidden
- production fake source fallback: forbidden
- Povezivanje: not activated
- Application AI / RU-5B: gated by remaining manual lifecycle dependencies

## RU status summary

- RU-0 — `CLOSED / LIVE / DO NOT REDO`
- RU-1 — `CLOSED / LIVE / DO NOT REDO`
- RU-2 — `CLOSED / LIVE / DO NOT REDO`
- RU-3 — `LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED`
- RU-4 — `CLOSED / LIVE / DO NOT REDO`
- RU-4B — `LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED`
- Client Data Layer — `CLOSED / CANONICAL / DO NOT REDO`
- RU-5 — `IN PROGRESS`
- RU-5 P0C-01 — `CLOSED / LIVE / DO NOT REDO`
- RU-5 P0C-02 — `CLOSED / LIVE / DO NOT REDO`
- RU-5 P0C-03 — `CLOSED / LIVE / DO NOT REDO`
- RU-5 P0D-01 — `CLOSED / LIVE / DO NOT REDO`
- RU-5 Manual Selection Eligibility Revalidation — `CLOSED / CANONICAL / LIVE / DO NOT REDO`
- P0D-02 Selection Semantic Idempotency — `CLOSED / CANONICAL / LIVE / DO NOT REDO`
- RU-5B — `NOT STARTED / GATED`
- RU-6A — `FOUNDATION ONLY / GATED BY RU-5`
- RU-6B — `NOT STARTED / GATED BY RU-6A`
- RU-7 — `FOUNDATION ONLY / GATED BY RU-6A/RU-6B`
- RU-8 — `NOT STARTED / MANDATORY PROOF TRACK`

## Explicit non-claims and next action

P0D-02 does not close hard calendar conflict authority, shared Dogovor/Povezivanje, D0140/RU-4B activation, monetization, bounded-note policy or Application AI. Fresh-read the frozen dependency plan plus current physical Agreement/calendar state before admitting the next unit; do not invent a new number.

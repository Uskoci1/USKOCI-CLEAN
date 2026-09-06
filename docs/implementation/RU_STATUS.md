# USKOČI RU status

Current authoritative RU matrix after live closure of frozen-governed `P0D-02 — selection_semantic_idempotency`.

| Unit | Status | Current rule |
|---|---|---|
| RU-0 | CLOSED / LIVE | Do not redo unless an actual regression is proven. |
| RU-1 | CLOSED / LIVE | Worker readiness authority remains required at relevant command boundaries. |
| RU-2 | CLOSED / LIVE | Need V2 draft/Human Review authority remains canonical. |
| RU-3 | LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED | D0140 production ALLOW remains fail-closed. |
| RU-4 | CLOSED / LIVE | Do not redo owner-edit/revision closure. |
| RU-4B | LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED | Do not activate public Q&A until all governing blockers are resolved. |
| Client Data Layer | CLOSED / CANONICAL | Specialized owners remain canonical; no fake production fallback. |
| RU-5 | IN PROGRESS | Continue dependency-by-dependency; no invented numbering. |
| RU-5 P0C-01 | CLOSED / LIVE | Public-safe profile projection canonical; raw `app_profiles` remains protected. |
| RU-5 P0C-02 | CLOSED / LIVE | Atomic Application submit canonical/live; no historical snapshot backfill. |
| RU-5 P0C-03 | CLOSED / LIVE | My Applications projection + withdraw canonical/live. |
| RU-5 P0D-01 | CLOSED / LIVE | Requester Candidate Projection canonical/live. |
| RU-5 Manual Selection Eligibility Revalidation | CLOSED / CANONICAL / LIVE | Current readiness/team-capacity are revalidated at Selection boundary. |
| P0D-02 Selection Semantic Idempotency | CLOSED / CANONICAL / LIVE | Durable semantic receipt + retained R05 exact-intent retry identity; no historical hash backfill. |
| RU-5B | NOT STARTED / GATED | Manual lifecycle dependencies must be freshly reconciled before admission. |
| RU-6A | FOUNDATION ONLY / GATED BY RU-5 | Hard calendar/Agreement authority must not be claimed prematurely. |
| RU-6B | NOT STARTED / GATED BY RU-6A | Shared Dogovor/Povezivanje remains later. |
| RU-7 | FOUNDATION ONLY / GATED BY RU-6A/RU-6B | Deferred. |
| RU-8 | NOT STARTED / MANDATORY PROOF TRACK | Required before release closure. |

## Live checkpoint

- Supabase: `77 / 20260906090451_clean_p0d02_selection_semantic_idempotency`
- canonical implementation merge: `5faa7b5442d26b2c2d3ece3ed1b48b39a37d00d9`
- proof head/run: `c3ada4219b9c8427be0c7b35bc36afa30b4302cc` / `34023168764` PASS
- PR PRE-P4 / CodeQL: `34023318196` / `34023316595` PASS
- canonical PRE-P4 / CodeQL / Control-0: `34023411493` / `34023410485` / `34023411602` PASS
- source canonical MD5/bytes: `065a6a172f1cea50b99c57f6759ef109` / `15516`
- live recorded MD5/bytes: `c267357c43e2c18448b46268ae458085` / `15513`
- whitespace-stripped identity: `3433be65f949407f62f751dbf5b57a9d` both sides; three LF transport omission only
- live function MD5s: Selection `b1ca0a03ee075565c71b50f00d61dade`; Candidate `1978ce1d5852cef46f94e81468d37bba`
- business rows: `6 / 6 / 4 / 2`; Selection history unchanged; command receipts `0` immediately after migration
- D0140 `0/0/0` and FAIL_CLOSED; all RU-4B inventories `0`; monetization FREE/0; Povezivanje off

## Explicit non-claims / cursor

P0D-02 does not close hard calendar conflicts, shared Dogovor/Povezivanje, D0140/RU-4B activation, monetization, bounded-note policy or Application AI. Fresh-read frozen dependencies and current physical Agreement/calendar state before naming or implementing the next unit.

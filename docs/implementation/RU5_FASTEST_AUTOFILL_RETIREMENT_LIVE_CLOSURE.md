# RU-5 FASTEST/AUTO_FILL retirement — live closure

Status: **CLOSED / CANONICAL / LIVE / PROVEN** for this retirement unit only.

Aggregate `RU-5` remains **IN PROGRESS**. This closure does not admit `RU-5B`.

## Governing authority

- implementation-ready master: `USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip`
- master SHA-256: `e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`
- frozen contract: retire FASTEST Need/Application/AI pricing state and AUTO_FILL Selection state; preserve `MY_PRICE`, `OFFERS`, `REQUESTER_SELECTS`, `BIDDING`, P0D-02 idempotency and P0D-03 Requester Connection Activation V1.

## Canonical implementation proof

- exact proof head: `e7b5ce501c2b9708bd176075ab4b41575edf0832`
- proof run: `34034993845` — PASS
- implementation PR: `#32`
- PR PRE-P4: `34038248027` — PASS
- PR CodeQL: `34038246172` — PASS
- canonical merge: `6ee5c611fadf6861b7cc029ffda77437a847ca8c`
- canonical PRE-P4: `34038380354` — PASS
- canonical CodeQL: `34038380028` — PASS
- canonical Control-0: `34038380360` — PASS

Canonical source:

- version/file: `20260906130000_clean_ru5_fastest_autofill_retirement.sql`
- raw MD5: `25bf03d6bed27d0d9af27ec65d59a63c`
- UTF-8 bytes: `7363`

## Live Supabase proof

Project: `leqcwgzvjsxugfgzdmth`

Fresh read-only postflight:

- migration count: `79`
- live head: `20260906141409_clean_ru5_fastest_autofill_retirement`
- live recorded statement MD5: `04466b38e780a59a7eab6f4b928544a0`
- live recorded statement UTF-8 bytes: `6743`
- exact byte identity with canonical source: `false`

The recorded representation differs only by non-executable SQL line comments and whitespace. Removing `--` line comments and whitespace from both canonical and live representations produces the same MD5:

`c99a1ded1106ae52f2dbf47289192ce0`

Therefore:

- executable semantics: **PROVEN EQUIVALENT**
- applied migration history: **UNCHANGED**
- repair migration solely for transport representation: **NOT REQUIRED**

Live admissible contracts:

- Need price modes: `MY_PRICE | OFFERS`
- Application snapshot price modes: `MY_PRICE | OFFERS`
- Selection modes: `REQUESTER_SELECTS | BIDDING`

Retired-state inventory after promotion:

- FASTEST Need rows: `0`
- FASTEST V2 AI fact rows: `0`
- FASTEST Application snapshot rows: `0`
- AUTO_FILL Selection rows: `0`

Continuity fingerprints:

- `rpc_select_response(...)`: `4c2b68cdee2fe66facf7fe1c46cef43f`
- `rpc_list_need_candidates(uuid)`: `1978ce1d5852cef46f94e81468d37bba`

Business continuity:

- profiles: `6`
- Needs: `6`
- marketplace responses: `4`
- selections: `2`
- agreements: `2`

No historical business row was rewritten for this retirement.

## Live Edge proof

`uskoci-ai-interview`:

- status: `ACTIVE`
- version: `6`
- `verify_jwt=true`
- EZBR SHA-256: `012507310cd74cf9e769021aea71f8cfdd4e483406edbff0ee35e0b527e98954`
- live V2 AI price-mode contract: `MY_PRICE | OFFERS`
- FASTEST is not offered by the live V2 instruction/validator path.

## Preserved safety and authority boundaries

P0D-03 remains unchanged:

`REQUESTER_SELECTION_V1 / REQUESTER / SELECTION / PROMOTIONAL_FREE / HEADCOUNT / 0 RSD`

- connection activation rows remain `0`
- no Worker debit
- no historical activation backfill
- no paid monetization activation

D0140:

- production policy bundle rows: `0`
- publication decision rows: `0`
- production ALLOW: **FAIL-CLOSED**

RU-4B:

- foundation remains live
- public Q&A activation remains **BLOCKED**
- preselection question/policy/command inventories remain zero

## Aggregate RU-5 remains open

This unit closure does **not** prove the full RU-5 exit gate.

Remaining governing blockers:

1. **Bounded / preselection note governance** — the governing plan requires a bounded note and denial of contact/payment/exact-private-location bypass content according to current policy. Current governing sources do not owner-approve a numeric maximum, regex/block list, moderation threshold or numeric rate. Concrete values found under `06_DRAFT_EVIDENCE` remain draft evidence and must not be promoted by implication.
2. **Two-account/device Application journey proof** — the frozen journey `W03 → W04 → W05 → W06 → R05` still requires end-to-end two-identity proof. Existing constituent DB/unit proofs do not substitute for that aggregate journey, and automated integration proof must remain distinct from physical device/emulator proof.

## Exact next cursor

1. merge this docs/provenance closure only after normal PR gates pass;
2. fresh-read final canonical closure state;
3. resolve bounded/preselection-note authority without inventing policy;
4. reconstruct and execute the strongest available authenticated two-account `W03 → W04 → W05 → W06 → R05` proof;
5. do not mark aggregate RU-5 CLOSED and do not enter RU-5B until every governing exit condition is physically proven.

Explicit non-claims: Application AI, hard calendar-conflict authority, immutable Agreement Snapshot V2, shared multi-person Dogovor, D0140 production ALLOW, RU-4B public activation, HITNO activation, wallet/checkout/packages or paid monetization.

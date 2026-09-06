# USKOČI — LIVE IMPLEMENTATION NETWORK

Current authoritative network checkpoint: `2026-09-06` after RU-5 FASTEST/AUTO_FILL retirement became canonical/live/proven.

Historical network checkpoints that previously occupied this file are preserved byte-for-byte in `LIVE_IMPLEMENTATION_NETWORK_HISTORY_PRE_RU5_RETIREMENT_20260906.md` and in Git history. They remain evidence, but they do not override this newer checkpoint.

## Governing source

- master: `USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip`
- SHA-256: `e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`
- canonical repository/branch: `Uskoci1/USKOCI-CLEAN` / `clean-alpha-backend`

## Current canonical implementation checkpoint

RU-5 FASTEST/AUTO_FILL retirement:

- exact proof head/run: `e7b5ce501c2b9708bd176075ab4b41575edf0832` / `34034993845` PASS
- implementation PR: `#32`
- PR PRE-P4 / CodeQL: `34038248027` / `34038246172` PASS
- canonical merge: `6ee5c611fadf6861b7cc029ffda77437a847ca8c`
- canonical PRE-P4 / CodeQL / Control-0: `34038380354` / `34038380028` / `34038380360` PASS
- source migration: `20260906130000_clean_ru5_fastest_autofill_retirement.sql`
- source MD5/bytes: `25bf03d6bed27d0d9af27ec65d59a63c` / `7363`

## Current live Supabase checkpoint

Project: `leqcwgzvjsxugfgzdmth`

- migration count/head: `79 / 20260906141409_clean_ru5_fastest_autofill_retirement`
- live recorded statement MD5/bytes: `04466b38e780a59a7eab6f4b928544a0` / `6743`
- exact byte identity: `false`
- normalization: remove SQL `--` line comments and whitespace
- canonical/live normalized MD5: `c99a1ded1106ae52f2dbf47289192ce0`
- verdict: comment/whitespace-only transport reconciliation; executable semantics proven equivalent; applied history unchanged; no repair migration

Admissible current contract:

- Need/Application price modes: `MY_PRICE | OFFERS`
- Selection modes: `REQUESTER_SELECTS | BIDDING`

Retired inventory:

- FASTEST Needs: `0`
- FASTEST V2 AI facts: `0`
- FASTEST Application snapshots: `0`
- AUTO_FILL Selections: `0`

Continuity:

- profiles `6`
- Needs `6`
- responses `4`
- selections `2`
- Agreements `2`
- Selection function MD5 `4c2b68cdee2fe66facf7fe1c46cef43f`
- Candidate function MD5 `1978ce1d5852cef46f94e81468d37bba`

## Current live Edge checkpoint

`uskoci-ai-interview`:

- `ACTIVE v6`
- `verify_jwt=true`
- EZBR SHA-256 `012507310cd74cf9e769021aea71f8cfdd4e483406edbff0ee35e0b527e98954`
- V2 price modes `MY_PRICE | OFFERS`
- FASTEST is retired from the live AI price-mode contract

## Preserved closed units

- RU-0 — `CLOSED / LIVE / DO NOT REDO`
- RU-1 — `CLOSED / LIVE / DO NOT REDO`
- RU-2 — `CLOSED / LIVE / DO NOT REDO`
- RU-4 — `CLOSED / LIVE / DO NOT REDO`
- Client Data Layer — `CLOSED / CANONICAL / DO NOT REDO`
- RU-5 P0C-01 — `CLOSED / LIVE`
- RU-5 P0C-02 — `CLOSED / LIVE`
- RU-5 P0C-03 — `CLOSED / LIVE`
- RU-5 P0D-01 — `CLOSED / LIVE`
- RU-5 Manual Selection Eligibility Revalidation — `CLOSED / CANONICAL / LIVE`
- P0D-02 — `CLOSED / CANONICAL / LIVE`
- P0D-03 — `CLOSED / CANONICAL / LIVE / PROVEN`
- RU-5 FASTEST/AUTO_FILL retirement — `CLOSED / CANONICAL / LIVE / PROVEN`

P0D-03 remains exactly:

`REQUESTER_SELECTION_V1 / REQUESTER / SELECTION / PROMOTIONAL_FREE / HEADCOUNT / 0 RSD`

No Worker debit and no historical connection-activation backfill were introduced.

## Fail-closed/deferred network

- RU-3 — `LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED`
- D0140 production ALLOW — `FAIL_CLOSED`; policy bundle rows `0`; publication decision rows `0`
- RU-4B — `LIVE FOUNDATION / PUBLIC ACTIVATION BLOCKED-DEFERRED`; governed production inventories remain zero
- monetization — `FREE / 0 RSD`; no paid/wallet/checkout/packages activation
- HITNO production activation — unchanged/disabled
- Application AI / RU-5B — gated
- RU-6A hard calendar authority / immutable Agreement Snapshot V2 — separate future unit
- RU-6B shared multi-person Dogovor — separate future unit

## Aggregate RU-5 status

`RU-5 = IN PROGRESS`.

FASTEST/AUTO_FILL retirement does not close the aggregate. Two governing blockers remain:

1. **Bounded / preselection note governance** — frozen RU-5 requires a bounded note and denial of contact/payment/exact-private-location bypass content according to current policy. Current governing sources do not owner-approve a numeric max length, regex/block list, moderation threshold or numeric rate. Values under `06_DRAFT_EVIDENCE` remain draft-only. Do not invent policy.
2. **Two-account/device Application journey proof** — frozen proof gate remains `W03 → W04 → W05 → W06 → R05`. Existing constituent DB/unit proofs do not substitute for the aggregate authenticated two-identity journey. Automated integration proof and physical device/emulator proof must remain separately classified.

## Exact next cursor

1. finish docs/provenance closure through normal PR and canonical push gates;
2. fresh-read final canonical status/provenance;
3. exhaustively resolve bounded-note governing authority without invention;
4. reconstruct exact `W03/W04/W05/W06/R05` surface → client command → RPC/DB authority mapping;
5. execute the strongest available authenticated two-account automated proof with zero residue and no service-role substitution for user authority;
6. execute physical device/emulator proof only if that environment is actually available; never claim it otherwise;
7. keep RU-5B gated until all aggregate RU-5 requirements are physically proven.

Explicit non-claims: bounded-note policy values, Application AI, calendar hard-conflict authority, Agreement Snapshot V2, shared Dogovor, D0140 production ALLOW, RU-4B public activation, HITNO activation or paid monetization.

Principle: **AI agent is replaceable. Canonical project state is not.**

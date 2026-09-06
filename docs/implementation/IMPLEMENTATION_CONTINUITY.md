# USKOČI implementation continuity

## Current authoritative checkpoint — 2026-09-06 — P0D-03 REQUESTER CONNECTION ACTIVATION V1 CANONICAL / LIVE / POSTFLIGHT PROVEN / CLOSURE PENDING

Frozen authority explicitly names this unit `P0D-03 — requester_connection_activation_v1`. Backend implementation and live promotion are complete; this docs/provenance branch is the final closure step.

### Canonical implementation and proof

- proof branch: `proof/p0d03-requester-connection-activation-v1-20260906`
- final implementation/proof head: `01b514289091ad9c9ced7d1d5ed4598eaa2994c5`
- exact-head proof run: `34026655155` — PASS
- earlier locked proof provenance: `06c60587b6af992d987052a4373f1cc8294df969` / run `34026374264` / artifact `9987204281`
- implementation PR: `#28`
- PR PRE-P4: `34026813290` — PASS
- PR CodeQL: `34026811947` — PASS
- canonical implementation merge: `e9d9fd065b0ea895dc37a32bc1707167cd3ed5ec`
- canonical PRE-P4: `34026900540` — PASS
- canonical CodeQL: `34026900127` — PASS
- canonical Control-0: `34026900533` — PASS
- locked canonical migration: `supabase/migrations/20260906100000_clean_p0d03_requester_connection_activation_v1.sql`
- canonical raw MD5 / bytes: `e6fb0cb596b51587958b92d08b36ce98` / `25525`

### Live Supabase

- project: `leqcwgzvjsxugfgzdmth`
- live migration count/head: `78 / 20260906102021_clean_p0d03_requester_connection_activation_v1`
- recorded statement count: `1`
- live recorded statement MD5 / bytes: `c77a5d4c6efec10c928f38c0542e593e` / `25524`
- terminal LF in live recorded statement: false
- appending exactly one terminal LF yields canonical MD5 `e6fb0cb596b51587958b92d08b36ce98` and `25525` bytes; no semantic drift and no forward repair required
- live Selection definition MD5: `4c2b68cdee2fe66facf7fe1c46cef43f`
- Candidate projection definition MD5 unchanged: `1978ce1d5852cef46f94e81468d37bba`
- Povezivanje V1 policy is exactly `REQUESTER_SELECTION_V1 / REQUESTER / SELECTION / PROMOTIONAL_FREE / HEADCOUNT / 0 RSD`
- `private.connection_policy_versions=1`; `private.connection_activations=0`
- no historical Agreement/Selection activation backfill was fabricated
- both connection tables are private and RLS-enabled; direct activation-ledger SELECT is denied to anon/authenticated/service_role
- business state preserved: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `need_selections=2`, `agreements=2`
- D0140 policy bundle inventory remains `0`; production ALLOW remains fail-closed
- RU-4B production Q&A remains activation-blocked with governed inventory empty
- paid/wallet/checkout relations remain absent; Worker debit remains absent; Application AI remains absent/gated

### Closed behavior

- Requester is the V1 Povezivanje beneficiary;
- activation reason is Selection;
- units are covered `HEADCOUNT`;
- V1 platform connection cost is exactly `0 RSD` (`PROMOTIONAL_FREE`);
- canonical Selection requires/creates the immutable activation receipt for a newly created Agreement in the same transaction;
- task work price remains separate from platform connection cost;
- P0D-02 semantic idempotency and prior Selection eligibility/Candidate behavior remain preserved;
- historical Agreements/Selections remain untouched.

### Explicit non-claims / locks

P0D-03 does **not** implement paid monetization, wallet/checkout/packages, Worker debit, hard calendar conflict authority, calendar commitment, immutable Agreement task/location snapshot V2, shared multi-person Dogovor/group-private channels, D0140 production ALLOW, RU-4B public Q&A activation, Application AI/RU-5B, reviews, push, maps or identity-provider runtime.

Unit status before this closure branch is merged: **CANONICAL / LIVE / POSTFLIGHT PROVEN / FORMAL DOCS-PROVENANCE CLOSURE PENDING**. After this closure payload is canonical and its canonical push gates pass: **CLOSED / CANONICAL / LIVE / DO NOT REDO**.

Exact next cursor after closure: fresh-read the frozen dependency plan and current physical Agreement/calendar state before admitting another unit. Do not invent a new P0D/RU identifier and do not interpret narrow P0D-03 activation as shared Dogovor or monetization.

## Predecessor authoritative checkpoint — 2026-09-06 — P0D-02 SELECTION SEMANTIC IDEMPOTENCY CLOSED / CANONICAL / LIVE

Frozen forward authority explicitly names this unit `P0D-02 — selection_semantic_idempotency`. The governing frozen package remains unchanged.

### Canonical implementation and proof

- implementation proof branch exact head: `c3ada4219b9c8427be0c7b35bc36afa30b4302cc`
- exact-head proof run: `34023168764` — PASS
- implementation PR: `#26`
- PR PRE-P4: `34023318196` — PASS
- PR CodeQL: `34023316595` — Actions/Python/JavaScript-TypeScript PASS
- canonical implementation merge: `5faa7b5442d26b2c2d3ece3ed1b48b39a37d00d9`
- canonical PRE-P4: `34023411493` — PASS
- canonical CodeQL: `34023410485` — Actions/Python/JavaScript-TypeScript PASS
- canonical Control-0: `34023411602` — PASS
- locked canonical migration: `supabase/migrations/20260906080000_clean_p0d02_selection_semantic_idempotency.sql`
- canonical raw MD5 / bytes: `065a6a172f1cea50b99c57f6759ef109` / `15516`

### Live Supabase

- project: `leqcwgzvjsxugfgzdmth`
- live migration count/head: `77 / 20260906090451_clean_p0d02_selection_semantic_idempotency`
- recorded statement count: `1`
- live recorded statement MD5 / bytes: `c267357c43e2c18448b46268ae458085` / `15513`
- canonical source: `342` LF with terminal LF; connected live record: `339` LF without terminal LF
- canonical/live whitespace-stripped MD5: `3433be65f949407f62f751dbf5b57a9d` on both sides — the three-byte difference is whitespace-only transport deviation, not semantic drift
- live Selection definition MD5: `b1ca0a03ee075565c71b50f00d61dade`
- Candidate projection definition MD5 remains `1978ce1d5852cef46f94e81468d37bba`
- `private.selection_commands`: RLS enabled, `0` policies, `0` rows immediately post-migration; anon/authenticated/service_role direct SELECT all denied
- Selection EXECUTE remains authenticated + service_role, anon denied
- authenticated direct `marketplace_responses` INSERT/UPDATE/DELETE remains denied
- business rows unchanged: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`
- historical state unchanged: `2` SUBMITTED responses, `2` SELECTED responses, `2` SELECTED need_selections, `2` Agreements
- no historical Selection request-hash receipt was fabricated
- D0140 inventories remain `0/0/0`; production ALLOW remains fail-closed
- all five RU-4B governed inventories remain `0`; public Q&A remains activation blocked
- monetization remains `FREE / 0 RSD`; Povezivanje remained not activated at this predecessor checkpoint; Application AI/RU-5B remained gated

### Closed behavior

- same Requester key + same exact Selection payload returns the same authoritative Agreement without duplicate Selection/Agreement/receipt;
- same key + different semantic payload rejects with `IDEMPOTENCY_KEY_REUSED`;
- true concurrent same-key retry serializes to one result; distinct keys racing for the final seat produce one winner under existing Need row authority;
- R05 retains one request ID for exact `(Need/revision, Application/version/hash, covered slots)` intent across ambiguous retry and allocates a new ID when that intent changes;
- historical Selection/Agreement rows remain untouched and legacy replay relies on existing immutable evidence rather than fabricated hashes.

### Explicit non-claims / locks

This closure does **not** implement hard calendar conflict authority, shared Agreement/Dogovor redesign, D0140 production ALLOW, RU-4B public Q&A activation, monetization, bounded-note policy or Application AI/RU-5B.

`P0D-02 — selection_semantic_idempotency` = **CLOSED / CANONICAL / LIVE / DO NOT REDO**.

## Predecessor authoritative checkpoint — 2026-09-06 — RU-5 MANUAL SELECTION ELIGIBILITY REVALIDATION CLOSED / CANONICAL / LIVE

This is a predecessor forward continuity pointer. The governing frozen package remains unchanged and older checkpoints remain evidence. They must not override the newer P0D-03 physically proven state above.

### Frozen authority

- package: `USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip`
- SHA-256: `e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`
- rule: frozen MASTER defines product/system intent; current GitHub/live state defines what is already physically implemented; latest explicit owner decisions supersede older conflicting product/UI material.

### Canonical GitHub implementation

- repository: `Uskoci1/USKOCI-CLEAN`
- canonical branch: `clean-alpha-backend`
- Selection eligibility proof branch final gated head: `d71c6e08b518e2955020c21538c1238358b14df3`
- implementation PR: `#23`
- canonical implementation merge: `c0dd1434c436578e0f517520a2156b72ec5d3eaa`
- closure/provenance PR: `#24`
- closure/provenance canonical merge: `cc507910a10515db52f0b0db6d86478cfd19ea05`
- locked source migration: `supabase/migrations/20260906010000_clean_ru5_selection_eligibility_revalidation.sql`
- canonical raw MD5: `6ddb7d5d141e7cb3a454fa7e6ca1280d`
- canonical UTF-8 bytes: `17954`

### Proof and promotion gates

- exact-head Selection proof: `34017442269` — PASS
  - predecessor replay: PASS
  - narrow two-function scope: PASS
  - unready Worker -> existing `STALE`: PASS
  - current team-capacity drift -> existing `STALE`: PASS
  - ready Worker -> `SELECTABLE`: PASS
  - invalid Selection denied with zero partial writes: PASS
  - exact Agreement binding: PASS
  - P0D-01 regression: PASS
  - TypeScript: PASS
  - Jest: `21/21` suites, `136/136` tests PASS
- implementation PR PRE-P4: `34017443678` — PASS
- implementation PR CodeQL: `34017442615` — Actions/Python/JavaScript-TypeScript PASS
- implementation canonical push PRE-P4: `34017639405` — PASS
- implementation canonical push CodeQL: `34017639038` — Actions/Python/JavaScript-TypeScript PASS
- implementation canonical Control-0: `34017639343` — PASS
- closure PR PRE-P4: `34018929991` — PASS
- closure PR CodeQL: `34018929257` — Actions/Python/JavaScript-TypeScript PASS
- closure canonical push PRE-P4: `34019026629` — PASS
- closure canonical push CodeQL: `34019026435` — Actions/Python/JavaScript-TypeScript PASS
- closure canonical Control-0: `34019026661` — PASS

### Live Supabase

- project: `leqcwgzvjsxugfgzdmth`
- live migration count: `76`
- live head: `20260906065758_clean_ru5_selection_eligibility_revalidation`
- canonical source version: `20260906010000`
- live recorded statement count: `1`
- live recorded statement MD5: `6ddb7d5d141e7cb3a454fa7e6ca1280d`
- live recorded statement UTF-8 bytes: `17954`
- canonical/live byte identity: `TRUE`

Final fresh live postflight after closure promotion:

- `rpc_select_response(uuid,integer,uuid,integer,text,text)` definition MD5: `ea1c1c40783dbfb9eeab527c128f9dd0`;
- `rpc_list_need_candidates(uuid)` definition MD5: `1978ce1d5852cef46f94e81468d37bba`;
- Selection EXECUTE: authenticated `TRUE`, service_role `TRUE`, anon `FALSE`;
- Candidate projection EXECUTE: authenticated `TRUE`, service_role `FALSE`, anon `FALSE`;
- authenticated direct `marketplace_responses` INSERT/UPDATE/DELETE remains denied;
- `need_selections` keeps RLS enabled; authenticated has one SELECT policy and zero DML policies;
- business rows are unchanged: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`;
- historical state is unchanged: `2` SELECTED responses, `2` SELECTED `need_selections`, `2` Agreements;
- legacy open Applications remain rows rather than being rewritten: `2` SUBMITTED;
- snapshot rows remain `0`; no backfill occurred;
- both current SUBMITTED rows satisfy the new current-read `STALE` branch (`2/2`);
- D0140 inventories remain `0/0/0`;
- all RU-4B governed inventories remain `0`;
- D0140 production ALLOW remains fail-closed;
- RU-4B public Q&A remains activation blocked;
- monetization remains `FREE / 0 RSD`;
- Application AI remains gated.

The connected SQL inspection channel executes as `supabase_read_only_user`, which intentionally does not have EXECUTE on requester-only `rpc_list_need_candidates`. Therefore live authenticated RPC replay was not fabricated by changing grants or escalating that channel. The exact live function bytes/definition, authenticated grant, current live rows and prior authenticated disposable proof together establish the closure evidence without weakening production access boundaries.

## Unit verdict

`RU-5 MANUAL SELECTION ELIGIBILITY REVALIDATION` — `CLOSED / CANONICAL / LIVE / DO NOT REDO`.

The unit changes only the two admitted Selection functions. It does not rewrite historical Applications/Selections/Agreements and does not introduce a new product state.

### Explicit non-claims / separate dependencies

This closure does **not** claim or implement:

- hard calendar conflict authority;
- Agreement/shared-Dogovor redesign;
- bounded-note policy;
- D0140 production ALLOW;
- RU-4B public Q&A activation;
- monetization;
- Application AI / RU-5B.

### Safety locks that remain in force

- no D0140 production ALLOW activation;
- no RU-4B public Q&A activation;
- no paid monetization activation;
- no raw public `app_profiles` exposure;
- no direct-client write bypass where RPC authority exists;
- no fake production fallback;
- no invented ranking/note/calendar/selection policy;
- no RU-5B Application AI until the manual lifecycle dependency boundary is closed.

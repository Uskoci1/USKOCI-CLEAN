# USKOČI RU status

Current authoritative RU matrix after canonical/live/proven FASTEST/AUTO_FILL retirement and fresh live re-admission on 2026-09-06.

| Unit | Status | Current rule |
|---|---|---|
| RU-0 | CLOSED / LIVE | Do not redo unless an actual regression is proven. |
| RU-1 | CLOSED / LIVE | Worker readiness authority remains required at relevant command boundaries. |
| RU-2 | CLOSED / LIVE | Need V2 draft/Human Review authority remains canonical. |
| RU-3 | LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED | D0140 production ALLOW remains fail-closed. |
| RU-4 | CLOSED / LIVE | Do not redo owner-edit/revision closure. |
| RU-4B | LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED | Do not activate public Q&A until all governing blockers are resolved. |
| Client Data Layer | CLOSED / CANONICAL | Specialized owners remain canonical; no fake production fallback. |
| RU-5 | IN PROGRESS | Constituent units and FASTEST/AUTO_FILL retirement below are closed; aggregate RU-5 still requires bounded/preselection-note authority resolution plus full two-account/device journey proof before RU-5B admission. |
| RU-5 P0C-01 | CLOSED / LIVE | Public-safe profile projection canonical; raw `app_profiles` remains protected. |
| RU-5 P0C-02 | CLOSED / LIVE | Atomic Application submit canonical/live; no historical snapshot backfill. |
| RU-5 P0C-03 | CLOSED / LIVE | My Applications projection + withdraw canonical/live. |
| RU-5 P0D-01 | CLOSED / LIVE | Requester Candidate Projection canonical/live. |
| RU-5 Manual Selection Eligibility Revalidation | CLOSED / CANONICAL / LIVE | Current readiness/team-capacity are revalidated at Selection boundary. |
| P0D-02 Selection Semantic Idempotency | CLOSED / CANONICAL / LIVE | Durable semantic receipt + retained R05 exact-intent retry identity; no historical hash backfill. |
| P0D-03 Requester Connection Activation V1 | CLOSED / CANONICAL / LIVE / PROVEN | Narrow V1 Requester-beneficiary Selection activation is live at 0 RSD. Do not redo unless a physical regression is proven. |
| RU-5 FASTEST/AUTO_FILL retirement | CLOSED / CANONICAL / LIVE / PROVEN | Need/Application/AI price modes are `MY_PRICE|OFFERS`; Selection modes are `REQUESTER_SELECTS|BIDDING`; historical business rows were not rewritten. |
| RU-5B | NOT STARTED / GATED | Manual canonical Application contract must first satisfy the frozen aggregate RU-5 gate. |
| RU-6A | FOUNDATION ONLY / GATED BY RU-5 | Hard calendar authority and immutable Agreement snapshot remain separate. |
| RU-6B | NOT STARTED / GATED BY RU-6A | True shared multi-person Dogovor remains later. |
| RU-7 | FOUNDATION ONLY / GATED BY RU-6A/RU-6B | Deferred. |
| RU-8 | NOT STARTED / MANDATORY PROOF TRACK | Required before release closure. |

## Current canonical/live checkpoint

- governing master: `USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip` / SHA-256 `e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`
- canonical repository/branch: `Uskoci1/USKOCI-CLEAN` / `clean-alpha-backend`
- FASTEST/AUTO_FILL implementation merge: `6ee5c611fadf6861b7cc029ffda77437a847ca8c` (PR #32)
- exact predecessor proof head/run: `e7b5ce501c2b9708bd176075ab4b41575edf0832` / `34034993845` PASS
- implementation PR #32 PRE-P4 / CodeQL: `34038248027` / `34038246172` PASS
- implementation canonical PRE-P4 / CodeQL / Control-0: `34038380354` / `34038380028` / `34038380360` PASS
- Supabase project: `leqcwgzvjsxugfgzdmth`
- live Supabase: `79 / 20260906141409_clean_ru5_fastest_autofill_retirement`
- canonical source: `20260906130000_clean_ru5_fastest_autofill_retirement.sql`
- canonical raw MD5/bytes: `25bf03d6bed27d0d9af27ec65d59a63c` / `7363`
- live recorded MD5/bytes: `04466b38e780a59a7eab6f4b928544a0` / `6743`
- exact byte identity: `false`
- transport reconciliation: after removing SQL line comments and whitespace, canonical/live normalized MD5 is `c99a1ded1106ae52f2dbf47289192ce0`; executable semantics are proven equivalent; applied history remains untouched and no repair migration is required
- live constraints: Need/Application price modes `MY_PRICE|OFFERS`; Selection modes `REQUESTER_SELECTS|BIDDING`
- retired inventory: FASTEST Needs `0`; FASTEST V2 AI facts `0`; FASTEST Application snapshots `0`; AUTO_FILL Selections `0`
- live Selection/Candidate definition MD5s preserved: `4c2b68cdee2fe66facf7fe1c46cef43f` / `1978ce1d5852cef46f94e81468d37bba`
- live business rows preserved: profiles `6`; needs `6`; responses `4`; selections `2`; agreements `2`
- Edge `uskoci-ai-interview`: `ACTIVE v6`, `verify_jwt=true`, EZBR SHA-256 `012507310cd74cf9e769021aea71f8cfdd4e483406edbff0ee35e0b527e98954`; live V2 AI contract allows only `MY_PRICE|OFFERS`
- Povezivanje V1 policy remains `REQUESTER_SELECTION_V1 / REQUESTER / SELECTION / PROMOTIONAL_FREE / HEADCOUNT / 0 RSD`; activation rows remain `0`; no Worker debit or historical activation backfill
- D0140: zero policy bundles and no publication decisions; production ALLOW remains fail-closed
- RU-4B: foundation tables remain live with zero question/policy-command inventory; user-facing activation remains blocked
- monetization remains FREE / 0 RSD; no paid/wallet/checkout/packages activation is claimed

## Current RU-5 aggregate blockers

### A. Bounded / preselection note governance

Frozen RU-5 requires a bounded note and denial of preselection-note contact/payment/exact-private-location bypass content according to current policy. The only concrete numeric/regex implementation found in the implementation-ready master is under `06_DRAFT_EVIDENCE/P0_SQL_DRAFTS_V10/P0C/DRAFT_P0C_03_preselection_note_policy.sql`; draft evidence is not governing authority. The current locked public preselection Q&A contract requires a bounded configured size and deterministic privacy/contact floors, but does not owner-approve a numeric note length, regex set, block list, moderation threshold or rate. Do not invent those values. This gate is therefore `BLOCKED / DECISION-REQUIRED` for any policy-specific implementation that would require such values.

### B. Two-account/device Application journey proof

Frozen RU-5 requires a complete two-account/device journey `W03 → W04 → W05 → W06 → R05`. Existing DB/unit/integration proofs establish constituent command properties but do not by themselves prove the complete physical journey. Reconstruct the exact frozen surface/command mapping, then run the strongest available authenticated two-account proof without service-role substitution for user authority; keep automated integration proof distinct from physical device/emulator proof.

## Explicit non-claims / cursor

FASTEST/AUTO_FILL retirement does not close aggregate RU-5. It does not authorize bounded-note policy invention, Application AI, hard calendar authority, immutable Agreement Snapshot V2, shared Dogovor, D0140 production ALLOW, RU-4B public activation, HITNO or paid monetization.

Exact next cursor after this docs/provenance closure is canonical: resolve bounded/preselection-note authority without invention, then reconstruct and prove the required `W03 → W04 → W05 → W06 → R05` two-account journey. RU-5B remains gated until both aggregate blockers are physically closed.

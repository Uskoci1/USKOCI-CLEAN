# USKOČI RU status

Current authoritative RU matrix after canonical/live/proven closure of frozen-governed `P0D-03 — requester_connection_activation_v1` and canonical docs/provenance closure PR #29.

| Unit | Status | Current rule |
|---|---|---|
| RU-0 | CLOSED / LIVE | Do not redo unless an actual regression is proven. |
| RU-1 | CLOSED / LIVE | Worker readiness authority remains required at relevant command boundaries. |
| RU-2 | CLOSED / LIVE | Need V2 draft/Human Review authority remains canonical. |
| RU-3 | LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED | D0140 production ALLOW remains fail-closed. |
| RU-4 | CLOSED / LIVE | Do not redo owner-edit/revision closure. |
| RU-4B | LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED | Do not activate public Q&A until all governing blockers are resolved. |
| Client Data Layer | CLOSED / CANONICAL | Specialized owners remain canonical; no fake production fallback. |
| RU-5 | IN PROGRESS | Constituent units below remain closed; aggregate RU-5 still requires frozen-contract reconciliation/proof before RU-5B admission. |
| RU-5 P0C-01 | CLOSED / LIVE | Public-safe profile projection canonical; raw `app_profiles` remains protected. |
| RU-5 P0C-02 | CLOSED / LIVE | Atomic Application submit canonical/live; no historical snapshot backfill. |
| RU-5 P0C-03 | CLOSED / LIVE | My Applications projection + withdraw canonical/live. |
| RU-5 P0D-01 | CLOSED / LIVE | Requester Candidate Projection canonical/live. |
| RU-5 Manual Selection Eligibility Revalidation | CLOSED / CANONICAL / LIVE | Current readiness/team-capacity are revalidated at Selection boundary. |
| P0D-02 Selection Semantic Idempotency | CLOSED / CANONICAL / LIVE | Durable semantic receipt + retained R05 exact-intent retry identity; no historical hash backfill. |
| P0D-03 Requester Connection Activation V1 | CLOSED / CANONICAL / LIVE / PROVEN | Narrow V1 Requester-beneficiary Selection activation is live at 0 RSD. Do not redo unless a physical regression is proven. |
| RU-5B | NOT STARTED / GATED | Manual canonical Application contract must first satisfy the frozen aggregate RU-5 gate. |
| RU-6A | FOUNDATION ONLY / GATED BY FRESH RU-5/AGREEMENT/CALENDAR RECONCILIATION | Hard calendar authority and immutable Agreement snapshot remain separate. |
| RU-6B | NOT STARTED / GATED BY RU-6A | True shared multi-person Dogovor remains later. |
| RU-7 | FOUNDATION ONLY / GATED BY RU-6A/RU-6B | Deferred. |
| RU-8 | NOT STARTED / MANDATORY PROOF TRACK | Required before release closure. |

## Current canonical/live checkpoint

- canonical current HEAD after P0D-03 closure: `6b7d9df42b575d72b97ab2dd9cb0f45f02fda96e`
- canonical implementation merge: `e9d9fd065b0ea895dc37a32bc1707167cd3ed5ec`
- final proof head/run: `01b514289091ad9c9ced7d1d5ed4598eaa2994c5` / `34026655155` PASS
- implementation PR #28 PRE-P4 / CodeQL: `34026813290` / `34026811947` PASS
- implementation canonical PRE-P4 / CodeQL / Control-0: `34026900540` / `34026900127` / `34026900533` PASS
- closure PR #29 merge: `6b7d9df42b575d72b97ab2dd9cb0f45f02fda96e`
- closure canonical PRE-P4 / CodeQL / Control-0: `34029631265` / `34029630490` / `34029631297` PASS
- Supabase: `78 / 20260906102021_clean_p0d03_requester_connection_activation_v1`
- source canonical MD5/bytes: `e6fb0cb596b51587958b92d08b36ce98` / `25525`
- live recorded MD5/bytes: `c77a5d4c6efec10c928f38c0542e593e` / `25524`
- transport equivalence: live record omits only terminal LF; appending one LF yields canonical MD5/bytes exactly
- live function MD5s: Selection `4c2b68cdee2fe66facf7fe1c46cef43f`; Candidate `1978ce1d5852cef46f94e81468d37bba`
- Povezivanje V1 policy: `REQUESTER_SELECTION_V1 / REQUESTER / SELECTION / PROMOTIONAL_FREE / HEADCOUNT / 0 RSD`
- `connection_activations=0` after promotion; no historical backfill
- private connection tables retain RLS; direct activation-ledger SELECT denied to anon/authenticated/service_role
- business rows: `6 profiles / 6 needs / 4 responses / 2 agreements / 2 selections`
- D0140 production ALLOW remains fail-closed; RU-4B remains blocked; paid/wallet/checkout remains absent

## Current RU-5 aggregate blockers/reconciliation items

The current physical P0C-02 explicitly excluded bounded-note policy rather than inventing it. Frozen RU-5 still requires bounded note and prohibited preselection-note denial according to current policy. No new numeric length/regex/block policy may be invented from draft evidence.

The frozen RU-5 proof gate also requires a two-account device journey `W03 → W04 → W05 → W06 → R05`; current unit proofs do not by themselves establish that complete device journey.

Current schema/Selection code still admits legacy `FASTEST/AUTO_FILL` while the frozen current RU-5 contract retires it. Current live Need rows are `OFFERS`, so retirement can be reconciled without rewriting current business rows, but historical/runtime compatibility must be inspected before any mutation.

## Explicit non-claims / cursor

P0D-03 is not hard calendar authority, calendar commitment, immutable Agreement snapshot V2, shared Dogovor, paid monetization, D0140/RU-4B activation or Application AI.

Exact next cursor: finish fresh RU-5 aggregate reconciliation. Resolve only owner-approved preselection-note semantics, prove the required two-account Application path, and reconcile retired FASTEST/AUTO_FILL admissibility. Do not admit RU-5B or invent a new unit identifier until that gate is physically satisfied.

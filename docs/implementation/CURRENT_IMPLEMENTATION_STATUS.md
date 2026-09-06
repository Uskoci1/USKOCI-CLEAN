# USKOČI current implementation status

Authoritative current status as of `2026-09-06`, after canonical/live/proven closure of frozen-governed `P0D-03 — requester_connection_activation_v1` and its docs/provenance closure PR #29.

## Current platform checkpoint

- canonical repo/branch: `Uskoci1/USKOCI-CLEAN` / `clean-alpha-backend`
- P0D-03 formal closure checkpoint SHA: `6b7d9df42b575d72b97ab2dd9cb0f45f02fda96e`; always fresh-read the branch for the moving current HEAD
- canonical implementation merge: `e9d9fd065b0ea895dc37a32bc1707167cd3ed5ec`
- final implementation/proof head: `01b514289091ad9c9ced7d1d5ed4598eaa2994c5`
- exact-head proof: run `34026655155` PASS
- implementation PR #28 PRE-P4 / CodeQL: `34026813290` / `34026811947` PASS
- implementation canonical PRE-P4 / CodeQL / Control-0: `34026900540` / `34026900127` / `34026900533` PASS
- docs/provenance closure PR #29 merge: `6b7d9df42b575d72b97ab2dd9cb0f45f02fda96e`
- closure canonical PRE-P4 / CodeQL / Control-0: `34029631265` / `34029630490` / `34029631297` PASS
- live Supabase: `78 / 20260906102021_clean_p0d03_requester_connection_activation_v1`
- canonical source: `20260906100000_clean_p0d03_requester_connection_activation_v1.sql`
- canonical raw MD5 / bytes: `e6fb0cb596b51587958b92d08b36ce98` / `25525`
- live recorded MD5 / bytes: `c77a5d4c6efec10c928f38c0542e593e` / `25524`
- transport: terminal LF omitted only; appending one LF to the live recorded statement yields canonical MD5 `e6fb0cb596b51587958b92d08b36ce98` and `25525` bytes
- live Selection definition MD5: `4c2b68cdee2fe66facf7fe1c46cef43f`
- Candidate projection definition MD5: `1978ce1d5852cef46f94e81468d37bba`
- business counts: `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`, `need_selections=2`
- Povezivanje V1 policy: `REQUESTER_SELECTION_V1 / REQUESTER / SELECTION / PROMOTIONAL_FREE / HEADCOUNT / 0 RSD`
- `private.connection_activations`: `0` historical rows after promotion; no historical Povezivanje was fabricated
- connection policy/activation tables are private, RLS-enabled; direct activation-ledger SELECT is denied to anon/authenticated/service_role

## P0D-03 closure

`P0D-03 — requester_connection_activation_v1` is **CLOSED / CANONICAL / LIVE / PROVEN / DO NOT REDO**.

- canonical Selection creates the Requester-beneficiary zero-cost V1 connection activation receipt required for a newly created Agreement in the same transaction;
- units are covered `HEADCOUNT`;
- V1 platform cost is exactly `0 RSD` (`PROMOTIONAL_FREE`);
- Worker debit is not introduced;
- task work price remains separate from platform connection cost;
- historical Agreements/Selections were not backfilled with invented activation receipts;
- P0D-02 semantic idempotency and prior Selection eligibility/candidate behavior remain preserved.

## Current locks

- production D0140 ALLOW: `FAIL_CLOSED`; policy bundle inventory remains `0`
- RU-4B public Q&A: `ACTIVATION_BLOCKED / DEFERRED`; governed production inventory remains empty
- monetization: `FREE / 0 RSD`; no paid/wallet/checkout relation introduced
- urgent production activation: unchanged/disabled
- raw cross-account `app_profiles`: forbidden
- production fake source fallback: forbidden
- Povezivanje V1 means only the narrow Requester/Selection zero-cost activation receipt now live; it does **not** imply shared Dogovor, paid monetization or broader connection-product activation
- Application AI / RU-5B remains gated until the manual RU-5 Application contract and required proof boundary are fully reconciled

## RU status summary

- RU-0 — `CLOSED / LIVE / DO NOT REDO`
- RU-1 — `CLOSED / LIVE / DO NOT REDO`
- RU-2 — `CLOSED / LIVE / DO NOT REDO`
- RU-3 — `LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED`
- RU-4 — `CLOSED / LIVE / DO NOT REDO`
- RU-4B — `LIVE FOUNDATION / ACTIVATION BLOCKED-DEFERRED`
- Client Data Layer — `CLOSED / CANONICAL / DO NOT REDO`
- RU-5 — `IN PROGRESS`; constituent closed units remain closed, but aggregate RU-5 is not yet closed
- RU-5 P0C-01 — `CLOSED / LIVE / DO NOT REDO`
- RU-5 P0C-02 — `CLOSED / LIVE / DO NOT REDO`
- RU-5 P0C-03 — `CLOSED / LIVE / DO NOT REDO`
- RU-5 P0D-01 — `CLOSED / LIVE / DO NOT REDO`
- RU-5 Manual Selection Eligibility Revalidation — `CLOSED / CANONICAL / LIVE / DO NOT REDO`
- P0D-02 Selection Semantic Idempotency — `CLOSED / CANONICAL / LIVE / DO NOT REDO`
- P0D-03 Requester Connection Activation V1 — `CLOSED / CANONICAL / LIVE / PROVEN / DO NOT REDO`
- RU-5B — `NOT STARTED / GATED`
- RU-6A — `FOUNDATION ONLY / GATED BY FRESH RU-5/AGREEMENT/CALENDAR RECONCILIATION`
- RU-6B — `NOT STARTED / GATED BY RU-6A`
- RU-7 — `FOUNDATION ONLY / GATED BY RU-6A/RU-6B`
- RU-8 — `NOT STARTED / MANDATORY PROOF TRACK`

## Fresh RU-5 reconciliation findings

The next admitted work remains RU-5 aggregate reconciliation before RU-5B/RU-6A admission.

Current physical P0C-02 intentionally did not invent or activate the frozen-plan bounded/preselection-note policy. The frozen RU-5 contract still requires a bounded Prijava note and prohibited-note denial according to current policy, plus the required two-account device path `W03 → W04 → W05 → W06 → R05`. These requirements are not yet sufficient to claim aggregate RU-5 closure.

The current physical schema/code also retains legacy `FASTEST/AUTO_FILL` admissibility even though the frozen current RU-5 contract retires that path. Live business rows currently use `OFFERS`; retirement must be reconciled narrowly without rewriting history or inventing broader product behavior.

## Explicit non-claims and exact continuation cursor

P0D-03 does not close hard calendar conflicts/commitments, immutable Agreement task/location snapshot V2, shared multi-person Dogovor/group-private channels, D0140/RU-4B activation, paid monetization, reviews, push, maps, identity-provider runtime or Application AI.

Exact continuation cursor: complete the fresh RU-5 aggregate reconciliation against frozen authority and current physical code/live state. Resolve only owner-approved note-policy semantics; do not invent numeric/pattern policy values. Prove the required two-account Application path and reconcile retired FASTEST/AUTO_FILL admissibility before admitting RU-5B. Do not invent a new P0D/RU identifier.

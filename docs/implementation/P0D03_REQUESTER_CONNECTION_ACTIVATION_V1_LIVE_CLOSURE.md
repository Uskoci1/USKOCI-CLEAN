# P0D-03 Requester Connection Activation V1 — Live Closure

Date: `2026-09-06`

## Verdict

`P0D-03 — requester_connection_activation_v1` = **CLOSED / CANONICAL / LIVE / DO NOT REDO** once this docs/provenance closure payload is merged to canonical and its canonical push gates pass.

## Implementation proof and promotion

- final implementation/proof head: `01b514289091ad9c9ced7d1d5ed4598eaa2994c5`
- exact-head proof run: `34026655155` PASS
- earlier locked proof provenance: `06c60587b6af992d987052a4373f1cc8294df969` / run `34026374264` / artifact `9987204281`
- implementation PR: `#28`
- PR #28 PRE-P4: `34026813290` PASS
- PR #28 CodeQL: `34026811947` PASS
- implementation canonical merge: `e9d9fd065b0ea895dc37a32bc1707167cd3ed5ec`
- canonical PRE-P4: `34026900540` PASS
- canonical CodeQL: `34026900127` PASS
- canonical Control-0: `34026900533` PASS

## Live evidence

- project: `leqcwgzvjsxugfgzdmth`
- migration: `78 / 20260906102021_clean_p0d03_requester_connection_activation_v1`
- canonical source: `20260906100000_clean_p0d03_requester_connection_activation_v1.sql`
- canonical MD5 / bytes: `e6fb0cb596b51587958b92d08b36ce98` / `25525`
- live recorded statement MD5 / bytes: `c77a5d4c6efec10c928f38c0542e593e` / `25524`
- live terminal LF: false
- live statement plus exactly one terminal LF: MD5 `e6fb0cb596b51587958b92d08b36ce98` / `25525` bytes
- conclusion: connected migration transport omitted only the terminal LF; canonical/live executable content is identical and no forward repair is required
- live Selection definition MD5: `4c2b68cdee2fe66facf7fe1c46cef43f`
- Candidate definition MD5 unchanged: `1978ce1d5852cef46f94e81468d37bba`

## Povezivanje V1 contract now live

- policy key/version: `REQUESTER_SELECTION_V1 / 1`
- beneficiary: `REQUESTER`
- activation reason: `SELECTION`
- charge mode: `PROMOTIONAL_FREE`
- unit basis: `HEADCOUNT`
- platform cost: `0 RSD`
- `private.connection_policy_versions`: one V1 policy row
- `private.connection_activations`: `0` historical rows immediately after promotion; no historical Povezivanje was fabricated
- both private tables are RLS-enabled
- direct `connection_activations` SELECT for anon/authenticated/service_role is denied
- a new Agreement created through canonical Selection must have its matching immutable activation receipt in the same transaction
- Worker debit is not introduced
- task work price remains separate from platform connection cost

## Preserved history and safety locks

- business rows remain `app_profiles=6`, `needs=6`, `marketplace_responses=4`, `agreements=2`
- Selection history remains `2` selections / `2` Agreements; open legacy Applications remain `2 SUBMITTED`
- D0140 production ALLOW remains fail-closed; publication policy bundles remain `0`
- RU-4B public Q&A remains activation-blocked; current governed question inventory remains `0`
- paid/wallet/checkout relations remain absent
- Application-AI authority remains absent/gated

## Non-claims

This closure does **not** claim or implement paid monetization, wallet/checkout/packages, Worker debit, hard calendar conflict authority, calendar commitment, immutable Agreement task/location snapshot V2, shared multi-person Dogovor/group-private channel model, D0140 production ALLOW, RU-4B public Q&A activation, Application AI/RU-5B, reviews, push delivery, maps, or identity-provider runtime.

## Continuation cursor

Do not invent another P0D/RU identifier from this closure. Fresh-read the frozen dependency plan and current physical Agreement/calendar state before admitting the next unit. P0D-03 itself must not be redone unless a physical regression is proven.

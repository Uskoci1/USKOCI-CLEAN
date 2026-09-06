# USKOČI — RU-5 TWO-ACCOUNT AUTHENTICATED JOURNEY PROOF CLOSURE

Date: `2026-09-06`

This document closes the **automated authenticated two-account integration proof** portion of the frozen RU-5 aggregate gate. It does **not** close the separate bounded/preselection-note governance gate or the separate physical mobile device/UI proof gate.

## Canonical context

- governing master: `USKOCI_ONE_MASTER_IMPLEMENTATION_READY_2026-09-03.zip`
- master SHA-256: `e063b050dd673485ebb9b1d3e3a556fb0c88dbdda4bacc95eacbf760a31ae988`
- canonical repository/branch: `Uskoci1/USKOCI-CLEAN` / `clean-alpha-backend`
- prerequisite W03→W04 client-routing fix canonical merge: `bc49e8ae423b91b37321787e1dc3a1dada90583e` (PR `#34`)
- two-account proof PR: `#35`
- proof branch final head: `bedca53d2d0bff336a2ea912b3489f4fbf5402aa`
- canonical proof merge: `55f218d1f2cd9a79fdaba9b8c058e92664be758f`

## Proof environment

The proof runs against a disposable local Supabase stack reconstructed to the current live-equivalent migration state:

`79 / 20260906141409_clean_ru5_fastest_autofill_retirement`

The journey uses **two distinct real GoTrue Auth sessions** through publishable/anon clients:

- Worker/Uskočer session for marketplace opportunity/application actions;
- Requester/Naručilac session for candidate projection and selection.

Service/admin authority is not used as a substitute for either marketplace identity. Any elevated access is restricted to disposable fixture support and server-side verification.

## Frozen journey proven

Automated proof run `34045287333` / job `101519151761` completed `SUCCESS` and proves:

1. `W03` public opportunity read;
2. `W04` exact Need read;
3. `W05` authenticated `rpc_submit_response`;
4. same submit key + same payload replay succeeds;
5. same submit key + changed payload is denied;
6. `W06` own-Application projection is available to the Worker;
7. `R05` candidate projection is Requester-owner-only;
8. the exact submitted Application version/hash is selectable;
9. `R05` authenticated `rpc_select_response` succeeds;
10. P0D-02 Selection semantic replay remains valid;
11. W06 reload reflects selected state;
12. P0D-03 remains exactly `REQUESTER_SELECTION_V1 / REQUESTER / SELECTION / PROMOTIONAL_FREE / HEADCOUNT / 0 RSD`;
13. postflight leaves zero external/production residue.

The proof explicitly reports:

`PASS RU5_TWO_ACCOUNT_AUTH_JOURNEY ... disposable_local_db_only bounded_note_not_claimed device_ui_not_claimed`

and:

`PASS RU5_TWO_ACCOUNT_AUTH_JOURNEY_POSTFLIGHT live79 gated_features_unchanged disposable_zero_external_residue`

## Regression and canonical gates

Proof-branch run:

- two-account journey: PASS
- TypeScript `tsc --noEmit`: PASS
- regression suite: `23/23` suites PASS, `146/146` tests PASS

PR `#35` gates:

- PRE-P4 `34045560199`: PASS
- CodeQL `34045558347`: PASS

Post-merge canonical gates on `55f218d1f2cd9a79fdaba9b8c058e92664be758f`:

- PRE-P4 `34045636959`: PASS
- CodeQL `34045636726`: PASS
- Control-0 `34045636967`: PASS

## Fresh live postflight

Fresh read-only live preflight/postflight after canonical proof merge confirms production remained unchanged:

- Supabase migration count/head: `79 / 20260906141409_clean_ru5_fastest_autofill_retirement`
- `app_profiles=6`
- `needs=6`
- `marketplace_responses=4`
- `need_selections=2`
- `agreements=2`
- D0140 `publication_policy_bundles=0`
- D0140 `need_publication_decisions=0`
- RU-4B questions/answers/policy decisions/materiality decisions/commands: all `0`
- `private.connection_activations=0`

Therefore this proof introduced no production business rows, no activation rows, no publication policy, no RU-4B activation and no monetization side effect.

## Status effect

The former combined blocker **“two-account/device journey proof”** is now split correctly:

- **Automated two-account authenticated integration proof** — `CLOSED / CANONICAL / PROVEN`.
- **Physical mobile device/emulator UI proof** — `OPEN / NOT EXECUTED`; no Maestro/Detox-equivalent physical click-through proof is currently present and no device proof is claimed.
- **Bounded/preselection-note governance** — `BLOCKED / DECISION-REQUIRED`; concrete numeric/regex/block-list policy values remain unapproved and must not be invented from draft evidence.

Aggregate `RU-5` therefore remains `IN PROGRESS`. `RU-5B` remains gated.

## Explicit non-claims

This closure does not authorize or claim:

- bounded/preselection-note numeric or regex policy values;
- physical device/UI journey completion;
- Application AI / RU-5B admission;
- D0140 production ALLOW;
- RU-4B public activation;
- hard calendar conflict authority;
- immutable Agreement Snapshot V2;
- shared multi-person Dogovor;
- HITNO activation;
- wallet/checkout/packages or paid monetization.

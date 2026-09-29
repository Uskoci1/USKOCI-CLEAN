# Round68 — deployable P6 rollout v2 (frozen rollout + proven visibility and PLACES cost layers)

Status: **SOURCE + DISPOSABLE PROOF PASS. NOT APPLIED to canonical DEV. NOT native-accepted.** P6 remains OPEN.

## Why this exists
The frozen rollout `p6_discovery_rollout.sql` (sha256 `ce1dab6b…`) does not contain the two cost layers that make the 30k SQL screening
green (Round67, run 36632921473): the visibility layer `p6_discovery_visibility_cost_v1.sql` (`a988f403…`) and the PLACES layer
`p6_discovery_places_cost_v1.sql` (`9297c4a1…`). Both layers are guarded as disposable-only, so neither could be applied to a real
target. Codex's handoff requires that they be covered by an explicit rollout/provenance package, never slipped in.

## What was built (ownership: local Claude session, per the owner's P6 handoff of 2026-09-30)
- `scripts/proofs/build-p6-rollout-v2.mjs` composes `supabase/candidates/p6_discovery_rollout_v2.sql` deterministically from the three
  sha256-pinned inputs (CRLF normalised to LF, as CI checks them out). The frozen file is never edited: its bytes appear unchanged except
  the final `commit;`. The layers change in exactly one place — the disposable-only guard becomes a postgres-only guard, because the
  rollout's own preconditions (PKG045b restricted Need ACL, certificate ready, not already installed) now protect the transaction.
  `--check` proves the committed file equals the composition.
- v2 adds postconditions: certificate/erasure digests and Need ACL unchanged, PLACES branch present in `rpc_discovery_v1`, RLS helper present,
  `public.needs` policy count still 6.
- `supabase/proofs/discovery/p6_rollout_v2_candidate_proof.mjs` + workflow `p6-rollout-v2-proof.yml`.
- `supabase/proofs/discovery/p6_rollout_v2_live_observation.json`: fresh read-only DEV metadata (ledger 210, `rpc_discovery_v1` absent,
  visibility helper absent, authenticated AND anon still hold whole-table SELECT on `needs`, PKG045b not applied).

## Evidence
Run **36640264441**, source `09665f780e2bab1a4de5a685c5375d728a7824f7`, v2 sha256 `da01a4f1bd6454a8229c2d7c3fdcc951e944d0af69d4e99fc637d42f8c72f346`.
On a disposable historical target replayed through PKG045b (real Supabase CLI 2.116.0 stack):
- predecessor `needs_public_discovery` and `v5_closed_account_visibility` predicate hashes equal canonical DEV's (the disposable really mirrors DEV);
- the source-only proven stack (base + cost v2 + v3 + visibility + PLACES, rolled back) and the v2 candidate give **identical** bodies for the seven
  P6 functions, identical predicate hashes for the two policies and an identical RLS helper definition;
- certificate, erasure certificate, closure digest and the Need ACL are byte-unchanged; policy count stays 6;
- all seven P6 functions are SECURITY INVOKER with `search_path=pg_catalog`, EXECUTE for authenticated only (anon/service_role none);
  the helper `rls_private.p6_discovery_test_world_accounts()` is the one deliberate SECURITY DEFINER (stable, fixed search path, authenticated-only, non-API schema);
- a second application is refused (`P6_ROLLOUT_ALREADY_INSTALLED`) with no drift.

Expected final md5 values for a DEV readback after a future apply: `rpc_discovery_v1` `1c60224483697732c496df5b9207f08f`
(the other six equal Round56's), policy `needs_public_discovery` `7d2b4a721dfb96bc3a5cac893aefe939`,
`v5_closed_account_visibility` `27782111557095551c5a184087afd5bc` (md5 of `pg_policies.qual`). Full receipt: `ROUND_68_P6_ROLLOUT_V2_CHECKS.json`.

## Fresh DEV preflight facts relevant to PKG045b (read-only, metadata only)
Only five RLS policies (`response_versions_read`, `responses_requester_read`, `need_geography_owner_read`,
`need_requirement_details_owner_read`, `need_sensitive_owner`) reference the three internal `needs` columns — exactly the five owner
predicates PKG045b already replaces — and the one invoker function that mentions them (`rpc_resolve_activity_event`) reads only `needs.id`
and uses `is_my_task`. No client source under `src/` names the three restricted columns; the one direct `needs` read
(`ru4Production.remainingSearchState`) selects an allowed column.

## Limits (read before quoting)
Nothing here changes canonical DEV. The 1000 ms SQL screening remains diagnostic, not an SLA. The earlier real-Auth/PostgREST 11-group proof
(Round56) covers the frozen part; the visibility truth table runs inside the candidate transaction; real-client behavior on this exact stack is
the separate native journey (in progress). The owner's 2026-09-30 blanket approval is recorded for the eventual apply, which still requires a
fresh preflight, PKG045b first, and byte/hash/ACL readback.

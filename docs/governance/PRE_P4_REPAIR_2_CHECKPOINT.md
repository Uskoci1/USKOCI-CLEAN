# PRE-P4 Repair 2 checkpoint

## What changed

The ambiguous `needs_participant_read` policy created by migration
`20260830194000_clean_p2_read_layer_repair.sql` was replaced through two forward-only
migrations:

1. `20260831110153_clean_pre_p4_participant_rls_repair.sql` introduced the explicit
   outer-Need correlation and a caller-bound participant predicate.
2. `20260831110701_clean_pre_p4_participant_rls_execution_contract.sql` corrected the
   helper execution boundary discovered during post-DDL verification. The final helper
   is `public.fn_need_participant_can_read(uuid)`, accepts no account identifier, and is
   executable only by `authenticated`.

The first migration remains mirrored because it was applied. It was not edited or
removed after the execution-contract defect was discovered.

## Why

PostgreSQL had parsed the 194000 subqueries as `a.need_id = a.id` and
`s.need_id = s.id`, so they were not correlated to the outer Need. The final policy now
passes the outer Need primary key as a top-level `VAR varno=1 varattno=1` to a
security-definer predicate. The predicate checks only `auth.uid()` against:

- a `SELECTED` selection; or
- a `CONFIRMED`/`COMPLETED` Agreement.

Cancelled and superseded relationships do not qualify. Requester ownership and
PUBLISHED/SELECTION discovery policies were not changed.

## Files and migrations

- `supabase/migrations/20260831110153_clean_pre_p4_participant_rls_repair.sql`
- `supabase/migrations/20260831110701_clean_pre_p4_participant_rls_execution_contract.sql`
- `supabase/migrations/MD5_MANIFEST.txt`
- `supabase/migrations/MIGRATION_PROVENANCE.json`
- `supabase/migrations/check_migration_integrity.py`

## Tests and proof

- Canonical migration/live snapshot: 46 files = 46 live migrations.
- Static contract: explicit `public.needs.id`, caller-bound `auth.uid()`, participant
  statuses, and authenticated-only function grant are asserted by the integrity check.
- Live `pg_get_functiondef`: matches the intended agreement/selection predicate.
- Live policy parse tree: participant argument is the outer Need `id`
  (`VAR varno=1 varattno=1`), not an inner alias.
- Live privileges: `authenticated EXECUTE=true`; `anon=false`; `PUBLIC=false`.
- Live owner/discovery policies: unchanged.
- Business rows after DDL: 6 Needs / 4 Responses / 2 Agreements / 4 Profiles.
- Local checks: migration integrity, TypeScript, 5/5 Jest suites and 34/34 tests pass.

## Open proof gap

The configured SQL connector runs as `supabase_read_only_user` with `BYPASSRLS` and is
not permitted to `SET ROLE authenticated`. It therefore cannot honestly prove the
wrong-user/selected-worker/requester matrix. No authenticated user JWT is configured in
the canonical repository or tool connection.

Required final matrix:

- unrelated authenticated worker cannot read an ACTIVE Need;
- selected/Agreement worker can read its ACTIVE Need;
- requester can read its own Need;
- PUBLISHED/SELECTION discovery remains visible;
- cancelled/superseded worker receives no participant visibility.

Until that matrix executes through real authenticated sessions:

- `PARTICIPANT_RLS = DB_PROVEN / AUTHENTICATED_RUNTIME_PROOF_REQUIRED`
- `REPAIR_2 = NOT YET FULL PASS`
- `READY_FOR_REPAIR_3 = NO`
- `PACKAGE_4 = NOT STARTED`

# PRE-P4 Repair 2 checkpoint

## What changed

The ambiguous `needs_participant_read` policy created by migration
`20260830194000_clean_p2_read_layer_repair.sql` was replaced through three forward-only
migrations:

1. `20260831110153_clean_pre_p4_participant_rls_repair.sql` introduced the explicit
   outer-Need correlation and a caller-bound participant predicate.
2. `20260831110701_clean_pre_p4_participant_rls_execution_contract.sql` corrected the
   helper execution boundary discovered during post-DDL verification. The final helper
   at that historical point was executable only by `authenticated`.
3. `20260831114338_clean_pre_p4_participant_rls_authenticated_proof.sql` moved the
   helper out of the exposed `public` API schema, added the two predicate indexes, and
   executed the owner/participant/unrelated/discovery matrix as the actual PostgreSQL
   `authenticated` role in the same transaction.

The first migration remains mirrored because it was applied. It was not edited or
removed after the execution-contract defect was discovered.

## Why

PostgreSQL had parsed the 194000 subqueries as `a.need_id = a.id` and
`s.need_id = s.id`, so they were not correlated to the outer Need. The final policy now
passes the outer Need primary key to
`rls_private.need_participant_can_read(uuid)`. This non-exposed security-definer
predicate accepts no account identifier and checks only `auth.uid()` against:

- a `SELECTED` selection; or
- a `CONFIRMED`/`COMPLETED` Agreement.

Cancelled and superseded relationships do not qualify. Requester ownership and
PUBLISHED/SELECTION discovery policies were not changed.

## Files and migrations

- `supabase/migrations/20260831110153_clean_pre_p4_participant_rls_repair.sql`
- `supabase/migrations/20260831110701_clean_pre_p4_participant_rls_execution_contract.sql`
- `supabase/migrations/20260831114338_clean_pre_p4_participant_rls_authenticated_proof.sql`
- `supabase/migrations/MD5_MANIFEST.txt`
- `supabase/migrations/MIGRATION_PROVENANCE.json`
- `supabase/migrations/check_migration_integrity.py`

## Tests and proof

- Canonical migration/live snapshot: 47 files = 47 live migrations.
- Static contract: explicit `public.needs.id`, caller-bound `auth.uid()`, participant
  statuses, and authenticated-only function grant are asserted by the integrity check.
- Live `pg_get_functiondef`: matches the intended agreement/selection predicate.
- Live policy parse tree: participant argument is the outer Need `id`
  (`VAR varno=1 varattno=1`), not an inner alias.
- Live privileges: `authenticated` has only schema `USAGE` and function `EXECUTE`;
  it has no schema `CREATE`; `anon` and `PUBLIC` have neither privilege.
- The old public helper is absent, and the Supabase Security Advisor no longer reports
  the participant helper as an authenticated-callable exposed SECURITY DEFINER RPC.
- Transactional authenticated proof used the two existing accounts: the Agreement
  worker saw its ACTIVE Need and the requester saw the owned Need. A generated JWT
  subject with no ownership/selection/agreement saw zero ACTIVE rows and exactly all
  four PUBLISHED/SELECTION discovery rows.
- Both participant lookup indexes exist.
- Live owner/discovery policies: unchanged.
- Business rows after DDL: 6 Needs / 4 Responses / 2 Agreements / 4 Profiles.
- Local checks: migration integrity, TypeScript, 5/5 Jest suites and 34/34 tests pass.

## Final classification

- `PARTICIPANT_RLS = PASS / AUTHENTICATED_DATABASE_RUNTIME_PROVEN`
- `REPAIR_2 = PASS`
- `READY_FOR_REPAIR_3 = YES` after the canonical Git push and runner-backed PRE-P4
  workflow both succeed
- `PACKAGE_4 = NOT STARTED`

No third real account exists in live data. The wrong-user case therefore used an
authenticated-role JWT subject that is proven absent from all ownership and participant
relations; it did not create a user or fixture. Cancelled/superseded denial is enforced
by the exact status predicate and remains without a live row fixture.

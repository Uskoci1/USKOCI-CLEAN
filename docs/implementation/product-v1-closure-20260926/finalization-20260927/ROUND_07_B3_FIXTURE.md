# Round 07 — B3 canonical participant proof fixture

Status: SOURCE FIXED; Node syntax PASS; disposable SQL rerun pending. No candidate SQL, schema, DEV, Edge, provider, certificate or workflow change.

## Evidence

CI `36310983457`, preserved in `ROUND_07_B3_CI_SECOND.log`, passed the B3a paging, scope, exact ACK/no-partial-write, photo metadata and restricted-account checks, then failed at `2026-09-27T10:00:49.9698058Z`: setting `agreements.requester_account_id` to NULL violated NOT NULL. B3b was not reached.

The fixture incorrectly treated the intermediate `20260830173000_clean_authoritative_mutation_boundary.sql` nullable schema as current. `20260830174000_clean_repair_authority_boundary.sql:29–32` restores NOT NULL on both account/profile pairs, and restores ON DELETE RESTRICT. The later closure guard also rejects a NULL requester. Source search found no later removal of these account-column NOT NULL constraints in migrations or the DEV-alpha ledger. Disabling ordinary triggers did not make this fixture valid; [PostgreSQL's NOT NULL constraint](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-NOT-NULL) still prohibits the row.

## Correction

Only `supabase/proofs/chat/private_history_read_proof.mjs` and `message_window_proof.mjs` changed:

- Removed `legacyParticipants` and its participant trigger-bypass writes. No constraints are relaxed and no NULL Agreement is manufactured.
- Assert the actual `pg_attribute.attnotnull` values for both account columns. Attempt ordinary requester, worker and both-NULL updates; require the specific closure/NOT NULL refusals and unchanged Agreement rows/trigger definitions, read effects and closure state.
- Record `nullParticipantCoverage.status = NOT_APPLICABLE_CANONICAL_NOT_NULL` and `runtimeNullParticipantPathTested = false`. A nullable schema now fails the canonical-schema assertion instead of silently claiming coverage.
- Keep actual requester and worker positive membership, outsider refusals and B3a's two exact event ACKs. Existing partial-batch rejection, event isolation, B3b read/delivery immutability and photo-link refusal checks remain. B3b's separate metadata-only attachment-link fixture is unchanged.

## Validation and limits

`node --check` passed for both proof files. Scoped `git diff --check` passed. No proof, SQL, tests, CI, build or provider execution was performed for this correction; no commit/push occurred.

NULL-participant membership remains conditional source defense, **not runtime-proven coverage** in this canonical predecessor. This change does not establish any nullable production state, perform account erasure, or prove DEV application. The next disposable CI run must establish the replacement negative proof and all later B3a/B3b assertions.

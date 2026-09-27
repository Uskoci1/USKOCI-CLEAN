# B3c — disposable recertification and full account erasure

Date: 2026-09-27. **Prepared; the new CI execution has not yet been verified.** The owner authorized certificate rebinding only on a disposable test database. No B3c application or certificate rebinding on DEV is authorized or performed by this package.

The basis remains the Round16 package, Round18 SQL/Auth rollback receipt, and Round20 actual Realtime PASS from run `36336794390`, source `601d78f6542b8ac2bc1665f4286b2cb69e4c09fe`. That candidate's SHA256 was `06a0cd600c8d2726f4e58a48a5705497ef7799978043d53ae997803c094a33f2`. The historical result does not prove the new files.

## Exact scope

- The B3c candidate's SQL behavior is unchanged; comments distinguish the historical proofs from the new, separately authorized phase. Installation still leaves certificates unchanged.
- The existing SQL/Auth and Realtime phases run again on the same commit. Realtime passes only the SHA256 of the complete catalog, both certificates, readiness definition and metadata, publications, dataset catalog, and migration history. The new reader must observe an identical snapshot.
- `chat_b3c_disposable_recertification_proof.sql` accepts only the explicit disposable mode and an independently checked local connection. The old accepted digest and the new proven digest come from that preceding snapshot; the SQL does not accept arbitrary current state as a new baseline.
- One transaction changes only `private.closure_source_v5.sha256`, `private.closure_erasure_source_v5.sha256`, and one constant in `private.retention_ai_source_ready()`. All function metadata except the expected body, other certificate fields, other functions, schema, privileges, publications, dataset catalog, and migration history must remain unchanged. Readiness must become true, and the erasure binding must carry the same new digest.
- Missing or unknown admission, an incorrect expected digest, disagreeing certificates, an additional table, a broadened policy, DELETE publication, or changed readiness metadata must be refused without leaving changes behind. A second rebind is refused. Later schema, policy, publication, or metadata changes must invalidate readiness and the binding again.

## Actual closure flow and the separate synthetic row

Six fresh local Auth accounts establish three independent Agreements. Messages, selection, Agreement cancellation, and task cancellation use the existing canonical commands. Ordinary cancellation must remove the invalidation cache.

Because the ordinary flow already deletes the cache, postgres then inserts an **explicitly synthetic residual body-free row** for each of the two terminal Agreements. This makes the erasure DELETE assertion non-vacuous. No triggers, RLS, or existing guards are disabled.

Before rebinding, the owned closure review must return `CLOSURE_POLICY_NOT_READY`. Afterwards, the actual unchanged closure worker runs from canonical start through `CLOSED`, once for a requester account and once for a worker account. Replaying start must not create a new generation. Required outcomes are:

- a verified erasure step for the invalidation table with exactly one affected row;
- erasure of the account's own message and cancellation reason, with the counterpart's message preserved;
- Auth soft erasure, cleared personal identity, and zero remaining sessions;
- canonical refusal of the old session, with a successful call to the same reader for an unrelated account;
- an unchanged third Agreement, its messages, cache, profiles, and identities;
- an unchanged final certified catalog and migration history.

The fixture has no media objects; there are no Storage or provider calls. This is not a new proof of Storage deletion, load, concurrent changes, or every historical content shape.

## Execution and boundaries

The existing workflow gains a third phase bounded to 600 seconds. It retains manual dispatch without arbitrary inputs, the narrow push trigger for the existing workflow file on the canonical working branch, exact `GITHUB_SHA` binding, private raw logs outside the upload path, and `always()` teardown without a backup. Uploads contain only bounded reports, stages, and source hashes. The new report requires 11 checks; its PASS remains to be verified in CI.

Local checks passed for JavaScript syntax, YAML, Bash syntax of every workflow run block, the upload and teardown boundary, and six executed refusals before IO. The refusals cover a remote API, remote database, mismatched DB alias, `PGHOSTADDR`, `PGSERVICE`, and `PGOPTIONS`. No local SQL or closure runtime PASS is claimed. Root handles commit, push, and the exact CI run.

The new files are `private_invalidation_catalog_snapshot.mjs`, `chat_b3c_disposable_recertification_proof.sql`, and `private_invalidation_closure_proof.mjs` under `supabase/proofs/chat/`. The existing candidate, wire harness, and workflow change only within the scope above. Committed migrations, clients, and DEV are unchanged. Passing this test would not itself authorize DEV recertification or runtime subscriptions.

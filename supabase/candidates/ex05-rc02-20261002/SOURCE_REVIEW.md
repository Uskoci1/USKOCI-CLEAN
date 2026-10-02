# RC02 source candidate and exact revert

Status: SOURCE PREPARED / NOT APPLIED / NOT EXECUTED. No database connection, test run, server write, canonical-repository edit, dependency change or device action was performed. These files are review artifacts, not a migration or authorization to apply.

Baseline source: repository HEAD `2adca787b45954dd3e662c4fd60a50f5d1e97d40`. The complete cancel body was reconstructed from `supabase/candidates/pkg046a_media_upload_cancellation.sql`, normalized to LF, with its single literal `'40001'` changed to `'PT409'` as applied by B24. Its MD5 exactly matches the existing EX05-S02 recorded DEV pin. This establishes source provenance, not a fresh live read. A future authorized application must obtain a new read-only preflight and stop on any drift.

- Baseline prosrc MD5: `bf8c24310252386d06de269fe7bc385a`.
- Baseline prosrc SHA-256: `ac6155460e1bea19612b066ead892764430de82715d5fabb148c04a7f9d6ae4c`.
- Proposed prosrc MD5: `043f8cfb2cbe68e6f791e1be23ca14cc`.
- Proposed prosrc SHA-256: `5efbc842a2790e3baabe393e17051ebc54fcdfdf9d7a90424d18722a3842f0d0`.

## Exact change and source review

Only `public.rpc_cancel_media_upload(uuid,uuid)` changes. Four lines are inserted after its existing per-command advisory lock and before its asset row lock: two explanatory comments, a conversation `FOR UPDATE` re-read and the same existing ownership/purpose/schema refusal. The original early validation remains. Everything else in its body is byte-identical, including PT409, JSON keys, tombstones, READY removal, not-ready deselection, scope checks and closure guard. No status/editability check is added: a closed intake conversation can still retire an unconfirmed command as before.

The relevant order becomes shared closure guard -> upload-command advisory -> conversation row -> asset row. The remove writer and completion retry already lock conversation before asset. The claim's first-send path takes advisory before conversation. Therefore the conversation lock belongs AFTER the existing advisory lock. Adding `FOR UPDATE` only to the original early conversation read, as the old proof's diagnostic positive control does, would invert the claim's advisory/conversation order for an absent command: claim holds advisory and waits for conversation while cancel holds conversation and waits for advisory. This is a source-derived potential cycle, not a newly executed finding. The candidate avoids it.

Source references: original cancel at `supabase/candidates/pkg046a_media_upload_cancellation.sql:181`; claim's PKG046 tombstone insertion at the same file:149; base claim, completion and removal at `supabase/migrations/20260912224647_clean_v5_owned_media.sql:84`, `:138`, `:227`; diagnostic PC1 at `supabase/proofs/ex05/ex05_s02_sql.mjs:304`.

## Boundaries and behavioral risks

1. Every valid TASK cancellation now waits for its conversation lock, including PROCESSING/STAGED/FAILED, absent-command tombstones and repeated CANCELLED commands. Previously those branches did not lock the conversation. Serialization/wait timing changes intentionally; do not carry the old non-READY T9 no-conversation-wait expectation forward as acceptance. Only READY paths need the lock for the reproduced inversion, but unconditional acquisition avoids a racy pre-read of asset state and a second lock-order algorithm.
2. If ownership/purpose/schema changes or the conversation disappears while waiting, the second validation returns the existing MEDIA_NOT_FOUND refusal against the locked current row. It does not continue using the stale conversation copy. Ordinary valid-call outputs/actions remain unchanged.
3. Existing in-flight transactions may retain the old function body/lock sequence until they end. Replacing the function is not proof of an immediately deadlock-free live system; no session termination is proposed or authorized.
4. Revert restores the exact old function body and therefore restores the known READY lock inversion. It is an emergency rollback artifact, not a desirable end state. Both scripts reject a mismatching body rather than overwrite later work.
5. The proposed order has been source-reviewed against the pinned siblings. It has NOT received a new disposable concurrency run, SQL execution, live verification or device acceptance. Existing run 36994974880 reproduced F1/F2; it did not validate this candidate. No claim of eliminating every possible deadlock is made.

## Artifacts and guards

- `rc02_candidate.sql`: single transactional gated replacement; requires exact before-body pin and six neighboring function pins. Reads the current `pg_get_functiondef` and replaces only the exact unique anchor. Asserts exact new body and unchanged complete non-body pg_proc tuple plus comment. No ACL, signature, owner, security, config, schema, data or certificate edits.
- `rc02_revert.sql`: same guards in reverse; accepts only the exact candidate body and recreates the baseline body byte-for-byte.
- `rc02_preflight.sql`: read-only current function pins, metadata, live definition and closure certificate/readiness checks; not executed here. Capture its results before any authorized application. Missing/false pins are a stop, not a reason to relax the gate.
- `baseline.prosrc.txt` and `candidate.prosrc.txt`: exact bodies for review, not standalone executable SQL.
- `body.diff`: full four-line delta.
- `manifest.json`: source HEAD, repository file hashes/Git blobs, body hashes and artifact SHA-256 values. `prepare_rc02.py` only reads repository files and emits scratch artifacts; it neither connects to a database nor runs a test.

Candidate and revert require the live closure digest to equal both stored bindings with retention source ready, then require those same values/readiness after replacement. They never rebind a certificate. The historical EX05 digest/ledger count is not assumed current. Execute only in a serialized server-change window; concurrent unrelated DDL is outside this package's compare-and-replace guarantee.

The source reasoning follows PostgreSQL's documented recommendation to acquire locks in a consistent order: https://www.postgresql.org/docs/current/explicit-locking.html. Supabase skill guidance was read; its normal execute/test workflow was not invoked because this task explicitly authorizes source preparation only. AGENTS still requires the owner's named `primeni` before server application.

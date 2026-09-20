# V5 policy-bound account closure source

Candidate131: `20260912230039_clean_v5_policy_bound_closure.sql`. No live migration, policy, scheduler or worker enablement is performed by this source work.

## Supported contract and closed activation

The compiled adapter `V5_RETAINED_SUBJECT_CLOSURE_V1` closes access, deletes enumerated owned Storage objects, and calls Supabase Auth `should_soft_delete:true`. Its exact receipt is `AUTH_IDENTITY_ERASED_SUBJECT_RETAINED`: authentication credentials/metadata and sessions are erased, while the subject UUID remains for legitimate foreign-key evidence. It does not claim Auth-row hard deletion or removal of all relational personal data.

The optional `private.retention_policy_sets.account_closure_execution` binding defaults to NULL. It requires the exact adapter/source digest, current active Privacy digest, both active legal documents, every current required data class, rule-row digests, and an explicit positive finite `retentionSeconds` per class. Every supported relational action is `RETAIN_RESTRICTED`; media byte deletion is separately explicit as `DELETE_OWNED_OBJECTS`. A real policy requiring immediate relational erasure needs its actual reviewed adapter and is not silently coerced into retention. No numeric retention schedule was recovered from the owner-supplied RC2 package, so real activation stays closed.

`CLOSURE_REQUESTED` in this adapter means `closure_executions_v5.requested_at`, the actual admitted start, not an earlier P10 preparation timestamp. Due retained rules block further execution; this source does not implement their later purge. Policy changes, data-source/schema changes, active holds, open marketplace obligations, processing workflows and unsettled Storage producers block dispatch.

## Native command and recovery

`profil/privatnost` opens the full native review. The existing export, policy and permissions controls remain. The final destructive action appears only for a complete authoritative ready review. The app persists opaque owned request coordinates before sending, restores them across remount/app restart, and reads the same key first. ABSENT does not auto-submit; a user can explicitly replay only that exact stored command. Account incarnation, focus and background changes retire pending callbacks. Definitive CLOSED is shown only from a correlated server receipt. The existing local logout writer is offered for restricted or closed execution.

Client RPCs:

- `rpc_review_account_closure_execution(p_expected_user_id)`
- `rpc_start_account_closure_execution(p_expected_user_id,p_request_id,p_expected_revision,p_client_request_id,p_policy_sha256)`
- `rpc_read_account_closure_execution(p_expected_user_id,p_client_request_id)`

The old SQL121 preparation service remains separate. Its reserved EXECUTING fixtures are not upgraded into completed accounts.

## External operation fences

Each action has one account/request/generation/action/attempt identity. Dispatch is linearized under the closure and existing retention advisory locks. A later hold can stop future actions but cannot undo an already admitted external request. Exact positive evidence can settle that old attempt even after a hold; it cannot authorize a next step.

The worker performs one exact Storage DELETE and a separate authenticated object-absence read. Generic HTTP404, NoSuchBucket, transport errors and timeouts are not absence. Unknown destructive requests remain DISPATCHED; subsequent work only reads the same object/user and never blindly sends DELETE again. Completion SQL additionally checks actual Storage metadata or Auth deleted metadata/empty password/no sessions. Auth erasure cannot dispatch while owned objects or unverified Storage actions remain.

Media130 durable DISPATCHING producers block destructive cleanup. Only their definitive immutable-path/hash settlement allows progress. An unverified legacy export artifact also blocks closure, including after lease expiry or an earlier absence observation: its late remote upload is not proved quiescent.

A PostgREST pre-request hook fences old JWTs for restricted accounts; only exact owned execution-receipt reads and same-key start replay endpoints are exempt. Existing configured role hooks cause a fail-closed migration rather than overwrite. Restrictive Storage and public-table SELECT policies cover paths that do not run PostgREST's hook, including Realtime authorization. This adds no positive read grant. Actual Realtime transport remains outside the current disposable proof.

## Maintenance integration

The new `uskoci-account-closure-worker` requires service authentication. `USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED` defaults to disabled; only the exact string `true` admits worker RPCs. Calls accept either one `{accountId,generation}` or `{action:"maintenance",maxSteps:1..8}`. Maintenance reads a bounded fair service-only work list and performs at most one step per listed account, within the shared55-second transport deadline. Closed bindings return no work. Existing export/push maintenance endpoints are separate, so no new cron is installed or activated. Root can include this explicit maintenance entrypoint and the enable flag in the separately reviewed concrete live batch.

## Verification and boundaries

Local focused verification:49 native/client/journal/privacy tests and31 exact-source Edge transport tests passed. TypeScript checked after integration. `v5_account_closure_execution_proof.mjs` is the actual disposable Postgres/Auth/Storage proof source; it must run against the next exact committed131 source after130. It tests private grants, synthetic closed/open policy binding, hold locking, same-key race, actual Storage deletion with deliberately lost ACK, read-only recovery, real Auth soft erasure, old-JWT Data API denial, refresh failure and exact CLOSED replay. Its temporary policy rows/86400-second durations are explicitly synthetic fixtures, never legal content or approval. No local Postgres/Docker exists on this host; real PL/pgSQL compile and runtime remain the dedicated CI gate.

Primary implementation references: [Supabase Auth deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser), [managing user data and old JWTs](https://supabase.com/docs/guides/auth/managing-user-data), [Storage deletion API](https://supabase.com/docs/guides/storage/management/delete-objects), [PostgREST request path and pre-request](https://docs.postgrest.org/en/stable/references/transactions.html).

## Presentation review

| Before | After | Why |
| --- | --- | --- |
| Static unavailable closure text | Server review and visible exact blockers | Product availability follows the current binding. |
| No durable execution intent | Opaque key persisted before send; read first on restore | Lost responses cannot create another account-closing command. |
| No execution result surface | Queued/unknown/actual CLOSED and retained-evidence copy | A network success is never described as completed erasure. |

Motion review: no new decorative animation or timer-based progress; native full-screen transition has no added motion. Scalable text, flowing settings rows and existing44px+ actions are retained. Actual signed-in closure screen/large-text device proof remains pending; prior Auth device proof does not establish this new screen.

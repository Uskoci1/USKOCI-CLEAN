# Round 16 — direct private-chat realtime readiness

Date: 2026-09-27. Source inspected: `dfe2836e`. **Client-only direct realtime is not ready on the current DEV server. No realtime subscription or server change was added.** This package contains read-only evidence and a bounded candidate contract; it is not a claim of direct incoming delivery.

## Fresh catalog evidence

The read-only Supabase catalog queries ran against project `leqcwgzvjsxugfgzdmth`. The first two complete snapshots are timestamped `2026-09-27T15:36:24.296554Z` and `2026-09-27T15:37:01.854211Z`. Exact metadata, policies and helper definitions are retained in `ROUND_16_CHAT_REALTIME_CATALOG.json`. No message rows, Auth records, tokens or credentials were read.

| Gate | Observed state | Consequence |
| --- | --- | --- |
| Postgres publication | `supabase_realtime` exists; `puballtables=false`; **zero published tables** | `agreement_messages` cannot produce Postgres Changes notifications with current configuration. |
| Message table access | RLS enabled, default replica identity, authenticated SELECT on all columns | Existing RLS remains the row-access boundary; a subscription is not separately authorized by the client filter. |
| Message SELECT policy | Authenticated requester/worker of the exact Agreement, plus restrictive `rpc_storage_account_open()` | The current policy positively checks a party and an open account. |
| Anonymous access | Table/column SELECT grants exist, but neither message SELECT policy applies to `anon` | A table grant alone is not evidence of anonymous row visibility. No anonymous data disclosure is claimed. |
| Private broadcast | **Zero** `realtime.messages` policies; no application trigger/function references `realtime.send` or `realtime.broadcast_changes` | There is no existing authorized private broadcast feed to connect instead. |
| B3 read admission | `support_auth_v5` checks role, exact expected account, JWT session ID and `push_session_valid`; it rechecks before returning | B3 admission is stronger than the current message SELECT policy's session checks. |

`push_session_valid` validates an extant Auth session and checks session expiry, deleted account and ban state. The direct message policy does not call this helper. Enabling publication on the raw message relation alone would add a realtime path carrying `body`, `photo_asset_ids`, sender and client-message IDs without proving B3-equivalent session admission. That is not a client-only fix and is not approved by this package.

Current [Postgres Changes documentation](https://supabase.com/docs/guides/realtime/postgres-changes) requires the publication and table authorization. [Private Broadcast authorization](https://supabase.com/docs/guides/realtime/authorization) requires policies on `realtime.messages` and a private client channel. The [July 2026 realtime schema change](https://supabase.com/changelog/realtime-schema-locked-down-against-modification) preserves policy changes but forbids adding/modifying other objects inside the owned `realtime` schema. The changelog was checked; no dependency was installed or upgraded.

## Existing client seam

`src/app/dogovor/[id].tsx` enables `useAgreementIncomingRefresh` only for the foreground, fresh, current participant's visible private Poruke tab. Its refresh callback is `messages.refresh('silent')` on the B3 history model.

The hook currently listens to admitted Expo notification hints and dropped-notification hints. It owns account revision, session epoch, Agreement, source, focus and foreground, and disposes listeners on retirement. `createAgreementIncomingRefresh` already bounds bursts to one active read plus a trailing read, with a two-second minimum spacing and a bounded 128-ID duplicate set. It performs no periodic polling and never treats hint content as a message or read receipt. These are useful existing pieces, but they are **push-assisted refresh, not direct database realtime**.

The B3 history service keeps pages at most 50 rows and retained history at most 200, protects reading anchors, and separates current server reads from immutable pending outbox commands and measured displayed-ID acknowledgements. A future realtime adapter should call this existing silent-refresh entry point, not insert payload rows into the conversation.

## Minimal candidate contract — not prepared as executable SQL, not applied

The preferred reviewable server candidate is a **body-free per-Agreement invalidation relation** in an application-owned schema. This avoids publishing private message rows and permits per-event RLS admission rather than relying on cached private-broadcast join authorization.

1. One row per Agreement, with only its UUID and a monotonically increasing invalidation revision. No body, photo reference, sender ID, client-message ID or private location. The revision is not a message count or receipt.
2. One narrowly scoped server-owned trigger on committed private-message INSERT changes this row within the same transaction. A rolled-back message must produce no notification. Authenticated clients have no INSERT/UPDATE/DELETE privilege on the relation or trigger helper.
3. The SELECT policy must validate a current authenticated JWT session, an open account and a positive requester/worker match for the exact Agreement. It must not rely on a topic/filter supplied by the client or user-editable claims. Nonparticipant, revoked/expired session, deleted/banned/closed account and anonymous reads must fail closed.
4. Add **only the body-free relation** to `supabase_realtime`; listen for its INSERT/UPDATE events filtered to the current Agreement. Preserve all raw message table ACLs, policies and publication absence. DELETE payload behavior must not become an alternative private event path.
5. Give the new relation an explicit account-closure/erasure policy and cover it in the existing manifest/readiness/certificate workflow. Define and prove how terminal Agreements and participant removal retire access. This package does not authorize bypassing that gate.
6. Disposable SQL/Auth and actual authenticated subscription proof must cover two legitimate parties, an intruder, another Agreement, malformed/expired/revoked session, closure, rollback and reconnection. Record publication membership, ACL/policy/trigger hashes and absence of message text/asset references on the wire. No acceptance follows from catalog presence alone.

After that separately approved server candidate is proved and applied, the bounded client package is a subscription adapter/hook sharing the existing invalidation coordinator. Subscribe only while the same account/session/Agreement/visible foreground visit is admitted; use INSERT/UPDATE solely as invalidation, including one hint after an established/re-established subscription; coalesce bursts; remove the exact channel and timers on blur/background/account change. Late channel callbacks must fail the same identity checks before the bounded B3 read. Do not log payloads, acknowledge on receipt, replace history, settle outbox commands or alter scroll-following intent.

## Verification and boundary

The unchanged safe refresh seam was verified with `agreement-incoming-refresh.test.ts`, `agreement-incoming-refresh-hook.test.tsx`, and `agreement-message-history-service.test.ts`: **3 focused suites / 104 tests PASS**. Two overly nested read-only catalog inspection queries had syntax errors; they were replaced by smaller successful SELECT queries. No mutation was attempted.

No new client source, tests, subscription, dependency, polling timer, migration, grant, publication, server trigger, Auth/session record, certificate, provider send or DEV business data was changed. Direct realtime delivery, native reconnect behavior and query cost remain unproved. Root's concurrent emulator work is separate evidence.

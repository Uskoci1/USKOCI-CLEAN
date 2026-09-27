# P3 / Chat B3a — private history and exact read contract

**SOURCE PROPOSAL — NOT RUN / NOT APPLIED / NOT WIRED TO THE APP.**

Prepared on 2026-09-27 after the bounded client lifecycle round in `P3_SOURCE_ROUND.md`. The owner has deferred tests, builds and device acceptance. This package contains candidate/proof source only, with no workflow, deployment, database mutation, dependency, certificate update, new voice interface or current-app behavior change.

Owned artifacts:

- `supabase/candidates/chat_b3a_private_history_read.sql` — two additive RPCs; atomic pre/post guards.
- `supabase/proofs/chat/private_history_read_proof.mjs` — unexecuted disposable Auth/Postgres proof source.
- this contract note.

## Source basis and closure boundary

The current private reader downloads an ascending table result without paging. The legacy `rpc_mark_agreement_messages_read(uuid)` marks all eligible unread `MESSAGE_RECEIVED` events for the Agreement. B3a adds new names and leaves those legacy functions and all text/photo send writers unchanged.

The existing text and photo senders emit one canonical event with `dedupe_key = agreement_message:<message UUID>` and `payload.message_id = <same UUID>` (`supabase/migrations/20260907080000_clean_n01_message_event.sql:63-70`; `supabase/migrations/20260913065130_clean_v5_agreement_private_photos.sql:114-116`). The existing notification read rule also requires a caller-owned, non-suppressed `IN_APP` delivery (`supabase/candidates/pkg050a_agreement_messages_read.sql:69-76`). The exact-ID writer preserves that eligibility rule.

Both new RPCs use `private.support_auth_v5(expected_user_id)` for the current authenticated session and `private.agreement_photo_context_v5(..., false)` for Agreement context, including terminal read access. Each new RPC then requires an explicit null-safe positive match against either participant before returning content or acknowledging an event. The candidate pins those helper bodies, the existing photo-message metadata reader, and the legacy notification reader. It rechecks the session before returning.

During B3b preparation, source review found that the existing helper's `a NOT IN(requester_account_id, worker_account_id)` test can evaluate to NULL and fail to refuse an unrelated caller when either participant is NULL (`20260913065130_clean_v5_agreement_private_photos.sql:53`). Both participant columns are nullable with `ON DELETE SET NULL` (`20260830173000_clean_authoritative_mutation_boundary.sql:90-105`). Current normal closure uses Auth soft deletion and retains the Auth row; it does not itself establish that NULL state. Hard-delete FK, legacy/import or administrative states are the schema-level concern. B3a now rejects a caller who `IS DISTINCT FROM` both participants (`chat_b3a_private_history_read.sql:48-53,102-105`). **The applied helper and other existing callers are unchanged; this remains a separate unresolved live-code concern.** This is a source finding, not evidence that such rows exist live or a runtime exploit was demonstrated.

The package adds no relation, column, trigger, index, table grant, policy, asset, export class or account-closure dataset. It dynamically captures the current source digest, erasure certificate and erasure binding; it refuses a stale predecessor and requires all of them to remain equal after creation, with retention readiness still true. The source pins were calculated from normalized existing SQL bodies; they are not fresh live hashes. There is no certificate rebinding. New function bodies and their authenticated-only grants are also pinned in the candidate's postcondition (`chat_b3a_private_history_read.sql:8-35,135-164`).

| Prerequisite body | Source of normalized body pin | MD5 |
| --- | --- | --- |
| `private.support_auth_v5(uuid)` | `supabase/migrations/20260913045824_clean_v5_support_case_authority.sql:88` | `66773994698c60b9fab919f2a9fda93a` |
| `private.agreement_photo_context_v5(uuid,uuid,integer,boolean)` | `supabase/migrations/20260913065130_clean_v5_agreement_private_photos.sql:49` | `7790c5be70effa702dd106ab6ae8f807` |
| `public.rpc_read_agreement_photo_messages_v5(uuid,uuid,uuid[])` | `supabase/migrations/20260913065130_clean_v5_agreement_private_photos.sql:121` | `9c5a0868e9507b23b600863f4508a5a5` |
| `public.rpc_mark_agreement_messages_read(uuid)` | `supabase/candidates/pkg050a_agreement_messages_read.sql:54`, existing postcondition at `:90-92` | `725de3a6132fba68b98a09fb2b66ae7a` |

The first three pins were derived by hashing the contents inside each function's existing `$f$` delimiters after CRLF-to-LF normalization. B3a's current body pins, after the null-safe membership correction, are `912f1c7e4df9c8c933351f45bd1fa1c5` (page) and `27e5395f9ba25e0bccd5136dfde5d931` (exact read), derived from the new `$page$`/`$read$` bodies the same way. This is source preparation, not an executed SQL validation.

## Newest / older read

`rpc_read_agreement_messages_page_v1(expected_user_id, agreement_id, limit=50, before_created_at=null, before_id=null)` at candidate line 38:

- accepts 1–50 messages per page;
- reads newest messages when no cursor is supplied;
- requires both cursor values together and verifies that they identify an existing message in this Agreement;
- compares the exact PostgreSQL `(created_at, id)` tuple, without millisecond truncation;
- selects at most `limit + 1` rows to detect an older page, then returns the requested rows in chronological order;
- returns a null `olderCursor` at the history boundary, otherwise the exact first returned row's `{createdAt, messageId}`;
- enriches only those at-most-50 IDs through the existing validated photo metadata reader;
- exposes explicit `TEXT` or `PHOTO` kind. It does not pretend to support `VOICE`.

The envelope is:

```text
schema: AGREEMENT_MESSAGES_PAGE_V1
accountId, agreementId, authoritative: true, asOf
messages: [{
  messageId, agreementVersion, senderAccountId, clientMessageId,
  body, createdAt, kind: TEXT | PHOTO, mine,
  photos: [{assetId, width, height, byteSize, contentType: image/jpeg}]
}]
olderCursor: null | {createdAt, messageId}
```

No storage path, public/private URL, raw asset hash or upload command appears in this projection. The photo reader verifies attachment identity and readiness; an inconsistent body/version/client identity between the bounded row read and enrichment refuses the projection. Message `read_at` is not exposed as a personal receipt.

`asOf` is descriptive statement time, **not** a multi-request snapshot token. This candidate does not add an `after` cursor or claim gap-free arrivals: `created_at` is assigned before commit, so a transaction committing late can appear behind a previously observed high-water tuple. Incremental-arrival semantics need a separate reviewed design. Newest/older paging also does not claim a frozen historical snapshot across concurrent retention/deletion/late commits.

The result cardinality and metadata batch are bounded. Existing `(agreement_id, created_at)` indexing is reused; no query plan, tie-heavy scan cost, 1,000-row performance or new composite index has been verified. This is not the P6 growth acceptance claim.

## Exact displayed-message notification acknowledgement

`rpc_mark_displayed_agreement_messages_v1(expected_user_id, agreement_id, message_ids[])` at candidate line 97:

1. Validates current session, membership and the actor's open-account closure guard.
2. Requires a one-dimensional, one-based, unique, non-null array of 1–50 UUIDs.
3. Verifies **every** supplied ID belongs to the Agreement before writing anything. A mixed valid/foreign/unknown batch fails atomically.
4. Updates only caller-owned unread `MESSAGE_RECEIVED` events for counterpart messages among those IDs, with the canonical dedupe **and** payload link and an eligible in-app delivery.
5. Returns `AGREEMENT_MESSAGE_READ_V1`, the account/Agreement, exact accepted `displayedMessageIds`, `markedEventCount` and `authoritative: true`.

Own messages are valid submitted IDs but cannot mark the other person's notification. Other Agreements, omitted IDs, other event types, suppressed/missing in-app deliveries and mismatched event links are untouched. Replaying a successfully acknowledged set returns zero newly marked events. A valid visible message with no eligible event can also return zero; this is not a missing-message claim.

The RPC does not update `agreement_messages.read_at`, notification delivery state, push attempts or the send journal. It cannot independently prove that a client displayed an ID. Later app integration must supply only measured visible rows and bind callbacks to the current focus, account and Agreement; passing the whole loaded page would still violate the product requirement.

The legacy broad RPC remains callable for old clients. Exact semantics apply only to callers of the new RPC. A later approved client rollout and compatibility decision must retire broad use; this candidate alone cannot close the current-app false-read boundary.

P4 overlap remains explicit: the current activity-event resolver returns only the Agreement ID/role (`supabase/candidates/pkg045a_task_read_contract.sql:261-265`; `src/data/inboxClientService.ts:48-55`), and Inbox opens `tab=poruke` without a message anchor (`src/app/obavestenja.tsx:52`). A push target can be older than the newest 50 rows. B3a does not add an authorized event-to-message reference or bounded page-around-message lookup; those are still required for a general exact-message tap contract. Its read writer also does not alter push-delivery state or promise push cancellation. P5 taxonomy/matching has no new dependency on these two RPCs; no AI provider or speech-to-text behavior is changed.

## Unexecuted proof source

`private_history_read_proof.mjs` uses the existing runtime that rejects non-local Auth/Postgres targets before IO. Before executing candidate SQL, it binds the raw bytes of the candidate, proof, runtime and schema-surface reader to `git show <GITHUB_SHA>:<path>` and records raw SHA256 values. It assumes a separately reconstructed disposable predecessor through admitted Notification A1; it does not reconstruct or connect to DEV itself. No workflow was added and the script has not been invoked.

The authored cases cover:

- predecessor/body tamper rollback; only two added functions; authenticated-only ACL; unchanged closure source/erasure/binding;
- empty, one-message, newest/older 121-row history, equal timestamps, adjacent microseconds, exact order and no duplicate historical IDs;
- a later normally committed message appearing on a newest refresh while older cursor traversal retains the original older rows;
- invalid/missing/infinite/foreign cursors and page-size bounds; stranger, wrong expected account, anonymous and retired-session refusals;
- empty/null/duplicate/null-element/multidimensional/oversized displayed-ID batches; mixed valid/unknown/foreign IDs with no partial marking;
- counterpart versus own message IDs, both directions, omitted newer messages, repeat acknowledgement and no other event/Agreement sweep;
- suppressed/missing in-app deliveries and mismatched payload links remaining unread;
- explicit text/photo projection and exact photo notification ID, using a **metadata-only disposable fixture**, with no image bytes or Storage calls;
- a closing-account lock race that must refuse the acknowledgement with `ACCOUNT_CLOSING`, leaving all event read timestamps and the certificate unchanged;
- each nullable participant position: outsider page/ack refusal without event changes, successful remaining-party read and exact acknowledgement, with unrelated events and certificate unchanged;
- terminal history and read acknowledgement with unchanged message `read_at` and final certificate.

The 121 ordering rows and ready-photo metadata are explicitly synthetic SQL fixtures. Real message/event cases use existing send RPCs. Neither constitutes native display/scroll, actual upload, private playback or two-device proof. Syntax, runtime behavior and assertions remain unverified until the owner authorizes execution.

The first independent bounded source review identified raw source-attribution and closing-account proof gaps; both were added to proof source. Later B3b source inspection found the nullable-participant authorization flaw described above, and B3a source/proof were amended before application. These reviews and corrections are not a passing proof run.

## Work still required before adoption

An authorized disposable run must first validate predecessor pins, the candidate and all authored adversarial cases against the replayed chain. Any drift must be investigated, not removed from the guards. Query-cost evidence and an independently reviewed incoming-message strategy remain necessary. Client integration then needs a validated page decoder, retained history/scroll behavior, exact viewability acknowledgements, and the owner's approved interaction proposal before presentation/flow changes. Server application requires its own authorization; voice authority, audio dependency, recording/player and closure/export extension remain separate approvals and work.

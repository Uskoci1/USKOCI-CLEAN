# P3 / Chat B3a — private history and exact read contract

**DEV APPLIED AND CLIENT WIRED 2026-09-27 — 11 FOCUSED SUITES / 515 TESTS PASS; NO NATIVE ACCEPTANCE.**

The owner explicitly approved B3a/B3b application after prerequisites and client integration. Exact B3a bytes were applied as DEV migration `20260927140148` (`dev_alpha_chat_b3a_private_history_read`), followed by B3b `20260927140231`; ledger 203→205. Fresh catalog reads verify the function bodies, authenticated-only ACLs and unchanged certificate/erasure rows/readiness definition. Both migration transactions passed their mandatory closure digest/binding/readiness pre/post guards. A separate direct private-helper query was refused by the read-only database role; no ACL was expanded to bypass that refusal. See the [application receipt](../../../../supabase/operations/dev-alpha/ledger/20260927_chat_b3_application.receipt.json) and [Round 14](ROUND_14_CHAT_B3_APPLICATION.md). The frozen candidate/proof bytes and historical disposable evidence below are unchanged. The wired client passes 11 distinct focused suites / 515 tests, including 82 strict service tests. Integration TypeScript passes; final exact-source/check and commit receipts are tracked in Round 14. Native visibility remains unaccepted.

Prepared on 2026-09-27 after the bounded client lifecycle round in `P3_SOURCE_ROUND.md`; this living contract now reflects the [Round 09 proof receipt](ROUND_09_B3_PROOF_RECEIPT.md). CI [36312570701](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36312570701) on source `be72a1bd5311e7974bba5572529852156039eac7` passed B3a **11/11** and B3b **7/7** checks using actual disposable Auth/PostgreSQL. The replay was source147 → recorded predecessor through PKG-050 → local Notification A1; PKG-051 was excluded. This is not full current DEV parity, DEV application, client wiring, device acceptance or provider delivery. Frozen candidate/proof bytes are unchanged by this contract update.

Owned artifacts:

- `supabase/candidates/chat_b3a_private_history_read.sql` — two additive RPCs; atomic pre/post guards.
- `supabase/proofs/chat/private_history_read_proof.mjs` — executed disposable Auth/Postgres proof source, bound to the receipt's exact Git bytes.
- this contract note.

## Source basis and closure boundary

Before B3 integration, the private reader downloaded an ascending table result without paging. The legacy `rpc_mark_agreement_messages_read(uuid)` marks all eligible unread `MESSAGE_RECEIVED` events for the Agreement. B3a adds new names and leaves those legacy functions and all text/photo send writers unchanged.

The existing text and photo senders emit one canonical event with `dedupe_key = agreement_message:<message UUID>` and `payload.message_id = <same UUID>` (`supabase/migrations/20260907080000_clean_n01_message_event.sql:63-70`; `supabase/migrations/20260913065130_clean_v5_agreement_private_photos.sql:114-116`). The existing notification read rule also requires a caller-owned, non-suppressed `IN_APP` delivery (`supabase/candidates/pkg050a_agreement_messages_read.sql:69-76`). The exact-ID writer preserves that eligibility rule.

Both new RPCs use `private.support_auth_v5(expected_user_id)` for the current authenticated session and `private.agreement_photo_context_v5(..., false)` for Agreement context, including terminal read access. Each new RPC then requires an explicit null-safe positive match against either participant before returning content or acknowledging an event. The candidate pins those helper bodies, the existing photo-message metadata reader, and the legacy notification reader. It rechecks the session before returning.

Earlier source review identified a conditional SQL branch: the helper's `a NOT IN(requester_account_id, worker_account_id)` expression can evaluate to NULL if a participant were NULL (`20260913065130_clean_v5_agreement_private_photos.sql:53`). The original note incorrectly treated the intermediate nullable migration as the canonical schema. The following authority repair, `20260830174000_clean_repair_authority_boundary.sql:29-31`, restores **NOT NULL on both participant columns**. Both the successful disposable proof and [fresh narrow DEV read](ROUND_09_DEV_B3_READ_ONLY.json) confirm that constraint. Ordinary requester/worker/both-NULL writes are refused; no impossible NULL Agreement was manufactured. B3a retains its explicit `IS DISTINCT FROM` membership guard as defense in depth. **No reachable NULL-participant exploit or affected live row is established; that hypothetical helper branch was not runtime-tested.** Existing helpers/callers remain unchanged. Current soft-delete closure also does not create a NULL participant. A future schema change would require its own authority review; the earlier unresolved-live-exposure characterization is superseded by this canonical constraint evidence.

The package adds no relation, column, trigger, index, table grant, policy, asset, export class or account-closure dataset. It dynamically captures the current source digest, erasure certificate and erasure binding; it refuses a stale predecessor and requires them to remain equal after creation, with retention readiness still true. The passing disposable receipt records complete equal `closureBefore`/`closureAfter` objects and readiness true, with digest `9432adc2906abde3b991bb79d92f1f924c46d203af054970deeec76a388269b8`. There is no certificate rebinding. The four prerequisite body pins below also match the narrow DEV observation at `2026-09-27T10:38:34.583233+00:00`; this is not a fresh full ledger/certificate/Edge attestation. New function bodies and their authenticated-only grants are pinned in the candidate postcondition (`chat_b3a_private_history_read.sql:8-35,135-164`).

| Prerequisite body | Source of normalized body pin | MD5 |
| --- | --- | --- |
| `private.support_auth_v5(uuid)` | `supabase/migrations/20260913045824_clean_v5_support_case_authority.sql:88` | `66773994698c60b9fab919f2a9fda93a` |
| `private.agreement_photo_context_v5(uuid,uuid,integer,boolean)` | `supabase/migrations/20260913065130_clean_v5_agreement_private_photos.sql:49` | `7790c5be70effa702dd106ab6ae8f807` |
| `public.rpc_read_agreement_photo_messages_v5(uuid,uuid,uuid[])` | `supabase/migrations/20260913065130_clean_v5_agreement_private_photos.sql:121` | `9c5a0868e9507b23b600863f4508a5a5` |
| `public.rpc_mark_agreement_messages_read(uuid)` | `supabase/candidates/pkg050a_agreement_messages_read.sql:54`, existing postcondition at `:90-92` | `725de3a6132fba68b98a09fb2b66ae7a` |

The first three pins were derived from the existing `$f$` bodies after CRLF-to-LF normalization. B3a's body pins are `912f1c7e4df9c8c933351f45bd1fa1c5` (page) and `27e5395f9ba25e0bccd5136dfde5d931` (exact read), derived from `$page$`/`$read$` the same way and exercised by disposable SQL guards. Separately, the exact tested candidate bytes have SHA-256 `7298317c474e0a1c670c82f8855811b783528427c5a9d9bab796534e67bd0bbc`; the receipt's Git-blob/manifest comparison uses raw bytes without newline normalization.

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

The RPC does not update `agreement_messages.read_at`, notification delivery state, push attempts or the send journal. It cannot independently prove that a client displayed an ID. The wired route supplies only measured incoming rows and binds callbacks to the current focus, account revision, Agreement, tab visit and row snapshot. Native visibility acceptance remains separate; passing the whole loaded page would still violate the product requirement.

The legacy broad RPC remains callable for old clients. Exact semantics apply only to callers of the new RPC. The new route has no broad ACK fallback. Retiring legacy broad use for older clients remains a separate rollout/compatibility decision; the SQL candidate alone does not supply native display evidence.

P4 overlap remains explicit: the current activity-event resolver returns only the Agreement ID/role (`supabase/candidates/pkg045a_task_read_contract.sql:261-265`; `src/data/inboxClientService.ts:48-55`), and Inbox opens `tab=poruke` without a message anchor (`src/app/obavestenja.tsx:52`). A push target can be older than the newest 50 rows. B3a does not add an authorized event-to-message reference or bounded page-around-message lookup; those are still required for a general exact-message tap contract. Its read writer also does not alter push-delivery state or promise push cancellation. P5 taxonomy/matching has no new dependency on these two RPCs; no AI provider or speech-to-text behavior is changed.

## Executed disposable proof and preserved history

`private_history_read_proof.mjs` uses the existing runtime that rejects non-local Auth/Postgres targets before IO. Before candidate SQL, it binds raw candidate/proof/runtime/schema-surface bytes to `git show <GITHUB_SHA>:<path>` and records raw SHA256 values. The separately added `chat-b3-history-proof.yml` workflow reconstructs the bounded predecessor and A1 preparation before invoking B3a/B3b. The successful [B3a report](b3-ci-36312570701/chat-b3a-report.json) records 11 passing checks, actual Auth/database, zero provider/Storage calls and no device proof.

The passing proof covers:

- predecessor/body tamper rollback; only two added functions; authenticated-only ACL; unchanged closure source/erasure/binding;
- empty, one-message, newest/older 121-row history, equal timestamps, adjacent microseconds, exact order and no duplicate historical IDs;
- a later normally committed message appearing on a newest refresh while older cursor traversal retains the original older rows;
- invalid/missing/infinite/foreign cursors and page-size bounds; stranger, wrong expected account, anonymous and retired-session refusals;
- empty/null/duplicate/null-element/multidimensional/oversized displayed-ID batches; mixed valid/unknown/foreign IDs with no partial marking;
- counterpart versus own message IDs, both directions, omitted newer messages, repeat acknowledgement and no other event/Agreement sweep;
- suppressed/missing in-app deliveries and mismatched payload links remaining unread;
- explicit text/photo projection and exact photo notification ID, using a **metadata-only disposable fixture**, with no image bytes or Storage calls;
- a closing-account lock race that must refuse the acknowledgement with `ACCOUNT_CLOSING`, leaving all event read timestamps and the certificate unchanged;
- canonical NOT NULL constraints on both participants and ordinary requester/worker/both-NULL write refusal without mutation; both actual members' read/ack success and outsider refusal with unrelated events unchanged;
- terminal history and read acknowledgement with unchanged message `read_at` and final certificate.

The 121 ordering rows and ready-photo metadata are explicitly synthetic SQL fixtures. Real message/event cases use existing send RPCs. Neither constitutes native display/scroll, actual upload, private playback or two-device proof. SQL/runtime assertions passed only within the recorded disposable predecessor; query cost and current-app behavior remain unproved.

Earlier failures are retained in the [receipt's history](ROUND_09_B3_PROOF_RECEIPT.md#earlier-failures-remain-part-of-the-evidence): run `36310433116` hit the closure trigger during an invalid NULL fixture; `36310983457` then exposed the canonical NOT NULL constraint; `36312008697` passed B3a but failed B3b's timestamp-order oracle. See [fixture correction](ROUND_07_B3_FIXTURE.md) and [ordering correction](ROUND_07_B3_WINDOW_ORDERING.md). Source-attribution and restricted-account proof gaps had already been corrected. Historical proof-source header comments remain frozen with the tested bytes; this living contract and receipt carry current execution status.

## Current application and remaining acceptance

DEV now has all three B3 RPCs under the explicit approval and recorded immediate preflight/application/postflight. The strict client page/window/ACK service preserves raw timestamps; Round 14 wires 50-row pages, an at-most-200-row retained interval, owned reading-position recovery and exact current-visit visibility dispatch. Eleven distinct focused suites / 515 tests pass, with integration TypeScript PASS and final exact-source/check/commit receipts tracked in Round 14. The service cannot itself prove that a row was displayed. Query-cost evidence, an independently reviewed incoming-message strategy and native visibility acceptance remain necessary. The legacy broad ACK remains callable for older clients; its retirement is a separate compatibility decision. Mandatory voice, the canonical event-to-message resolver and complete exact-message push delivery are not supplied by these RPCs. Other server/dependency and closure/export changes keep their separate approval gates. This status update does not alter frozen candidate or proof bytes.

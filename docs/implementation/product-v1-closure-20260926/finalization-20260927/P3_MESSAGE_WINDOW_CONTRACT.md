# P3 / Chat B3b — exact-message window

**DEV APPLIED AND CLIENT WIRED 2026-09-27 — 11 FOCUSED SUITES / 515 TESTS PASS; NO NATIVE ACCEPTANCE.** Exact B3b bytes were applied under explicit owner approval as `20260927140231` (`dev_alpha_chat_b3b_message_window`), after B3a `20260927140148`; DEV ledger 203→205. Fresh catalog reads verify the window body/ACL and unchanged closure certificate, erasure row and readiness definition. Mandatory closure digest/binding/readiness pre/post checks passed inside each migration transaction; the read-only role's separate private-helper refusal did not cause any authority expansion. See the [application receipt](../../../../supabase/operations/dev-alpha/ledger/20260927_chat_b3_application.receipt.json) and [Round 14](ROUND_14_CHAT_B3_APPLICATION.md). The wired client passes 11 distinct focused suites / 515 tests, including 82 strict service tests. Integration TypeScript passes; final exact-source/check and commit receipts are tracked in Round 14. Native positioning/viewability remains unaccepted.

Prepared 2026-09-27; historical proof is preserved in the [Round 09 receipt](ROUND_09_B3_PROOF_RECEIPT.md). CI [36312570701](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36312570701), source `be72a1bd5311e7974bba5572529852156039eac7`, passed B3b **7/7** and predecessor B3a **11/11** checks on actual disposable Auth/PostgreSQL. Source147 → recorded replay through PKG-050 → local Notification A1 excludes PKG-051 and does not prove full current DEV parity. No device/provider or current-app acceptance follows from that disposable result.

This package adds one authenticated read candidate after amended B3a. It supplies the bounded target-window capability proposed in `P4_EXACT_MESSAGE_LANDING_CONTRACT.md`; it does not add an event resolver, push payload, route, scroll behavior, read receipt, incoming stream or voice support.

Owned new files:

- `supabase/candidates/chat_b3b_message_window.sql`
- `supabase/proofs/chat/message_window_proof.mjs`
- this contract note.

The candidate retains explicit null-safe membership as defense in depth. The earlier nullable-schema characterization is corrected below. Existing helper bodies and previously applied migration files remain unchanged; Round 14 introduces separate client integration. The separately added disposable workflow is recorded in the receipt; frozen candidate/proof artifacts are not rewritten by this living-contract update.

## One request and response contract

```text
rpc_read_agreement_message_window_v1(
  p_expected_user_id: UUID,
  p_agreement_id: UUID,
  p_target_message_id: UUID,
  p_before_count: integer = 24,
  p_after_count: integer = 25
)
```

Each count must be 0–49 and their sum must be at most 49. Null, negative, oversized or over-budget counts produce `CHAT_WINDOW_INVALID` (`22023`). Range checks precede the sum to avoid integer-overflow ambiguity. The target is mandatory. A null, unknown or other-Agreement target produces the same `CHAT_MESSAGE_NOT_AVAILABLE` (`42501`) after Agreement membership admission. A missing/foreign Agreement retains the existing generic `MEDIA_NOT_FOUND` refusal.

The result contains the target exactly once, the nearest requested older rows and the nearest requested newer rows. There is **no opposite-side refill**: the earliest target with default counts returns at most 26 rows, and the latest returns at most 25. Counts 0/0 return only the target. Successful output is always 1–50 rows in ascending `(created_at, id)` order.

```text
schema: AGREEMENT_MESSAGE_WINDOW_V1
accountId, agreementId, targetMessageId
messages: [same explicit TEXT | PHOTO row and validated photos as B3a]
beforeCursor: null | {createdAt, messageId}
afterCursor: null | {createdAt, messageId}
asOf, authoritative: true
```

The target lookup uses the existing message primary key and checks Agreement identity. Two independently limited queries read at most their side count plus one sentinel. One shared statement builds both sides and the target; the target is never trimmed by a final page limit. If it disappears or its timestamp changes between the initial lookup and this statement, the function refuses a targetless result. It selects at most 52 candidate rows before returning at most 50, irrespective of the target's distance from the newest message. This bounds retained/output cardinality, **not all rows visited by the query plan**.

Each non-null cursor is the exact first/last returned row tuple and means another row exists beyond that boundary in the window statement. A side with count zero can still return its target tuple as a non-null cursor. Clients must retain raw PostgreSQL timestamp strings, including microseconds; converting cursors through JavaScript `Date` loses precision.

B3a can consume `beforeCursor` as an exclusive older cursor. B3a has no exclusive forward reader. Bounded forward continuation can reanchor B3b at `afterCursor.messageId` with counts 0/49; that includes the boundary row again, so ID deduplication is mandatory. The disposable proof passed that inclusive behavior, and Round 14 client integration uses the bounded window contract. This is not gap-free incoming delivery or native traversal acceptance.

`asOf` describes statement time, not a cross-request snapshot. Later arrivals, deletion or delayed commits can change subsequent windows/cursor availability. Reanchoring is a bounded historical read, not gap-free incoming delivery, a durable sequence or proof that all messages have been seen.

## Authority, projection and canonical participant constraints

`private.support_auth_v5(expected)` requires a non-null matching authenticated account and a live session, and is repeated before return. The existing Agreement context helper admits terminal history. B3b then explicitly refuses when the actor `IS DISTINCT FROM` both participant IDs, before selecting any message. It never accepts a router parameter or event ID as authorization.

The reused `private.agreement_photo_context_v5` contains `a NOT IN(requester_account_id, worker_account_id)` (`20260913065130_clean_v5_agreement_private_photos.sql:53`). A hypothetical NULL participant would make that condition NULL for an unrelated caller. The earlier note incorrectly treated `20260830173000_clean_authoritative_mutation_boundary.sql` as final schema: `20260830174000_clean_repair_authority_boundary.sql:29-31` restores **NOT NULL on both columns**. The successful disposable proof and [fresh narrow DEV read](ROUND_09_DEV_B3_READ_ONLY.json) confirm both constraints. B3a/B3b retain explicit positive null-safe membership checks without weakening the canonical schema.

**No reachable NULL-participant exploit or affected live state is established.** The proof refuses ordinary requester/worker/both-NULL writes; it neither relaxes constraints nor manufactures an impossible Agreement. The hypothetical NULL-helper branch was not runtime-tested. Current soft-delete closure also does not create NULL participants. Existing photo helpers/readers remain unchanged, but the earlier unresolved-live-exposure characterization is superseded by the canonical NOT NULL evidence. Any future constraint change needs a separate authority review.

The new window duplicates B3a's explicit `TEXT`/`PHOTO`, mine/sender/version/client-ID/body/time projection and reuses `rpc_read_agreement_photo_messages_v5` only for the selected IDs. It retains exact message/version/client-ID/body joins, validates asset attachment and readiness, and exposes only asset ID, dimensions, byte size and fixed content type. No storage path, signed URL, hash, upload command, message `read_at` or inferred voice kind is added.

The future P4 resolver must separately validate recipient, eligible IN_APP delivery, event type, canonical dedupe and payload-message linkage before supplying this target. B3b proves only a current authorized message window. Native current-visit positioning/viewability must still show that exact target before B3a's exact displayed-ID writer acknowledges it. Tap, resolver success, page loading and a scroll request are insufficient.

## Existing indexes and bounded cost claim

`20260829183633_clean_agreement_foundation.sql:37-48` provides the message PK on `id` and B-tree `(agreement_id, created_at)`. `20260907110000_clean_d03_message_retry.sql:24` adds sender/client retry uniqueness, not a history-order index. Source search found no later `(agreement_id, created_at, id)` index.

The candidate requires an existing valid/ready single-column target PK and valid/ready nonpartial B-tree Agreement/time prefix. That prefix supports the Agreement/range selection but does not completely satisfy the UUID tie order. A large equal-timestamp group can still require extra scanning/sorting. No index is added and no planner, latency, buffer, 1,000-row or growth claim is made. Any future composite-index proposal needs its own schema/closure and execution review.

## Source pins and closure boundary

| Required normalized body | MD5 |
| --- | --- |
| `private.support_auth_v5(uuid)` | `66773994698c60b9fab919f2a9fda93a` |
| `private.agreement_photo_context_v5(uuid,uuid,integer,boolean)` | `7790c5be70effa702dd106ab6ae8f807` |
| `public.rpc_read_agreement_photo_messages_v5(uuid,uuid,uuid[])` | `9c5a0868e9507b23b600863f4508a5a5` |
| Amended B3a page | `912f1c7e4df9c8c933351f45bd1fa1c5` |
| Amended B3a exact read | `27e5395f9ba25e0bccd5136dfde5d931` |
| New B3b window | `9ae403a4c1ba9130e18cdd5b3dd831f6` |

The first three prerequisite source locations are recorded in `P3_PRIVATE_HISTORY_CONTRACT.md`. B3a pins come from `$page$`/`$read$`; B3b's own pin comes from `$window$`, with CRLF normalized to LF for those body comparisons. Disposable SQL exercised these guards. The narrow DEV read at `2026-09-27T10:38:34.583233+00:00` independently matches the four existing helper pins and finds no B3 RPCs. B3b's exact tested candidate SHA-256 is `d57619fbf972120763861d2bf61fd02122e2b4d5b84fc3be3165404569243f0d`; receipt source integrity compares raw Git bytes without newline normalization. This is not a fresh full DEV ledger/certificate/Edge attestation.

The candidate refuses an existing B3b signature, wrong predecessor body/security envelope, missing indexes or stale closure readiness. It dynamically captures and preserves the closure source digest, both entire certificate rows, erasure binding and readiness-function definition. Only the new function gains authenticated EXECUTE; PUBLIC, anon and service_role are revoked. There is no table, index, trigger, policy, writer, grant expansion on an existing object or certificate rebinding. The postcondition pins the exact new body and definer/search-path/volatility/ACL envelope.

The disposable receipt confirms complete equal `closureBefore`/`closureAfter` objects, readiness true and digest `9432adc2906abde3b991bb79d92f1f924c46d203af054970deeec76a388269b8`. That preserved disposable certificate is not a claim that the current DEV certificate was freshly attested.

## Executed disposable proof and preserved history

The proof imports the runtime that refuses non-local Auth/Postgres targets before IO. It requires the separately replayed predecessor through A1 and B3a; the `chat-b3-history-proof.yml` workflow provides that preparation. Before SQL, candidate/B3a/proof/runtime/surface-reader bytes must equal `git show <GITHUB_SHA>:<path>`, with raw SHA256 recorded. The successful [B3b report](b3-ci-36312570701/chat-b3b-report.json) records seven passing checks, actual Auth/database, zero provider/Storage calls and no device proof.

The passing proof covers:

- B3a body-pin and new-body tamper refusal with rollback, exactly one added authenticated read function, unchanged unrelated authority and closure;
- 121 ordering fixtures with equal timestamps and adjacent microseconds, an old target outside the newest 50, exact nearest rows, target uniqueness, edges, zero sides and total cardinality;
- exact before/after cursor tuples, B3a exclusive older continuation and B3b inclusive forward reanchor;
- invalid counts including maximal integers, missing/null/foreign target, foreign/missing Agreement, wrong expected account, anonymous and retired-session refusal;
- canonical NOT NULL constraints on both participants and ordinary requester/worker/both-NULL write refusal; both actual members admitted, outsiders refused and no notification/read/delivery/attempt mutation;
- explicit TEXT/PHOTO target and metadata allowlist, corrupt attachment-link refusal using a disposable fixture;
- later ordinarily committed arrival and terminal Agreement history, with exact target preserved and no read acknowledgement;
- snapshots of all message read timestamps, events, notification deliveries and push attempts around reads/refusals, plus final unchanged closure evidence.

Ordering and media-link fixtures are synthetic local SQL states; the participant checks preserve canonical constraints and the photo fixture contains metadata only. There is no real upload, Storage object, native geometry, provider push, client visibility or closure-erasure execution in this proof. Earlier failed runs remain linked in the [receipt history](ROUND_09_B3_PROOF_RECEIPT.md#earlier-failures-remain-part-of-the-evidence): invalid NULL-fixture trigger/constraint failures in `36310433116` and `36310983457`, followed by B3a success but a B3b typed-timestamp ordering-oracle failure in `36312008697`. [Fixture correction](ROUND_07_B3_FIXTURE.md) and [oracle correction](ROUND_07_B3_WINDOW_ORDERING.md) explain the progression; the passing run is `36312570701`, not a relabeling of those failures.

## Review and remaining boundary

Independent bounded source review preceded execution and covered authenticated ownership, explicit membership, session recheck, bounded target inclusion, tuple precision, photo joins and source/closure preservation. It did not itself establish runtime success and initially missed the later NOT NULL repair; the disposable runs corrected that fixture assumption. The final receipt supplies the bounded runtime evidence. Frozen proof-source header comments remain historical; this contract and receipt carry current status. Native positioning, client visibility and query cost remain unproved.

Disposable proof remains complete for the recorded source, and DEV application is now complete under explicit approval and fresh pre/post evidence. The strict window decoder is implemented and covered by the 82-test service suite. Round 14 wires ID-deduplicated bounded continuation, saved-anchor restoration and current-visit measured visibility dispatch; 11 distinct focused suites / 515 tests pass. Integration TypeScript passes, with final exact-source/check/commit receipts tracked in Round 14. Removed anchors recover to latest in one tap, and a changed reading anchor is retained during pending paging. Native checks remain unaccepted. A canonical event-to-message resolver, query-cost evidence and complete push landing remain separate requirements. Other server, mandatory voice/dependency and storage/closure changes keep their separate gates. Frozen SQL and proof bytes are unchanged by this contract update.

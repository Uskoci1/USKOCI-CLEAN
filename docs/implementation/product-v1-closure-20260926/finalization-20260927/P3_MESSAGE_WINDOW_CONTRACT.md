# P3 / Chat B3b — exact-message window

**SOURCE ONLY — NOT RUN / NOT APPLIED / NOT CLIENT-WIRED / NOT READY FOR APPLY.** Prepared 2026-09-27. No SQL/proof/test/type/build/device/provider execution belongs to this preparation.

This package adds one authenticated read candidate after amended B3a. It supplies the bounded target-window capability proposed in `P4_EXACT_MESSAGE_LANDING_CONTRACT.md`; it does not add an event resolver, push payload, route, scroll behavior, read receipt, incoming stream or voice support.

Owned new files:

- `supabase/candidates/chat_b3b_message_window.sql`
- `supabase/proofs/chat/message_window_proof.mjs`
- this contract note.

The B3a candidate, proof and contract were also amended with explicit null-safe membership checks after the source finding below. Applied helpers, migrations, clients, workflows and control files are unchanged by P3.

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

B3a can consume `beforeCursor` as an exclusive older cursor. B3a has no exclusive forward reader, and no client consumes `afterCursor` yet. A future approved integration may reanchor B3b at `afterCursor.messageId` with counts 0/49; that includes the boundary row again, so ID deduplication is mandatory. The proof source checks that inclusive behavior. This does not add a live client traversal or authorize a flow change.

`asOf` describes statement time, not a cross-request snapshot. Later arrivals, deletion or delayed commits can change subsequent windows/cursor availability. Reanchoring is a bounded historical read, not gap-free incoming delivery, a durable sequence or proof that all messages have been seen.

## Authority, projection and the nullable-participant finding

`private.support_auth_v5(expected)` requires a non-null matching authenticated account and a live session, and is repeated before return. The existing Agreement context helper admits terminal history. B3b then explicitly refuses when the actor `IS DISTINCT FROM` both participant IDs, before selecting any message. It never accepts a router parameter or event ID as authorization.

During this preparation, the reused `private.agreement_photo_context_v5` was found to use `a NOT IN(requester_account_id, worker_account_id)` (`20260913065130_clean_v5_agreement_private_photos.sql:53`). With a NULL participant and unrelated caller, that condition is NULL and does not raise. The schema permits both participant columns to be NULL and defines hard-delete FKs with `ON DELETE SET NULL` (`20260830173000_clean_authoritative_mutation_boundary.sql:90-105`). B3a's two new RPCs and B3b now require a positive null-safe match.

**This does not establish live reachability or exploitation.** Current normal closure uses Auth soft deletion (`supabase/functions/uskoci-account-closure-worker/closure.ts:87`) and requires a retained Auth row with `deleted_at` (`20260913081147_clean_v5_event_bound_account_erasure.sql:661`); it does not itself fire the hard-delete FK. Hard-delete, legacy/import or administrative NULL states are the schema-level concern. The existing helper and existing photo metadata/binary readers remain unchanged and are a separate unresolved live-code concern; these new guards do not fix every existing caller.

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

The first three prerequisite source locations are recorded in `P3_PRIVATE_HISTORY_CONTRACT.md`. B3a pins come from its current candidate `$page$`/`$read$` bodies. B3b's own pin is calculated from `$window$` source with CRLF normalized to LF. These are file-text hashes, not live catalog observations or SQL execution.

The candidate refuses an existing B3b signature, wrong predecessor body/security envelope, missing indexes or stale closure readiness. It dynamically captures and preserves the closure source digest, both entire certificate rows, erasure binding and readiness-function definition. Only the new function gains authenticated EXECUTE; PUBLIC, anon and service_role are revoked. There is no table, index, trigger, policy, writer, grant expansion on an existing object or certificate rebinding. The postcondition pins the exact new body and definer/search-path/volatility/ACL envelope.

## Unexecuted disposable proof source

The proof imports the existing runtime that refuses non-local Auth/Postgres targets before IO. It requires a separately replayed predecessor through A1 plus the amended B3a; it does not replay B3a or reconstruct DEV. Before SQL, it requires exact raw bytes for candidate, B3a source, proof, runtime and surface reader to equal `git show <GITHUB_SHA>:<path>`, recording each raw SHA256. No workflow was added.

Authored cases cover:

- B3a body-pin and new-body tamper refusal with rollback, exactly one added authenticated read function, unchanged unrelated authority and closure;
- 121 ordering fixtures with equal timestamps and adjacent microseconds, an old target outside the newest 50, exact nearest rows, target uniqueness, edges, zero sides and total cardinality;
- exact before/after cursor tuples, B3a exclusive older continuation and B3b inclusive forward reanchor;
- invalid counts including maximal integers, missing/null/foreign target, foreign/missing Agreement, wrong expected account, anonymous and retired-session refusal;
- each nullable participant side and both-null state: outsiders refused, actual remaining party retained, no notification/read/delivery/attempt mutation;
- explicit TEXT/PHOTO target and metadata allowlist, corrupt attachment-link refusal using a disposable fixture;
- later ordinarily committed arrival and terminal Agreement history, with exact target preserved and no read acknowledgement;
- snapshots of all message read timestamps, events, notification deliveries and push attempts around reads/refusals, plus final unchanged closure evidence.

Ordering, nullable-party and media-link fixtures are synthetic local SQL states. The photo fixture contains metadata only. There is no real upload, Storage object, native geometry, provider push, read receipt or closure-erasure execution in this proof. A later proof failure must be investigated; source review does not establish that the SQL parses or any assertion passes.

## Review and remaining boundary

Independent bounded source review completed on 2026-09-27 with no actionable defect found in the candidate, proof or contract. The review covered non-null authenticated ownership and explicit positive membership before target reads, repeated session validation, nearest-side bounds and target inclusion, tuple cursor precision, photo identity joins, full closure certificate/readiness preservation, raw source-byte binding before candidate SQL, and the authored NULL-participant/no-read-effect proof cases. It did not execute SQL or the proof, recompute catalog hashes, or establish parser success, runtime outcomes, native positioning or query cost. The existing photo-helper finding remains separate and unresolved.

Required next evidence remains separately authorized disposable execution against exact predecessors, query-cost measurement, an event resolver contract and approved native landing/viewability integration. B3b is not deployed and does not connect current push or chat clients to any new RPC. Voice dependencies, storage/closure changes and UI remain separate work.

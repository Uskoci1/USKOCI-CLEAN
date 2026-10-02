# MESSAGES-INBOX-01 — source candidate, NOT APPLIED

Canonical DEV: `leqcwgzvjsxugfgzdmth`. Live metadata captured2026-10-02T21:59:15Z; package's metadata-only preflight returned six true checks at22:07:25Z. See receipt and baseline files. No private messages or account rows read. No DDL, provider call, application or test execution. Existing stored source/erasure certificates agree at `3a785d423a564a5b39f55f916c536753ac73c4a76664ce0a09394ee68909cd23`; computed digest was deliberately not invoked during this preparation.

## Exact public interface

`rpc_list_my_conversations_v1(p_expected_user_id uuid, p_limit integer DEFAULT30, p_cursor jsonb DEFAULTNULL) RETURNS jsonb`.

`p_limit`1..50. First page cursor SQL null. Later cursor exactly `{snapshotAt,lastAt,kind,id}`; timestamps ISO date/time with explicit offset orZ and at most6 fractional digits, UUID, kind AGREEMENT|GROUP. Reject extra keys, JSON null, partial/invalid cursor, infinity/future snapshot, lastAt newer than snapshot. Cursor denotes descending `(lastMessage.createdAt, kind COLLATE "C", conversationId)` tuple. Preserve microseconds when comparing/validating client-side.

Envelope exact keys:

```
schema: 'MY_CONVERSATIONS_PAGE_V1'
accountId: UUID
authoritative: true
asOf: ISO timestamp
snapshotAt: ISO timestamp
items: ConversationRow[] (0..limit)
nextCursor: {snapshotAt,lastAt,kind,id} | null
```

Row exact keys:

```
kind: 'AGREEMENT' | 'GROUP'
id: UUID
routeAgreementId: UUID
task: {id: UUID, title: string} // bounded to1000 codepoints
counterpart: {profileId: UUID, displayName: string} | null // bounded to200
lastMessage: {
  id: UUID,
  createdAt: ISO timestamp,
  mine: boolean,
  kind: 'TEXT' | 'PHOTO' | 'VOICE',
  preview: string | null // bounded to240 codepoints if present
}
unreadMessageCount: integer | null
```

Private id=routeAgreementId. Counterpart is nullable if missing/restricted, never fabricated. Group counterpart alwaysnull; task title identifies context; no member count fabricated. GROUP lastMessage.kind alwaysTEXT. VOICE preview alwaysnull; PHOTO may carry actual text caption. No signed URLs, storage paths or attachments in aggregate response. Client uses actual photo/voice kind labels instead of displaying empty text as a missing message.

Text normalization follows the exact SQL: ASCII-space `btrim` before codepoint truncation. A truncation boundary may end in a space; other whitespace may remain. The decoder accepts bounded Unicode text without imposing JavaScript trim identity or rejecting a whole valid page for existing whitespace-only text. Presentation trims for display and uses a neutral fallback. This clarification resolves the independent source-review trim concern without changing the frozen SQL.

Private unreadMessageCount alwaysnull: existing measured private ACK updates events, not `agreement_messages.read_at`. Null must not be converted to0. Group count is actual visible messages unread for caller at/before cutoff; no notification preferences or event counts involved. Private/group histories stay independent. No-message Agreements remain accessible through Dogovori; not fabricated as dated conversations.

Errors explicitly raised: `AUTH_REQUIRED`, `AUTH_CONTEXT_CHANGED` through current support auth, `ACCOUNT_CLOSING`, `INBOX_LIMIT_INVALID`, `INBOX_CURSOR_INVALID`. Unexpected transport/SQL errors remain unavailable, never successful empty inbox. No automatic retries or ACK on read/list opening.

## Authority

One new SECURITY DEFINER function is necessary to read the existing private group tables whose authenticated ACL intentionally grants nothing. It follows current expected-account/session helper, positive Agreement party read predicate, group membership helper and exact per-message visibility grants. It adds no broader table privileges. Fixed `search_path=pg_catalog`; all app relations/helper names qualified. Execution revoked from PUBLIC/anon/service_role, granted only authenticated. Caller is rechecked after read. Restricted caller rejected; restricted counterpart identity omitted. No write-state filtering that hides previously admitted terminal history.

Private party predicate matches freshly pinned read-side `agreement_voice_context_v1(false)`; the function does not call a helper once per Agreement merely to repeat that predicate. Group membership is necessary but insufficient: latest preview, ordering and unread all join immutable caller message-visibility grants. A removed member cannot discover later group's time/activity. One caller-owned Agreement id supplies the existing group route; it is chosen deterministically, not another person's private Agreement.

## Paging limits

SnapshotAt is a timestamp cutoff, not a retained cross-request MVCC snapshot. Post-cutoff arrivals do not move older rows while paging. Concurrent deletion, redaction, closure, visibility changes and transactions committing late can still affect pages; reauthorize every page, deduplicate client keys, refresh first page for new arrivals. Do not promise snapshot isolation. No global total or invented unread aggregate.

## Candidate and revert

`candidate.sql` is self-contained. It checks absence of every same-name overload; exact helper-body/ACL/security configuration pins; required columns/nullability; existing relation authority and index definitions; exact stored certificates. It checks full computed digest before and after *future approved application*, then creates ONLY this RPC and its restricted function ACL/comment. No table, index, row, policy, trigger or existing function changes. Full digest calls are included as fail-closed apply gates and were NOT run in this task.

Closure digest definitions were read rather than executed. Their selected function lists exclude this new reader; their table/trigger/storage/publication surfaces are unchanged. No recertification or certificate writes proposed. Future apply must still pass the computed check; metadata agreement alone is not a claim of full readiness.

`revert.sql` checks pinned candidate body/metadata and predecessor authority, drops only this exact function withoutCASCADE, and verifies closure digest unchanged. Frontend must keep feature-gated until approved server receipt. Reverting should first turn off its client gate; it never erases conversations. `function.sql` is the readable body; do not apply it alone because it lacks package gates/ACLs.

`preflight.readonly.sql` / `postflight.readonly.sql` query metadata only, do not invoke business RPCs or calculate full digest. The recorded preflight's `ALREADY_PRESENT:true` means its absence predicate passed (RPC not present); name retained to match the exact receipt. All file hashes in MANIFEST.json.

## Source review / remaining checks

Native frontend and RPC execution not verified. SQL was reviewed by source only: no live or disposable create/call. Existing private-message `(agreement_id,created_at)` index supports latest seek; group `(group_id,sequence)` plus visibility indexes exist, but no group `(group_id,created_at,id)` index. Current aggregate may sort a member's visible group history; performance has not been measured, and no index/dependency was added. One client call replaces per-row history calls, but this is not a measured speed claim.

Next safe independent review: SQL syntax/PLpgSQL name resolution, expected argument/default metadata, private/group authorization parity, cursor cutoff/ties, nullable private unread, redaction/erasure behavior and exact rollback. Any disposable proof or server application is separate from the metadata-only work performed here.

Documentation consulted: [Supabase database functions](https://supabase.com/docs/guides/database/functions) for definer search path and function execution grants. Changelog markdown fetch returned unsupported-content-type; no claim derived from that failed fetch.

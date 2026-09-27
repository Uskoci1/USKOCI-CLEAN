# P4 opaque push event transport — source preparation

Status: **EDGE SYNTHETIC PASS / SQL SOURCE PREPARED / CLIENT PLAN ONLY**.
No DEV SQL, Edge deployment, environment change, certificate update, provider send,
device operation or commit was performed by this package. The installed worker
remains outside this source-only change. Do not mark direct push-to-message proven.

## Existing path and the gap

| Boundary | Current source behavior | Required change |
| --- | --- | --- |
| `rpc_begin_push_send(uuid,uuid)` | Rechecks service identity, token lock, lease, suppression, recipient, session and device revision; returns A1 event type only | Add the joined event UUID only for `MESSAGE_RECEIVED` |
| `uskoci-push-transport/index.ts` | Exact receipt validation; fixed public copy; provider data is `{kind:'INBOX'}` | Accept both receipt generations; opt in to the narrow event hint |
| `publicInboxCopy.ts` | Exact public title/body allowlist and exactly one data key | Later admit only the additional exact three-key message shape; keep copy/privacy checks |
| `PushRuntime.tsx` | Waits for route/Auth readiness; captures account/revision/session epoch; deduplicates native request IDs; tap opens Inbox | Later capture an owned event intent; never accept provider URLs or private target IDs |
| `pendingRoute.ts` + root `_layout.tsx` | Cold tap remembers Inbox because the async root return consumer may replace navigation | Preserve one convergent destination during exact resolution |
| `obavestenja.tsx` / `useInbox.ts` | A tapped message event already calls the P4 resolver and opens the exact conversation window | Reuse that authority for a push intent even if the event is absent from the first Inbox page |
| `activityMessageTargetService.ts` | Authenticated account-bound `rpc_resolve_activity_message_v1`; 15s bound; cancellation; strict body-free response | Reuse unchanged |
| `dogovor/[id].tsx` | Exact `messageId` enters the existing B3 window; viewport controls ACK | Reuse unchanged; tap/resolve is never read/delivered proof |

## Narrow wire contract

With the new explicit transport switch enabled, a message sends:

```json
{"kind":"INBOX","eventType":"MESSAGE_RECEIVED","eventId":"<event UUID>"}
```

- `kind`: keeps the existing owned Inbox entry point.
- `eventType`: selects the one supported exact resolver; it is not an arbitrary route.
- `eventId`: opaque lookup hint from the recipient/role-matched durable event. It is
  not a credential or authorization. No entity ID is inferred from it on the phone.

All other events and legacy A1 receipts still send exactly `{kind:'INBOX'}`. Fixed
title/body, channel, sound, priority and TTL retain their existing behavior. No
message text, task title, agreement/message/person/account ID, address, media URL,
custom URL or arbitrary JSON is added. Existing Expo token/lease transport is unchanged.

## Source changes

1. `supabase/candidates/chat_p4_push_event_transport.sql`: one guarded replacement
   of the existing service-only begin function. The functional body delta is one
   UUID variable, selecting `e.id` in the existing matched event lookup, and one
   conditional JSON field. Locking, suppression, lease transitions and send count
   remain byte-identical to A1 outside that delta.
2. `supabase/functions/uskoci-push-transport/index.ts`: accepts the exact old receipt
   or the exact message-only receipt with a valid UUID. Extra fields, event IDs on
   other types and malformed IDs fail before provider access. Canonicalizes UUID case.
3. `supabase/proofs/notifications/n09_push_transport_edge.test.mjs`: focused cases
   plus the unchanged transport/privacy regression set. The harness now constructs
   a single lease timestamp, removing an incidental millisecond mismatch; a separate
   regression still rejects genuinely different claim/begin expiration values.

The switch `EXPO_PUSH_MESSAGE_TARGET_ENABLED` is **off unless exactly `true`**.
This is necessary because currently installed clients reject any extra payload key.
It is source preparation, not an instruction or authorization to enable it.

Candidate working-tree SHA-256:
`bd4957d6a2534d892c64839e0dd8fbd6b03267c9bd18159a6cf7b6ae1824e450`.
Expected A1 predecessor body MD5: `f946246b96985efefa26e2bd560cc897`.
Prepared begin body MD5: `ea801be7205a8b07c7c94e20af3bd90e`.
Rebind source hashes to the eventual committed bytes before a disposable proof.

## Certificate boundary and unperformed SQL proof

`prepare_notification_a1.mjs` previously proved that changing this begin body alone
left the closure certificate/digest, erasure binding, history and push rows unchanged.
The source digest definitions protect schema/triggers and named media/closure functions,
not this begin RPC. That is evidence for a narrow boundary, not a fresh DEV attestation.

The new candidate requires the exact A1 body, service-only effective ACL, postgres
owner/config and applied P4 resolver body. It snapshots and requires unchanged full
function metadata, closure digest, both certificate rows, erasure binding and readiness
definition, with readiness true. Its postcondition pins the new body too. Any boundary
drift aborts; it contains no recertification.

**The candidate has not been executed on Postgres.** The prepared harness
`supabase/proofs/chat/push_event_transport_proof.mjs` and isolated workflow
`.github/workflows/chat-p4-push-transport-proof.yml` reuse the unchanged local
source147 → PKG-050 → A1 → B3a/B3b → 13-check P4 predecessor proof. They then admit:

- exact commit bytes and ten bounded SQL/Edge checks;
- rejected predecessor/body/security/config/ACL mutations with transaction rollback;
- real Auth, service-only begin and exact message/non-message response keys;
- foreign recipient/role, deleted event, stale lease, changed device, expired
  session and disabled preference refusals;
- actual begin/claim/completion/readiness RPCs with intercepted synthetic Expo;
- both legacy and opt-in payloads, authenticated exact resolver/window, foreign
  exclusion and no read ACK;
- unchanged DDL data/catalog/ACL/certificate/history and full catalog restoration.

Only bounded source hashes, stage verdicts and reports are uploaded, including
failures; raw predecessor logs/credentials/fixture rows remain private and teardown
always runs. This machine has no callable local Docker/Postgres/Supabase toolchain,
so a committed CI run is still required. The Node result below does not substitute
for that proof. It does not add new claims about account blocking or native delivery.

## Minimal client plan — handed to root

Use the existing Inbox as the routing bridge, with one in-memory owned push intent,
not a new screen or a provider-supplied URL:

1. A shared strict data decoder admits legacy or the exact three-key message shape.
2. After current `PushRuntime` ownership/dedup checks, store one intent containing
   event ID, account ID, account revision, session epoch, request identity, sequence
   and a short expiry. Only the event ID came from provider data. New accepted taps
   retire older intents. No disk persistence and no automatic ACK.
3. Navigate to the same `/obavestenja`; cold start remembers the same destination.
   A focused Inbox consumer resolves the event directly through the existing P4
   service, independently of pagination and the currently selected Inbox filter.
4. Gate completion by the same intent sequence, account/revision/epoch and Inbox
   visit. Leaving, backgrounding, changing account/session, superseding the tap or
   expiring the intent cancels/retire it. A late reply cannot hijack later navigation.
5. Retire only the **matching owned** cold Inbox return destination when the Inbox
   consumer takes ownership. Root must skip its older fallback after this handoff.
   A revision check protects a return consumer already awaiting a result; retain
   a scoped consumed/retired serial as well so a consumer starting after retirement
   cannot replay an older sign-in destination. Never clear a newer push/user return.
   Existing generic sign-in return intents retain their behavior. On success,
   replace this Inbox landing with the exact conversation instead of stacking it.
6. The server-resolved `agreementId/messageId` opens the current `poruke` tab/window.
   UNAVAILABLE/error stays in Inbox with a truthful retry/status surface. It must
   never fall back to an unrelated latest message. Retry is explicit. The existing
   measured message viewport alone may mark read.

Expected client ownership: `publicInboxCopy.ts`, `PushRuntime.tsx`, a small owned
intent store/hook, `pendingRoute.ts`, the existing Inbox route and focused tests.
Before implementing, test cold/live duplicate taps, root-consumer ordering both ways,
ABA/logout/session change, navigation-away, timeout/retry, superseding taps, event
outside page one, forbidden/removed message, legacy payload and both platforms.
No client file was changed by this transport agent; root owns its implementation
and result. Review also identified late cold-response ordering, superseded cold
tokens and owner-scoped retirement as required client regressions.

## Verification and rollout boundary

- RED before Edge implementation: **2 expected failures / 64 pass** (new valid
  message receipts were rejected by the existing worker).
- GREEN: `node --test supabase/proofs/notifications/n09_push_transport_edge.test.mjs supabase/proofs/notifications/n10_push_copy.test.mjs`
  — **101/101 PASS**, synthetic transport only, no real network.
- A first post-edit run exposed the independent fixture timestamp mismatch; it was
  fixed in the harness and covered by the explicit mismatch regression above.
- Scoped `git diff --check` and new proof `node --check`: PASS. Predecessor workflow
  replay compared byte-for-byte: unchanged. No full Jest, app build or native/device claim.

After SQL proof and explicit deployment authorization: deploy compatible Edge with
exact-message switch off **before** applying SQL (worker 21 rejects the new receipt).
Ship/admit the compatible client, prove both cold and live owned taps, then separately
enable exact transport. Until the supported installed clients are compatible, retain
legacy data. No per-device capability exists in this package; a global switch is not
a safe substitute for compatibility during an uncontrolled mixed-version rollout.

Reference checked: [Expo notification response and cold-start APIs](https://docs.expo.dev/versions/latest/sdk/notifications/).
The repository uses the existing installed API; no SDK/package upgrade was made.

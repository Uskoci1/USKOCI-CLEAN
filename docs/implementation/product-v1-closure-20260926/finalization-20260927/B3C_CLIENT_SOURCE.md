# B3c client invalidation connection

2026-09-27. **CONNECTED CLIENT SOURCE; focused tests PASS; native acceptance pending.** The owner explicitly approved connecting the applied B3c surface. The separate [DEV application receipt](B3C_DEV_APPLICATION_RECEIPT.md) records ledger 209 and all three certificate bindings. This client package makes no server change.

## Implemented boundary

`src/data/agreementInvalidationService.ts` provides
`subscribeAgreementInvalidations({ accountId, accountRevision, sessionEpoch,
agreementId, isCurrent, refresh }) => stop`. It captures the input scope and uses
the existing authenticated Supabase singleton. It does not freeze a JWT, modify
shared Auth settings, create a second Supabase client, or call a message RPC itself.

One channel listens only for INSERT and UPDATE on
`public.agreement_invalidations_v1`, filtered to the validated Agreement UUID.
The filter limits traffic; the existing per-event server RLS remains authority.
The decoder admits only the proved table/event envelope, matching Agreement and
body-free row keys with positive safe-integer revisions. It returns no row data.
Raw message tables, DELETE events, foreign targets, arbitrary payload bodies and
malformed rows never become a refresh, message, read receipt or public error.

Valid changes, SDK SUBSCRIBED callbacks and PostgreSQL system-OK callbacks request
a canonical reread through the existing incoming-refresh coordinator. Same-turn
callbacks share one hint; later arrivals during an active read retain one trailing
read. The existing two-second admission interval remains. Revisions are not
globally deduplicated or interpreted as message counts: cache deletion can reset
them. Reconnect uses the same SDK channel, and no polling or independent retry loop
is introduced. A failed read remains owned by the existing history resource.

The connected hook owns one coordinator shared by CDC and the existing native
push fallback. Both subscription helpers can delegate hints to that owner while
retaining their standalone defaults. Hints received before actual read dispatch
are covered by that read; hints received during it retain a trailing read. This
also preserves notification-ID deduplication. The history model already prevented
overlapping requests, but separate source coordinators could otherwise schedule
redundant later reads. Failure of a partial source registration removes its own
callbacks while the other source remains usable; hook disposal stops the shared
coordinator before retiring either subscription.

Every callback and queued read checks the captured account, account revision,
session epoch, active AppState and caller admission. Stop synchronously retires
the owner/coordinator before removing the channel, even when removal throws,
rejects or never settles. Background/inactive retires the visit permanently;
foreground does not silently recreate it. Partial registrations are cleaned up.

## Focused native owner

The existing call site is `src/app/dogovor/[id].tsx:205`, using
`useAgreementIncomingRefresh`, with a loaded participant, available chat, Poruke
tab and fresh workspace/foreground gate. `chatDostupan` maps only CONFIRMED and
SUPERSEDED Agreements. The current history model already owns bounded page/window
reads, a 15-second deadline, account/focus generation, one active/trailing read,
reading-anchor preservation and at most 200 retained messages.

`src/hooks/useAgreementIncomingRefresh.ts` now composes the service only for
`source.poreklo === 'supabase'`. The existing call site supplies Agreement ID and
current admission, so the route needed no edit. The native owner stops on blur,
source replacement, account/session changes, disabled/terminal/closure admission
and background. A new admitted foreground visit creates a new service owner;
duplicate active AppState callbacks do not replace listeners. Its callback remains
the existing `messages.refresh('silent')`; measured displayed-ID ACKs are unchanged.
No changes to the route, history reader/model, outbox, photos or ACK path are part
of this source package. Closed/disabled threads retain their existing canonical
history behavior and do not receive a new channel.

SUBSCRIBED is a channel-join hint, not proof of PostgreSQL stream readiness. The
additional system-OK hint also triggers catch-up, but this client unit does not
claim lossless transport or initial CDC-slot readiness. Focus, foreground, manual
and existing push-triggered canonical reads remain available. A silent remote
membership/closure change is not detected by inventing a DELETE stream or polling;
server RLS refuses new rows and subsequent canonical reads retain their authority.

## Validation and server evidence

The focused service suite passed 31 cases covering malformed/private/foreign
payloads, revision reset, burst and in-flight coalescing, SDK reconnect, queued and
retained callbacks, account ABA/session/focus/background retirement, stalled
channel removal, partial registration, failed reads, exact production filters,
captured scope and absence of Auth/RPC mutation. The first attempt did not execute
tests because an overbroad React Native mock omitted Platform; the fixture was
corrected to the repository's existing Proxy pattern.

The final focused integration command passed **3 suites / 73 tests**:

```text
npx jest src/data/__tests__/agreement-incoming-refresh-hook.test.tsx src/data/__tests__/agreement-invalidation-service.test.ts src/data/__tests__/agreement-incoming-refresh.test.ts --runInBand --silent
```

The real service and coalescer are composed with the hook in these tests; only
native Auth/AppState and channel/module boundaries are substituted. Cases cover
exact filters, Supabase-only admission, retained/queued callbacks, account ABA and
session changes, target/source replacement, blur/unmount, background/foreground,
duplicate active notifications, terminal/disabled admission, reconnect and a
trailing read while an earlier read remains pending. Existing push fallback tests
remain green. Cross-source same-turn/in-flight cases confirm one shared bounded
read owner, and partial registration cases confirm cleanup in both directions.
An initial integration fixture yielded before React committed its
retirement render; five assertions failed. Committing that render synchronously
before draining queued microtasks preserves the intended retirement assertion;
the final run passed. No full Jest, TypeScript, build or live chat write ran in
this client package. Root owns consolidated types and native acceptance.

Separately, exact application CI
[36345955454](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36345955454)
passed at `82fd28b3b3b5cf1804db6bc02807e9572724841f`, tree
`da71ff2e2deba2b1b40b7d32fb4bc47a67c77b26`. The independently verified application
report SHA256 is
`7fd12e085fae6e0e00d106894276be7e3037d9756b16aa3390ed622f33a06ec8`.
All 20 source pins, 12 application/closure checks, seven refusal cases, four later
drift cases, both canonical closures and stages 01–26 plus teardown passed.
That CI proves the application candidate on a disposable database. Subsequent DEV
application is recorded separately above; this client connection still has no
device-stream or Storage-object deletion acceptance.

Owned client files are `src/data/agreementInvalidationService.ts`,
`src/data/agreementIncomingRefresh.ts`, `src/hooks/useAgreementIncomingRefresh.ts`
and their three focused suites. No route source change was needed. Owned-file
whitespace and JSON receipt parsing checks passed; root performs integration,
commit and build.

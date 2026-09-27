# Private chat incoming hints — Round 06

2026-09-27. **SOURCE PREPARED; CHECKS PENDING INTEGRATOR. No native/provider/DEV mutation or acceptance.** The owner now permits ordinary UI/flow implementation and bounded package checks. Root runs consolidated types/focused tests; this subtask has not executed them.

## Problem and change

An open private Agreement thread refreshed on focus, foreground return, manual refresh and its own send, but did not react when a new push notification arrived. The existing installed Expo Notifications receipt/dropped-message listeners can request a fresh canonical read without trusting the push as a message, assuming Realtime publication, adding a dependency or starting polling.

`src/data/agreementIncomingRefresh.ts:11` adds an event-driven controller. The first hint schedules a read; further unique hints share one active read and one pending trailing read. Read starts are separated by at least two seconds. There is no timer without pending invalidation and no autonomous retry loop after a failure. The last 128 bounded native notification identifiers are held only for deduplication. They never become account, route, Agreement or message identities. Synchronous/async read failures are contained; the existing focused resource owns retained data and its refresh-error state.

`src/data/agreementIncomingRefresh.ts:52` owns deferred native-module subscription. Disposal is available before module resolution. A retired/inactive owner cannot install listeners later; partial registration failure removes the first listener; disposed native callbacks cannot enqueue more reads. Dropped notifications are an undifferentiated invalidation hint, not evidence that a particular message was sent, delivered or read.

`src/hooks/useAgreementIncomingRefresh.ts:11` binds that controller to navigator focus, strict active AppState, account ID/revision, session epoch, Agreement ID, source identity, current refresh callback and enabled presentation. Background/inactive state immediately retires the native listeners and queued work; foreground can establish a fresh listener when the caller is eligible. Unsupported platforms and disabled/unfocused views install none. This hook performs no initial read because the existing focused resource already owns focus/foreground reconciliation.

The unchanged strict foreground notification envelope from `PushRuntime.tsx` is now shared in `src/ui/notifications/publicInboxCopy.ts:44`. Both native presentation and incoming hints require the same admitted public title/body pair, push trigger, exactly `{ kind: 'INBOX' }`, bounded identifier and absence of private native decorations/images. Existing push presentation, navigation, permissions, registration and transport behavior are unchanged. A payload contains no trusted Agreement ID, so any admitted Inbox hint can refresh the currently authorized open private thread; no claim is made that the hint belongs to that thread.

## Integration and existing authority

Root owns route integration and AgreementChat visual/scroll/composer changes. The hook signature is:

```ts
useAgreementIncomingRefresh({
  accountId, accountRevision, agreementId, enabled,
  source: izvor,
  refresh: stableSilentMessageRefresh,
});
```

The route uses its existing `messages.refresh('silent')`: `supabaseIzvor.poruke` reads authenticated ordered message rows; `agreementPhotoClientService.messages` revalidates photo metadata in batches of 50. Its existing 15-second caller deadline and focused resource prevent a late snapshot from replacing a newer owner. The hint carries no text/photo bytes and cannot settle an outbox command. Existing exact command reconciliation still uses canonical message/body/photo identities.

Authoritative sources consulted: closure PLAN and CHAT_IMPLEMENTATION_BASELINE require incoming messages, paging and an exact displayed-message read boundary. This package advances incoming refresh only. Installed `expo-notifications@57.0.15` `build/NotificationsEmitter.d.ts` defines receipt and Android FCM dropped-message listeners; the [official Expo Notifications reference](https://docs.expo.dev/versions/latest/sdk/notifications/#addnotificationreceivedlistenerlistener) documents their registration/removal. Installed types are used instead of assuming the latest documentation's recommended package version. Root reported a fresh read-only DEV publication query returning no rows for the relevant chat/notification tables; no database Realtime contract is assumed or enabled.

## Bounds and open work

- Push availability, permission, OS delivery and connectivity govern hints. This is not a gap-free message stream or proof of two-device arrival.
- Focus/foreground and manual refresh remain reconciliation fallbacks. No new native network-reconnect monitor or background listener is added.
- The existing full-history read remains unpaged and re-enriches photos. Hint cadence/coalescing limits repeated starts but does not make history work bounded in row count.
- B3a/B3b remain unapplied and unwired. Existing Agreement-level notification acknowledgement is not an exact displayed-message read receipt; this module adds no acknowledgement or delivered/read state.
- No voice capability or recording permission is added. No server, provider, dependency, SQL/proof, certificate or live-data mutation occurred here.

## Focused check source

`src/data/__tests__/agreement-incoming-refresh.test.ts` covers no startup polling; duplicate/burst/throttle behavior; active/trailing cancellation; ownership change before the first microtask; rejected reads; inactive/disposed late module resolution; module failure and partial listener cleanup; stale native callbacks; strict payload rejection; and dropped-message invalidation.

`src/data/__tests__/agreement-incoming-refresh-hook.test.tsx` covers disabled/background/unfocused/web subscription refusal, foreground listener replacement without replay, and retained callbacks after account ABA, session replacement, source/Agreement change, disabled tab, blur and unmount. Existing push-runtime tests also cover the shared validator's presentation contract. These are prepared tests, not passing-test claims until the integrator records a run.

## Integrator execution

The final bounded run passed all eight rerun suites (368 tests), including this package. `ROUND_06_JEST_FINAL.json` records individual cases. TypeScript also passed. A separate chat run passed 38 cases. These are mocked/local source tests, not native/provider/device acceptance.

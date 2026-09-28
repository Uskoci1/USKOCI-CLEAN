# Round38 — P4 push / Inbox source proof and external gate

Date: 2026-09-28. Tested client source `b06480512d197168c0ef857bb151a0e143b3a667`; current branch is source-equivalent for P4 client files, later session commits are control/evidence only.

## Current client state

The exact full regression includes current Inbox, message push ingress, device registry, preferences, readiness, settings and runtime tests. The client keeps push as a hint and re-authorizes exact private targets through the Inbox/event resolver and B3 message window. Opening a notification is not a displayed/read ACK; only measured authorized message IDs reach the displayed-message write.

Permission/settings UI preserves unsaved choices, distinguishes opening OS Settings from an actually granted permission and fences stale/double callbacks.

Android token acquisition and owned session-bound registration have historical physical-device proof from 2026-09-26. It remains evidence of that APK only; it is not current release-artifact acceptance and does not cover iOS.

## Exact source evidence

GitHub Actions run [36400916665](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36400916665), exact code `b0648051`, TypeScript PASS and full Jest **342 suites / 7,214 tests PASS**. Included PASS:
- `inbox-native.test.tsx`
- `message-push-ingress.test.tsx`
- `push-device-client.test.ts`
- `push-preferences-native.test.tsx`
- `push-readiness.test.ts`
- `push-runtime.test.tsx`
- `push-settings-route.test.tsx`.

## Exact-message transport gate

Repository/control evidence still records the compatible P4 bridge as applied while exact-message transport remains **OFF**. The client/resolver can consume an exact event target, but enabling provider transport requires:
1. inventory/compatibility of active device registrations;
2. one real current event/message ID correlated through backend event → provider attempt → received notification → tap → authorized resolver → exact B3 window → displayed ACK;
3. cold/warm/already-open cases;
4. wrong-account/expired/removed-membership fallback;
5. final Android artifact and separate iOS/APNs proof.

This execution session attempted a read-only Supabase connection, but the connected Supabase account exposes projects different from the repository's canonical clean DEV project ref. No query/change was issued against an uncertain project, and the exact transport flag was not changed.

## Reminder P05

No existing verified scheduler/event path for the pre-appointment reminder was found in the current control evidence. P05 still requires a new server/event scheduling package and is intentionally not fabricated in the client.

## Status

P4 client/source is green; provider exact-message delivery and final native acceptance remain open. No server, Edge, flag, token, registration or provider mutation occurred in Round38.

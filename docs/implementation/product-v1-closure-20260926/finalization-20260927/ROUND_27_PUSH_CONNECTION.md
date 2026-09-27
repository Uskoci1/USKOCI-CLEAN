# Round 27 — compatible push entry and consolidated native acceptance

2026-09-27. **CLIENT IMPLEMENTED / TARGETED CHECKS PASS / TRANSPORT NOT APPLIED / NATIVE PUSH ACCEPTANCE PENDING.**

## Problem, cause and product decision

The live worker sends only `{kind:INBOX}`. Even after the applied P4 resolver and Inbox row integration, tapping a message push cannot identify the message. The compatible client now accepts either the old fixed payload or an opaque MESSAGE_RECEIVED event ID. It never accepts a provider route, message body or arbitrary extra fields.

The visible Inbox owns the authenticated resolution, independently of its loaded page. A successful target replaces that bridge with the correct Agreement/Poruke/exact message window. Missing events remain unavailable; transport/read errors offer an explicit retry. Merely resolving or navigating sends no read ACK. Existing displayed-message confirmation remains authoritative.

## Implementation and regression boundaries

`pushTarget.ts`, `messagePushIntent.ts` and `useMessagePushIngress.ts` add a strict parser, memory-only account/revision/session-scoped intent and focused foreground read. A newer tap wins; Back, background, account/session changes and explicit Inbox actions retire the attempt. Retries retain the visit but abort the previous read. An owner-bound one-use delivered marker prevents a slower cold Auth return from replacing the already opened chat, whether the root consumer starts before or after the resolution. Delayed native cold-response lookup cannot override a newer live tap.

Files: `src/ui/notifications/{pushTarget,PushRuntime,publicInboxCopy}.ts[x]`, `src/store/{messagePushIntent,pendingRoute}.ts`, `src/hooks/useMessagePushIngress.ts`, `src/app/{_layout,obavestenja}.tsx`; ingress, push-runtime, pending-route, session-layout and Inbox native regression tests. TaskCard, DiscoveryPeek, payments, dependencies and server recovery semantics are unchanged.

## Backend and rollout

Canonical DEV remains ledger208, with applied P0/P4/P5. The compatible Edge + SQL package is separately documented in `P4_PUSH_EVENT_TRANSPORT_20260927.md`. Its first run36344974563 retained8checks but failed because the synthetic provider reused a globally unique ticket; source SQL/Edge were unchanged. Only the fixture was corrected at b4561a9c and run36345502344 was dispatched. This client commit neither deploys that package nor enables the exact payload flag.

B3c disposable recertification run36344033190 passed5SQL/10Realtime/11closure checks, including two canonical closures and preserved unrelated data. See its separate receipt. DEV application and the final application-byte proof remain separate.

## Checks

- Final scoped client run: four suites/226 tests PASS. The combined process reported an existing forced-worker-exit warning; it is not clean resource acceptance.
- New ingress suite alone with `--runInBand --detectOpenHandles`:13PASS and no open-handle warning.
- Inbox native suite passed in the earlier package run. Initial new-hook fixture failure (incomplete React Native mock) and TypeScript account-ID narrowing error were corrected; neither is a product red-before claim.
- Final integrated `npx tsc --noEmit -p tsconfig.json`: PASS.
- Independent review found three cold-return/visit races, now corrected and covered. No full Jest, provider send or actual three-field push-tap proof is claimed.

## Device evidence and next action

APK run36344044088/source04b66de6/treeb61f9046 installed with `adb install -r` on emulator5556. APK and installed base SHA256 both `a046e6e8f90e310f8b281cc9687871e9f3956e09606a850f1f55376119a96e37`;72,804,121bytes. Session retained; Profile and manual worker profile load live DEV. This build includes P0/P4/P5, but not this new direct-push ingress. Native read-only review continues; it does not prove license saving, publication or full E2E.

The owner reconnected the physical Honor VKP-NX9 and authorized using it. ADB reports `device`; its existing package is `rs.uskoci.preview`, versionCode35, updated2026-09-26. The `rs.uskoci.dev` emulator APK is not installed alongside it. Build the existing compatible push-proof variant from this client commit and update in place, preserving the account/data. Verify signature/package/hash and actual native result before claiming success.

## Status

Working end-to-end core remains established historically. Whole-product release acceptance, voice recording/playback, direct provider delivery, iOS, bounded whole-map Discovery, legal/operator/export policy and store gates remain open. P6 now has a prepared PAGE/EXACT_PUBLIC source slice; it is not executed or wired and must not replace the full-collection mapper prematurely. Dashboard refresh is local; hosted publication remains pending.

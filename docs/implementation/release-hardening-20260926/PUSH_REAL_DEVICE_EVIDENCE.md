# Real Android push checkpoint — 26.09.2026

Status: **ANDROID DELIVERY OBSERVED / SAME-MESSAGE E2E STILL SEPARATE**.

## Build and registration

The first push-proof APK had correct Firebase Messaging integration but lacked the public Supabase runtime key and stalled at the launch splash. That build is not an accepted runtime.

Corrected source `463215ef8cfec4e8df9b52e55cacdc8a75dfe435`, workflow `36252278794`, passed config isolation, Expo config, native prebuild, Firebase enrollment checks, ARM64 release, APK manifest verification and artifact upload. The owner installed it and reported that the app opened normally.

After explicit notification enablement, fresh DEV read-back showed exactly:

- 1 active device;
- Android = 1;
- bound revision = 1;
- session binding present = 1;
- one active user;
- old CREATED/unstarted backlog = 0;
- attempts before proof = 0.

## One-shot real send

A temporary proof-only worker was deployed with POST scheduler calls remaining disabled. Its one-shot path admitted only:

- exactly one active, revision-bound, session-bound Android device;
- zero existing backlog;
- zero prior attempts;
- one fixed dedupe key;
- one existing Agreement owned by that active account;
- REQUESTER push + dogovor category enabled;
- quiet hours disabled.

GitHub Actions run `36254577674` invoked the path once.

Observed DEV state:

- proof durable event = 1;
- proof IN_APP delivery = 1;
- proof PUSH delivery = 1;
- push attempts = 1;
- PUSH state = `SENT`;
- attempt state = `TICKET_PENDING`;
- provider ticket is present;
- suppression = null;
- no other CREATED/unstarted push row.

The owner reported that the USKOČI notification arrived on the physical Android phone. Tapping the system notification opened Inbox.

The receipt scheduler intentionally does not make the ticket eligible for receipt claim until roughly 15 minutes later; therefore this checkpoint records Expo ticket acceptance and observed phone arrival, not an immediate provider-receipt claim.

## Navigation nuance

The synthetic one-shot event used `MESSAGE_RECEIVED` but did not insert a real chat message. It correctly routed Inbox → Agreement → Messages, where the UI correctly showed an empty conversation. That synthetic event is **not** used as proof that one real chat message travelled through the whole push chain.

A separate pre-existing real `MESSAGE_RECEIVED` Inbox event belongs to an Agreement with 2 real messages. The owner tapped that real Inbox row and confirmed it opened the correct Agreement/Poruke with the real messages visible.

Therefore we can state separately:

- real push delivery → phone → Inbox: **observed**;
- real MESSAGE_RECEIVED Inbox navigation → Agreement/Poruke with actual messages: **observed**;
- one same real message → event → push → phone → tap → exact message: **not yet a single-chain proof**.

## Cleanup

The temporary proof worker was removed immediately. Live `uskoci-push-transport` was restored to canonical GitHub source as v19. The one-shot GitHub workflow trigger was then deleted.

No blanket transport enablement or mass send occurred.

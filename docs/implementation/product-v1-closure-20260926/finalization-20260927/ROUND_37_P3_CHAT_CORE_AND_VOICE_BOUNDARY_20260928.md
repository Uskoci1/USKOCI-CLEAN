# Round37 — P3 chat core source closure and voice boundary

Date: 2026-09-28. Tested client source is `b06480512d197168c0ef857bb151a0e143b3a667`; current branch is source-equivalent for the reviewed chat files, with later commits limited to control/evidence documentation.

## Text/history/read lifecycle

Current Agreement chat keeps the already-applied B3a/B3b/B3c architecture:
- bounded history/window reads;
- exact message landing;
- durable outbox/client-message identity;
- deterministic refresh owner for push/realtime hints;
- displayed ACK only for measured authorized incoming IDs;
- older/newer paging and return-to-latest without fabricating read state;
- account/focus/background ownership and late-result fences.

The exact full regression run includes PASS for message client/history/read, chat UI/recovery and incoming-refresh suites. This does not replace two-device/native realtime proof.

## Photos

Current private photo composer/history keeps upload preparation distinct from a sent message. Failed media remains retryable as media; terminal Agreement history still permits authorized recovery of already-prepared/previous attachments while new sends stay disabled. The message row exposes the photo action independently of the text send action.

Exact full run includes PASS for:
- `agreement-chat-terminal-photos.test.tsx`
- `agreement-photo-composer.test.tsx`
- related photo client/journal/hooks suites.

Current exact native upload/open/retry on the consolidated APK is still pending.

## Group conversation

The current group route/service/controller is not inferred from a two-person chat. It has its own service and tests, server membership/permission contract and displayed-ID command ownership. The exact full run includes PASS for:
- `v5-group-conversation-controller.test.ts`
- `v5-group-conversation-screen.test.tsx`
- `v5-group-conversation-service.test.ts`.

This is source/CI evidence only; an actual multi-member native Agreement remains required.

## Voice — hard boundary, still unshipped

`CHAT_VOICE_CONTRACT.md` is explicit: voice messages are mandatory V1 functionality but **B1/B2 are not implemented and voice is unshipped**.

What exists:
- B0 bounded M4A structural validator with 36/36 source checks;
- a foreground PCM native module used for speech/level capture infrastructure;
- AI speech controls;
- the intended VOICE message/storage/idempotency/closure contract.

What does **not** yet exist for Agreement chat:
- applied private `agreement-voice` bucket/schema/upload lifecycle/message VOICE projection;
- closure/export integration required before DEV apply;
- versioned B3 read compatibility for VOICE;
- approved/installed native recorder-player dependency or equivalent encoded-M4A implementation;
- Agreement outbox VOICE union and actual voice composer/player;
- Android two-account record/upload/send/read/play proof; iOS proof.

No microphone button is added to Agreement chat merely to make the UI look complete. The current B3 readers reject unsupported VOICE/empty-body shapes, so enabling a writer first would be a compatibility defect.

Per repository constraints, B1 DEV application and any new native audio dependency require separate explicit approval. Round37 does not apply server/storage changes and does not install libraries.

## Exact source evidence

GitHub Actions run [36400916665](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36400916665), exact code `b0648051`: TypeScript PASS, full Jest **342 suites / 7,214 tests PASS**. Relevant suites listed above all PASS.

## P3 status

- Text/history/read/recovery: SOURCE/CI PASS; current two-device/native realtime/reconnect proof pending.
- Photos: SOURCE/CI PASS; current native media upload/open/retry proof pending.
- Group: SOURCE/CI PASS; actual multi-member native proof pending.
- Voice: BLOCKED/UNSHIPPED at B1/B2 pending explicit server/dependency approval and later device proof.

P3 is therefore **not complete** and must not be marked READY.

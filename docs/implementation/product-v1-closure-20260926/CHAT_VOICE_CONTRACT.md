# Chat 2.0 — Voice Message Contract V1

Status (2026-09-27): **B0 STRUCTURAL VALIDATOR SOURCE/CHECKS PASS; B1/B2 NOT IMPLEMENTED; VOICE UNSHIPPED**.

See `finalization-20260927/P3_B0_AUDIO_STRUCTURE_20260927.md`: 36 local structural checks pass, including malformed-track/sample rejection. The narrow AAC-LC subset has no real Android/iOS recording or decoder acceptance yet. This contract describes the intended voice feature, not deployed functionality.

Voice messages are mandatory V1 Agreement chat functionality. They extend the existing durable Agreement message/outbox identity; they do not create a second chat.

## Product behavior

Message presentation exposes an explicit server-owned kind:

- `TEXT`
- `PHOTO`
- `VOICE`

V1 keeps existing text+photo behavior. A VOICE message is voice-only: no text body and no photo assets in the same message. This avoids ambiguous retry/attachment combinations while V1 is closed. A later additive contract may allow captions.

Recording is foreground-only. The app asks for microphone permission only after the person explicitly starts the voice action. Leaving the app, changing account/Agreement, losing focus or cancelling retires the active recorder. No background recording service is enabled.

UX states:

1. idle microphone action;
2. recording with elapsed time + live level/waveform;
3. recorded preview with play/delete/send;
4. private upload pending;
5. message command pending;
6. confirmed sent;
7. unknown outcome with exact retry/readback.

A failed or unknown upload/message command is never drawn as sent.

## Native audio target

Target recording format: **AAC in MPEG-4 / M4A**.

V1 target encoder settings are voice-oriented:

- extension `.m4a`;
- MIME `audio/mp4`;
- AAC;
- mono;
- 64 kbps target;
- maximum duration **300,000 ms (5 minutes)**;
- minimum accepted duration **300 ms**;
- maximum admitted bytes **4 MiB**.

The proposed recorder/player uses `expo-audio` for Android/iOS. That dependency is not installed or approved; implementation and native compatibility remain pending. Background recording must remain disabled.

## Storage

Do not reuse `profile-media`. That bucket is image-only and its existing sanitization/storage contracts are JPEG-specific.

Create a new private bucket:

- id: `agreement-voice`;
- public: false;
- file size limit: 4 MiB;
- allowed MIME: `audio/mp4`.

Authenticated clients receive no direct INSERT/UPDATE/DELETE/SELECT policy for this bucket. Bytes travel through an authenticated Edge boundary that rechecks Agreement/session authority. The service role owns the Storage write/read.

No permanent public URL and no private Storage path is exposed to presentation code.

## Durable upload

Add a private `agreement_voice_uploads_v1` lifecycle, analogous in safety semantics to Agreement photos but audio-specific:

- owner account;
- Agreement + exact accepted version;
- client request id;
- attempt id;
- PROCESSING / STAGED / READY / FAILED / CANCELLED;
- input hash/bytes/type;
- validated content hash/bytes/duration;
- exact private storage path;
- dispatch state/outcome;
- attached message id.

One account + client request id identifies one immutable upload intent. Same key/different Agreement/version/hash is a conflict.

The Edge boundary validates the MPEG-4 container before stage/Storage dispatch. V1 does not call this “sanitization” or “transcoding”: it performs bounded structural validation (container/brand, duration metadata, audio marker, box bounds, file size). Any later transcoder is a separate security package.

## Message binding

Add one nullable `voice_asset_id` to `agreement_messages` with an attachment guard.

Server projection returns explicit `kind`; clients never infer VOICE from an empty body.

V1 message invariants:

- TEXT: trimmed body 1..2000, zero photos, voice null;
- PHOTO: 1..6 READY photo assets, body 0..2000, voice null;
- VOICE: body empty, photos empty, exactly one READY voice asset.

A voice asset may attach to exactly one canonical message. The message + attachment link + counterpart `MESSAGE_RECEIVED` event commit atomically.

## Idempotency / recovery

The existing sender-global `clientMessageId` remains the message command identity.

A lost response never allocates a new message key automatically. Retry reads/reuses:

- the exact voice upload command;
- exact voice asset id;
- exact Agreement version;
- exact message client id.

Outbox storage persists only the minimum voice intent metadata needed to recover. Audio bytes remain in the app's temporary private file until the server upload state is conclusively READY/CANCELLED/FAILED; logout/account change clears local voice drafts and outbox data for that account.

## Read / playback

The message page returns bounded VOICE metadata:

- asset id;
- durationMs;
- byteSize;
- contentType = `audio/mp4`.

Playback bytes require a fresh party/session authorization through the voice Edge read boundary. The app player never receives a reusable service credential or a public URL.

Only one voice player is active at a time. Playback state is local UI state and is not a server “read receipt”.

## Notifications

VOICE uses the existing `MESSAGE_RECEIVED` event.

System push remains:

- title: `Nova poruka u Dogovoru`;
- body: `Imaš novu poruku.`

No audio bytes, waveform, transcript or user-authored content enters push.

## Paging and read boundary

Voice ships as part of Chat 2.0, which also requires:

- newest page + older cursor pages;
- deterministic order/id de-duplication;
- arrivals while open;
- exact displayed-message acknowledgement boundary;
- no mark-read for messages not actually displayed;
- offline/replay protection.

B3a/B3b have now been proved, explicitly applied to canonical DEV and connected to the client: bounded history/window reads and exact displayed-message acknowledgements. See `finalization-20260927/ROUND_14_CHAT_B3_APPLICATION.md`. The broad legacy `rpc_mark_agreement_messages_read(agreement_id)` is not the authority for this new boundary. Actual realtime subscriptions (B3c) and exact notification targets (P4) have their separate proof/application gates.

Voice also needs an explicit compatibility rollout: current B3 readers emit only `TEXT`/`PHOTO`, and current clients reject unknown kinds or empty-body `TEXT`. A voice writer must not be enabled merely because its upload works. Prepare a versioned read projection plus an explicit old-client compatibility decision, prove history/page/window/ACK behavior, and only then enable sending. Current B3 application is not voice-read readiness.

## Account closure / retention / export — hard gate

The voice schema/bucket **must not be applied to DEV** until account closure understands it.

The same server package must update and prove:

- closure relation inventory/order;
- account-owned scope predicate;
- Storage delete enumeration/readback for `agreement-voice`;
- scoped evidence/hold behavior;
- no false CLOSED while a voice Storage write outcome is unknown;
- data-export inventory/projection decision;
- retention/catalog/source binding required by the current closure certificate model.

This is why voice is not implemented by merely adding an audio column and bucket.

## B package order

- **B0** — this contract + structural M4A validator + tests.
- **B1** — voice schema/bucket/RPC/Edge + closure/export integration in disposable proof.
- **B2** — `expo-audio` dependency/config, recorder/player, client journal/outbox union, AgreementChat UI.
- **B3** — chat paging + exact read boundary.
- **B4** — exact Android physical-device two-account voice send/play/retry; iOS/TestFlight proof later.

No B1 DEV apply until its closure proof is green.

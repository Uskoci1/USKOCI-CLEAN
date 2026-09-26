# Chat 2.0 implementation baseline — 2026-09-26

Read-only source inventory at `a5ef12bb`. This prepares the next package; it is
not new implementation, live DEV verification or two-device acceptance.

## Existing implementation

- `src/data/agreementMessageClientService.ts`: text and photo commands use the
  existing v2/v5 RPCs, stable client message identity, account/Agreement authority
  and explicit receipts. Text is bounded to 2,000 characters; photo messages
  support 1–6 assets. A missing receipt is not a confirmed send.
- `src/data/agreementOutbox.ts`: immutable commands survive locally and reconcile
  exact message/body/photo identities. Retry keeps the original command key.
- `src/data/supabaseIzvor.ts`, `citajDogovorPoruke`: all messages are read in
  ascending `created_at,id` order, without cursor or limit.
- `src/data/agreementPhotoClientService.ts`: metadata enrichment is batched by50;
  this does not page the message history itself.
- `src/ui/AgreementChat.tsx`: the returned history renders in a ScrollView.
  Focus, foreground return, manual refresh and own send refresh the data;
  there is no incoming-message subscription or polling loop.
- `src/app/dogovor/[id].tsx` and
  `supabase/candidates/pkg050a_agreement_messages_read.sql`: opening/reading the
  messages tab settles eligible Agreement-wide MESSAGE_RECEIVED notifications.
  It has no exact displayed-message boundary; individual message projections
  correctly keep `procitano: null` instead of claiming personal read receipts.

## Voice is not shipped

B0 includes `supabase/functions/_shared/voiceM4a.mjs`, its synthetic fixtures and
workflow. Its structural validation is not decoding or sanitizing arbitrary
audio. The contract's older “validator next” label is historical.

There is no Agreement voice SQL candidate, private upload/read Edge boundary,
explicit TEXT/PHOTO/VOICE client union, recorder/player or expo-audio dependency
in this source baseline. AI speech transcription is a separate existing flow,
not voice-message delivery or spoken AI replies.

## Next coherent package

1. B1: private voice authority/storage/send/read, stable retry identity,
   MESSAGE_RECEIVED emission, export and account-closure integration. Prove on a
   disposable database first, including unknown Storage-write outcomes.
2. B2: approved audio dependency/configuration, recorder, preview/player and
   durable voice outbox; microphone permission only on explicit recording.
3. B3: newest/older cursor pages, incremental incoming messages, deterministic
   ordering/deduplication and acknowledgement of displayed message IDs only.
4. B4: exact-build two-account Android acceptance, then independent iOS proof.

The owner must approve a new audio dependency, DEV/Edge application and any
closure-certificate change. No such approval is inferred from this inventory.
Legal/retention requirements and private playback authority remain intact.

## Two-device acceptance

- Send/play in both directions; cancel recording, background, navigate away and
  change accounts without recording continuing or a draft leaking.
- Interrupt upload and lose a send response; reopen and recover exactly one
  asset/message/notification using the same command identity.
- Keep B reading older history while A sends: no false read acknowledgement,
  stable position and an explicit way to reach new messages.
- Page long history while new messages arrive: no omissions or duplicates.
- Deny private playback after losing membership/session; preserve text/photo
  behavior and voice-only composition.

Real-device recording awaits the owner's explicit readiness to speak. No new
test accounts, real data deletion, provider calls or server mutations were made
for this preparation.

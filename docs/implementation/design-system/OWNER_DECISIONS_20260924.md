# Owner decisions — 2026-09-24

Recorded from the owner's answers in the UI unification session (branch `work/uskoci-ui-unification-20260924`).

1. **Voice notice wording approved.** `VOICE_PROCESSING_NOTICE` (`src/features/voice/useHoldToTalk.ts`), as rewritten in
   0846abf1 to match the rule that held speech sends on release: when the microphone is released, or tapped again in
   voice mode, the spoken text goes straight into the conversation; with "Pregledaj tekst pre slanja" on, or with a
   screen reader, it first lands in the message field and is sent only on Pošalji. Owner: "Je okej".
2. **Street names may be shown before a Dogovor.** A task detail may show the public route and place at street level
   without a house number (for example "Lenke Dunđerski · Novi Sad → Dositejeva · Novi Sad"), as the server's public
   projection returns it. The exact address (house number, entrance, private notes) stays revealed only inside a
   Dogovor. Owner: "Sme da prikaže ulicu". No code change was needed; this confirms the current behaviour.

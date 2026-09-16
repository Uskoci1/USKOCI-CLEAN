# PKG-011 — Slice 2: Dogovor workspace, conversation, changes, location, group, review

Date: 2026-09-16. Base `866f05d` (slice 1). Presentation and navigation only; every read, write, journal, ownership guard and copy contract of the Agreement flow is unchanged. One agent, no subagents.

## What the user gets

- **Dogovor overview** (`src/app/dogovor/[id].tsx` + new `src/ui/agreements/AgreementWorkspace.tsx`): top bar whose eyebrow is the Agreement state with tone (green confirmed, warm awaiting, muted cancelled); hero in a white card; a **next-step card** that says in the user's words what happens now (worker: "Kada završite, označite završetak"; requester: "Potvrdite završetak kada je posao obavljen"; awaiting: "Čeka se Naručilac" / "Uskočer je označio da je završio" with the server deadline; completed / cancelled); server-permission and pending-change notes live inside that card. People block; group conversation entry; contextual actions as **rows with hints and chevrons** (Izmene i otkazivanje · Dobrovoljna lokacija Uskočera · Bezbednost i privatna prijava); collapsible Kontakt / Lokacija i pristup / Tok Dogovora (timeline with a rail); problem report as a warm card with the same three-state logic; errors as a danger note with refresh.
- **Footer hierarchy** (decision taken under the owner's mandate): exactly one brand action per state — completion when the server's `radnje` allow it, *Oceni saradnju* after completion, otherwise *Otvori poruke*; the conversation stays one tap away as a secondary action whenever it is not the brand action.
- **Poruke** (`AgreementChat`): own messages right in soft green, the other party's left on white with the sender's name in green; pending sends keep their real outbox state text ("Šalje se…", "Poslato", "Slanje nije potvrđeno", "Nije poslato") with a danger-tinted bubble on failure and *Pokušajte ponovo* whose spoken label still names the message; white composer pill above the keyboard; send button ink when sending is possible, neutral when not; refresh/retry as quiet green actions.
- **Izmene**, **Lokacija Uskočera**, **Grupni razgovor** (`AgreementActionsScreen`, `AgreementLocationScreen`, `GroupConversationScreen`): moved from the AI-first scoped tokens to the shared system; groups and forms become white cards on the ground; group bubbles follow the chat bubble language. Controllers, journals, viewability and copies unchanged.
- **Ocena saradnje** (`AgreementReviewScreen`, `/oceni-dogovor`): intro title, one white card with the star radio group and tag chips (selected = green soft), saved receipt shows tags as chips, save as the brand action.

## Mobile behaviours decided here (owner mandate 2026-09-16)

| Area | Decision |
|---|---|
| CTA hierarchy | One orange action per state in the sticky footer; secondary white; contextual actions as rows; risky actions (changes, cancellation, problem) reached through rows/forms with consequences stated before the send (existing copies). |
| Progressive disclosure | Contact, private location and timeline stay collapsed; the timeline is a rail, not a third tab (DESIGN.md). |
| Recovery | Loading = skeleton with spoken status; unknown outcomes keep their copy and offer *Osveži status Dogovora* / *Osveži dozvole za završetak*; chat keeps unsent text and shows the real outbox state. |
| Transitions | Tabs switch without animation; sheets/keyboard handled by the existing KeyboardAvoidingView contract. |

## Proof

- `agreement-screen-recovery` (67 cases), `agreement-chat-ui`, `review-screen`, `v5-agreement-actions-screen`, `v5-group-conversation-screen`, `v5-agreement-current-location-screen`, `agreement-private-location`, `pkg005-calendar-navigation` green unchanged.
- New `pkg011-agreement-workspace`: one brand action per state (conversation / completion / review), next-step copy per state, unconfirmed permissions stay closed inside the card, rows present, timeline behind its section.
- `tsc` clean; full Jest recorded in the receipt.

## Next

Moje prijave, public Task detail and application composer (PKG-006 verified journal), then own Task detail + candidates (+ comparison view, owner decision 3).

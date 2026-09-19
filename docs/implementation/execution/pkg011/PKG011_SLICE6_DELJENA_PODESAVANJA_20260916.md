# PKG-011 — Slice 6: shared settings system and the account surfaces

Date: 2026-09-16. Base `0a45dd8` + slice 5. Presentation only; every client service, journal, controller and spoken label of the account surfaces is unchanged. One agent, no subagents.

## What the user gets

- **One settings system** (`src/ui/settings/SettingsPresentation.tsx`, same exports and props): ground background, white lists with 60pt rows, a green icon disc per row, quiet uppercase-free group titles, sentence-case green kickers, `SettingsAction primary` = the shared brand action (orange surface, ink text), `SettingsPanel` as a white card, soft panels in green wash, `SettingsInfo` rows. Because every account surface is built from these pieces, the restyle reaches them in one pass: **Profil hub**, **Ime na profilu**, **Fotografija profila**, **Obaveštenja** (push preferences), **Bezbednost**, **Blokirani korisnici**, **Podrška** (inbox, new case, case detail, operator), **Izvoz podataka**, **Privatnost i podaci** with account closure, **Pravila i saglasnosti**, **O aplikaciji**, **Fotografije zadatka**, **Pitanja o zadatku**.
- **Profil hub** (`/profil`): identity card on white with green initials disc, name, city, the intent as a green chip, reputation, avatar action and the explicit *Pređite na …* switch (owner decision 2: the only place the intent changes by the user's own choice); grouped rows below; sign-out quiet at the end.
- **Obaveštenja** (`/obavestenja` inbox): ground + white items, unread items on green wash with a stronger border, filters as a tab list, empty state with the original inbox vector and a sentence-case kicker; the cross-intent transition sheet from slice 1 stays.
- Remaining account screens moved from the SPOJ V2 and AI-first scoped tokens to the shared system through a mechanical, asserted migration (colors, type, radii, spacing), so their copies and structures are untouched: push preferences, safety, support presentation, closure dialog, legal documents, Q&A screen, personal data, export, privacy, legal route.

## Mobile behaviours decided here

| Area | Decision |
|---|---|
| Settings rows | Label + one-line detail + chevron; the leading icon sits in a small green disc so rows scan as a list, not as buttons. |
| Brand action | At most one orange action per settings screen (`SettingsAction primary`); everything else white, quiet or destructive text. |
| Kickers/group titles | Sentence case, quiet color; the previous tracked uppercase eyebrows are gone (frontend-design guidance, DESIGN.md typography). |

## Proof

- `inbox-native`, `profile-hub`, `push-preferences-native`, `push-settings-route`, `v5-avatar-screen`, `v5-safety-screen`, `data-export-screen`, `privacy-retention-screen`, `ClosureDialog`, `legalScreens`, `TaskQaScreen`, `SupportContextEntry`, `SupportScreens`, `v5-task-photos-screen`, `publication-screen`, `task-detail-screen` green unchanged (16 suites / 258 tests).
- New `pkg011-slice6-presentation`: settings screen header, row roles/hints, one brand action, panels, kicker case.
- `tsc` clean; full Jest recorded in the receipt.

## Not in this slice (still owner-approved V5 or PKG-014-bound)

`/nova`, `/pregled-zadatka`, `AiConversationShell`, `VoiceComposer`, `IntakePresentation` keep the approved V5 AI-first look. Manual entry, photo cancellation, Q&A activation and account closure execution remain PKG-014-dependent for their live RPCs; their presentation is now on the shared system.

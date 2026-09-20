# PKG-011 — Slice 5: worker profile suite

Date: 2026-09-16. Base `0a45dd8` (slice 4). Presentation and navigation only; the four-operation profile writer with readback, the worker AI turn journal, the availability/location client services and every pinned label are unchanged. One agent, no subagents.

## What the user gets

- **Radni profil** (`WorkerProfilePresentation`, `/profil/radnik`): frame with back, eyebrow *Ja mogu* and title; hero card with initials, name and a **status chip** whose tone follows the server state (green active, warm draft, danger suspended); one card *Ko ste i šta preuzimate* (name, team capacity, skills as green chips with ×, add row with a green *Dodaj*); *Alat i vozila* and *Kratko predstavljanje* behind rows; *Područje rada* card with read-only city/radius and the map action; availability card with the read-only switch and the two quiet links. Footer keeps the route's dynamic primary as the one brand action (*Sačuvaj profil* → *Podesi područje rada* → *Dopuni osnovne podatke* → *Unesi kapacitet tima* → *Proveri i aktiviraj profil*), *Sačuvaj kao nacrt* quiet.
- **Razgovor o profilu** (`/profil/razgovor`, `WorkerAiPresentation`): the live proposal card and the review/manual panels on the shared system (white sections, quiet labels, warm activation card); *Sačuvaj i aktiviraj profil* / *Sačuvaj profil* as the brand action. The conversation shell itself (`AiConversationShell`, `VoiceComposer`) stays as the owner-approved V5 experience.
- **Dostupnost** (`AvailabilityForm`, `CalendarControls`): calendar screens on the ground with white cards; *Radni profil* / *Izuzetak od nedelje* as sentence-case green eyebrows; weekday toggles and the state radio in green; special dates warm; every `CalendarAction primary` is now the shared brand action; civil date/time fields with quiet labels and a green calendar glyph.
- **Raspored** (`/raspored`): same copies pinned by the scope test; week strip in green with the orange dot for days with Agreements; cards on white.
- **Područje rada** (`/profil/lokacija`): title type and the map block as a card; controls inherit the slice 4 location system.

## Mobile behaviours decided here

| Area | Decision |
|---|---|
| Progressive activation | The footer's single brand action tells the worker the next missing step; secondary saves stay quiet. Status is a chip with tone, never color alone. |
| Chips | Skills/tools/vehicles as removable chips with a visible ×; the spoken label keeps "Ukloni …: value". |
| Read-only facts | City, radius and *Dostupan sam* render as locked fields with a hint on where they are edited, instead of looking editable. |

## Proof

- `worker-profile-native`, `pkg005-worker-onboarding`, `worker-ai-conversation-recovery`, `pkg005-calendar-scope`, `w02-calendar-native`, `w02-calendar-picker`, `w02-location-native`, `workerAreaSearch`, `profile-hub`, `v5-agreement-actions-screen`, `application-composer-read`, `application-selection-native` green unchanged.
- New `pkg011-slice5-presentation`: frame/intent, field labels as spoken names, tools behind a row, chip removal, navigation, status tones, read-only switch, status block.
- `tsc` clean; full Jest recorded in the receipt.

## Next

Shared settings system (`SettingsPresentation`) — profile hub, personal data, avatar, notifications, safety, support, export, privacy/closure, legal, about, Task photos, Q&A — in one pass.

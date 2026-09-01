# USKOČI HTML — Functional Coverage Wave CQ

Status: **REFERENCE COVERAGE PATCH PREPARED / PHYSICAL HTML REPLACEMENT REQUIRED**

Canonical physical reference path:
`docs/reference/USKOCI_HTML_REFERENCA_IZGLEDA_APP.html`

Prepared replacement SHA-256:
`5ada3a73ef9585a2fe29832e530c59d2f21804518b09b8ec0a2f8c3b1e78dad2`

## Added reference coverage

Wave CQ closes the following visible product-entry gaps without redesigning the existing HTML direction:

1. `HITNO` toggle during requester AI Need creation and review.
2. Rich Worker resources editor: vehicle type, carrying/cargo capacity, seats, team size and tools.
3. `Obaveštavaj me za ove filtere` action in Worker marketplace discovery.
4. Separate `Prijavi korisnika` safety flow.
5. `Blokiraj korisnika` action, distinct from reporting a Need/Opportunity.
6. Photo attachment entry in Dogovor chat (camera/gallery reference behavior).
7. `Otvori navigaciju` entry in active Dogovor.
8. Account/data-rights surfaces: change contact, active sessions, export data, delete account.

## Validation performed

The prepared HTML replacement was checked as follows:

- all inline JavaScript blocks pass `node --check`;
- loaded in headless Chromium using DevTools `Page.setDocumentContent`;
- R02 HITNO control rendered and toggled state;
- W03 saved-opportunity-alert control rendered and toggled state;
- W08 expanded resources sheet opened and saved values;
- W04 user-report flow opened and recorded a report state;
- S07 account/data-rights group rendered and export-data flow opened;
- D03 photo attachment flow opened and added a reference message;
- D02 native-navigation entry and user-safety actions rendered;
- existing Auth layer remained present;
- observed JavaScript runtime exceptions: **0**.

## Important

This remains a **reference-only HTML**. These interactions document intended product coverage and must not be treated as proof that Expo/React Native device APIs, Supabase writes, push, permissions, camera, voice, maps, account deletion or data export are production-wired.

The production priority remains: functional Expo end-to-end flows first, then visual polish, while Auth keeps HTML visual parity.
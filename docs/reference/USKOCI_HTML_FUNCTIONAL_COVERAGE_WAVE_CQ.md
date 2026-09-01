# USKOČI HTML — Functional Coverage Wave CQ

Status: **REFERENCE COVERAGE PATCH PREPARED / PHYSICAL HTML REPLACEMENT REQUIRED**

Canonical physical reference path:
`docs/reference/USKOCI_HTML_REFERENCA_IZGLEDA_APP.html`

Prepared replacement SHA-256:
`8cc0d6810dc53f0cfb3cd34a3182cbfd3defcc93cd144c6a6bad7ca0556e7a5c`

## Added reference coverage

Wave CQ closes the following visible product-entry gaps without redesigning the existing HTML direction:

1. AI-derived urgency during requester Need creation: **no separate HITNO toggle/button**. AI infers urgency from natural-language input; if the wording is ambiguous, production AI should ask a short confirmation before canonical save.
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
- explicit `Označi kao HITNO` UI and CQ urgency toggle are absent;
- urgency inference is modeled as an AI-derived fact from requester language, with negation handling (`nije hitno`, `ne mora odmah`, etc.);
- W03 saved-opportunity-alert control is retained;
- W08 expanded resources sheet is retained;
- W04 user-report flow is retained;
- S07 account/data-rights group is retained;
- D03 photo attachment entry is retained;
- D02 native-navigation entry and user-safety actions are retained;
- existing Auth layer remains untouched by this correction.

## Important

This remains a **reference-only HTML**. These interactions document intended product coverage and must not be treated as proof that Expo/React Native device APIs, Supabase writes, push, permissions, camera, voice, maps, account deletion or data export are production-wired.

The production priority remains: functional Expo end-to-end flows first, then visual polish, while Auth keeps HTML visual parity.
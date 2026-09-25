# R11 — purposeful screen composition

Date: 25 September 2026. Integration target: `work/uskoci-ui-unification-20260924`.

The owner asks for an airy, modern application in which every screen, command and search has a purpose. The seven
Airbnb screenshots clarify spacing and hierarchy, not a requirement to copy booking controls. Logos and bottom
navigation are not mandatory on every surface. Existing business facts, authority and recovery remain authoritative.

## Source inventory

`SCREEN_AUDIT.md` and `SCREEN_INVENTORY.json` map 40 active destinations and five redirects. Each entry records the
screen's decision, actual controls, search purpose, placement, return path, states and proposed refinement. The
internal galleries cover many presentation states but are not evidence of real account journeys. `CAPTURE_PLAN.json`
separates safe fixtures, existing read-only routes and destinations requiring an authorized context.

## This implementation batch

- Discovery: search becomes the header. Filters remain adjacent and secondary publication/profile/notification
  entries move into one dismissible menu. This gives the map more room while keeping each destination accessible.
  Task rows use larger title/fact text and open spacing; non-numeric price explanations sit below the full-width
  title. The map preview and own-task controls retain their existing commands and truthful facts. Attribution keeps
  all three source links and touch targets with a quieter background.
- Offers: person-first rows show 56 dp portraits, a separate total/people row and two-line notes. Comparison remains
  optional. Full offers retain all accepted terms, confirmation and recovery. Public profiles keep a 96 dp portrait
  with an equally sized initials fallback and adaptive trust sections.
- Agreement chat: when the keyboard or large text reduces space, complete identity/terms join the history scroll.
  A compact Back / Poruke / Uslovi bar remains available. The draft and photo tray survive resizing; recovery and
  photo preparation can scroll instead of displacing writing. The input remains scalable and scrollable.
- AI conversations: the opening retains the brand; transcript turns use a quiet speaker label. Idle opening art is
  static. Real processing dots and purposeful arrival/press transitions remain, with the existing Reduce Motion
  behavior. No provider, microphone or message contract changed.

Alternatives considered: keep and compress duplicate map headers, search-led map (selected), or hide all tools in a
drawer (rejected because search would become harder to reach). For chat: collapse all identity in fixed chrome,
move full context into history (selected), or create another terms sheet (unnecessary duplicate surface). Offer
alternatives and rationale are in `PEOPLE_OFFERS.md`.

## Verification status

Types passed after source integration. First full Jest run: 310/313 suites passed; three old layout assumptions
failed. The workspace harness inherited font scale 2 while asserting normal chrome, and mocked away the new
context slot. It now explicitly covers normal and compact layouts while retaining price, waiting and navigation
assertions. Public portrait size was restored to 96 dp after review. The old 42% price-word cap assertion now checks
full-width text and truthful price styling. Focused checks passed. Final combined run passed: **313 suites / 6,083
tests**, 147.56 seconds; types clean. The existing Jest worker-teardown warning remains; it is not a native acceptance
result. Checks used `npx tsc --noEmit -p tsconfig.json` and `npx jest -w 3 --testTimeout=30000`.

APK run `36121421114` passed on source `add23b4660304b3346e116fcdeb58150e26d382b`. Both attestations match the
source/tree/run/APK hash; replacement installation succeeded with existing app data preserved. `RECEIPT.json`
and `NATIVE_REVIEW.md` record 38 primary screens (32 inert examples, six existing read-only routes) and ten extra
states. Authentication and recovery still need their own context. Normal and 320 dp/font-2 docked-keyboard checks
confirm the R11 chat commands remain visible and history scrolls independently. Narrow media-caption, map-camera
and filter-label follow-ups remain explicit. No physical phone is attached; emulator evidence is not phone
acceptance. `dev-latest` was not changed.

## Remaining scope

This batch is not completion of all 40 screens. The audit proposes the next groups: publish/review/location forms;
worker profile/calendar; support/privacy/auth; remaining root collection cleanup. Group/support conversations need
their own keyboard checks. Safety target identity and block confirmation need a bounded client proposal without
changing authority. Authentication/recovery and actual participant-specific screens require genuine authorized
context, never fabricated credentials or a bypass.

Server reads, ownership retry, historical rating fan-out, human-chat freshness/pagination, push/legal/payment/store
gates remain separate functional work in the control table. No server, Edge, migration, payment, dependency, secret
or real business data mutation is included here.

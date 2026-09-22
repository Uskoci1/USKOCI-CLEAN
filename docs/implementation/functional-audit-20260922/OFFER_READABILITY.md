# Offer readability and message previews

My Applications: recognise a sent offer, its status and the next allowed action.
Candidate list: compare price, people, time and the person's message before opening
their full offer. These are the next client-only parts of F10 / B09-B10 / A11.

Compositions considered: dense table (poor on phones and large text), full-detail
cards everywhere (slow scanning), and compact fact cards with a short message
preview on candidates and the full saved message on one's own application.
Choose fact cards. The exact requested application is identified as opened; that
label describes navigation, not a new server status. V28 FactArt and Inter remain.
Green task titles, a separate total, and people wrapping below it on narrow screens
keep the offer legible. Visible row commands are short; their accessible labels
retain the task title so assistive technology distinguishes repeated commands.

The candidate list shows up to two lines of the actual nonblank message. Opening
still reveals the whole message; rendering a preview does not mark it viewed or
select it. Comparison columns retain their aligned existing facts. No RPC, server
policy, command validation, retry or reconciliation changed. Existing arrival and
press motion continues respecting reduced motion; no dependency added.

Phone inspection of the preceding 50178e6b build found a three-line price label
misaligning the two inputs at font scale 1.15. The visible label is now 'Ukupno
(RSD)', with the full existing accessible label and pricing explanation retained.
Input bottoms align even when labels wrap. The price basis and payload are unchanged.

Matches UX_NACRT section 5 step 3 and the offer/selection parts of sections 7-8.
No product-policy deviation is introduced. This is not a claim that all F10 flows
are accepted, nor that a browser fixture proves a native/server submission.

Evidence: 242 suites / 4710 tests passed; after final layout-only adjustments,
types and 96 focused tests passed. Browser inspections at 320 and 390 CSS pixels
used actual presentation components with labelled, disconnected fixtures. Native
inspection of 50178e6b confirmed review contents, reachable footer and Android Back
preserving the draft; no offer was sent. The new APK, exact-build phone checks and
independent Claude review are tracked in OFFER_READABILITY_RECEIPT.json.

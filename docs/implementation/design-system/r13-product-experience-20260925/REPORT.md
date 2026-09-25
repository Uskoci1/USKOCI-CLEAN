# R13 — product experience, 25 September 2026

The owner's latest instruction asks for a substantial creative refinement on clean white, with strong reading hierarchy and fluid behavior. Historical visual recipes are reference material, not constraints on layout. Business facts, privacy, recovery and accessibility remain constraints.

## Implemented scope

- Home: two illustrated starting actions on one open white surface; attention as a short inbox; one clearly distinguished upcoming appointment. The real four reasons, counts, roles and destinations remain.
- Discovery cards and map preview: full-width work title, clear price/capacity line, larger fact illustrations and a 56 dp publisher portrait. Missing prices remain neutral words. No invented photos or reputation.
- Search: fixed heading, ruled expandable sections and selected-value summaries on an opaque white surface. One newly expanded section is revealed; subsequent layout changes do not seize scrolling. Large text gets full-width date-mode options. Draft, apply/discard, counts, keyboard and screen-reader behavior remain.
- Task detail: open white page, prominent truthful terms, adaptive logistics, larger publisher, existing photographs and complete requirements. Owner applications and every relationship-dependent footer remain.
- Offer: task context, stronger amount input, people/time group and message; review and result use the same real terms. A confirmed or uncertain result now includes the submitted note. Confirmation returns to the top of the screen.
- Map: first bounds fit waits for real map and overlay measurements. Its exact verification is documented in MAP_FRAMING.md.

Alternatives and rationale: HOME.md, DISCOVERY.md, DETAIL.md, OFFER.md. Existing press feedback, list arrivals, native navigation, draggable map sheet and success motion are retained. No decorative idle animation or perpetual logo animation was introduced.

## Integration review

The independent review caught two errors before the release gate: nonnumeric unknown price wording was accidentally labelled as offers; an unsupported 44 dp Avatar size would have broken the typed component contract. Both were corrected. The unknown-price test failed before its correction and passed afterward. The shared supported portrait size is now 56 dp. The full suite then exposed the route's old 32 dp photo-fallback condition; it now also covers the new 56 dp portrait. Peek assertions were updated to the new title/decision anatomy without weakening scroll, close or overflow checks. The final type check and all 314 suites / 6,098 tests pass, with the existing Jest worker-teardown warning.

## Verification and boundaries

Read CHECKS.json and RECEIPT.json for completed checks, exact source, APK and native observations. Until those exist, this document describes implementation, not acceptance.

No server, migration, Edge, payment, provider, secret or dependency changes. No paid AI calls, microphone exercise, real task command, account deletion or data reset. Inert native galleries exercise the same presentation components with local fixtures; they do not prove real publication, selection, completion or payments. Read-only live Discovery observations are recorded separately and private task screenshots are not committed.

The whole app is not being declared finished by this batch. R11's remaining long-form, Safety, media and support/group-chat observations; real journeys on phones; AI provider/voice behavior; payments, legal and store gates remain separately tracked. Remote control-page upload must not be claimed from local JSON generation.

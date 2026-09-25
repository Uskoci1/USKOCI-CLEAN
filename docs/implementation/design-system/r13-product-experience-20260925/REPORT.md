# R13 — product experience, 25 September 2026

The owner's latest instruction asks for a substantial creative refinement on clean white, with strong reading hierarchy and fluid behavior. Historical visual recipes are reference material, not constraints on layout. Business facts, privacy, recovery and accessibility remain constraints.
The owner's subsequent typography clarification makes ordinary system text the visual baseline. Large-text checks
are bounded overflow checks; they must not dictate or inflate the ordinary composition.

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

### Native-driven refinement

The initial APK, run 36135521690 at source be72399d, was attested and installed without clearing data. Fourteen
bounded captures cover Home, first entry, real read-only map/detail/search and inert offer review/recovery/result.
Ordinary system text is the visual baseline. A brief 320-dp/font-2 input check confirmed that a typed two-digit
people value and the existing capacity refusal remain visible; emulator density/font were restored to 420/1.0.
No user submission was made. The initial native pass exposed two refinements: normal offer amounts were too strong
at 32 sp, and choosing a local pin left the camera at the regional overview. The correction uses 28 sp amounts in
offer/detail and an explicit-selection neighborhood camera. Its source checks and APK are recorded separately;
the initial captures are not evidence of the corrected camera or typography.

The correction passes the type check and the full suite: **314 suites / 6,113 tests**, 120.199 seconds, exit 0.
The existing forced-worker-teardown warning remains. No additional test was added just to mirror typography styles;
new regressions exercise camera intent, privacy and interrupted/deferred selection behavior.

Read CHECKS.json and RECEIPT.json for completed checks, exact source, APK and native observations. Until those exist, this document describes implementation, not acceptance.

Correction APK **36138797360**, source **1b018b17**, is attested and installed with data retained. Four fresh normal-size
views confirm calmer offer/review amounts and neighborhood framing of the selected public pin; closing the preview
keeps the camera and all seven results. `NATIVE_REVIEW.md` separates these from the initial fourteen observations.
This completes the bounded R13 package; physical-phone and real-journey acceptance remain open.

No server, migration, Edge, payment, provider, secret or dependency changes. No paid AI calls, microphone exercise, real task command, account deletion or data reset. Inert native galleries exercise the same presentation components with local fixtures; they do not prove real publication, selection, completion or payments. Read-only live Discovery observations are recorded separately and private task screenshots are not committed.

The whole app is not being declared finished by this batch. R11's remaining long-form, Safety, media and support/group-chat observations; real journeys on phones; AI provider/voice behavior; payments, legal and store gates remain separately tracked. Remote control-page upload must not be claimed from local JSON generation.

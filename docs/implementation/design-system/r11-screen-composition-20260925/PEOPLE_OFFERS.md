# R11 — people and offers

Date: 2026-09-25. Client presentation refinement, prepared over integration HEAD
`62e6009c3d00ae7499f19145412707c3877f9d8e`. This document records this bounded part of the
combined R11 change; its final source/APK receipt belongs to the parent package.

## Intent and chosen composition

The requester needs to understand who is offering, what the total covers, what the applicant says,
and the exact terms before choosing. The previous row placed a 40 dp portrait, name, trust, and price
beside each other; long identities competed with price. The public profile also used different
portrait sizes for a caller-supplied photo and its initials fallback.

Three compositions were considered:

1. A dense table led by price, people, and time. Efficient comparison, but weak person/message hierarchy.
2. Large portrait cards with an editorial introduction per applicant. Strong identity, but excessive list
   height and less direct access to terms; it would also imply a photo-rich product where photos are optional.
3. Spacious person-first rows, optional comparison, then a complete offer and public profile. Selected:
   people and their words lead, terms remain explicit, and the comparison stays an intentional command.

The current master plan, owner references in `OWNER_AIRBNB_REFERENCES_20260925.md`, R10 offer/profile notes,
and `mobile-app-ui-design` informed this choice. No Airbnb assets or new dependencies are used.

## Implementation

| Surface | Current composition and preserved contract | Source |
| --- | --- | --- |
| Candidate list | White rows with quiet separators, 56 dp portraits, 20 sp names, separate total/people row, 16 sp two-line message preview. At narrow/large text the total and its basis stack without a one-line clamp. One press opens the full offer. Counts remain actual loaded/eligible counts; sorting remains local and stable. | `src/ui/v2/CandidateFace.tsx:145`, `src/ui/v2/ApplicationSelectionPresentation.tsx:89` |
| Optional comparison | Same exact amount, people, and time in the same order; quiet grouped surface, 40 dp portrait, identity height accounts for the larger trust line. Existing two-column eligibility and single-column fallback remain. | `src/ui/v2/CandidateFace.tsx:200` |
| Complete offer | Person/profile entry, a single grouped terms block, then full selectable message. 24 dp separates unrelated sections. The total explicitly states how many people it covers; proposed time remains distinct from task time. The pinned choice, confirmation, selected-link readback, blocked state, unknown outcome, and retry are unchanged. | `src/ui/v2/ApplicationSelectionPresentation.tsx:279` |
| Public profile | The sheet keeps the larger 96 dp photo and gives initials the same 96 dp portrait. Offer rows remain 56 dp. Headline/location, trust, biography, and safety have separate reading space. Trust facts stack below 360 dp or at rounded scale 1.3+, with no fixed cell height. | `src/ui/system/PublicProfileSheet.tsx:32`, `src/ui/system/PublicProfileSheet.tsx:88` |
| Accessibility | Candidate essential facts moved to `accessibilityValue.text`; the optional hint describes opening. Rating/count/verification availability flags still govern truth. Full biography remains selectable. Offer/profile errors retain alert roles and now use a polite live region. | `src/ui/v2/CandidateFace.tsx:165`, `src/ui/system/PublicProfileSheet.tsx:77` |

All source references above are one-based. No new search, account command, backend call, fabricated fact,
route behavior, capability badge, logo, or navigation element was introduced. Existing route-owned reads,
guards, revision/hash checks, confirmation retirement, journals, and selection commands remain in place.

## Verification completed

Focused command:

```text
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/data/__tests__/candidate-face.test.tsx src/data/__tests__/application-selection-native.test.tsx src/ui/__tests__/public-profile-safety-entry.test.tsx
```

Result: **3 suites / 82 tests passed**, 17.313 seconds. The first pass found three existing tests still
reading facts from the old hint location. They now assert the same exact payload through
`accessibilityValue.text`; no expected fact or behavior was dropped. New coverage checks photo/fallback
size consistency, long terms at 320 dp/scale 2, exact full-note preservation and confirmation, unavailable
trust flags, and stacked profile facts at narrow/enlarged text. Existing native tests cover selection,
unknown outcomes, frozen retries, prior-account/late reads, and selected Agreement links. Safety tests
cover the real safety hook with mocked reads, unavailable/refused targets, and duplicate-press admission.

Root review restored the owner's larger public portrait: 96 dp photo and 96 dp initials/person fallback,
while list/offer portraits stay 56 dp. The shared Avatar API is unchanged. Correction verification ran
`candidate-face.test.tsx`, unchanged `task-detail-poster-route.test.tsx`, and
`public-profile-safety-entry.test.tsx`: **3 suites / 39 tests passed**, 10.7 seconds. The existing poster-route
expectation for a 96 dp public photo was preserved. Candidate/profile tests now verify the 96 dp initials
slot too; spacing and responsive stacking remain in place.

Scoped `git diff --check` passes. No provider call, live-data write, dependency installation, full test run,
APK build, or device operation was performed for this subtask.

## Existing gallery and open acceptance

Use **`uskociapp://dizajn-kandidati`**. The existing file
`src/app/dizajn-kandidati.tsx` does not parse a `scene` query. Its bottom strip selects:

- `Lista`, `Dugačka imena`, `Veliki tekst (raspored)`; `Uporedi` opens comparison from the list.
- `Ponuda`, `Ne može izbor`, `Izabrana`, `Ishod nepoznat`, `Ponovi izbor`, `Dogovor sklopljen`.
- `Javni profil`, `Profil: učitavanje`, `Profil: greška`; also list `Prazno`, `Učitavanje`, `Greška`.

These are existing local presentation fixtures. No new fixture or fake DEV record was added. The large-text
scene forces the layout branch only; it is not evidence that system text scaling was exercised.

The combined source-bound APK still needs before/after observations at normal and enlarged system text:
list scanning, long name/amount, comparison, full-note scrolling above the pinned action, confirmation,
unknown/retry, and profile trust/biography/safety reachability. Test portrait loading/fallback and screen-reader
facts with hints disabled on a real device. Two-column long-price wrapping and native sheet growth are visual
acceptance items, not conclusions inferred from Jest. Types/full regression, APK evidence, and phone/screen-reader
acceptance remain the combined R11 owner's work; this document does not claim those passed.

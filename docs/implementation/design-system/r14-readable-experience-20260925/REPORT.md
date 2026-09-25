# R14 — readable type, agreements and account surfaces

Owner direction, 25 September 2026: stronger, attractive, legible letters without oversized normal text; continue
coherent modern UI/UX batches. White reading surfaces remain. Baseline: `86e1679f`, installed app source `1b018b17`.

## Implemented

- Shared body, copy, note and conversation text now use the bundled Inter Medium face. Semibold and bold retain
  emphasis. Sizes, leading and ordinary price scale are unchanged. Secondary ink is `#525252` (7.81:1 on white,
  previously 6.10:1); fact ink is `#404040` (10.37:1). Measurements use sRGB relative luminance. Text inputs use the
  same bundled face without synthetic font weight. This also reaches search and AI reading surfaces.
- Agreement lists separate the person, task, accepted logistics and accepted total; 56 dp portraits and two-line
  identity retain actual data and existing fallback. Attention/rating actions, ordering and filtering are unchanged.
- The Agreement overview now leads with its existing next-step card, followed by the accepted terms and total.
  The real route and inert gallery use the same order. No new status, permission or business command was created.
- Chat keeps the person's name visible in its compact normal-text keyboard header, with full identity/terms still
  reachable. Refresh is a quiet 48 dp command; focused writing has a green edge. R11-N02's pending/reserved/retry
  photo explanation now takes the full row width. Ready photographs keep their compact strip. Exact controller
  calls, limits, reserved-media guards and uncertain-outcome recovery remain unchanged.
- Profile groups identity/editing, work setup, availability/calendar shortcuts, account/help and privacy. All old
  destinations remain. Settings use open white groups, strong small headings and colored art without repeated grey
  icon discs. This shared presentation also affects privacy/support screens and needs representative native review.

## Composition decisions

| Surface | User's job | Alternatives considered and selected |
| --- | --- | --- |
| Agreements | Recognize the accepted job and act on its real state. | Flat inbox hides terms; a grouped agenda needs more assumptions. Person-led cards preserve terms and existing attention actions. |
| Agreement overview | Understand what is needed now, then consult accepted terms. | Contract-first buries the next step; a fabricated tracking timeline would invent facts. Existing next step now leads. |
| Chat attachments | Understand a pending photograph and safely continue. | A thumbnail-sized sentence is cramped; a separate modal loses context. Full-width recovery rows keep exact commands together. |
| Profile/settings | Find the relevant personal or work setting. | Centered identity wastes vertical space; one long undifferentiated list hides purpose. Open groups plus two recurring schedule shortcuts improve retrieval. |

Existing press springs, native transitions, disclosures, list arrival and reduced-motion support remain. No additional
decorative loop was added. This batch does not claim measured frame-rate or haptic quality.

## Verification

Combined typecheck exited 0; full Jest passed **314 suites / 6,114 tests** in 126.267 seconds (exit 0). Existing worker
teardown warning remains. `git diff --check` passes. Test output is stored locally at `outputs/r6-integration/r14-jest.json`.
Source-bound APK and native evidence are recorded in `RECEIPT.json` when completed. Source implementation is not phone
or store acceptance. No backend, payment, dependency, provider, key or DEV data change. The installed R13 app remains
the baseline until a source-bound R14 APK is verified and installed. Remote control-table upload is unconfirmed.

Earlier scoped Agreement work is documented in `../R14_AGREEMENTS_20260925.md`; this report includes the integrator's
subsequent route/gallery next-step reorder. Historical R13 evidence remains unchanged.

# R16 physical-phone review

Source b4ba8a8d92c066d23b357c690cfdb42041a2c062; ARM64 run 36162844547.
Both artifact attestations, source/tree/run/SHA-256 and ABI passed before `adb install -r` returned Success.
Phone VKP-NX9 / Android 16: 1264x2728, density 560 (~361 dp), existing font scale 1.15 unchanged.
All product navigation was read-only. No account change, business submission, GPS request, microphone or paid AI call.
Screenshots and XML contain real public task/profile content and remain local, not copied into Git.

## Observed

- First cold opening of `/zadaci` via a deep link immediately after installation showed a load error. Expanding the sheet exposed the existing retry action;
  one retry loaded six tasks and map tiles. Android reported a validated default network. This is evidence of
  recovery, not a diagnosis or fix of the initial failure. The emulator independently loaded on its first opening.
- White joined search/tools, quick filters, selected root navigation and the regional map render.
- The filter panel exposes time/work mode, then people and price. The two footer actions remain visible and
  reachable. Scrolling and dismissal worked; the phone check did not apply a changed filter.
- Task list opens the actual public detail. Work title, actual offer terms, public place, time and people are
  legible; the description and requirements precede publisher context. The sticky application entry remains
  visible while scrolling. It was not submitted. Approximate-map and questions entries are reachable below.
- Collapsing the results sheet, opening a cluster and selecting its logo marker displayed the matching task preview.
  The selected marker has the branded offers pill; preview title/terms/place/time/person/capacity and close control
  fit without overlap. Only initials were observed for the public portrait in this sample; an actual photograph
  was not verified on this phone.
- Map-area scope was cleared back to all tasks before leaving the app open. Owner font/density settings were untouched.

## Follow-up, without inflating severity or claiming acceptance

1. R16-N01: the first cold-open failure recovered on retry; root cause remains unknown. Reproduce with safe,
   redacted error classification before changing session/data behavior. No new backend permission is implied.
2. R16-N02: at ~361 dp / 1.15, `Koliko vas dolazi` wraps to three lines beside the stepper (`filters-lower.png`).
   The controls are usable, but the layout is cramped. Stack that group at the actual narrow threshold in the next
   coherent source batch; keep ordinary type sizes and full labels. The filter footer also wraps its result action.
3. R16-N03: immediately after returning from detail, a regional cluster was partly behind the sheet/attribution
   (`map-return.png`). Collapsing the sheet exposed it. Re-check return/snap camera framing; this observation does
   not establish that R16 introduced it. The fallback marker ring remains visible behind a rich selected pill.
4. The card foot stacks on this width even when the short name and people fact could share a row. Evaluate its
   breakpoint with measured long-name and enlarged-text cases in the same responsive refinement.

This is bounded physical-device inspection, not owner visual approval, full two-person journey proof, iOS review,
successful provider execution, or store readiness. All existing functional/release gates and R14-N01 remain open.

Raw PNG/XML paths in this report refer to local `outputs/r6-integration/r16-phone`, not public repository assets.

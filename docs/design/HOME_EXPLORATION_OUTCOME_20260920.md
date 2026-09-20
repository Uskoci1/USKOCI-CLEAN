# Home exploration outcome — 20 September 2026

Status: PROPOSAL; native implementation awaits visual review. Figma file: ATgMxtsCfMLPo8rq5N489u.

## Delivered
- Page 44:2, **10 Home — new compositions**: three compositions × empty/active/attention = nine specimens, plus four QA specimens (360-width long title, partial read, applicant selection/server attention, loading).
- Page 44:3, **11 Home — proposal components**: 18 local reusable components, three scoped colour proposals, two title styles. Existing compatible colours/body styles, editable brand and icon components reused. Original decorative vector illustration authored for this exploration.
- Local owner gallery: outputs/uskoci-home-exploration-20260920/PREGLED.html in the parent projectless workspace, with nine final Figma PNGs and state-switching controls. Browser verification confirmed all three state switches and corresponding Figma links. The gallery is static design review material, not an app simulator.
- Exact frame and component references are in HOME_EXPLORATION_LEDGER_20260920.json; geometry results in HOME_EXPLORATION_VERIFICATION_20260920.json.

## Recommendation
Choose A (Local companion) as the next refinement basis, incorporating the record clarity of B (Work journal). A preserves brand warmth without retaining the old layout, and gives all three attention items priority when present. B makes continuing work easier to scan but dedicates 144 units to persistent launch actions. C makes one decision exceptionally prominent but consumes the most vertical space when attention items accumulate. Do not elevate C's large panel into the default container for every domain surface.

This is a designer recommendation, not recorded owner approval. All three remain reviewable.

## Verification and correction
Visual inspection covered all 13 specimens. Initially, the attention row's text body retained a fixed width and displaced its arrow outside the 360-width specimen. Restoring FILL on that body fixed the overflow. Final structural checks found zero horizontal containment failures, zero text-over-parent-height failures, zero forbidden internal-side labels and zero unintended construction placeholders. Scroll regions are configured independently from the bottom navigation. Section links gained explicit 108 × 48 touch-target containers.

The geometry check intentionally excludes decorative SVG vector paths and allows content below a clipped scroll viewport. It does not prove actual device gestures, native safe areas, 200% font scaling, reduced motion, screen readers or focus order. The control library is a proposal subset, not a complete pressed/disabled/error component system.

All four attention rules are represented across the set. Non-stale server attention and own-task applicant selection have a separate QA specimen. The fixture with five attention entries exposes three and a +2 remainder; three active agreements expose two and +1. Activity fixtures contain two rows, so no activity remainder is invented. Home rows navigate to subject destinations; none executes a business mutation. Notification counts are not derived from attention counts.

## Change boundary
Only design documents and Figma proposals changed. No native app code, dependencies, accounts, DEV records, migrations, secrets or paid provider calls. Earlier Figma pages remain intact. No new Jest/TypeScript/CI pass is claimed for this design-only work.

Next: owner visual review, refine the selected composition and missing component states, then implement the approved Home slice against the existing contracts and verify on the connected phone. Other major surfaces still need their own evidence, three compositions and state coverage.


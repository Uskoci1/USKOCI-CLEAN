# Home exploration — 20 September 2026

Status: DESIGN PROPOSALS, not approved native UI. Scope: three materially different Home compositions and their state variants. All content is labelled synthetic design material, never DEV data. No backend or native changes.

## Functional brief before visual composition

Home offers both OBJAVI ZADATAK and USKOČI I ZARADI to the same account. It previews three attention reasons/subjects, two upcoming active agreements, and five interleaved owned-task/application activities, preserving each +N remainder. Attention order is completion confirmation, open problem, stale/server-flagged active application, owned task with applicants. A row navigates; Home never confirms completion itself. Missing reads are unavailable/partial, not an empty account. Notification unread count is separate. No inferred earnings, ratings, verified identity, precise location, wallet or payment protection.

Targets verified in the current client: /nova, /mapa, /profil, /dogovori, /moje-aktivnosti; candidates at /potrebe/[id]/kandidati. Agreement and application deep links keep their subject IDs.

## Three compositions developed from the brief

**A — Local companion.** An editorial, warm surface uses an original illustration to explain the two-way local exchange. Two full-width action rows lead into obligations and agreements. In the attention state obligations move above discovery actions. Strength: welcoming first use, recognisable brand, clear task titles. Risk: editorial space costs a scroll when busy; collapse illustration on populated screens.

**B — Work journal.** A compact masthead opens a continuous, ruled agenda. Agreements and activities are visible as work records; a dedicated bottom action area keeps starting either journey within reach. Attention is a priority section, not a chronological event. Strength: frequent use, scanning, density. Risk: weaker emotional first impression; do not invent dates for undated subjects or merge event notifications into activities.

**C — Next decision.** A prominent next-action panel exposes the first reason or agreement, with the other attention rows always visible below it, not hidden in a carousel. A separate, compact two-action launch area and activity summaries complete the workspace. Strength: obvious next step. Risk: overemphasising one subject; all three reasons, +N and full-list links must remain accessible.

Same fixture facts and ordering across the three proposals. Empty, active and attention are distinct states. Long Serbian titles wrap; content scrolls while labelled navigation remains outside the scroll area. Compare clarity, speed, reach, trust, accessibility, extensibility and brand expression before selecting. No invented quality percentages.

## Reuse and creation decisions

- Reuse actual editable USKOČI BrandLockup (7:2) and Phosphor icon components; retain identity, not rejected layouts.
- Reuse compatible local semantic colours, spacing and Roboto body/support styles. Add only scoped proposal ground/radius/title tokens, with explicit proposed code syntax. Do not alter existing foundations.
- Material 3 accessible library searched for buttons and list items. Its general-purpose APIs do not encode USKOČI attention reasons or paired entry actions. Create small local proposal components with content properties, native-sized targets and existing brand bindings; no dependency install.
- Existing action tiles, header composition, summary and navigation geometry are not a visual baseline. Preserve destinations, rethink presentation.
- Home research gate: six eligible records across four publishers in references/01_HOME.md. Map composition remains outside this scope because its research gate is incomplete.
- Create editable Figma proposals, a reusable proposal component sheet, visual comparison and recorded structural verification. Keep all rejected pages and existing work intact.

## Validation limits

Static Figma specimens prove composition and editable structure only. They do not prove native gestures, speech, data fetching, screen-reader output, 200% font scaling or store readiness. Native implementation follows owner review of these proposals.

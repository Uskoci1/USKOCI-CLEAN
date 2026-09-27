# Round 06 — Agreement overview source

2026-09-27. Root's consolidated rerun passed 8 suites / 368 tests and TypeScript exited 0. A subsequent chat suite passed 38 tests, for 9 distinct final suites / 406 tests across the two final runs. No build, device, provider or database execution was performed by this subtask.

The overview now separates source-task context from the accepted record. The task title uses the existing page-title token, with its area/work mode and existing source link underneath. The existing person chrome still identifies the other party. The next step uses the existing heading/copy tokens and retains its action children, state derivation and accessibility announcement behavior. Accepted terms show the saved total first, then explicitly labeled accepted time and covered-person count. The one-person omission and conditionally shown version remain.

## Source and authority

- `src/data/agreementClientService.ts` maps price and schedule from `raw.terms`; covered people come from `terms.covered_slots`. The UI does not replace that count with the task's total capacity.
- Title, approximate area/city and execution mode are source-task context. Moving location/mode into the task link avoids presenting that public context as a precise accepted address. Private location and contact grants remain in the route's existing disclosures.
- Unknown price still reads `BEZ_IZNOSA`, terminal unscheduled work still reads `Bez tačnog termina`, and remote work still has no physical location. No rating, trust badge, read state or new action permission is derived.
- The D01/D02 blueprint's task/person/terms/next-action composition and the repository's existing white surfaces and `sys` typography/spacing tokens guide this package. The latest owner authorization permits normal UI implementation without another image-approval gate.
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines?cid=ADC-DM-c00321-M00659) emphasize a clear hierarchy. [Android content composition](https://developer.android.com/design/ui/mobile/guides/layout-and-content/content-structure) recommends grouping related content with whitespace, typography and dividers, with consistent spacing. The concrete choice here is a source-task group, a next-step group, then an accepted record. It does not introduce a new design system.
- Applied the `uskoci-design` and `mobile-app-ui-design` skills. The USKOČI skill's historical desktop design-file reference is absent; current repository design rules, blueprint and live tokens supplied the usable context. Historical directives were not treated as current product facts.

## Owned files and verification scope

- `src/ui/v2/AgreementPresentation.tsx`: overview title/context and labeled accepted terms. `AgreementHero` explicitly selects the prior compact layout for the live chat's scrollable context and historical previews.
- `src/ui/agreements/AgreementWorkspace.tsx`: next-step typography/spacing and heading role only. Footer, recovery and announcement effects are unchanged.
- `src/data/__tests__/agreement-overview-presentation.test.tsx`: three passing render assertions cover accepted values/source context separation, missing/remote/terminal truthfulness, and retained compact chat fact order. The corrected workspace and thread-presentation suites also passed in the root's final eight-suite rerun.

Source review checks found no new fixed content height, line truncation, disabled font scaling, extra action, route change or fabricated fact. The task-source callback and disabled state still come from the route. TaskCard, Peek, AgreementChat, service contracts and source readers are untouched. The actual native fit, font scaling, screen-reader behavior and overall balance remain unverified; render assertions alone cannot establish visual acceptance.

## First consolidated-run correction

The root's `ROUND_06_JEST_INBAND.log` showed the new overview suite passing but the established workspace suite caught a real regression: making the price label visible also showed `Dogovoreno ukupno` for an absent amount. The label is now `Cena` when the accepted amount is absent, including its spoken compact-context label. The saved amount still uses `Dogovoreno ukupno`; completion-review source is unchanged. The new overview test additionally rejects visible `ukupno` for an absent amount.

`pkg011-agreement-workspace.test.tsx` now locates approximate task area in the source link, includes the new visible fact labels, and counts the exact state text instead of matching a substring of the accepted-total label. Source-route assertions still exercise the original callbacks and destinations. Its duplicated message-acknowledgement block was replaced with one nonempty loaded-message fixture, an unchanged-list no-repeat assertion, an explicit empty-history no-acknowledgement case, and preserved-message verification after a refused acknowledgement. This matches the existing Round03 admission guard; no acknowledgement runtime changed.

The root's [final Jest log](ROUND_06_JEST_FINAL.log) and [JSON results](ROUND_06_JEST_FINAL.json) record 8 suites / 368 tests passing, including both overview/workspace suites. The [TypeScript log](ROUND_06_TSC_FINAL.log) belongs to the run reported by root as exit 0. After a separate chat StrictMode cleanup correction, the [chat log](ROUND_06_CHAT_FINAL.log) and [JSON results](ROUND_06_CHAT_FINAL.json) record another 1 suite / 38 tests passing, including a real effect-replay witness with two setups and one cleanup. These are 9 distinct final suites / 406 tests; earlier passing suites are historical evidence and are not added to this total. Native acceptance remains pending.

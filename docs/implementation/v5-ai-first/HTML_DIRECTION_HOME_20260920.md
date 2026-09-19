# Owner HTML direction — first native surface

The owner's latest instruction on 2026-09-20 explicitly asks for the **new supplied HTML appearance**,
with the existing app logic connected beneath it. This supersedes older instructions to preserve the
previous authenticated Home composition. It does not replace the original brand, entry sequence,
mascot or the authority of the backend. Skills provide implementation guidance, not competing visual
directions or new approval gates.

## Source evidence

- `C:/Users/user/Downloads/USKOCI_OTVORI (4).html`, SHA256
  `9bb737d77e9348436875eaa18e387e22568514685f6fe17d34d1cdaf069fff87`.
- `C:/Users/user/Downloads/USKOCI_ASTRA_DESIGN_PACK_2026-09-19 (2).html`, SHA256
  `899686f0c7858debd47986b5b75e857b41dd96e393ebd5f62128b0bf31518f16`.
- The relevant source is `homePage()`, `heroArt()`, the final `.home-page` / `.action-tile` CSS
  overrides, the large-type layout and the rounded three-item navigation.
- The HTML was read from the owner's files. Opening its file URL in the in-app browser was denied
  by browser policy; that denial was not bypassed. Native device verification is tracked separately.
- The `uskoci-design` skill's old donor path was stale. Its underlying design instructions were found
  and read at `USKOCI_CANONICAL_WORKSPACE_2026-09-08/donor/CLAUDE 30.08 USKOCI/.claude/skills/design/SKILL.md`.
  Generic web/logo-generation recipes do not override this native implementation or authorize calls.

## Implemented surface

`HomePresentation` now uses the original `BrandLockup`, the supplied heading and native SVG hero
geometry, two action tiles, a bordered attention group, upcoming Agreement cards, and activity rows
with distinct icons. Shared native color/type/radius tokens are retained so the surface belongs to
the existing white/green/orange system. Secondary text remains readable rather than inheriting the
HTML's smallest 10–11px text. Copy is not cut off with line limits.

At increased font scale (>=1.3), or widths below 340, the tiles stack and the decorative illustration
is hidden. Content has no fixed text height. The three real tabs retain the existing navigator,
history and route registrations, inside the HTML's rounded container. Tabs expose selected state
and use the existing press feedback instead of the previous unbounded Android ripple. The bar grows
with text scale and clears the bottom system inset. Publishing, review and location still hide it.

The supplied illustration is static on this frequently visited surface. Existing row-arrival and
press feedback keep their reduced-motion behavior. No entry/brand animation file was changed.

## Facts and boundaries

The same `composeHome()` snapshot and account/revision/focus guards remain in charge. Rows still
navigate to the exact task, application or Agreement. The UI imports no prototype runtime, example
people, invented counts, demo notifications, voice synthesis, payment or price behavior. Both start
tiles remain usable before reads complete and after a failed refresh. Failed sections do not become
empty accounts. The attention total is omitted when the snapshot is partial.

The compact date tile uses a calendar icon: the current Home row carries a formatted schedule, not
a separate accepted display date. The UI does not parse human-readable text or invent a date.
Two upcoming Agreement rows remain available, preserving the established preview/count contract.
Attention stays the four existing rules; the prototype's example pending-proposal row does not
silently add a fifth business rule. F02 candidate selectability and aggregate wiring remain open.

No database, migration, dependency, paid provider, voice, account or task mutation is part of this
slice. pkg023j remains applied but unwired. Other screens still require their own HTML adaptation.

## Verification checkpoint

Targeted Home/navigation, copy and no-mode checks pass. The additional checks cover a failed refresh,
navigation event forwarding and tab visibility in full-screen flows. Source-147 integrity passes.
Type checking and the full-suite result are recorded below when completed. A release APK/device
result must name its source commit and artifact; the old installed APK is not evidence for this UI.

### Concurrent work and isolated verification

During the first full run, another writer changed `aiNeedV2Ui.ts` and added a 148th source migration.
The owner confirmed Claude was working in parallel. Neither change is included here. This UI slice
was copied, by an explicit eight-file allowlist, to branch `work/html-home-native-20260920` based on
`c934abe2c34a6e0725a4d841f570c11ada9eeb7f`, in the task's `work/uskoci-html-native` checkout.
The original checkout was left intact. Dependencies are the same existing locked installation;
the repository's normal entry-asset generator was run in the new checkout.

The first shared full run was **not green**: 231 suites passed, two failed (14 assertions).
Four failures came from the concurrent identity change. Ten came from the old tab configuration
test calling the component directly without mocking the new dimensions hook. That test now supplies
dimensions and checks usable controls and external system-inset clearance for the rounded bar,
including enlarged text. It does not claim rendered layout proof.

Isolated targeted verification: four suites / 67 tests passed (Home, both navigation contracts and
the unchanged identity tests). `npx tsc --noEmit -p tsconfig.json` passed after normal generated entry
assets were restored. Source-147 integrity passed. The isolated full suite initially passed 4,495
tests with one known Windows location timeout; that location group passed 22/22 alone. PRE-P4 run
`35476540506` then passed all 233 suites / 4,496 tests, TypeScript and source-147 integrity on exact
source `b1df78e189afbc2777d5b342e4bc7d2bf1410614`. It ran full Jest under the manual source-check
boundary; separate domain jobs were skipped. The previously observed delayed Jest exit warning
remained, and the job completed successfully.

### First device evidence and follow-up

Android build `35476231868` succeeded on the same source. Its APK SHA256 is
`5bb84252feca5d7e1862a73ea74aeff1b6134f2e78892d9884ab4ea009dbbc18`.
Recovery and icon attestations were bound to that source, tree and artifact. Package `rs.uskoci.dev`,
versionCode 35, and signing certificate matched the installed development app. A replacement
installation succeeded without clearing data; the existing authenticated account opened the new
Home with live data on the connected HONOR / Android 16 phone at font scale 1.15.

Device inspection found the previous cream root-stack background visible around the new inset
tab bar. The follow-up sets only the authenticated `(app)` stack scene to the current white system
ground. Entry artwork, auth behavior and root routing are unchanged. TypeScript and four existing
root/session/navigation suites (53 tests) passed for that follow-up. The correction requires its
own APK verification; the first installed APK does not prove it.

At 200% system text the first APK correctly stacked the Home tiles and removed decorative artwork,
but the narrow third tab wrapped the last letter of `Dogovori`. Tab labels now fit to a single line
within their existing controls, keeping system scaling with bounded fitting; body text is unaffected.
The temporary phone font setting was restored to the owner's original 1.15 in a `finally` block.
The intermediate background-only APK run `35477007610` was cancelled in favor of a build containing
both observed visual corrections. It is not a passing artifact or device checkpoint.

### Home focus-return correction found during device review

After tab navigation, Home could display its cached snapshot but refuse navigation while its
silent refresh remained pending. The screen copied a mutable focus ref during render; focus
changed that ref after render, while a silent resource refresh intentionally published no loading
state. Therefore the visible callbacks still belonged to the previous focus until another render.

The new regression test recreates blur/refocus with a deliberately pending read. Before the fix,
the current Earn action produces zero navigations (expected one). Home now publishes its focus
token through React state on focus, so current actions work without waiting for data. Retained
callbacks from the previous focus remain rejected by the same token/account/source checks.
Four targeted suites / 54 tests pass, including this failure-before/pass-after proof. No read or
mutation authority is weakened. Intermediate APK run `35477098597` was cancelled so this functional
correction can be verified together with the two visual corrections in the next artifact.

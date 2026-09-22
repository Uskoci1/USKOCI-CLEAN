# Client foundation after functional-audit approval

Owner approved the presented analysis and order on2026-09-22: "odobram sve to".
Scope: F01-F04, four bounded client defects; this is not acceptance of whole screens or release gates.
The dated audit stays intact; current execution is recorded in docs/control/redovi.json.

## Decisions and composition

| Surface / person's task | Alternatives considered | Choice and reason |
| --- | --- | --- |
| Map: understand the displayed task set and open a relevant task | All information/actions in one row; hide the explanation in a panel; full-width explanation with a separate wrapping action row | Use the third: it preserves actual counts and privacy context at361dp/font1.15 without hiding meaning or covering map pins. |
| Notification settings: confirm the state and safely adjust preferences | Reload the route; unlock all controls after an error; enable only the existing readback action | Use the third: no lost context and no second uncertain mutation. Existing scoped read/generation/timeouts are unchanged. Quiet-time fields honor the same visual lock as switches. |
| Navigation: recognize the current section and return to it | Static section per hidden route; private duplicate navigation memory; derive from the real navigator history | Use the third: profile settings keep Home/Map/Agreements according to the actual entry point and Back history. History-less links use a section fallback. Original tab press/long-press and events stay unchanged. |
| Inbox: read when and to which task side an event belongs | Drop the timestamp; merge with the body; retain metadata at minimum12dp | Retain the useful metadata at12dp. No event, recipient or navigation change. |

The UX draft is satisfied without new differences: §2 legibility/origin, §5 discovery context and
§8 actionable errors. Existing full-screen editors/details keep their bar exception (approvedD8).
Inter, FactArt and the inset bar stay. Tab labels no longer shrink below the owner's minimum;
two lines and a font-scale-aware bar provide room. No new animation is necessary for these repairs.

## Verification

- Before implementation: two new settings regressions failed on the old source;15 existing checks passed.
  They exposed the disabled retry and editable quiet-time input after an uncertain save.
- Before implementation: five new navigation regressions failed;6 existing checks passed.
  Cases cover all three origins, nested settings, Back, action forwarding and history-less links.
- After implementation:54 checks across four suites pass (push preferences, tabs, marketplace, inbox).
  Settings retries perform only reads, deduplicate repeated taps and do not prompt, register or save.
  Existing stale-account, blur, revision, unknown-outcome and filter assertions remain.
- TypeScript: npx tsc --noEmit -p tsconfig.json passed, exit0.
- Full Jest:242 suites /4698 tests passed, exit0 (jest-foundation-final.json). Initial full run had
  8 failures only in the older tab-layout configuration reader, which expected an object rather
  than the new route-aware callback. Its invocation was adapted; inset/height/reduced-motion and
  route-coverage assertions were preserved. Full repeat passed. Jest emitted the existing worker
  teardown warning; it is not hidden or represented as clean teardown.
- Browser: actual MarketplacePresentation rendered at320/360px with isolated local fixtures;
  full-width legend is legible. At360px the trailing action bounds end at771.6 within777px viewport.
  Web map fallback is explicitly not a real map/gesture/phone proof. No backend or provider involved.
- Exact-source APK and device verification: pending. Physical phone is disconnected; owner explicitly
  requested the existing Android emulator. USKOCI_V5_TEST was started without wiping its data.
- Claude independent review: pending; no second writer was used in these source files.

## Boundaries

No server/validation/recovery algorithm, package, key, verify_jwt or certificate change. No paid AI
request or DEV fixture. The foreign frozen-inventory SQL and Claude's control template/README changes
remain untouched and outside this package. Android will be built from tracked CI source so the ignored
local dizajn-pregled route cannot enter this APK.

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
- Exact-source phone APK built successfully and both source/tree/run/hash-bound attestations passed.
  Physical phone is disconnected; owner explicitly requested the existing Android emulator.
  USKOCI_V5_TEST was started without wiping its data.
- Claude independent review: pending; no second writer was used in these source files.

Source commit8f0be1f46bb48ce485e983e4eb968aaa034db6f5 was pushed. Exact-source Android build:
https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/35741807845 (success; downloaded SHA256
5a8b732ea4f117c82d77f36050dc2119053c5d6e3a880b3b2c8774c8871eaa1d). Not installed on the physical phone.
Emulator advertises x86_64 and arm64-v8a; compatibility will be measured by installing/launching the
actual APK, not inferred from that list. No emulator reset, account change or device-data copy.

Emulator preflight: the last proven phone APK31598ac8 (SHA256c7e907ae...) installed successfully,
but launch exited with SoLoaderDSONotFoundError for libreactnative.so: the loader searched x86_64
inside the ARM-only APK. No USKOCI login or user flow occurred. The emulator's advertised ARM
compatibility is insufficient for this package. The APK workflow now has an explicit phone/emulator
choice, defaulting to the unchanged ARM64 phone build. Emulator uses x86_64; arbitrary target values
are rejected. No new package, native-source feature or server change. Emulator screenshots remain
separate from physical-phone acceptance. The initial emulator was gracefully stopped and reopened
with a window for the owner's eventual sign-in; its data was preserved.

The explicit x86_64 build213fcf9a /run35742822042 then passed. Its app source is unchanged from
8f0be1f4. Downloaded SHA25632a5cc30f5856dffb9a53cc94e94fae0811698b22b17e3a62837ad0dcd485b47,
source/tree/run and both attestations matched; lib/x86_64/libreactnative.so exists in the APK.
`adb install -r` succeeded and the actual app opened: welcome and sign-in form observed, live
process4965. Screenshots and exact dimensions are in CLIENT_FOUNDATION_RECEIPT.json.
The owner was asked to sign in personally. No credentials were read or entered. Map, filters,
nested navigation and signed-in settings remain unverified on this build until that sign-in.
Emulator startup is not physical-phone acceptance or push-delivery proof. The failed ARM-only
preflight is retained above as evidence; it is not a failure of the corrected x86_64 package.

## Boundaries

No server/validation/recovery algorithm, package, key, verify_jwt or certificate change. No paid AI
request or DEV fixture. The foreign frozen-inventory SQL and Claude's control template/README changes
remain untouched and outside this package. Android will be built from tracked CI source so the ignored
local dizajn-pregled route cannot enter this APK.

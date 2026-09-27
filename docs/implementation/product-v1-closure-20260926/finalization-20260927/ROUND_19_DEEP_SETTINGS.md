# Round 19 — deep settings and exact-build native acceptance

## Problem, cause and product decision

The signed-in emulator showed a loaded Profile name/photo/reputation while the identity host still announced `Učitavamo profil`. The source reused an unkeyed native View between loading and ready states. Native host reuse is the inferred mechanism, not a separately traced renderer defect. The identity now has distinct state hosts, an explicit busy loading node, and cleared loading semantics in ready/error states. Its appearance, photo/name actions and individually accessible descendants are unchanged.

Two additional source defects were reproduced in focused route tests. Notification settings could dispatch Back twice before native blur retired the visit. Legal-document launching could keep every link locked forever if the operating-system promise never settled, including after leaving and returning. A focus/account-owned one-shot exit now prevents repeated navigation. Legal links use a10-second, attempt-owned deadline; blur, Back, unmount and account replacement retire it, and a late result cannot release a newer retry. The screen says opening was not confirmed rather than claiming the document definitely failed to open. HTTPS validation, legal acceptance/recovery and unsaved-notification confirmation are unchanged.

## Implementation and checks

- `src/ui/profile/ProfileHubPresentation.tsx` and its Profile hub suite:34/34 PASS, including same-instance loading→ready/error and reachable photo/name/retry actions.
- `src/app/(app)/profil/obavestenja.tsx`, `src/app/(app)/profil/pravna.tsx` and their existing route suites: seven new regressions failed before the fixes; final33/33 PASS across two suites. Four test timer callbacks were then made explicitly void for TypeScript only.
- Integrated `npx tsc --noEmit -p tsconfig.json`: PASS, exit0. Diff check PASS. No full-suite rerun.
- No RPC, schema, Edge, dependency, payment, TaskCard, DiscoveryPeek or certificate change. No settings were saved, legal consent given, accounts closed or real messages sent during native inspection.

These three source fixes are not included in the currently installed Round18 APK. Native acceptance of the corrected Profile semantics and new route behavior follows the next consolidated build; source tests do not establish it.

## Installed native checkpoints

The exact artifact/source/evidence hashes and limits are in `ROUND_19_NATIVE_RECEIPT.json`. Screenshots/XML stay in the private task workspace `outputs/finalization-20260927/`, outside Git.

**Round17 / eff72a25 / run36332545768:** install-r preserved the existing emulator session. Search calendars with five and six week rows were inspected at font scales1.0 and1.3. Last-row targets are126px (48dp at density420), and the helper remains inside the white section. Selecting30 November and collapsing the section preserves the chosen date. The green `Pregledaj zadatak` action is visible in the inert ready-AI scene. This is layout/interaction evidence, not a paid AI request or a new publication.

**Round18 /6b06540e / run36333830435:** APK and installed base.apk hashes match `572c850b3e397224e2efb794e05a6b7bbebf079bce1d6959e9d5f17a04d6f14a`. Existing public tasks were opened read-only. Expanded map bounds are y310–1950px rather than the old y310–1522px; credits, the approximate-area explanation and navigation action fit below it without the former unused bottom region. The loaded map shows the USKOČI mark without a redundant1. A pan followed by Android Back returns to the same task detail; the next Back restores the same first rows and top position of the public list. A second existing task also opens its public approximate map. That public projection supplies one point even when the description mentions a route: this is **not** a multi-stop/private-route acceptance claim. External Google navigation was not launched.

Profile/privacy/notification settings were inspected read-only on the signed-in emulator. Privacy correctly reports unavailable retention publication; this is not proof that retention/export/deletion are enabled. The second emulator accepted the same Round17 APK but had no signed-in session, so private screens and inert galleries redirected to Auth. No credentials, bypass, reset or logout were used. Deep verification on that second emulator remains unavailable. Font scale was restored to1.0.

## Realtime proof remains separate

B3c SQL/Auth rollback proof passed again at f01be527 in run36334770586. Its first actual websocket phase failed after four successful subscriptions and before a confirmed first message; the final unchanged-surface comparison also failed, with certificateMoved=false. Exact bounded reports are retained in the task workspace. This is an unresolved proof result, not successful realtime, deployment or client integration. Diagnostic refinement must preserve the positive delivery and authorization gates. The entire local stack was discarded; DEV and certificates were untouched.

## Status and next step

Source fixes and focused regressions pass; named native calendar/map behavior is accepted on its exact older source. Whole-product, current physical-phone, multi-stop/private-map, real-message push, voice, load and store acceptance remain open. Continue the exact realtime diagnosis and consolidated settings-native check. P0 exact-public application still awaits its explicit `primeni` answer. The control table is regenerated locally; its hosted upload remains blocked by the observed file-chooser timeout, not published.

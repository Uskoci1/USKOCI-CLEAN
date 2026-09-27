# Round 23 — native fixes accepted, Home retry and isolated server proofs

2026-09-27. **Scoped emulator acceptance, not whole-product readiness.**

## Problem, cause, product and UI decision

An explicit map point/all-points action must move the camera again after a pan. Privacy actions must belong to the rendered focused visit. Round21 fixed both; this round installs its exact artifact and verifies the previously failing native paths. Existing visual composition, TaskCard and DiscoveryPeek stay unchanged. In the route map, all points have no false first selection; the selected point remains white with the established orange border. No new style is introduced.

Home also had an enabled but inert retry after a stalled read, background and failed foreground read. The source fix retires only the old retry with its resource AbortSignal; late completion cannot unlock a newer retry. See HOME_RETRY_RETIREMENT_20260927.md. This preserves section failures as unavailable, existing deadlines and navigation guards.

## Files, implementation and checks

- Installed source f526a736, APK run36339245682, exact source tree and APK hash independently verified; adb install -r retained the session. Installed base.apk hash matches. ROUND_23_NATIVE_RECEIPT.json records the bounded visual/action evidence.
- Route fixture: all three points fit; select end, pan, tap same end recenters; repeated Show all refits; selected row and pin agree; footer stays within screen; Android Back returns to preview.
- Existing account: direct and Profile→Privacy entry both open Closure; close/reopen/Android Back return; Privacy header Back returns to Profile. No prepare/start/delete action was pressed. This does not prove erasure or export.
- New Home route/test: regression red before, focused43/43PASS; integrated TypeScript PASS. This newer source and Round22 MyTasks are NOT in the installed f526a736 APK. No full-suite repetition.

## Backend/RPC

P4 run36339724742 passed13 distinct actual disposable SQL/Auth checks. P4_PASS_20260927.md and RECEIPT preserve exact hashes, prior failures, fresh read-only DEV205 preflight and unchanged certificates. Explicit P4 apply+wire approval was requested; no DEV application or runtime client import has occurred.

P5 run36340619418 passed7 isolated SQL-role checks, unchanged catalog/certificates, fixture rollback and stack teardown. All7 exact source hashes match Git. It proves the one-key owned-license projection; it is not actual Auth/HTTP/device evidence or a deployment-ready candidate. The LOCAL_ONLY_ROLLBACK gate remains. P5_LICENSES_PASS_20260927_RECEIPT.json records this later result without changing the proved candidate bytes.

## Regression, status and next step

No dependency, TaskCard/Peek, payment, DEV/Edge or certificate change. Physical phone absent; no real AI, microphone or push-provider action. APK screenshots are original local captures, not mock acceptance images. The control table is refreshed locally; hosted artifact republish is still pending its recorded chooser limitation. Next: finish the already reproduced Agreement exit/retry issue, then a consolidated client build. P0/P4 application and B3c disposable recertification remain separate pending approvals.

# R20 native acknowledgement follow-up — 2026-09-26

Status: corrective source verified; exact APK acceptance pending.

## Observed problem

The previous `a5ef12bb` APK preserved the first deep return visually, but did not
complete its restore acknowledgement because native scroll was already at the
requested offset. The second return restored the wrong sheet stop. The failed
APK, trace and screenshots remain in `R20_NATIVE_A5EF12BB.md`; passing its unit
tests did not prove repeated native return.

## Bounded correction

- Preserve all five of Gorhom's default native scroll handlers. Observe actual
  native scroll events through the existing public handler hook; its cached
  internal offset alone is not a fresh scroll acknowledgement.
- Keep the observation inside the keyed native sheet. A replacement, changed
  extent or stale focus owner cannot reuse it.
- Confirm an unchanged original offset only with an unlocked, idle observation
  at a physically settled detent. A smaller provisional window still needs its
  normal command acknowledgement and measured end evidence.
- Track native settlement separately from the requested React index. Protect
  newer explicit requests from delayed native callbacks. A fresh native gesture
  can retire an older explicit request; a queued gesture completion must be
  replaced by a fresh sample if retirement invalidated its command ownership.
- Re-sample readiness after momentum/animation/temporary positioning finishes,
  even when native does not send another scroll event. Do not send React updates
  on every scroll frame.
- Keep normal user scrolling separate from restore readiness.

This uses the installed libraries. No new dependency, server change, account,
task, message, provider call or microphone activity belongs to this correction.

## Verification record

The isolated original-source witness failed both new repeated-return and native
detent cases (2 failed, 0 passed, 100 skipped). Separate before-fix witnesses also
failed for an unchanged occupied target, a new-command/old-stop observation, and
native handle/content gestures interrupting an explicit target. Intermediate
candidate results are not final-source acceptance. Focused and integration
results are recorded in `R20_NATIVE_ACK_CHECKS.json`:

- Final author TypeScript check: PASS.
- Final integration Jest: **321 suites / 6,505 tests PASS**, exit0,259.714seconds.
  This includes all124 Discovery cases. Existing worker teardown warning remains.
- Independent narrow review: no remaining actionable ownership/gesture finding.
- The initial sandboxed full run failed to spawn workers (EPERM); no test pass
  was claimed from that attempt. The authorized process-permission rerun passed.

APK acceptance requires at
least two consecutive deep detail/Back returns without scrolling between them,
using the actual installed artifact, fresh UI dumps and bounded numeric traces.

## Remaining limits

The inert 1,000-row gallery tests native list behavior, not 1,000 live tasks or
concurrent users. It does not prove chat, notification delivery, microphone,
backend query growth, physical-phone or store acceptance. Those remain separate
control-table rows.

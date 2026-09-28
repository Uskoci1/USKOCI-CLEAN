# Round33 — Discovery FULL return source correction

Date: 2026-09-28. Source candidate: `b06480512d197168c0ef857bb151a0e143b3a667` on `work/uskoci-ui-unification-20260924`.

## Scope

This package addresses the known Android failure in which the expanded Discovery task list could disappear after leaving the screen and returning. The logical route state remained FULL with the saved list offset, map viewport and selection, while the retained native BottomSheet body had returned to Gorhom's initial hidden presentation (`alpha=0`, off-screen translation). The rejected global Reanimated candidate `2b2cf4d7` is not restored and no SDK/static flag is changed.

## Bounded correction

- When a physically settled Discovery sheet leaves the route at FULL, only that native FULL mount is retired.
- The logical Discovery view remains above that keyed boundary: requested FULL stop, list offset, viewport, filters and selected task are preserved.
- On return, a fresh native FULL sheet is created with mount animation disabled; the existing bounded restore machinery waits for the fresh mount's own unlocked/readiness/geometry evidence before requesting the saved offset.
- Peek/half mounts may still be retained when their state is settled and unchanged.
- TaskCard, DiscoveryPeek, branded pin, filters, map data, business commands, backend contracts and installed dependencies are unchanged.
- No DEV/database/Edge/provider/payment/certificate mutation belongs to this package.

## Regression contract

The focused Discovery suite now proves:

- an unchanged FULL return replaces the native sheet while preserving the same logical collection and saved deep offset;
- two consecutive deep FULL returns each rebuild native presentation and restore the same offset;
- callbacks and gesture/temporary/animation evidence from the retired FULL mount cannot certify the new visit;
- the fresh mount must earn its own readiness and geometry before restoration completes;
- an unchanged peek return still retains its mount, viewport and selected pin;
- existing map/list/filter/publication/virtualization/Back/accessibility behavior remains in the same focused suite.

## Exact source verification

GitHub Actions run [36400916665](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36400916665), job `108858303905`, exact source `b0648051`:

- TypeScript exact candidate: **PASS**.
- Focused Discovery: **1 suite / 140 tests PASS**.
- Full Jest: **342 suites / 7,214 tests PASS**.
- Workflow conclusion: **SUCCESS**.

The first candidate `ee639951` intentionally produced a RED focused run because six historical tests encoded the old requirement that a FULL return retain the same native mount. The new primary regression already passed in that run. Those historical expectations were then changed to prove the new stronger ownership contract; production code was not weakened to satisfy them.

## Device status — still open

No Android emulator or USB phone is available to this execution session, so this is **not native acceptance** and does not make B04/B05 READY. The exact candidate still needs an installed-artifact check on the same build:

1. open Discovery and expand the full list;
2. scroll to a clearly deep task;
3. record viewport, selected pin/card if present and visible row/offset;
4. open another real screen/detail and Android Back;
5. verify the full white sheet is visible, list position restored, map/filter/selection unchanged;
6. repeat the detail/Back return once more without an intervening list scroll;
7. verify no ANR/freeze and capture fresh screenshot/UI hierarchy plus exact build/hash.

A native PASS must be recorded separately against the installed artifact. Historical Round31/Round32 device evidence remains evidence of the old failure/rollback, not proof of this source candidate.

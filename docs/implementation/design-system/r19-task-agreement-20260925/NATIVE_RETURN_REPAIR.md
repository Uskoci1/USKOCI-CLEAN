# R19 native return repair — 2026-09-26

This corrective source follows the two residual observations in NATIVE_REVIEW.followup.md, on exact source `cb8ea1b9`. Its own tests and APK acceptance are recorded separately; a mock event sequence is not pixel or gesture acceptance.

## List restoration

Installed Gorhom 5.2.14 forces scroll to zero while the sheet is locked. The old return path sent scrollToOffset before physical extension/content readiness and retired its target after sending the command. Initial native zero could then overwrite the saved position.

The presentation now observes the newly mounted sheet's actual EXTENDED/FILL_PARENT state, seeds its restoration intent before child events, waits for current row content and list-window measurements, and retains a nonzero target until an actual offset event acknowledges it. Real drag, refresh or new search can cancel the restoration. Callbacks from a retired native sheet cannot alter the active visit. Locked-phase zero cannot overwrite an acknowledged user position. A measured shorter list clamps the target; a list fitting its window resolves to zero.

The independent source review identified and then rechecked three corrected edges: unreachable offset after a shorter dataset, stale refresh clearing a new restoration, and locked zero after successful acknowledgement. Focused tests cover these transitions and the initial content/ready ordering.

**Scaling limit remains:** RN VirtualizedList without getItemLayout can initially report only measured cells and their bounded tail spacer. A first positive content height is therefore not proof of the full height of a long variable-height list. Deep restoration among 1,000 rows needs an item anchor/window-aware strategy and separate native evidence; this package must not claim that acceptance. The existing 1,000-task fixture is a membership/count test only.

## Map annotation image

Installed MapLibre Android snapshots the annotation child into a bitmap. It refreshes on outer layout changes; nested asynchronous image loading or native reattachment need not trigger that layout again. The old onLoad plus one frame did not preserve the logo after detail/Back on the actual APK.

A rich annotation refresh now requires a live annotation reference, positive child layout, loaded image, and the first fully rendered native map frame for the current focus entry. It retains the loaded-image fact across a same-instance re-entry, because onLoad need not repeat. A coalesced animation-frame callback rechecks ownership before refreshing. The native frame listener is removed once ready; there is no periodic resnapshot or per-frame state update. Scope replacement and unmount retire pending callbacks.

Tests exercise six event orderings, re-entry without a second onLoad, retired callbacks and new map ownership. Actual selected/unselected logo pixels after native navigation remain the acceptance criterion. This is distinct from the earlier globally blank emulator renderer, which was corrected on the same old APK using host GPU.

Combined checks passed: clean TypeScript and 320 suites / 6,266 tests, recorded in CHECKS.native-return.json. The pre-existing Jest worker-teardown warning remains; the runner exited zero. No dependency, server, payment, provider, account or business-data change belongs to this repair.

## Actual rebuilt result

Exact source `46c87a38` / emulator APK run `36221798008` was installed and replayed. BOTH residual cases still fail:
the list resets to its first task and the selected logo can be blank after Back, while base labels render.
Read NATIVE_REVIEW.native-return.md and the separately versioned APK/capture receipts. This document describes an
attempted source repair, not a successful native fix. The next vector/diagnostic source is a separate version.

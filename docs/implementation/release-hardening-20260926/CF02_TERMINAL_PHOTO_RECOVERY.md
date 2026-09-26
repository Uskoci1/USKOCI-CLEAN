# CF02 — existing-photo recovery after Agreement closure

Date: 2026-09-26. Base: `bd550c64`. Client source only; no database, Edge, dependency or provider changes.

## Problem and change

When an Agreement became terminal, the chat removed the entire photo composer.
That correctly prevented a new upload, but also removed refresh/removal of already
prepared, unattached photos. The existing photo controller supports recovery in
read-only mode; its controls were unreachable.

`AgreementChat.tsx` now renders a small terminal-only recovery surface. It can
refresh the existing inventory, recover an existing saved upload into the current
selection and request its removal through the existing controller. It does not
expose pick, capture, upload retry or new-message send. Reserved attachments still
require resolving their message outcome first. Busy/capture locks remain intact.
A retained send callback checks the latest terminal/writable state before acting.

An independent review caught an additional case: a failed initial inventory read
has empty arrays. The recovery surface must keep the error and refresh action in
that state; it disappears only after an authoritative empty result. This is covered
by an extra failing-before/passing-after test.

## Verification and boundaries

- New real-component tests: original source failed 7 of 11 cases; corrected source
  passed all 11. The read-error case then failed before its correction and passed
  afterward. Final focused regression suite: 12/12.
- Earlier focused chat/controller/outbox selection: 75/75 passed before adding the
  read-error case. Final TypeScript check: exit 0.
- Independent bounded review: no remaining actionable finding.
- Final full-suite result is recorded in `CF02_TERMINAL_PHOTO_CHECKS.json` when complete.
- No actual user photo was uploaded, sent or removed during these checks.
- The emulator APK run `36269145778` and phone APK run `36269145651` are both from
  `bd550c64` and **do not contain CF02**. Native/physical-phone acceptance remains pending.
- This closes a source defect, not Chat 2.0: voice, bounded history, live arrivals
  and the displayed-message read boundary remain separately tracked.

The first root full-suite attempt was interrupted after the review required a
source change. It is not accepted as final verification. The later frozen-source
run uses a separate output file.

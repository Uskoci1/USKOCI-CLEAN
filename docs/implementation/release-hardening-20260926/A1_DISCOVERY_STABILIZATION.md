# A1 foreground push and retained Discovery stabilization

Date: 2026-09-26. Integration base: `d162cb7b`, on the continuation of
`work/uskoci-ui-unification-20260924`.

## Scope

Three independent fixes are being integrated. This package does not change DEV,
Edge deployments, notification preferences, legal policy, payments or dependencies.
The parallel Chat Voice V1 work is outside this package.

### Foreground notification compatibility

The deployed A1 formatter supplies distinct public titles/bodies for 24 event kinds,
but the client foreground handler only admitted the two legacy generic bodies under
the title `USKOČI`. The notification could arrive in the background while its banner
was suppressed with the app open. This does not invalidate the owner's earlier
physical Android delivery/tap observation.

The client now admits exact fixed title/body pairs from A1 and the two legacy pairs.
The test executes the actual server formatter and checks all 24 events, both
priorities and Android/iOS. Unknown copy, mismatched pairs, extra payload keys,
private/native attachments and retired account/session callbacks remain rejected.
No permission request, registration, navigation or delivery acknowledgement is
introduced by foreground display.

The integrated copy proposal also removes two internal role names from the server
formatter: `RESPONSE_VIEWED` becomes `Tvoja prijava je pregledana.` and
`RESPONSE_NOT_SELECTED` becomes `Za ovaj zadatak je izabrana druga osoba.`.
This is a source-only Edge proposal until the owner explicitly says to apply it.
The client rejects the two old disallowed bodies instead of weakening the existing
wording guard or hiding the literals. Until deployment, those two live A1 variants
remain suppressed in the foreground; the other current event copies are supported.
The OS background notification is governed by the deployed formatter, not this
foreground predicate. Queued old copies may still exist after a later deployment.

### Discovery return continuity

A retained native list needs a new callback owner after returning from detail,
but can reuse settled row measurements. The old code cleared these measurements
on blur while tying restore initialization to the retained mount identity. It also
recreated the cell component type on focus changes.

The repair separates focus ownership from native mount identity. A fresh owner
receives readiness and a guarded restore; unchanged settled geometry is retained.
Changed account, row facts, window/font geometry or interrupted transitions invalidate
reuse. Old scroll, size and final-cell callbacks cannot certify the new visit.
Actual row heights remain measured; there is no fabricated fixed-height shortcut.

Independent review found that a changed row can keep the same total content height,
so React Native need not emit another content-size callback. The final repair keeps
the last measured height as a provisional bound on the same native mount, while
invalidating old end/footer and scroll acknowledgement evidence. Fresh end evidence
must agree before a terminal clamp. A real remount or empty transition still clears
the height. No-event regressions cover same-height row and viewport changes, plus
a changed-height case that cannot settle from the stale size.

Native speed and position must still be measured on the resulting APK. The earlier
R19 1,000-row emulator check was correct but took about 7.3 seconds; it is historical
evidence, not a performance result for this repair.

### Frozen migration inventory

The new A1 SQL was incorrectly stored as a 148th source migration. It is moved to
`supabase/candidates/20260926175504_clean_notification_push_event_type.sql`.
Its SHA256 before and after is
`09b5d0c2ecf57879bda75e9e33c616d4f6a5b0d5a11c69383fc6df435def08da`.
The existing 147 migration bodies and their manifest are unchanged.

The N09/P11 disposable proof loaders now read the candidate path. P11's historical
proof-ledger filename and 123-to-124 assertion are intentionally unchanged; they
do not claim to reproduce all 203 live DEV entries. The already applied DEV entry
remains version `20260926180141`, name `clean_notification_push_event_type`.
Nothing is applied again.

### Control-table uncertainty

The dashboard generator correctly returns `sertifikat_ok: null` when a fresh
private check is unavailable. Its HTML template previously rendered that as
`ne važi`. It now distinguishes unknown from a measured failure. The historical
certificate values are not changed. Updating the published HTML template remains
separate from importing the new JSON state into the existing page.

## Verification

Results are recorded here after execution; source changes alone are not acceptance.

- Locked `npm ci`: passed, 881 packages installed, no dependency changes.
- Migration integrity: PASS, 147 files (87 snapshot + 60 pending).
- Final Node notification formatter/transport tests: 75 passed; synthetic providers only.
- Foreground regression witness before the repair: 104 failed, 55 passed (159 total).
- New server wording guard before the two-literal change: 28 passed, 1 failed;
  after: 29 passed. No deployment is implied.
- Final push/session/V3 wording checks: 192 passed in 3 suites.
- Isolated old-source Discovery witness: 9 failed, 4 passed; fixed: 13 passed.
  The subsequent unchanged-height witness failed two cases before its bounded fix.
- Final Discovery focused suite: 100 passed with the owner's 30-second test timeout.
- Final integration TypeScript: passed.
- Final complete Jest: 321 suites / 6,481 tests passed, exit 0, 307.359 seconds
  (`npx jest -w 3 --testTimeout=30000`). Jest reported its existing worker teardown
  warning; it did not fail a test. Later CI and exact APK results are recorded below.
- The first full local run was intentionally interrupted for the independent
  same-height finding. It is not a full-suite result; its log also records an Expo
  Firebase config subprocess returning a null status at its 15-second bound under
  load. Final-source checks must supersede that attempt explicitly.

## GitHub verification and delivery

Code commit `54f8aff2` and control commit `a5ef12bb` were pushed to the existing
`work/uskoci-ui-unification-20260924` branch without a PR or force push.
All results below bind to `a5ef12bb011012534c17287ce03218bb3c81adbe`, tree
`9710b804b08637a75e286f35f84add36fc30f287`:

- R20 run [36265280226](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36265280226):
  SUCCESS; downloaded full-Jest artifact confirms 321 suites / 6,481 tests, no failures.
- A1 run [36265280256](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36265280256):
  SUCCESS; all 11 runtime report checks pass on a disposable historical database
  with actual Auth/Edge and synthetic Expo. This is not live-203 database parity or delivery.
- N10 run [36265280227](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36265280227): SUCCESS.
- PKG-051 run [36265280220](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36265280220): SUCCESS.
  No payment implementation was changed by this package.
- PKG-006 run [36265280228](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36265280228): SUCCESS.

Android emulator run `36265297705` and phone push-proof run `36265299721` both
succeeded. Their APK hashes, source/run/tree attestations and package details were
verified. The emulator APK was installed with its actual device hash checked.
Its **second no-scroll detail return fails** despite the successful first return;
read `R20_NATIVE_A5EF12BB.md`. Native acceptance remains open for a corrective source.
The corrective source and its separate verification are tracked in
`R20_NATIVE_ACK_FOLLOWUP.md`; they do not retroactively change that APK's verdict.
The phone push-proof artifact is verified but not installed; no physical phone is connected.

The control table was regenerated locally and committed. On the existing owner-authenticated
Claude Artifact, both the accessibility upload control and the actual iframe file input
failed to yield a file chooser (tool timeout). Remote JSON import is **unconfirmed**;
the visible page still shows `b9aed185`. Its HTML template has not been republished,
so the local unknown-certificate display correction is not yet live on that page.

## Remaining product boundaries

This is not a claim of complete product or store readiness. The live notification
readiness policy, all real event chains, iOS delivery, legal/retention inputs,
pagination at scale and the separate voice implementation retain their own gates.
No real notification or paid AI call is sent by this package.

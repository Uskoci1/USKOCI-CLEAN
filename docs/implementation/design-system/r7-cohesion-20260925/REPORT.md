# R7 — UI cohesion, location and AI client reliability

Date: 2026-09-25. This is a bounded execution receipt, not a new master plan or a claim that the entire R6 sweep is closed.
The living design/AI plan is `USKOCI_MASTER_PLAN_DIZAJNA.md`; the execution tracker is `docs/control/redovi.json`.

## Changes

- Saving a task place, remote task or worker area no longer requires a redundant checkbox. Save is the confirmation;
  `confirmed: true`, draft-point acceptance, revision checks and unknown-outcome recovery remain. This step was
  committed separately as `9956d3ee`; types and all 305 suites / 5,921 tests passed before that commit.
- Removed Agreement current-location sharing screen, route, entries and its obsolete presentation test. Kept
  `AgreementPrivateLocation`, telephone consent, data services, existing records and every server function unchanged.
- Added owner-approved `expo-location` 57.0.20. Nearby starts only from an explicit tap, obtains one fresh foreground
  fix and retires the subscription and deadline. It centers the camera only; no exact GPS coordinate enters storage,
  business RPCs or analytics. Existing public map-tile requests still occur. No background location permission.
- Map preview uses the shared stacked title/value head and separate illustrated place/time facts. Filters keep draft
  edits until Apply. Existing items revealed by a filter no longer replay arrival motion. Complete map-credit links
  replace the duplicate native attribution control.
- Root-stack transitions respect live reduced-motion changes; interrupted bell animation resets; native input fields
  use Inter. Badge accessibility says what the number counts instead of a bare number.
- Task AI: successful speech no longer erases a separate typed draft. Typed submissions own one exact draft revision;
  new edits, speech, retries and restored IDs cannot claim another draft. Six new checks failed on the old code.
- Worker AI: Back can safely leave a pending interview while retaining recovery IDs; late callbacks are fenced. Busy
  form saves still wait visibly. The availability panel has one vertical scroll with reachable save/recovery controls;
  two real-form layout tests reproduced the old nested-scroll defect at narrow and enlarged-text sizes.
  The same draft-ownership protection now covers the worker interview: five predecessor-failing checks proved
  that successful speech/recovery/retry and an edited-back typed draft could otherwise erase independent input.

## Independent review corrections

The first Nearby implementation retained its target after consumption, so a map remount could undo a manual pan.
The camera now acknowledges and retires the exact request; an old acknowledgment cannot consume a newer request.
A real hook/map test covers Nearby → pan → remount, including remembered viewport restoration.

The first stacked preview still inherited a non-scrolling height cap. The correction keeps the bounded floating card
and gives overflow a native scroll path with a fixed close control. Native large-text acceptance must confirm it.

The integrated run also exposed four obsolete or incomplete test assumptions: the retired location gallery,
the previously forbidden Nearby control, a React Native mock missing StyleSheet.flatten, and location-permission
copy. These were aligned with the approved behavior; protected address, nonautomatic permission and recovery
checks remain. No production guard was bypassed to obtain a green test.

## Verification status

Focused checks for location, protected address, AI draft ownership, worker Back/availability, Nearby lifecycle,
appearance, typography and accessibility have passed. Integrated types are clean; all 307 suites / 5994 tests passed in 108.478 seconds. The 147-file migration inventory and whitespace checks pass. The existing Jest worker-exit warning remains. Matched CI, APK and native acceptance are recorded in `RECEIPT.json` separately; tests do not accept device behavior.

The connected device is emulator-5554. The pre-change APK b9aed185 has been opened on the real existing signed-in
session: Home and Discovery render actual DEV reads. No business command or paid AI call was executed. This does
not substitute for checking the new APK, phone microphone, TalkBack, iOS or the complete two-party journey.

## What remains

- R6's 181 historical entries must be reconciled individually with current code. This package is not “181 closed”.
- Discovery relations failure/retry (DN-01), bounded server discovery/paging, Home rating-read fan-out, and the other
  independent contract findings remain separate work. Do not label those fixed by visual changes.
- AI category inference/quality and current provider readiness need permitted operational evidence. Android speech
  needs an owner-present device pass. iOS native speech, AI speech/TTS and interruptible full voice are not finished.
- Legal/operator/retention, payments owned by the other session, production setup, push/device acceptance and store
  gates remain. The proposed rating-comment server package is not applied; all server changes still need “primeni”.
- No server, DEV, Edge, key, applied migration or payment code changed in this package.

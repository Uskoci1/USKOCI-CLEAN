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
- Owner's later visual batch: USKOČI logo and price capsules, native logo fallback beyond the 40 rich-label budget,
  warmer public-map geography with clearer water/parks/streets, 48 dp quick filters and larger illustrated preview
  facts with light press feedback. Amount/offer/missing-price semantics, grouping and all public-coordinate guards
  remain. The palette changes only known layer colors and is shared by Discovery and resolved-place maps.
  No extra dependency. The three composition alternatives and motion reasoning are in the master plan.
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
and gives overflow a native scroll path with a fixed close control. The final native 320 dp / font-scale-2
observation shows every fact for the observed task and a working close control; a longer overflowing task was not available.

The integrated run also exposed four obsolete or incomplete test assumptions: the retired location gallery,
the previously forbidden Nearby control, a React Native mock missing StyleSheet.flatten, and location-permission
copy. These were aligned with the approved behavior; protected address, nonautomatic permission and recovery
checks remain. No production guard was bypassed to obtain a green test.

## Verification status

Focused checks for location, protected address, AI draft ownership, worker Back/availability, Nearby lifecycle,
appearance, typography and accessibility have passed. Integrated types are clean; all 307 suites / 5994 tests passed in 108.478 seconds, then again in 114.472 seconds after the native credit-spacing correction. The 147-file migration inventory and whitespace checks pass. The existing Jest worker-exit warning remains. Matched CI, APK and native acceptance are recorded in `RECEIPT.json` separately; tests do not accept device behavior.

The connected device is emulator-5554. The pre-change APK b9aed185 has been opened on the real existing signed-in
session: Home and Discovery render actual DEV reads. No business command or paid AI call was executed. This does
not substitute for checking the new APK, phone microphone, TalkBack, iOS or the complete two-party journey.

The first R7 APK (`3fdbe559`, run 36095767194) passed both artifact attestations and installed with `adb install -r`.
Native inspection found that optional padding/gaps made the three 48 dp credit links wrap at normal 411 dp width,
overlapping a visible task pin. The final correction removes that surplus spacing, retaining all three named links,
48 dp targets, wrapping when actually needed and the same type size. At that intermediate checkpoint it was the
only app-source difference after the eight package proofs at `3fdbe559`; full types/Jest were rerun for it.
The first APK also showed timeout recovery for Nearby (the emulator supplied no fresh fix), readable selected-task
facts at font scale 2, and accessible filter controls. These observations alone do not establish real GPS success.

### Owner-directed larger visual batch

Source `43535736` follows the credit correction with the branded-map changes above. Final types pass and all
308 suites / 5,996 tests pass in 120.644 seconds; the existing worker-exit warning remains. The pure palette
checks preserve sources, geometry, filters, zoom bounds and labels and leave unknown layer types untouched.
The installed MapLibre version takes a hitbox as four insets, not width/height; typecheck caught that initial
integration mistake and it was corrected before the passing full run. Native image rendering was then inspected
in APK run `36099357856`, the combined visual build; the preceding credit-only
APK `36097610908` completed but was not installed, following the owner's request to batch changes.

Preview switching still uses the existing keyed sheet lifecycle. Removing the key safely needs scroll ownership,
updated measurements/announcements and an old-close/new-selection race proof; this batch does not claim that change.
Normal sheet springs, camera easing and press response remain enabled. System Reduce Motion is respected individually.

### Final native observations — combined APK `43535736`

Both APK attestations passed and matched source, tree, run and SHA-256; `adb install -r` returned Success.
The only connected target was `emulator-5554` / `USKOCI_V5_TEST`, not a physical phone. The existing signed-in
account was preserved. No task/application/agreement command, paid AI call or address search was made.

- At 411 dp and font scale 1, Home and Discovery displayed existing DEV reads. The public task's USKOČI logo
  rendered on both normal and selected capsules; tapping it opened the correct card and Close dismissed it.
  The selected title, offer wording, place, time, people and publisher/rating were readable. All three map credits
  fit one row without covering the pin. The filter panel opened; Apply was not executed.
- At 320 dp and font scale 1.3, the logo stayed legible; credits wrapped into three rows and remained visible.
- At 320 dp and font scale 2, the selected card displayed all facts for the observed task and its fixed Close
  worked. The surrounding search header occupies too much map space, bottom labels wrap awkwardly, and map
  credits are not visible in the collapsed-map screenshot. These are open layout/attribution acceptance issues,
  not a claim of complete large-text support. The longer-than-viewport card scroll path remains test-covered only.
- The location-form gallery showed the same palette at street scale with legible Latin road names and its existing
  point marker. This was a local presentation fixture; neither address resolution nor Save was triggered.
- An independent source/image review found no blocker in the normal-width logo, selection, palette and preview.
  It did not accept physical-device motion, high-density fallback markers or all enlarged-text states.

The temporary size/font overrides were restored to 1080 × 2424, density 420, font scale 1.0. Animation-scale
settings were not changed. A short emulator interaction recording exists locally; no frame-time or FPS claim
is derived from it. Native fallback beyond 40 rich labels remains unobserved with this DEV dataset. Earlier
Nearby timeout and availability/location-form observations are explicitly bound to the interim APK in the receipt.

Control rows A04/B02/B00/B04 were updated and `node scripts/control/osvezi.mjs` completed: 62 rows, 31 PROBLEM
and 31 not phone-verified. These are structural/acceptance states, not 31 newly observed bugs. Phone lights and the
dated DEV snapshot were not changed. External publication to the existing Claude artifact remains blocked:
the documented browser filechooser times out even on the actual iframe input, and no file was selected.

## What remains

- R6's 24 historical major entries were reconciled in the master plan; the other entries still need current-body
  review. This package is not “181 closed”. The narrow/large-text issues above also remain open.
- Discovery relations failure/retry (DN-01), bounded server discovery/paging, Home rating-read fan-out, and the other
  independent contract findings remain separate work. Do not label those fixed by visual changes.
- AI category inference/quality and current provider readiness need permitted operational evidence. Android speech
  needs an owner-present device pass. iOS native speech, AI speech/TTS and interruptible full voice are not finished.
- Legal/operator/retention, payments owned by the other session, production setup, push/device acceptance and store
  gates remain. The proposed rating-comment server package is not applied; all server changes still need “primeni”.
- No server, DEV, Edge, key, applied migration or payment code changed in this package.

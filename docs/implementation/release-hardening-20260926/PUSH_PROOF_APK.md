# Android push-proof APK — 26.09.2026

Status: **PUSH_CAPABLE_APK_BUILT_ATTESTED_DEVICE_PENDING**.

- Source: `3d31a3009c06c12d0cd082c64ef482536fc74b69`
- Tree: `b6a2cb7772ce7e9055b55d59395f6ed380659fdc`
- GitHub Actions run: `36246861282`
- Android package: `rs.uskoci.preview`
- APK SHA-256: `dd9bb8e887bb5c78a2ff92f51060c257d33aa9d980dd76d5b9c90b086d2e9728`
- APK bytes: **70,681,821**
- Firebase Messaging intent in actual APK manifest: **PASS**
- Firebase Messaging explicit auto-init disable in proof APK: **ABSENT / PASS**

## Isolation

The proof mode is fail-closed: `USKOCI_PUSH_PROOF_BUILD=1` is accepted only for `rs.uskoci.preview`, the only Android package currently present in the checked-in Firebase public client configuration. Ordinary preview retains the enrollment-disable plugin; dev/production packages cannot use this proof mode.

The successful run passed TypeScript, focused Firebase/push client tests, exact Expo config checks, native Android prebuild, generated Firebase input checks, ARM64 release build and actual APK package/Firebase Messaging manifest attestation.

## Independent artifact read-back

The downloaded artifact was unpacked after the run. Its APK SHA-256 independently recomputed to the same value above and matches both the uploaded checksum file and the source-bound attestation. The attestation binds the APK to source `3d31a300` and run `36246861282`.

## Server state after the build

Fresh read-only DEV observation at 2026-09-26 14:14:46 UTC:
- 202 migrations; latest `20260924202023`
- PUSH CREATED/unstarted: **0**
- push attempts: **0**
- active push devices: **0**
- inactive devices: **1**
- readiness rows: **0**
- PUSH suppressed/PUSH_OFF: **40**
- `uskoci-push-transport`: v16 ACTIVE, canonical GitHub source
- `uskoci-media`: v13 ACTIVE, canonical GitHub source

Therefore this build itself did not create a registration, delivery, attempt or provider send.

## Not accepted yet

No physical phone installation is claimed. Notification permission, Expo token acquisition, session-bound device registration, one-event delivery, provider ticket/receipt, lock-screen display and warm/cold tap are still unproved. This is not a production/store APK and does not change the production package.

## Next push boundary

Install this exact APK on the owner's physical Android phone. The owner explicitly enables notifications. Then read back exactly one active session-bound device for the current account/role. Reconfirm old backlog=0 before creating exactly one approved test event. Only then allow one bounded send/receipt cycle. No batch or blanket push activation.

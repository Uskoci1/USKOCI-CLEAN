# Round31: native findings, map recovery and catalog continuity

The consolidated Round30 emulator APK was built from `baa328327b2d7861966780337f16c327c757e1c3`, installed with `-r`, and its installed SHA-256 matched `5325691d20dfe121973f5c065a81c994704da220ce0917040e13b2956383863b`. The existing session survived. The ARM64 phone artifact from the same source was also verified, but the physical phone was no longer visible through ADB. It was not installed or accepted.

## What the native checkpoint established

- A count tap opens FULL directly. The list meets the search/filter surface; scrolling exposes the real “Bez označenog mesta” group. The existing TaskCard and Peek remain unchanged.
- The compact AI-location proposal shows its unconfirmed pin, then “Nije ovde” exposes correction and “Ispravi u razgovoru” returns to text. This used an inert local scene, not a paid AI/geocoder call or a saved task. The map's brighter water/greenery and Latin labels were visible.
- Original Catalog27 stills render in color and muted tone at 32 dp. The lock appears on actual Privacy. Legal documents remain honestly unpublished; no unavailable document was presented as ready.
- The native support animation trial briefly lost its artwork while the cold player mounted. A captured interval is not frame-rate/timing acceptance.
- Discovery's own 15-second display deadline showed an error; the same native instance completed at 19,139 ms, but the error remained. This is an exact-build reproduction, not a presumed provider outage.
- On one retained FULL return, the panel disappeared, leaving its dim background. A second instrumented return retained the header/cards/scroll correctly. The intermittent failure remains open; neither a green source test nor the successful second return closes it.
- A selected branded pin eventually displayed its corresponding unchanged Peek. ADB capture intervals were too broad to establish useful tap latency; responsiveness remains unaccepted on the physical phone.

## Corrections implemented after that checkpoint

1. Distinguish a display deadline from a real native map error. The still-owned map may recover after a late successful load; stale owners, retries and actual native failures remain guarded. Related point/overview maps had the same source pattern and received the same narrow correction. Only Discovery has the native failure reproduction. Details: `ROUND_30_MAP_LATE_READY_AND_PAYLOAD.md`.
2. Give GeoJSONSource the already memoized identical JSON text. This removes another encoding of the whole collection during pin renders without changing IDs, geometry, selection or camera behavior. It is not a measured native speedup.
3. Keep the decoded Catalog27 still while the native animation loads. Loaded/finish/failure events belong to one playback owner; older callbacks cannot replace a newer moment. The motion remains a development trial, not a newly enabled production animation.

## Verification and publication boundary

The existing full CI run `36351034207` initially failed three test fixtures/expectations. Commit `745f07d6ad8b20e91276ca6d1301a5d9c409f716` changes only those three tests: actual progressive price-section opening, hoisted AppState listener initialization, and a narrowly bounded token-derived zero-lift exception. Independent review found no weakening of behavior assertions. Rerun `36351959072` passed TypeScript and **342 suites / 7,199 tests**. That full run predates the three native corrections above.

The native corrections passed four map suites / 143 tests and the CatalogMoment suite / 13 tests. Final integrated TypeScript and the following exact APK checkpoint are recorded in `ROUND_31_CHECKS.json`; do not attribute the fixes to the installed Round30 APK.

No DEV database, Edge, certificate, provider-push, paid-AI, dependency, payment, TaskCard or Peek change is included. Canonical DEV remains at the previously verified ledger210/Edge22, with exact-message push payload still OFF. P6 server filtering, voice, provider push acceptance, iOS and release gates remain separate work.

The control table is refreshed locally. The previously recorded supported dashboard file-chooser failure still prevents claiming publication to the hosted artifact. Generation is not publication.

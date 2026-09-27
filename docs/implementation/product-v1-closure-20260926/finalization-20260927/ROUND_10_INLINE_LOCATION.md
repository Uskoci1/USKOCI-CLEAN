# Round 10 — keep the location decision inside the conversation

2026-09-27. Follow-up to Round09, using existing owner-only location contracts. The person should confirm or correct each actual place, see the saved result beside the conversation, and enter review without losing that work.

| Field | Outcome |
| --- | --- |
| Problem | The parent hid the entire point surface when every point was saved, so correction required leaving the conversation. Closing an already saved set warned that it would be lost. A stale review could replace a freshly read location with its older value while retaining the new revision. |
| Cause | Visibility depended only on missing slots; local changes were not distinguished from the loaded baseline; the review editor unconditionally overlaid old values on a fresh read. |
| Product decision | Keep a compact confirmed map in the conversation. Open manual corrections deliberately; distinguish saved, confirmed-but-unsaved, and unconfirmed work. Never combine an old location with a newer revision. |
| UX/UI | Confirmed points open the existing expanded map and explicit navigation. Each point remains separately editable. While a manual decision is open, the typed draft stays editable but Send, photos and review wait. Header/Android Back uses the point editor's own close/discard decision. The copy no longer assumes that every route has exactly two points. |
| Implementation | The parent validates saved geometry against current country/geography/address and scopes hiding to that exact location. The child renders an owned full-set preview, uses canonical receipt data after saving, and fences disabled/retired actions. A fresh conflicting location forces review refresh before another edit; an opening lock coalesces taps and blocks acceptance during the read. |
| Files | `IntakePresentation.tsx`, `AiConversationShell.tsx`, `ConversationPointAsk.tsx`, `pregled-zadatka.tsx` and their focused regression suites. |
| Backend/RPC | Existing `rpc_get_need_location_review`, `rpc_save_need_location_review` and review preparation only. No new RPC, database/Edge application, dependency, AI prompt or provider request. Confirmations still send `confirmed: true`. |
| Tests | TypeScript PASS; four distinct focused suites / 270 tests PASS. Exact commands, results and source hashes are in `ROUND_10_CHECKS.json`. The initial two test-only BackHandler type errors and corrected rerun are preserved; mocks/source checks do not imply native acceptance. |
| Device proof | NOT RUN. No APK, install, native screenshot, actual map gesture, Maps launch, microphone or paid AI call. |
| Regression | Same-slot pins from another city cannot satisfy the current place. Old opening responses cannot clear a later visit's lock. Saved locations are not described as unsaved work. Manual editing cannot admit retained competing send/review/photo callbacks. |
| Independent review | One reviewer identified the stale location/revision overlay; another caught the need to report manual-edit entry synchronously before a competing callback can run. Both were incorporated in this source package. |
| Git | Source base `8482b13e`; exact changed-source hashes are in the check receipt. The enclosing source commit and subsequent control refresh identify the deliverable. |
| Status | CLIENT SOURCE IMPLEMENTED / TYPES AND FOCUSED CHECKS PASS. Whole-product and native acceptance remain open. |
| Next | Exact-build location acceptance, plus separately approved chat B3 deployment/client wiring. B3's successful disposable proof is not a DEV deployment. |

## Privacy and route meaning

Location search now includes each slot's actual named landmark as well as its area and city, without duplicating equal values. A label-only named stop is no longer reduced to its city during the existing search; no new geocoder or AI extraction behavior is claimed.

The inline map is owned conversation content. Public task detail still receives only its existing coarse anchor. It cannot show a full public multi-stop route until an approved public projection exists; private coordinates are not substituted. An actual road route or ETA is not invented inside the map.

External navigation remains explicit and follows the [Google Maps URL contract](https://developers.google.com/maps/documentation/urls/get-started#directions-action): a destination can open navigation or a route preview, depending on the external app and available origin. Complete supported stop sets use the existing route URL; longer sets keep individual destinations rather than silently omitting stops. This round made no external navigation request.

## Chat documentation reconciliation

The two living B3 contract notes now reflect the successful disposable run and canonical NOT NULL participant columns. Historical failed artifacts are preserved. No live nullable-participant exploit, DEV installation or client connection is claimed. The pending owner approval for B3a/B3b remains separate from this client-only round.

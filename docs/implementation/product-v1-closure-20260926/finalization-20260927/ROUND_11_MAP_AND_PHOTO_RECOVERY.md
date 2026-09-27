# Round 11 — recover maps and photos without leaving the task

2026-09-27. Client continuation from `d62bb709`, after the inline location package. Existing cards, public/private projections and server contracts are preserved.

| Field | Outcome |
| --- | --- |
| Problem | The map expansion overlay intercepted the map's own retry target. A failed contextual photo stayed unavailable until focus/remount, even after refreshing the chat. Private map export relied on the grant-expiry render rather than checking the clock at the actual tap. |
| Cause | A full-map sibling press sat above failure controls; image bytes loaded only on focus/binding changes; map action ownership did not include caller-held grant authority. |
| Product decision | Recovery belongs beside the failed content. Showing a saved private location does not confer indefinite permission to launch it into another app. Dismissing a map must remain possible after permission expires. |
| UX/UI decision | Only the visible expand control intercepts taps. An unavailable photo becomes one compact retry target, including prepared thumbnails. Message summaries and photo actions are separate accessible targets; plain-text bubbles keep their layout. A loaded task photo alone opens the full-screen viewer. |
| Implementation | One explicit in-flight photo attempt, native image error recovery, abort/generation/account/focus/context fences, no automatic retries or disk cache. Agreement maps carry exact grant/reveal/visit/intent/expiry authority; expansion, stop selection and external navigation check it synchronously. Close checks the modal visit, independently of private export authority. |
| Files | `AgreementPrivateLocation.tsx`, `LocationMapPreview.tsx`, `AuthorizedPhoto.tsx`, `AgreementChat.tsx`, `ContextPhotos.tsx` and the focused tests referenced in CHECKS. |
| Backend/RPC | Existing contextual `mediaClientService.readMedia` and existing location grant/reveal/read methods only. No new RPC, DEV/Edge application, dependency, provider request or public exact-coordinate projection. |
| Tests | Five distinct selected suites / 100 tests PASS. The map's 10 tests were rerun after the dismissal correction, replacing that selection in the total rather than adding it twice. TypeScript status and file hashes are recorded in `ROUND_11_CHECKS.json`. |
| Device proof | NOT RUN. Native tap routing, thumbnail layout, actual image decoding, screen-reader traversal, grant expiry and Maps launch still need exact-build acceptance. No APK/build/install or provider execution. |
| Regression | Repeated retry taps start one request; old requests and image errors cannot replace a newer attempt. Blur, account/revision and media-context changes retire old actions. Expired/replaced grants cannot export coordinates; a denied map can still be closed. Text-only message content and style remain. |
| Independent review | Review found the intercepted map retry, photo recovery gap and missing grant clock admission. Integration review additionally found denied-map dismissal and the small caption touch target; both were corrected. |
| Git | Base `d62bb709`; source commit and subsequent control refresh identify the result. Source receipt records exact final files and check scope. |
| Status | CLIENT SOURCE IMPLEMENTED; focused checks PASS. Exact native acceptance, chat B3 activation, voice, full push-to-message proof and whole-product readiness are not claimed. |
| Next | B3a/B3b requires the already-requested explicit `primeni` before DEV application/client activation. Consolidated exact-build map/photo/AI acceptance remains deferred under the owner's testing instruction. |

## Technical references and limits

The separate photo action follows React Native's documented accessibility grouping behavior: nested accessible controls may be hidden by a parent. This source change removes that parent/child target collision; it is not a TalkBack/VoiceOver result. [React Native accessibility](https://reactnative.dev/docs/accessibility#accessible).

The image component uses its existing `onError` callback and keeps `cachePolicy="none"`. It rereads through the contextual authorized reader, not a retained signed URL or a new cache. [Expo Image API](https://docs.expo.dev/versions/latest/sdk/image/).

The location review also considered a generic fallback from a city/area to a geography `label`. That change was rejected for the public draft projection: current task-card contracts deliberately exclude private labels. Owned per-stop maps already use the actual labels; widening a public summary is not a valid shortcut. TaskCard/DiscoveryPeek remain unchanged.

No map road polyline, travel time or new routing provider is introduced. Public details continue to use their coarse anchor, while complete granted/owned stop sets retain the existing explicit external-navigation limits. Live remote revocation is still learned through existing refresh/foreground checks; this round adds action-time checks for already known grants, not a new realtime server signal.

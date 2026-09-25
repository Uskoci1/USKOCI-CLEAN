# R19 media: source audit and task-photo presentation

Date: 2026-09-25. Source inspected: `74f514d79fa323e135c9ddc23a6cb6b5b934c730` plus this bounded client change.

This is a local source/contract audit, not a fresh DEV inspection or device acceptance. No backend/provider calls, device actions, dependencies, uploads, or changes to real data were made by this work item.

## Task photos — implemented client improvement

User job: inspect the actual work photos before deciding whether to apply.

`NeedPhotos` already read up to six real, authorized images, but used a horizontal strip with fixed 320/248 dp image widths. Both public and owner details supplied the same component. Public photos followed the title; owner photos also followed the application row. Positioning within those screens belongs to the root R19 composition change.

`src/ui/media/ContextPhotos.tsx` now provides:

- Horizontal native paging, with each image sized to its measured container instead of a guessed phone width.
- A real `1 / N` counter and a small expand cue; no fake photos or counts.
- Tap to open the selected image in an existing React Native full-screen Modal. The viewer uses `contain` so the complete photo can be inspected.
- Swipe, previous/next buttons, an explicit Close button, Android Back dismissal, safe areas, and Reduce Motion-aware modal entry.
- Page retention across width changes and when returning from the viewer.
- Reset/dismissal on task, account/revision, photo-list, or route-focus change.

Every image still uses `AuthorizedPhoto` with the same asset ID and task ID. Its contextual authorization, in-memory representation, no-persistent-cache policy, loading indicator, and unavailable state remain unchanged. An authoritative empty list now renders nothing for both public and owner views: a top-of-detail photo area must not put a no-photo notice before the task title. Failed-list retry remains visible, so missing photos and failed reads are not conflated. `ProfilePhoto`'s implementation and `NeedPhotos`'s public signature are unchanged.

Main source evidence before this change: `src/ui/media/ContextPhotos.tsx:18`, `src/ui/media/AuthorizedPhoto.tsx:24`, `src/data/mediaClientService.ts:101`, `src/ui/v2/PublicNeedPresentation.tsx:94`, `src/ui/v2/NeedPresentation.tsx:171`. Line numbers for concurrently edited presentation files describe the audited source, not necessarily the final R19 layout.

## Profile-photo report — implementation exists, concrete recovery gap remains

The profile hub opens the photo editor by its owned profile ID (`src/app/(app)/profil.tsx:85`). The editor chooses from gallery/camera, prepares JPEG bytes, uploads, reads the command, and requires a separate explicit Save before publishing the image (`src/app/(app)/profil/fotografija.tsx:105`, `:115`, `:133`). Native image preparation and permission/size errors are implemented in `src/features/media/nativePhotoPicker.ts:23`. Selection is limited to images; camera permission is requested only for camera use.

The user's specific failure was not reproduced in this audit. Do not claim the image feature is missing or that the issue is fixed.

A source-level recovery gap is concrete:

1. Upload intent is durable, but prepared bytes are only in memory and are cleared on blur (`fotografija.tsx:53`).
2. A failed receipt read preserves that intent and returns a null asset (`:64-70`).
3. With no bytes after leaving/restarting, UPLOAD retry can only read again (`:165`). The unresolved UI suppresses choosing another image (`:185-195`).

If no asset receipt ever becomes available, the user can be left with only repeated checks. Do not erase an unknown intent just to reopen the picker: a late upload must remain fenced and traceable.

For a **known** pending asset, the checked repository body of `rpc_discard_profile_avatar` accepts a non-applied AVATAR asset and sets `selected=false`; it does not require READY (`supabase/migrations/20260912224647_clean_v5_owned_media.sql:258-269`). Completion preserves that deselection (`:138-159`). The client currently offers discard only when READY (`fotografija.tsx:152`). Exposing an explicit, guarded discard of an authoritatively read PROCESSING/STAGED avatar is a possible separate client fix, requiring its own race/recovery proof and confirmation of the active contract. It was not implemented here.

For an **absent** receipt, the existing task cancellation writer cannot be reused: it is explicitly TASK/conversation scoped (`supabase/candidates/pkg046a_media_upload_cancellation.sql:180-223`). An avatar cancellation fence needs a separate server proposal if that case must be recovered across restart.

## Agreement attachments — actual capabilities and missing work

The current human-chat path supports text and up to six JPEG photo attachments. It has gallery/camera selection, private upload receipts, an outbox-bound immutable message command, authorized reading, cancellation/retry, and attachment rendering:

- `src/contracts/projections.ts:467`: message projection contains text and optional JPEG photos, no audio/document fields.
- `src/data/agreementMessageClientService.ts:22-73`: captures text/photo intent; sends through the text RPC or photo-message RPC; validates the response and retains unknown-outcome semantics.
- `src/data/agreementPhotoClientService.ts:77-129`: upload/list/read/cancel and photo metadata bound to the exact message/version/body.
- `src/hooks/useAgreementPhotos.ts`: native photo preparation and pending-selection lifecycle.
- `src/ui/media/AgreementPhotoComposer.tsx:27-108`: gallery/camera, six-photo limit, upload recovery and saved selection.
- `src/ui/AgreementChat.tsx:277`: authorized photo rendering in the transcript.
- `supabase/functions/uskoci-media/index.ts:101-142`: agreement image read/upload contract explicitly validates JPEG output and image input.

**Audio recordings and document attachments are not a completed end-to-end feature in this client/Edge contract.** There is no recorder/player or document-picker package in the inspected manifest. Existing AI dictation must not be described as human-chat audio attachments.

Safe client-only continuation: improve the photo tray and authorized photo viewing using existing components, without changing send/read/recovery contracts.

Audio/documents require a separately approved package: native capture/picking/playback, admitted MIME/size/duration rules, server upload/message/read contracts, explicit authorization and unknown-outcome recovery, storage processing, reporting, export/erasure/retention coverage, plus any new library approval. Adding only icons would falsely advertise support. No such package is activated here.

## Verification

Executed once after implementation:

```text
npx jest --runInBand --testTimeout=30000 --runTestsByPath src/data/__tests__/task-photo-gallery.test.tsx src/data/__tests__/media-client.test.ts src/data/__tests__/v5-avatar-screen.test.tsx
```

Result: **3 suites / 63 tests passed**. The seven new gallery tests cover measured-width paging/counter/resizing, correct full-screen starting photo and Back dismissal, Reduce Motion/explicit close, task/account change retirement, route blur, empty/error/retry without invented photos, and unchanged profile-photo contract.

Integration follow-up: owner empty-state copy was removed when root moved the gallery above the title. The same gallery test now requires an empty render for both sides while retaining failed-read retry. Focus/account/Modal paths were reviewed again: old galleries are unmounted on identity/list changes, the viewer is dismissed on route blur, and Android Back closes only the viewer. Rerun of `task-photo-gallery.test.tsx` only: **1 suite / 7 tests passed**, 2.079 seconds.

Integrated type checking, full Jest, APK construction, and native visual acceptance belong to the root R19 batch. They were not run or claimed by this work item.

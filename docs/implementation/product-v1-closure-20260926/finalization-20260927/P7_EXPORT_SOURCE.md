# P7 export — retain a failed-cleanup warning after expiry

2026-09-27. **SOURCE ONLY, UNVERIFIED.** No tests, types, build, device, provider, database or proof execution. No visual/public-copy, backend, dependency or account-closure changes.

## Substantiated failure

`src/lib/dataExportFile.native.ts` checks ownership/expiry after creating and after writing its newly owned file. If the export expires during that work, it attempts to delete the file. If deletion fails, it deliberately returns `{ status: 'FAILED', code: 'CLEANUP_FAILED' }`, because an incomplete local file may remain.

`src/app/(app)/profil/izvoz.tsx` previously discarded every save result when `ownedDownload()` failed. That predicate includes both operation ownership and the artifact expiry. Consequently, the same still-focused account could receive a real cleanup-failure result after expiry and never see the screen's existing warning about the local file. This source path requires no account switch or malformed server payload: crossing the deadline during native work and a failed deletion suffice.

## Bounded correction

The route now separates current download ownership from permission to keep saving before expiry. Download admission, byte receipt/generation/digest/length matching and the native/web saver's `isCurrent` callback retain the expiry fence. After the saver returns, only `FAILED/CLEANUP_FAILED` may be reported after expiry, and only while the same account revision, rendered focus/data, controller and un-aborted operation remain current. Expired success and other stale outcomes still cannot produce a saved claim. The existing warning text and tone are reused unchanged; in-memory bytes are still cleared in `finally`.

Only `izvoz.tsx` and this note are changed. `dataExportFile.native.ts`, `dataExportFile.web.ts`, `dataExportDeliveryService.ts` (the actual delivery filename) and the shared editor/closure code are unchanged.

## Other inspected boundaries and limits

The download is an authenticated byte stream, not row pagination. The existing delivery source validates receipt/generation, headers, expiry and maximum/actual length; it rejects truncated or oversized streams, clears accumulated chunks and handles late chunks after retirement. The screen binds the returned length/digests to its loaded descriptor. Native save verifies the physical file's size/MD5; web save verifies SHA256 and reports only download initiation. Existing native picker ownership and exclusive local creation remain. No additional concrete defect was established in these inspected paths.

The correction is source-reviewed, not runtime-proven. A later authorized focused check should cover expiry after native creation/write with cleanup failure versus successful cleanup, unchanged account/scope versus retirement, and expired `SAVED` suppression. Actual provider filesystem behavior and a real exported-file journey remain unverified here.

# Private Agreement photographs —144 implementation contract

AF-D21/22:6 photographs/message;10MiB original; sanitized JPEG at most1600px and5MiB; no raw archive, audio, Gemini or public URL. Temporary server admission is120 new uploads/rolling24h and12/minute/account. Replayed keys and absent cancellations do not consume a new upload admission. No automatic history deletion is installed.

The two existing text send RPCs remain unchanged. A photo-only message has an empty body and explicit ordered attachments, never fabricated user text. New sends/uploads require the current accepted Agreement version and existing send/block/closure authority. Historical attachment reads follow existing bilateral message visibility, including terminal Agreements and old messages after a block; a block forbids new contact but does not invent a history erasure rule.

## Authenticated message RPCs

`rpc_send_agreement_photo_message_v5(p_expected_user_id uuid,p_agreement_id uuid,p_expected_version integer,p_client_message_id text,p_body text,p_asset_ids uuid[])` accepts the existing8–200 character message key, trimmed body0–2000 Unicode code points, ordered1–6 distinct READY assets owned by this account and bound to the exact Agreement/version. It atomically stores the canonical message and one existing counterpart event. It returns exactly `{messageId,agreementId,agreementVersion,clientMessageId,body,assetIds}`. Exact replay returns the same receipt; changing body/order/version/Agreement under the key conflicts. Assets can attach to only one message. Replaying after the Agreement becomes read-only acknowledges the committed message without writing again.

`rpc_read_agreement_photo_messages_v5(p_expected_user_id uuid,p_agreement_id uuid,p_message_ids uuid[])` accepts1–50 distinct known canonical message IDs from that Agreement. Returns exactly `{accountId,agreementId,messages,authoritative:true}`; each message is `{messageId,agreementVersion,clientMessageId,body,assetIds,photos}`. Existing text-only messages return empty arrays and their legacy `clientMessageId` may be null. Each photo is exactly `{assetId,width,height,byteSize,contentType:'image/jpeg'}` in immutable attachment order. Foreign/missing IDs fail closed, never partial success. No read marker changes.

## Existing uskoci-media Edge endpoint

All calls use the current bearer session. No caller-supplied account or Storage path is accepted.

- Binary `x-media-operation: agreement-upload`, `x-media-target: AGREEMENT_UUID`, `x-media-version: POSITIVE_INTEGER`, `x-media-request-id: UUID`; JPEG/PNG/WebP Content-Type and original bytes. One durable claim, one Storage dispatch maximum. A repeated unknown request never performs a second POST.
- JSON operation `agreement-upload-read` or `agreement-upload-cancel`: `{agreementId,agreementVersion,clientRequestId}`. Cancellation of ABSENT creates a durable tombstone against a delayed claim. Cancelling an unattached upload retains any already-dispatched operation for settlement/closure; it does not refund or delete evidence. If attachment already won, returns the actual READY receipt with `attachedMessageId`.
- Exact-key read can reconcile an already-dispatched upload using positive SHA/size-verified Storage GET and settle that same dispatch. No original image, second upload POST or send replay is needed after restart. Missing/unknown object evidence preserves the recorded unresolved state; it is never reported as rejection or absence.
- JSON operation `agreement-upload-list`: `{agreementId}`. Returns `{accountId,agreementId,uploads,authoritative:true}`, at most120 latest owner unretired receipts; no raw paths. Restoring this list is read-only, never an upload or send replay.
- JSON operation `agreement-read`: `{agreementId,assetId,messageId}` for a persisted known message, or `{agreementId,assetId}` for the owner's own unattached READY preview. Byte authorization runs before and after exact hash/size verified private Storage GET; response is JPEG/no-store.
- Selected support evidence bytes continue through existing `read` with `{assetId,caseId}`. Only an explicitly captured message photograph is admitted, not all photos in the Agreement.

Upload receipt is exactly `{accountId,agreementId,agreementVersion,clientRequestId,assetId,state,attachedMessageId,photo,authoritative:true}`. `state` is ABSENT/PROCESSING/STAGED/READY/FAILED/CANCELLED. ABSENT has `assetId:null`, `attachedMessageId:null`, `photo:null`; all other states have the stable asset UUID. `photo` is the5-field metadata object only when READY; it is null otherwise. Unknown HTTP is not ABSENT or cancellation. Owner-list omits CANCELLED/FAILED rows but exact-key reads remain available. The client stores only opaque upload identities, never image bytes or native paths; explicit message outbox retains its existing text policy and exact ordered asset IDs/version.

Routine errors use existing safe media codes plus `MEDIA_VERSION_CONFLICT`, `MEDIA_COMMAND_CONFLICT`, `MEDIA_RATE_LIMITED`, `INTERACTION_BLOCKED`, `ACCOUNT_CLOSING`. Read-only unknown recovery does not bypass session/account/focus fences.

Local SQL/Edge implementation and the disposable proof are ready for source review. Targeted Node tests cover the real sanitizer and transport boundaries; the144 actual database proof still needs isolated execution. This contract is not a deployed or actual-database PASS claim.

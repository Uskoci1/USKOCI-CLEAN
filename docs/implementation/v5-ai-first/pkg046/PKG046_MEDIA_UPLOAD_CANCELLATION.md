# PKG-046 — task-photo upload cancellation (F16 / A05 / GAP-0036)

Status 2026-09-22: **candidate written, proof workflow added, not yet run on CI, not applied.** Application moves
the closure certificate and needs the owner's explicit approval after the proof passes.

## The defect

`src/app/(app)/fotografije-zadatka.tsx:125` ("Odustani od nepotvrđenog slanja") calls
`mediaClientService.cancelUploadCommand`, which calls `rpc_cancel_media_upload(p_conversation_id, p_client_request_id)`
(`src/data/mediaClientService.ts:115-118`). On canonical DEV `leqcwgzvjsxugfgzdmth` that function does not exist:
read-only `pg_proc` count 0 at 2026-09-22 20:56 UTC, ledger 197. The person taps the button, PostgREST answers
that the function is unknown, the client maps that to `MEDIA_UNCONFIRMED` and shows "Otkazivanje nije potvrđeno";
the unconfirmed command identity stays in the journal and the picker stays disabled until "Osveži" finds a state.

## Why the 2026-09-16 candidate cannot be applied

`supabase/candidates/pkg008_media_upload_cancellation.sql` (proven then on run 35045306378, never applied) creates a
new table `private.owned_media_cancellations`. Since PKG-023f (2026-09-19) the certified closure source digest is
`private.closure_source_digest_v5()` = hash of `private.closure_schema_digest_v5_139()` (every public/private table's
columns, constraints and triggers) + `private.closure_erasure_program_digest_v5()` (every table's owner/ACL/RLS flags
and the reviewed function set) + 72 pinned function bodies. Live values read on 2026-09-22:

| digest | value |
| --- | --- |
| `closure_source_digest_v5()` = certified in `closure_source_v5`, `closure_erasure_source_v5`, `retention_ai_source_ready()` | `65980fce…b137a591` |
| `closure_erasure_program_digest_v5()` | `31e77c9d…3cf8bbe4f3` |

A new table changes both. A new account-keyed table would also sit outside the 73 redaction relations, so closing
an account would leave its tombstones behind. The candidate's preflight would additionally pass while its
`rpc_cancel_media_upload` body assumes a one-argument `closure_assert_open`; live has `(a uuid, b uuid default null)`,
so that part works, but the certificate does not.

## The design here

Model cancellation the way `private.agreement_photo_uploads_v5` already does (`state='CANCELLED'`, `cancelled_at`,
null input columns, `CANCEL` operation of `rpc_agreement_photo_upload_service_v5`):

1. `private.owned_media_assets`: `input_sha256`, `input_bytes`, `input_type` become nullable; `state` admits
   `CANCELLED`; a new check ties `CANCELLED` to null inputs, `scope='TASK'`, `selected=false`,
   `dispatch_state='NOT_DISPATCHED'`, `storage_path is null`. Existing rows (4, all READY) satisfy it.
2. `rpc_claim_media_upload_service`: one fence after its per-command advisory lock — a `CANCELLED` row for
   `(account, key)` raises `MEDIA_COMMAND_CANCELLED` (55000). Body otherwise verbatim; ACL unchanged.
3. `rpc_read_media_upload`: skips `CANCELLED` rows (`MEDIA_NOT_FOUND`) — a tombstone never reads as an asset.
4. New `rpc_cancel_media_upload(uuid,uuid)`, authenticated only, security definer:
   - owner's own `NEED_INTAKE` / `NEED_FACT_V2` conversation, else `MEDIA_NOT_FOUND` (not an editability check);
   - same advisory lock as the claim, so a delayed first send waits and then meets the tombstone;
   - absent key → insert the `CANCELLED` row, receipt with `previousState:null, assetId:null`;
   - existing `CANCELLED` row → same receipt (idempotent); another conversation → `MEDIA_COMMAND_CONFLICT`;
   - `READY` → `rpc_remove_task_photo` (refs and `selected=false`, no Storage delete); `PROCESSING`/`STAGED`
     selected → `selected=false`; `FAILED` → already retired;
   - receipt shape is exactly the one the shipped client already decodes (`decodeMediaUploadCancelled`, 8 keys).
5. Certificate re-bind in three places, the PKG-032b pattern, with an isolation probe: undoing only the schema
   change inside a rolled-back sub-transaction must give the certified value back.

The tombstone sits in a redaction relation (`t.account_id=$1`, operation DELETE unless protected), has no Storage
object, is never `DISPATCHING`, so the closure preparation, the blockers, the storage step and the redaction step
treat it like any settled asset. Triggers `media_new_asset_hold_v5` (INSERT) and `media_evidence_asset_v5`
(UPDATE/DELETE) are untouched; under an active retention hold a tombstone gets the same evidence reference every
asset gets.

## Files

| file | role |
| --- | --- |
| `supabase/candidates/pkg046a_media_upload_cancellation.sql` | the candidate: preflight pins (claim `81962817…`, read `63ed40f2…`, state check text, input NOT NULLs), schema, isolation probe, claim fence, read predicate, cancel writer, re-bind, postconditions (claim after `4f522b3d…`, read after `36d5647d…`) |
| `supabase/proofs/pkg046/pkg046_proof.mjs` | disposable proof: exact chain to live certificate `65980fce…`, the app's broken call before, three tampers roll back, apply once, surface diff limited to the reviewed objects (7 removed / 9 added), tombstone/idempotency/hidden reads, late claim refused, fresh claim admitted, PROCESSING deselected then settled READY unselected, READY leaves the draft, owner-only ACL, zero residue, real closure worker erases an account with a tombstone on the new certificate |
| `.github/workflows/pkg046-media-cancel-proof.yml` | the harness (source147 + dev_alpha replay chain as PKG-045), focused Jest and types |
| `src/data/mediaClientService.ts` | copy for `MEDIA_COMMAND_CANCELLED` on the upload path |
| `supabase/functions/uskoci-media/index.ts` | `MEDIA_COMMAND_CANCELLED` is a safe code (409) instead of a generic 503; deploy is the owner's byte-exact CLI route, separate from the SQL |
| `docs/implementation/v5-ai-first/pkg046/FUNCTION_PINS_20260922.json` | live pins read before writing |

## What the proof does not show

No Storage object is written (synthetic digests drive the service chain, as in PKG-008). No phone. The Edge
change is exercised only through the SQL fence; the Edge unit surface for this function does not exist. The
existing PKG-008 client tests (`media-client`, `v5-task-photos-screen`) already cover the receipt decoder and the
screen; they run in the workflow unchanged.

## Application

Only after the proof passes and the owner answers "primeni pkg046a": apply the exact file bytes as
`dev_alpha_pkg046a_media_upload_cancellation`, read back the two body md5s, the cancel ACL, the three certificate
places (all equal to the new live digest), `retention_ai_source_ready()` true, and record the receipt with the
new certificate value in `supabase/operations/dev-alpha/ledger/`. Then the Edge deploy, then a new APK is not
required: the shipped client already makes the exact call.

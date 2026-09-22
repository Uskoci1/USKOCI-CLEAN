# PKG-046 — task-photo upload cancellation (F16 / A05 / GAP-0036)

Status 2026-09-22: **proven and APPLIED to canonical DEV** after the owner's explicit "primeni pkg046a".
Ledger **198 = 147 source + 51 dev_alpha**, `dev_alpha_pkg046a_media_upload_cancellation`, version `20260922220350`.
The certificate moved, by approval, from `65980fce…b137a591` to **`cc248ff125c67146bb343db7d222230cb291be99048125d55f6b547ce49e36f7`**,
re-bound in all three places, `retention_ai_source_ready()` true. Receipt:
`supabase/operations/dev-alpha/ledger/20260922_pkg046a_application.receipt.json`.

## Proof

Run `35787119578`, source `a0c12868`, all **10 checks PASS**, receipt `PROOF_35787119578.json`:

| check | what it establishes |
| --- | --- |
| `EXACT_PREDECESSOR_REPLAY_REPRODUCES_LIVE_CERTIFICATE` | the replayed stack is self-consistent and ready before anything is applied |
| `BEFORE_APP_CANCEL_CALL_HAS_NO_SERVER_FUNCTION` | the shipped client's exact call answers PGRST202 first — the defect, reproduced |
| `PREDECESSOR_DRIFT_BODY_MISMATCH_AND_INCOMPLETE_REBIND_ROLL_BACK_ATOMICALLY` | three tampered variants each abort and leave nothing behind |
| `ONLY_REVIEWED_MEDIA_OBJECTS_CHANGED_CERTIFICATE_MOVED_AND_REBOUND_IN_THREE_PLACES` | surface diff limited to 7 removed / 9 added; the new digest is certified in all three places |
| `ABSENT_COMMAND_TOMBSTONE_IDEMPOTENT_HIDDEN_FROM_EVERY_READ` | cancelling an unknown key is idempotent and never reads back as an asset |
| `LATE_CLAIM_OF_CANCELLED_KEY_REFUSED_FRESH_KEY_ADMITTED` | a delayed first send meets `MEDIA_COMMAND_CANCELLED`; a new key still works |
| `ADMITTED_PROCESSING_COMMAND_DESELECTED_SETTLES_UNSELECTED` | an in-flight upload finishes its own chain and lands unselected |
| `READY_PHOTO_LEAVES_DRAFT_THROUGH_EXISTING_REMOVAL_WRITER` | a finished photo is removed by the existing writer, not by a second path |
| `OWNER_ONLY_ACL_AND_ZERO_UNEXPECTED_RESIDUE` | attacker, anonymous and service are refused; no evidence rows for a tombstone |
| `REAL_CLOSURE_WORKER_ERASES_TOMBSTONE_ACCOUNT_ON_NEW_CERTIFICATE` | a real account holding a tombstone closes and erases on the moved certificate |

Two earlier runs failed and are part of the record: `35785488747` asserted the disposable certificate equals the
DEV value (it cannot — the disposable stack carries extension tables), and `35786515616` raised
`PKG046_PREDECESSOR_DRIFT` on a second apply because the md5 pins were checked before the already-applied test.
Both are fixed in the candidate that this run proved.

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

## Application (done 2026-09-22 22:03:50 UTC)

The owner approved the certificate movement in writing ("primeni pkg046a"). Applied through the Supabase
connector as one transaction; the ledger text is `d49bf0c8…`, byte-identical to the text the proof applied
(`candidateSha256` in `PROOF_35787119578.json`); the candidate file itself hashes `abaf253a…` and differs only
by its trailing newline.

Read back on DEV immediately afterwards:

| what | value |
| --- | --- |
| ledger | 198, latest `dev_alpha_pkg046a_media_upload_cancellation` (`20260922220350`) |
| `rpc_cancel_media_upload(uuid,uuid)` | md5 `f293793039bd012ba5cba20a7dba3fb2`, security definer, `search_path=pg_catalog`, ACL `{postgres,authenticated}` — no anon, no service_role |
| `rpc_claim_media_upload_service` | md5 `4f522b3df65e00f6985e50e66d388bbc` (from `81962817…`), ACL unchanged `{postgres,service_role}` |
| `rpc_read_media_upload` | md5 `36d5647d8e4423c3f75bd13459ff524c` (from `63ed40f2…`), ACL unchanged `{postgres,authenticated}` |
| state check | now admits `CANCELLED`; the tombstone check is present as written |
| input columns | `input_sha256`, `input_bytes`, `input_type` nullable (0 of 3 NOT NULL) |
| certificate | `cc248ff1…` live = `closure_source_v5` = `closure_erasure_source_v5` = the constant in `retention_ai_source_ready()` = `closure_erasure_binding_v5()->>'sourceSha256'`; the old `65980fce…` appears nowhere |
| readiness | `retention_ai_source_ready()` true |
| data | the 4 existing media rows are untouched and all READY; 0 CANCELLED rows; no Storage object touched |
| catalog | public RPCs 227 → 228, authenticated-executable 157 → 158; no Edge function changed |

**Any package written against `65980fce…` is now stale** and must pin `cc248ff1…` instead.

Still open after this application:

- **The button has not been pressed on a phone.** The installed APK already makes the exact call, so no new
  build is needed; the acceptance is a real cancellation from the app.
- **The Edge change is not deployed.** `supabase/functions/uskoci-media/index.ts` adds `MEDIA_COMMAND_CANCELLED`
  to its safe codes (409 instead of a generic 503). It only affects how a *delayed* send's refusal is reported;
  cancellation itself does not pass through it. Deployment is the owner's byte-exact CLI route.

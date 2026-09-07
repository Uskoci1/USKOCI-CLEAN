# N08 — validated, account-bound notification preferences

An authenticated recipient could store an invalid quiet-hours timezone, causing a counterpart's message RPC to fail with PostgreSQL22023. The failed transaction retained no message, event or delivery. N08 rejects invalid preferences at their write boundary and makes owner settings read/write safe under retries, concurrent edits and an in-flight account change.

Status: **CANONICAL / AUTHENTICATED DISPOSABLE PROVEN / LIVE STRUCTURAL PROVEN**. PR53 merged as `06d8ce1a14c87ca2237d94aa5a60cd7230899ff6`; reviewed exact promotion is live at85 / `20260907102458_clean_n08_notification_preferences`. Inventory is85 source / live85 / pending0. Read the [promotion record](N08_LIVE85_PROMOTION_20260907.md). No provider call or physical push proof is claimed. Do not reapply N08 or N07.

## Original source admission and proof

- Baseline canonical: `f4a687fbb1049ae118030e859da97a68c92e327f` (includes dependency fixes through PR52).
- Complete source plus inert client proof: `6c4ac2387a9ce017bcc27c27f477d2f08f4821ce`.
- [Run34109276473](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/34109276473): all12 N08 authenticated checks and all6 preceding N07 checks PASS; actual full regression log37 suites/232 tests plus TypeScript PASS.
- Original artifact10013759621 ZIP SHA-256: `bd098db108be14865f6f96612b2912cda929e89020f43a5f4c3b6c19ab3bf822`, matched to GitHub's digest before inspecting the original report/log.
- Exact forward file: `supabase/migrations/20260907100000_clean_n08_notification_preferences.sql`; byte-identical candidate retained under `supabase/proofs/notifications/n08_preferences_candidate.sql`.
- Both SQL files:13177 UTF-8 bytes, MD5 `349e81a12760af65dc4d5d98a7677333`, SHA-256 `f1829f054b79e5c2f8cba529711185a530949d371b9de552af6997ebabe0ec16`.
- Frozen source inventory: `supabase/proofs/notifications/n08_preferences_files.json`; applied-source MD5 manifest and pending provenance register the same bytes. The proof applies the actual forward file in disposable DB, admits its history row as85, and verifies the original84 full history entries unchanged.

The report and log are [saved with hashes](evidence/n08-preferences-20260907/SHA256_MANIFEST.json). `projection_examples` contains actual server responses for synthetic disposable identities, including an absent default read, a retained legacy revision0 read and the first save acknowledgment. It contains no credentials, production account data or private message contents. The historical discarded first sentinel `N08/Invalid_Zone` did not reproduce the failure; corrected nonnumeric sentinels reproduced it with both pushfalse and pushtrue. The final proof repeats the valid reproduction before applying the fix.

## Owner and command contract

The existing `public.notification_preferences` table remains the only owner. No event engine, message writer, Inbox ledger, device registry, provider adapter or duplicate preference store is introduced.

```text
rpc_get_notification_preferences(p_expected_user_id uuid, p_role text) → jsonb
rpc_set_notification_preferences(p_expected_user_id uuid, p_role text,
                                p_settings jsonb, p_expected_revision bigint) → jsonb

{ userId, roleContext, exists, revision, updatedAt, settings }
```

`auth.uid()` remains authority. Both commands require the initiating account ID to equal that authority before reading, locking or writing. This closes the case where an old account-A request reaches Supabase after its shared client has switched to account-B's token. The client also checks the returned user/role.

`p_role` is REQUESTER or WORKER. Settings are the complete13-key projection: ten booleans (`in_app_enabled`, `push_enabled`, `opportunities_enabled`, `responses_enabled`, `dogovor_enabled`, `execution_enabled`, `recovery_enabled`, `account_enabled`, `quiet_hours_enabled`, `urgent_overrides_quiet_hours`), nullable `quiet_start`/`quiet_end`, and `quiet_timezone`. Unknown/missing keys, coerced booleans, malformed/out-of-range times, incomplete enabled quiet hours and timezones outside `pg_timezone_names` are rejected. Times accept HH:MM or HH:MM:SS with up to six fractional digits and return canonical database text. Existing overnight and equal-time/all-day quiet semantics are preserved.

An absent read returns `exists:false`, revision0, `updatedAt:null`, existing in-app/category defaults true, push/quiet/urgent defaults false, null times and Europe/Belgrade. It creates no row. Existing valid rows retain their settings/timestamp and start at revision0; their first write advances to1. An absent first write also requires expected0 and returns1.

An exact immediate retry at current revision `expected+1` returns the same acknowledgment only when the complete canonical payload matches. A different payload or stale revision conflicts; it cannot silently overwrite a newer opt-out. Concurrent identical requests converge on one revision; distinct requests with the same predecessor have one winner. The client snapshots the payload before dispatch, validates the entire acknowledgment and never retries with an invented new revision.

| Server condition | Code / stable message | Client outcome |
|---|---|---|
| Missing authenticated actor |28000 / AUTH_REQUIRED|AUTH_CONTEXT_CHANGED|
| Missing or different initiating actor |28000 / AUTH_CONTEXT_CHANGED|AUTH_CONTEXT_CHANGED|
| Invalid role |22023 / INVALID_NOTIFICATION_ROLE|INVALID_SETTINGS|
| Invalid payload, time, timezone or expected revision |22023 / INVALID_NOTIFICATION_PREFERENCES|INVALID_SETTINGS|
| Stale/different command |40001 / NOTIFICATION_PREFERENCES_REVISION_CONFLICT|CONFLICT|
| Missing privileges |42501|AUTH_CONTEXT_CHANGED|
| Network/unknown backend outcome |No fabricated acknowledgment|UNAVAILABLE; caller may retry the same command|

The server trigger independently validates all table writes and forces revision+1/timestamp even for service writers attempting to reset metadata. Owner/role keys cannot move. Authenticated clients retain owner SELECT only; direct preference DML is revoked. Service retains SELECT/INSERT/UPDATE, with DELETE revoked so ordinary opt-out cannot reset CAS history. The two public RPCs are authenticated-only; helper execution is closed. All four new functions use `search_path=pg_catalog`; only the public owner RPCs are security definers.

## Apply discipline and proof boundary

The forward SQL has one transaction, a5-second lock timeout and30-second statement timeout. It locks preference writes, checks exact quiet/emitter/message predecessors and schema shape, and aborts on any invalid legacy row without repairing data or leaving partial DDL. It has no default opt-in, backfill, provider request or gate activation.

The12 final checks establish: authenticated predecessor failure and recovery; invalid-legacy preflight rollback; exact forward bytes and preserved valid legacy row/history; no-write defaults; auth/role/payload/time invariants; JWT-B/expected-A denial; complete-payload retry/revoke boundaries; competing and identical concurrent writes; direct DML/other-account/service revision boundaries; real message channel suppression and durable Inbox truth; final grants/fingerprints/gates. Old events and delivery metadata are unchanged by preference edits. New domain events remain in Inbox even with all transports off; an eligible PUSH delivery is only CREATED, never reported SENT. No push attempts or active devices are created.

The unchanged engine body hashes are quiet `386e00eb4a7645addffac95fde09bea7`, emitter `8da91a4736e09b10872bd1240d6e0c8c`, message `d9a3733814e3101a3941284c07dc2bed`. New body hashes are recorded in the original proof for immediate postflight comparison: settings helper `8448ca42aebbc17047aea6e303717194`; trigger `9e1b24219feb130e210f69757cde8d7e`; get `29d586ea368744089afeefe62d568863`; set `34a307e2c38ff341581229f3726af680`.

`notificationPreferencesClientService` is an inert typed transport with21 focused tests. It performs no RPC on import and is not connected to visible settings controls. Active settings UX, native permission/token lifecycle, dispatcher, provider tickets/receipts and physical delivery remain separate work. In particular, the current Inbox reads durable events regardless of IN_APP suppression; this unit does not silently change that ledger semantics.

The source admission and live promotion are complete. Continue the next real product gap; visible settings and native provider delivery retain their separate proof requirements. The frozen candidate manifest preserves its original pre-promotion status and84 predecessor; current live provenance is authoritative for admission.

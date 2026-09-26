# Notification A1 runtime evidence — 26.09.2026

Status: **DISPOSABLE PROVEN / DEV APPLIED / EDGE SOURCE VERIFIED**.

## Exact source and proof

- Source commit: `0ffb5281f46cd39d5ef488fa39f810b092fda97f`
- A1 SQL source (current inventory location): `supabase/candidates/20260926175504_clean_notification_push_event_type.sql`
- Original proof path at the source commit above: `supabase/migrations/20260926175504_clean_notification_push_event_type.sql`
- Migration source blob: `330178b34000c4da5bdaa23578dae38c7e7f0c7d`
- Shared formatter blob: `062ba7b284a273950d25a5e749726f67a4d6868c`
- Edge entrypoint blob: `d27b8af89cf06f9bd20c01827a1026bfdfa0e6e4`
- Disposable Auth/Postgres + exact Edge/synthetic Expo proof: GitHub Actions `36260836635` — **SUCCESS**
- Earlier formatter matrix proof: `36258688611` — 28/28 matrix tests and 44/44 N09 transport regressions PASS.

The disposable package uses real Supabase Auth/PostgREST/Postgres. Expo is synthetic; no live account/device/provider send is part of that proof.

## Source inventory reclassification — 26.09.2026

The A1 SQL was outside `MD5_MANIFEST.txt` and `MIGRATION_PROVENANCE.json`. Its placement under `supabase/migrations/` added a 148th file to the frozen source-147 inventory and caused the migration-integrity failure in PKG-051 run `36260836646`. The file now lives under `supabase/candidates/`; its filename and bytes are unchanged. SHA-256 before and after the move is `09b5d0c2ecf57879bda75e9e33c616d4f6a5b0d5a11c69383fc6df435def08da`.

The A1 workflow and N09 proof load the candidate path. The P11 helper maps only this exact A1 filename to candidates, preserving its Git source-byte assertion, historical predecessor count 123 and resulting disposable count 124. Every other historical proof file still resolves under migrations. The frozen 147 SQL files, manifest, provenance and PKG-051 workflow are unchanged.

Local validation: `python supabase/migrations/check_migration_integrity.py` now passes with `files=147 live_snapshot=87 pending=60 participant_contract=PASS`. The 87/60 values describe the frozen historical replay; they are not the current DEV ledger. This source-location repair does not rerun the disposable proof or change its earlier exact-source evidence.

Candidate-directory placement is source classification, not a claim that A1 is unapplied. The recorded DEV ledger remains **203**, with version `20260926180141` and name `clean_notification_push_event_type`; its applied SQL and ledger entry are immutable. This repair performs no database, Edge, provider or device operation.

## Applied DEV state

The exact forward migration was applied after the green proof.

Fresh postflight:

- migration count: **203** (was 202)
- latest migration version: `20260926180141`
- latest migration name: `clean_notification_push_event_type`
- `rpc_begin_push_send(uuid,uuid)`: anon **NO EXECUTE**, authenticated **NO EXECUTE**, service_role **EXECUTE**
- active push devices: **1** (the already proven owner Android registration)
- new CREATED/unstarted push backlog: **0**
- total push attempts: **1**, still the earlier owner proof attempt only
- no new push send was created by this A1 apply.

Live Edge:

- `uskoci-push-transport`: **v20 ACTIVE**, verify_jwt=false
- live entrypoint is byte-for-byte equal to GitHub source
- live `_shared/pushNotificationCopy.mjs` is byte-for-byte equal to GitHub source
- deployment SHA-256: `568de7c82a8c35a100f835ef9a44c3b347fc9ee154020d24489e94c6a3c0e88a`

## Privacy boundary

After all existing lease, preference, block, session, device and revision checks, the begin RPC resolves the durable event and returns **eventType only** as semantic notification input. It does not return delivery title/body, message text, entity id, account id, address or arbitrary event payload.

The Edge worker rejects unexpected receipt keys. Known event types are formatted with the fixed A1 allowlist. Future well-formed event types fall back to the generic USKOČI notification. Provider data remains only `{ kind: 'INBOX' }`.

## Advisors

Supabase security and performance advisors were run after the DDL. Existing project-wide informational/performance findings remain (including private RLS-without-policy informational notices, auth-function initplan warnings, unused indexes and multiple permissive policies). This package did not claim that the global advisor set is clean. No new observed finding identified this A1 function as a newly exposed authenticated/anon API.

## Device scope

The differentiated A1 copy was **not** re-sent to the physical phone during this apply. The earlier Android delivery/tap proof remains in `PUSH_REAL_DEVICE_EVIDENCE.md`. A future real event can confirm the new per-event copy without repeating registration/backlog work.

## Private certificate snapshot

The current connector was denied `private.closure_source_digest_v5`. The control snapshot therefore treats the 24.09 certificate/retention values as historical, not as a fresh 26.09 private re-check.

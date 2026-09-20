# Emergency checkpoint: export and account closure connectivity

Date: 2026-09-13. Read-only source audit for the owner-requested emergency
checkpoint. No scheduler, backend configuration, credentials or product source
were changed by this audit. The current instruction stops new scheduler
implementation; the steps below belong to the next authorized development cycle.

## Confirmed source paths

**Account closure has no automatic worker caller.**

- `src/ui/closure/ClosureDialog.tsx:54` submits the owned preparation/start
  command, then reads its receipt. `src/data/closureExecutionClientService.ts:57`
  calls `rpc_start_account_closure_execution`; line61 reads
  `rpc_read_account_closure_execution`. Neither invokes an Edge worker.
- `supabase/functions/uskoci-account-closure-worker/index.ts:8` accepts only the
  exact internal service bearer. Line9 additionally requires
  `USKOCI_ACCOUNT_CLOSURE_WORKER_ENABLED=true`. The endpoint supports one exact
  account/generation or bounded maintenance of at most8 listed accounts.
- Its maintenance branch calls `rpc_list_account_closure_work_service`, then
  `executeClosureStep`. Source searches found no application, server scheduler
  or deployed-in-source HTTP dispatcher invoking this branch.
- The existing `private.marketplace_tick` in
  `supabase/migrations/20260910162955_clean_p3_retention_execution_authority.sql:356`
  calls lifecycle expiry, matching dispatch, completion, SQL export maintenance
  and retention maintenance. It does not invoke either Edge worker.

Consequently, even when the required source/configuration guards admit a native
closure start, the resulting `EXECUTING` generation cannot progress by itself
through Storage, relational erasure and Auth. An independently authorized
internal worker invocation could progress it; an enabled flag alone cannot.
This is a confirmed connectivity blocker, not evidence that a particular real
account has already become stuck or that its data has been erased.

**Export preparation is connected through an explicit second action; automatic
fulfillment and Storage cleanup are not.**

- `src/app/(app)/profil/izvoz.tsx:84` records the export request. The separate
  `Pripremite kopiju` action at line93 calls `prepareExport` for the exact receipt.
- `src/data/dataExportDeliveryService.ts:29` invokes
  `uskoci-data-export-worker` with the current user's bearer and receipt. The
  worker's lines77–91 authenticate the user and check the owned receipt before
  its internal claim, Storage upload/readback and canonical completion.
  Therefore this worker is not exclusively service-only, and export is not
  necessarily stuck when the user explicitly prepares the copy and the export
  binding is ready.
- The worker's global `{action:"tick"}` branch is service-only. It prepares one
  eligible request and performs one cleanup. No scheduled caller was found.
- `private.data_export_maintenance` in
  `supabase/migrations/20260910153005_clean_p2_export_delivery_authority.sql:436`
  expires SQL availability and clears eligible temporary SQL snapshots. Its
  explicit result says `storageWorkerRequired=true` and
  `storageDeletionPerformed=false`.
- Native cancel/revoke uses the existing SQL RPCs. It does not call the worker's
  Storage cleanup action. An expired or revoked download is not proof that the
  underlying private Storage object has been deleted.

The initial request can therefore remain `REQUESTED` after leaving the screen;
there is no automatic fulfillment guarantee. Eligible Storage copies also lack
automatic cleanup without an internal tick. Export policy/source readiness is
a separate prerequisite and is not supplied by scheduling.

## Hosted evidence boundary

The root integrator reported a fresh canonical DEV cron inventory containing
only `select private.marketplace_tick(25);` every minute, with no new scheduled
HTTP jobs. The historical saved
`DEV_ALPHA_PREFLIGHT_20260913.json` independently records the same single cron
at07:14UTC, while still at history108; its old migration count must not be
presented as current. Root subsequently promoted verified history109–144 and
current Edge payloads. This audit did not issue an additional backend query,
read secrets, invoke workers or verify a hosted completion.

## Minimum next-cycle work

1. Read metadata for actual `pg_net`/Vault availability and the current cron
   definition. The repository does not establish that these extensions are
   already configured. Supabase documents the existing-platform
   [pg_cron + pg_net + Vault scheduling pattern](https://supabase.com/docs/guides/functions/schedule-functions).
2. Implement a narrowly scoped private dispatcher, composed with the existing
   engine tick, for only two fixed same-project destinations: export
   `{action:"tick"}` and closure `{action:"maintenance",maxSteps:8}`. Reuse the
   existing SQL request/generation queues and their authoritative claim,
   dispatch, reconciliation and completion rules. Add bounded scheduling and
   in-flight handling; a dispatcher failure must not stop original marketplace
   lifecycle maintenance.
3. Keep authentication server-only. `Transport.isInternal()` in
   `supabase/functions/_shared/data-export.ts:106` compares the full configured
   service credential. A publishable/anon key cannot authorize these global
   worker operations. Never place a service credential in the client, migration
   text, cron command text, logs or report. Use a private server credential
   configuration with explicit access controls; no anonymous or public admin
   RPC and no arbitrary destination/body forwarding.
4. Prove request → scheduled worker → real Storage/Auth result on disposable
   accounts, including app departure, duplicate scheduler delivery, unknown
   transport result, holds and cleanup. HTTP200 or a scheduled request ID alone
   is not a completion receipt. Preserve exact generation/attempt evidence and
   all existing policy/ownership guards.
5. Account for throughput: the current closure maintenance handler runs one
   bounded step per listed account. A once-per-minute invocation can take many
   ticks for the relational inventory. Any bounded loop improvement must stay
   within the existing execution deadline and preserve fairness and fencing;
   it is not implemented by this checkpoint.

This uses the existing Supabase backend and workers, with no AI inference or
new provider. Platform capacity/configuration remains an implementation check,
not a claim of zero metered infrastructure usage. No new schedule or activation
was performed.

## One-shot QA signup review

`scripts/dev-alpha-qa-signup.ps1` was reviewed without execution. SHA256:
`0da47c443875f56755e75b289c6ad968e17d4bd8442e14a45f0b19651de81bf1`.
PowerShell parsing reported zero syntax errors. The prepared configuration
filename is `artifacts/dev-alpha-qa/public-auth-config.json`; its canonical
project/URL and publishable-key/QA-alias formats were verified without printing
their values. No credential/attempt file existed at this read.

The script requires an explicit switch, generates a random password, saves a
Windows DPAPI credential with owner-only ACL, writes an attempt marker before
the single ordinary Auth signup POST, disallows redirects and automatic retries,
and preserves an unknown result for readback. It does not use Auth admin/service
credentials or activate a profile. The email-format check does not independently
prove mailbox ownership; the exact prepared alias relies on the owner's prior
authorization. An ordinary Auth response and independent canonical readback are
still required before claiming account creation or email confirmation.

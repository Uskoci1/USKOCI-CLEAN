# Private photo membership — bounded source finding

Date: 2026-09-27. Status: SOURCE FINDING / EXECUTION WITHHELD.
This review read repository source only. It did not query accounts, Agreements,
messages, photos or live function definitions; execute an exploit or proof; or
change SQL, DEV, Edge, stored data or any certificate. The existing applied
helper and frozen migrations remain untouched. No live severity, affected-row
count or observed disclosure is claimed.

## Confirmed source condition

`supabase/migrations/20260913065130_clean_v5_agreement_private_photos.sql:49–63`
defines the SECURITY DEFINER helper `private.agreement_photo_context_v5`.
Its admission at line 53 is:

```sql
if not found or a not in(ag.requester_account_id,ag.worker_account_id) then
  raise exception 'MEDIA_NOT_FOUND' using errcode='42501';
end if;
```

For an existing Agreement, a non-member caller and one NULL participant,
`NOT IN` evaluates to NULL, so PL/pgSQL does not enter the refusal branch.
Both participants NULL has the same problem. These states are permitted by the
source schema: `20260830173000_clean_authoritative_mutation_boundary.sql:90–105`
drops both account columns' NOT NULL constraints and adds Auth foreign keys
with `ON DELETE SET NULL`.

This is not an anonymous/null-session bypass. `private.support_auth_v5` requires
the authenticated role, a non-null caller equal to the expected user, and a
valid session (`20260913045824_clean_v5_support_case_authority.sql:88–92`).
`private.push_session_valid` also excludes erased/banned Auth users and invalid
sessions (`20260910193029_clean_n09_expo_push_transport.sql:42–46`). A valid,
unrelated caller is the relevant case.

## Existing read paths and compensating checks

References below to the photo migration mean
`supabase/migrations/20260913065130_clean_v5_agreement_private_photos.sql`.

- `rpc_read_agreement_photo_messages_v5` is an authenticated SECURITY DEFINER
  RPC (photo migration, lines 121–137 and 354–360). After the helper it checks
  bounded message IDs, Agreement ownership of those IDs and attachment links.
  It does not independently require a positive participant match. In the NULL
  state, a valid outsider with an Agreement ID and existing message ID can
  satisfy the remaining source checks and receive message body/attachment
  metadata. The function also accepts text-only message rows.
- `rpc_agreement_photo_read_service_v5` requires the service role, a valid user
  session, and the same helper (lines 139–149). For an attached photo, it then
  verifies the exact Agreement/message/version/asset link, but does not repeat
  participant admission. The Edge `agreement-read` path authenticates the user,
  takes those IDs, calls that service and checks it again before returning
  bytes (`supabase/functions/uskoci-media/index.ts:96–111`). Both authorizations
  inherit the same membership condition. An attached-photo disclosure would
  additionally require existing linked asset/message IDs and retained bytes.
- The unattached-photo branch retains its separate asset-account check (photo
  migration, lines 145–148). Upload-list metadata is filtered to the caller's
  own account (lines 167–172). This finding does not establish access to another
  person's unattached upload or prove a write bypass.
- Direct table SELECT policies use positive membership and do not admit an
  unrelated caller merely because a participant is NULL
  (`20260829183740_clean_rls_policies.sql:65–85`). The affected SECURITY DEFINER
  readers directly read the tables without another caller-membership predicate;
  those ordinary caller RLS policies are not an independent compensating gate
  in this path. The closure pre-request hook checks the caller's own restriction,
  not membership of the supplied Agreement
  (`20260912230039_clean_v5_policy_bound_closure.sql:269–271`).

No Agreement/message/asset ID enumeration path was demonstrated. No existing
live NULL participant or live callable-body parity was inspected. Reachability
therefore remains conditional on the schema-permitted NULL state and known
identifiers, rather than a demonstrated live disclosure.

## Current normal closure does not create the NULL state

The current account-closure worker sends `should_soft_delete: true`
(`supabase/functions/uskoci-account-closure-worker/closure.ts:83–87`). Finalization
explicitly requires the Auth row to remain with `deleted_at` set and its sessions
removed (`20260913081147_clean_v5_event_bound_account_erasure.sql:659–664`). A
retained Auth row does not trigger the participant FK's `ON DELETE SET NULL`.

The event-bound erasure's admitted relational catalog excludes
`public.agreements` (same migration, lines 86–113). It redacts the closing
account's message bodies and photo links, rather than nulling Agreement
participants (lines 227 and 314–317). Consequently normal current closure is
not source evidence for producing the vulnerable state. A physical Auth-row
deletion, legacy/imported state or administrative mutation is a possible source
of the permitted state; none was observed here.

## New chat candidates

The NEW, NOT APPLIED B3a candidate now independently requires positive membership
after obtaining the Agreement context. Both the page reader and exact-ID receipt
use `u IS DISTINCT FROM requester AND u IS DISTINCT FROM worker` to refuse an
outsider (`supabase/candidates/chat_b3a_private_history_read.sql:48–53`,
`:103–106`). Since `support_auth_v5` guarantees a non-null `u`, the check also
refuses one or both NULL participants while admitting the remaining actual
participant. This correction was independently source-reviewed.

The unexecuted B3a proof contains disposable fixtures for each NULL side,
outsider refusal with unchanged event receipts, and remaining-participant
success (`supabase/proofs/chat/private_history_read_proof.mjs:163–185`). It does
not claim to reproduce normal closure or live data. The source-only B3b window
must use the same explicit positive admission. Its separate review is not
claimed by this document.

These guards protect only the new candidate RPCs. They do not repair the
existing helper or its existing photo readers.

## Smallest separate correction and required evidence

A future NEW source candidate can preserve the helper's result and writing
branch while changing only the admission condition to:

```sql
if not found or a is null
  or (a is distinct from ag.requester_account_id
      and a is distinct from ag.worker_account_id) then
  raise exception 'MEDIA_NOT_FOUND' using errcode='42501';
end if;
```

Do not rewrite an applied migration or apply an isolated helper replacement.
The helper is included in the sealed closure source digest (photo migration,
lines 363–378). A prepared candidate must pin the exact predecessor definition
and relevant existing bindings, provide its exact new definition/hash, and
explicitly account for the source digest, closure certificate, erasure source
and erasure binding. It must retain the strict readiness predicate rather than
weakening it to accept drift. Each certificate change and any DEV/Edge apply
requires the owner's explicit authorization; none is provided by this report.

When execution is separately authorized, a disposable proof should cover:

1. Both participants present: each member succeeds, unrelated caller refuses.
2. Each participant NULL and both NULL: outsiders refuse; the remaining actual
   participant retains intended terminal-history access.
3. Missing Agreement, null/mismatched expected account, revoked/erased session:
   existing refusal behavior remains.
4. Existing text/photo metadata and linked binary authorization: outsiders
   refuse despite valid known IDs; member metadata stays identical; unrelated
   Agreement/message/asset combinations refuse; own unattached uploads keep
   their existing ownership checks.
5. Refusal leaves messages, event `read_at`, deliveries and photo state unchanged.
6. Exact reviewed candidate/proof bytes are bound to the recorded source SHA.
   Record old/new helper hashes and all affected closure/erasure bindings,
   prove only the authorized binding transition, and re-establish strict
   readiness and the existing closure acceptance checks. Any disagreement
   aborts without an unapproved certificate repair.

These are required future cases, not executed results or deployment approval.

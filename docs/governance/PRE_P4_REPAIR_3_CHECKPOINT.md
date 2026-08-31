# PRE-P4 Repair 3 checkpoint

## Scope

Repair 3 closes AI confirmation provenance and direct legitimate-writer authority for
`public.ai_structured_facts` on clean Supabase `leqcwgzvjsxugfgzdmth`.

## Live migration

- version: `20260831120157`
- name: `clean_pre_p4_ai_confirmation_provenance`
- recorded statement count: `1`
- recorded statement MD5: `9f9bdc28adbd03fa14f8c2e247bf4a9f`
- canonical mirror contract: recorded UTF-8 statement + one terminal LF
- canonical raw MD5: `0739626857f34b31b4aef489def947f0`

The migration had already been applied live before its Git mirror existed. This
checkpoint records the forward reconciliation; the migration MUST NOT be executed a
second time merely because its source mirror is being restored.

## Resulting contract

- authenticated has SELECT only on `ai_structured_facts`; direct INSERT/UPDATE/DELETE
  are denied;
- `rpc_ai_confirm_fact(uuid)` is the owner-only confirmation path;
- confirmation changes status without rewriting `source`;
- `private.guard_ai_fact_write()` preserves immutable source/evidence/content fields;
- the guard server-derives `confirmed_by_user_id` and `confirmed_at` on the allowed
  transition to `CONFIRMED`;
- replay of an already confirmed fact is idempotent;
- wrong-owner confirmation is denied.

## Runtime proof carried by the applied migration

The migration executed a transactional `SET LOCAL ROLE authenticated` proof. Any
mismatch raised and rolled back the migration. The proof verified:

- `AI_INFERENCE` source remains `AI_INFERENCE` after human confirmation;
- evidence remains unchanged;
- confirmation metadata is server-derived;
- replay does not change the first confirmation timestamp;
- direct authenticated UPDATE is denied;
- direct authenticated DELETE is denied;
- wrong-owner confirmation is denied;
- temporary proof data is cleaned before commit.

Post-apply read-only verification found zero `__pre_p4_provenance_probe__` fact rows.

## Reconciliation rule

Canonical Git source is restored by mirroring the already-recorded live migration bytes,
updating `MD5_MANIFEST.txt`, and updating `MIGRATION_PROVENANCE.json`. No Supabase DDL
or re-application of migration `20260831120157` is part of this reconciliation.

## Runner proof

PRE-P4 integrity run `33402828213` completed successfully on the reconciliation PR head.
Its migration-bytes/provenance check, TypeScript contract check, and regression tests all
passed before the final governance-only status update.

## Gate classification

- `REPAIR_3_LIVE = PASS / AUTHENTICATED_DATABASE_RUNTIME_PROVEN`
- `REPAIR_3_SOURCE_MIRROR = PASS / RUNNER_PROVEN`
- `SOURCE_LIVE_ALIGNMENT = READY_TO_MERGE_CANONICAL`
- `PACKAGE_4 = NOT STARTED`

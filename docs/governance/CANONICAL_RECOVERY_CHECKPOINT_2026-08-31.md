# USKOČI canonical recovery checkpoint — 2026-08-31

This document records the recovery decision taken after concurrent commits landed on
`clean-alpha-backend`. It is evidence, not a claim that the PRE-P4 gate has passed.

## Frozen physical checkpoint

- Repository: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- Drift head inspected: `3a2ab40342d8efecbfe5a63635f6ef777a2b5ccd`
- Live Supabase project: `leqcwgzvjsxugfgzdmth`
- Live migration count: 44
- Latest live migration: `20260830202733_clean_pre_p4_provenance_reconciliation`
- Observed business rows: 6 Needs, 4 Responses, 2 Agreements, 4 Profiles
- AI publishing boundary: fail-closed with `PACKAGE_4_NOT_READY`

## Rejected migration proposal

The file named `20260831123000_clean_p5_authority_reconciliation.sql`, introduced by
commit `3a2ab40342d8efecbfe5a63635f6ef777a2b5ccd`, was never applied to the canonical
Supabase project and was never entered in `MD5_MANIFEST.txt` or
`MIGRATION_PROVENANCE.json`.

It is classified as **REJECTED_UNAPPLIED_PROPOSAL**, not as Migration 45, because:

- the SQL is syntactically incomplete and ends in the middle of a policy operation;
- quoted policy identifiers are malformed;
- it targets a policy name that is not the live `needs_participant_read` policy;
- it compares profile identifiers with `auth.uid()` account identifiers;
- it references columns that do not exist in the live profile, notification, and
  access-grant schemas;
- it would weaken or replace authoritative guards without reproducible proof.

The recovery commit removes only this never-applied file from the current tree. Git
history remains intact, no applied migration history is rewritten, and no live DDL or
business data is changed. Any intended behavior from that proposal must be implemented
later through separately reviewed, forward-only migrations.

## Concurrent UI/source changes

Commits `0aa18af` through `c71cc8f` added application, opportunity, candidate, and
worker-profile source. Those changes are preserved for forensic review. Their current
classification is **PARTIAL / NOT PROVEN**:

- existing TypeScript and Jest success does not prove authenticated live behavior;
- some routes have no proven production navigation entry;
- candidate status mapping and server contracts still require reconciliation;
- the worker-profile completion call referred to an RPC that is not live;
- production adapter fake-success and RPC-signature findings remain open.

The commit labels `Package 4` and `P5` do not change the locked product gate. Package 4
has not started canonically and AI publishing must remain fail-closed.

## Required continuation order

1. Restore the real PRE-P4 workflow and obtain a successful runner-backed result.
2. Keep concurrent UI work classified as partial until source, live RPC, navigation,
   authenticated runtime, and device proof agree.
3. Repair `needs_participant_read` only with a new forward migration after CONTROL 0
   passes.
4. Continue the approved PRE-P4 repair sequence; do not start Package 4 in the same
   gate-closing step.

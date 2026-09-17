# PKG-015 promotion to canonical DEV: plan, evidence and decisions

Owner approved the promotion on 2026-09-17 as a minimal, isolated PKG-015 batch, and required that
the exact SQL and diff be shown, that no existing verified engine change be confirmed, that no data
be deleted or overwritten, that a preflight and readback plan exist, that only accounts with real
provenance be classified, and that unclear accounts stay UNCLASSIFIED.

This document answers each of those before the write, and records the result after it.

## 1. Account provenance: what the evidence actually proves

The owner's bar was explicit: classify as a synthetic acceptance fixture **only** if existing
evidence confirms the accounts were really created as test or acceptance accounts, and do not guess.

### Evidence found

| Fact | Source |
| --- | --- |
| `adversarial_a@example.com` signs in to **this exact project ref** with the hardcoded password `password123` | `adversarial_read.js`, `adversarial_read2.js` and `rls_test.js`, committed in `0aa18af` (2026-08-31) and removed as scratch files in `4f17fd5` |
| those scripts drive adversarial RLS and authority probes against `needs`, `agreements` and `ai_structured_facts` | same files |
| an authenticated adversarial harness ran on 2026-08-30 with 11 of 11 passing | `HANDOFF.md` added by `df5b81f`, committed 2026-08-30 17:40:51, eight minutes after the accounts were created |
| both accounts were created **331 milliseconds apart**, at 17:32:43.838 and 17:32:44.169 | live `auth.users` read |
| both are on `example.com`, reserved by RFC 2606 and unable to receive mail, yet both carry `email_verified: true` | live `auth.users` read |
| both have machine-shaped profiles: `display_name` equal to the email local part, both roles auto-created | live `app_accounts` and `app_profiles` read |

### Determination

**Both accounts are classified `SYNTHETIC_ACCEPTANCE_FIXTURE`, and that is a confirmation rather
than a guess.** Two facts settle it independently of intent. They cannot belong to a real person,
because `example.com` is reserved and unrouteable, so `email_verified: true` was set programmatically
and never by a real confirmation. And they were created 331 milliseconds apart, which is a script,
not two people signing up. Those two facts alone establish machine-created, non-real accounts. The
committed scripts and the contemporaneous harness note then place that creation inside an adversarial
test run on this project.

### The one discrepancy, recorded rather than smoothed over

The committed scripts name `adversarial_a` and `adversarial_w`, not `adversarial_b`, and the harness
that the 2026-08-30 note credits, `adversarial_test.js`, was **never committed**; it was a local
scratch file. So the exact script that created `adversarial_b` is not in the repository. Direct,
by-name evidence exists for `adversarial_a`. For `adversarial_b` the evidence is structural: same
creation run, same unrouteable domain, and a data footprint that is precisely the worker counterpart
of the requester journey `adversarial_a` drives.

That is why the registry has revision control and an append-only history. If the owner disagrees
about `adversarial_b`, reclassifying it is one call that preserves the previous value.

### What would have made this stronger

Had `adversarial_test.js` been committed, or had either account carried metadata naming its creator,
the classification would rest on direct evidence for both. Neither exists. The census records this
so a later reader does not mistake a structural inference for a literal one.

## 2. A constraint discovered after approval, and the path it forces

Promotion by the normal forward-only route means a new migration in `supabase/migrations/`, which
would take the source from 147 files to 148. That is not a local change. The source count and the
frozen admission manifest are pinned across the harness:

| Measure | Count |
| --- | --- |
| files carrying a functional reference to 147 | 25 |
| functional lines, comments excluded | 65 |

They include `source147_admission.json` itself, whose `inventory_sha256` is the digest of
`MD5_MANIFEST.txt`, the source-boundary tests of four separate domains, both W02 calendar proofs, the
dispatch-lock manifest, the P1 successor delta, the PKG-006 head assertion and the PKG-010 chain
definition. Re-freezing all of that is the re-baseline PKG-013 performed, and it needed five release
runs to go green.

**So the forward-migration route cannot be confirmed as "minimal, isolated, and no existing verified
engine change".** It changes 25 proof files.

### The route taken instead

The registry is applied as a **DEV operational migration**, exactly like the two that already exist
on this project, `dev_alpha_confirmed_qa_ai_budget_activation` and `dev_alpha_owner_ai_test_admission`.
Canonical source stays at 147 files and not one of the 25 harness files is touched.

This is principled rather than a shortcut. The registry records the lineage of accounts **on a
non-production project**. Production will not have synthetic fixtures to classify. The candidate's
own header says so. DEV-only operator metadata is precisely the category the existing `dev_alpha_*`
rows occupy, and PKG-014 already reconciled that category as legitimate.

Reconstructibility is preserved: the SQL is committed at `supabase/candidates/pkg015_dev_data_lineage.sql`,
proven by run 35157543709, and the DEV ledger stores the applied statements verbatim.

**If the owner wants the registry in canonical source instead, that is a separate re-baseline package
with a measured cost of 25 files and 65 lines, and it should not ride inside a batch approved as
minimal.**

## 3. Exactly what is written

The applied SQL is `supabase/candidates/pkg015_dev_data_lineage.sql`, byte for byte, already reviewed
and proven. It creates, and creates nothing else:

| Object | Kind |
| --- | --- |
| `private.account_lineage_v5` | table, RLS enabled and forced, all privileges revoked from every role |
| `private.account_lineage_events_v5` | table, append-only, RLS enabled and forced, all privileges revoked |
| `private.account_lineage_events_append_only()` | trigger function that refuses UPDATE and DELETE |
| `private.account_lineage(uuid)` | read helper, EXECUTE revoked from every role |
| `private.account_is_non_production(uuid)` | fail-closed predicate, EXECUTE revoked from every role |
| `public.rpc_admit_account_lineage_service(uuid,text,text,text,integer)` | writer, `service_role` only |
| `public.rpc_read_account_lineage_service(uuid)` | read, `service_role` only |

**No existing verified engine change.** The file contains no `ALTER`, `DROP` or `CREATE OR REPLACE`
of any pre-existing object. Every statement is a `CREATE` of a new object plus its own `REVOKE` and
`GRANT`. This was proven mechanically in CI, where the function, table and policy surface was
compared before and after the candidate and any change to an existing object would have failed the
run. It passed.

**No deletion and no overwrite.** The file contains no `DELETE`, no `UPDATE` and no `TRUNCATE`. The
`adversarial` accounts, their two agreements, versions, messages, selections and responses are not
read, moved or altered. Classification writes only new rows in the new registry.

## 4. Preflight, taken before the write

| Check | Value |
| --- | --- |
| database | `postgres` on project `leqcwgzvjsxugfgzdmth` |
| migration ledger rows | 149 |
| PKG-015 objects present | none, clean |
| domain surface digest | `53c4e70348422b743d0e05a7632814e1` |
| rows across every `public` table | 366 |
| accounts | 5 |

The candidate additionally carries its own preflight block, which aborts if any of its objects
already exist, and its own postcondition block, which aborts if any privilege is wrong.

## 5. Readback plan, to run after the write

1. The seven objects exist, and the domain surface digest changed by exactly the new objects.
2. Row counts across `public` are unchanged at 366, and all 5 accounts still exist.
3. The migration ledger gained exactly one row.
4. Fail-closed proof on live data: an account with no registry row reads `UNCLASSIFIED` with revision
   0 and `nonProduction` false.
5. Classification of the accounts that have provenance, then an authoritative read of each.
6. Privilege readback: no client role can reach either service function or either table.

## 6. Classification to be written

| Account | Class | Basis |
| --- | --- | --- |
| `adversarial_a@example.com` | `SYNTHETIC_ACCEPTANCE_FIXTURE` | named in committed adversarial scripts against this project ref |
| `adversarial_b@example.com` | `SYNTHETIC_ACCEPTANCE_FIXTURE` | created 331 ms after A in the same run, unrouteable domain, worker counterpart of A's journey |
| `msljivic031@…` | `OWNER_PERSONAL` | the owner's own account |
| `msljivic031+uskoci-qa@…` | `DEV_ACCEPTANCE_QA` | the dedicated QA account AF-D20 authorized; drove the PKG-014 acceptance |
| `uskocibusiness@…` | `OWNER_BUSINESS` | the owner's business account |

No account is left unclassified, because every one of the five has provenance the owner or the
repository can vouch for. The registry's `UNCLASSIFIED` default remains the behaviour for any future
account nobody has classified, and that is proven live in the readback.

## 7. What is deliberately not in this batch

The PKG-003 and PKG-008 candidate SQL are **not** promoted here. The owner asked for the case for
each to be made separately first, and it is not made in this document. They remain unapplied.

---

## 8. Executed, 2026-09-17

Applied to canonical DEV/ALPHA `leqcwgzvjsxugfgzdmth` as migration
`20260917053239_dev_alpha_pkg015_account_lineage`, from the bytes proven by CI run 35185612325 on
candidate `774034a`. The candidate's own preflight and postcondition blocks both passed, so every
privilege assertion inside the SQL held on the live project.

### Readback after the write

| Check | Result | Expected |
| --- | --- | --- |
| migration ledger rows | 150 | 149 plus one |
| new ledger row | `20260917053239 dev_alpha_pkg015_account_lineage` | that name |
| rows across every `public` table | 366 | unchanged |
| accounts | 5 | unchanged |
| agreements of the fixture pair | 2 | unchanged |
| domain surface digest, excluding the seven new objects | `53c4e70348422b743d0e05a7632814e1` | identical to preflight |
| fail-closed on live data, before classification | `UNCLASSIFIED`, revision 0, `nonProduction` false | that |

The digest matching the preflight value byte for byte is the mechanical proof that **no existing
function, table or policy changed**. Not one row was deleted, rewritten or reassigned.

### Classification written

All five accounts, each at revision 1, each carrying its reason and source reference.

| Account | Class | Non-production |
| --- | --- | --- |
| `adversarial_a` | `SYNTHETIC_ACCEPTANCE_FIXTURE` | true |
| `adversarial_b` | `SYNTHETIC_ACCEPTANCE_FIXTURE` | true |
| `msljivic031` | `OWNER_PERSONAL` | true |
| `msljivic031+uskoci-qa` | `DEV_ACCEPTANCE_QA` | true |
| `uskocibusiness` | `OWNER_BUSINESS` | true |

`adversarial_b`'s stored reason records in the row itself that its evidence is structural rather
than by name, and that it should be reclassified if the owner disagrees. The registry keeps the
previous value on any reclassification, so that correction costs one call.

### Readback after classification

| Check | Result |
| --- | --- |
| classified accounts | 5 |
| accounts left unclassified | 0 |
| history rows | 5, every one a first admission with no previous value |
| accounts reported non-production | 5 |
| fail-closed for an unknown account id | `UNCLASSIFIED`, `nonProduction` false |
| `authenticated` may call the writer | false |
| `authenticated` may read the registry table | false |
| `service_role` may call the writer | true |
| rows across every `public` table | 366, unchanged |
| agreements | 2, untouched |

**GAP-0018 is closed on canonical DEV.** Every account on the project now carries a recorded lineage
with a reason and a source reference, and the question "is this row test data?" has an authoritative
answer that survives the session.

Two things this deliberately did not do, both still true after the write: the engine gates nothing on
lineage, which is GAP-0042, and no existing data was cleaned, which remains PKG-023.

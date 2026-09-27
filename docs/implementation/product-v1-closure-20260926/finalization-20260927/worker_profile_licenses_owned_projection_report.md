# P5 owned worker licenses projection — source preparation

2026-09-27. **SOURCE ONLY / SQL RUNTIME NOT RUN / DEV UNAPPLIED / CLIENT UNWIRED.**
This is a small next contract step, not matching completion or deployment readiness.

The manual worker editor cannot read the existing self-declared licenses from its
owned reader. Matching already checks `app_profiles.licenses` against
`needs.required_licenses`; the owned AI profile read/save also preserves this field.
The proposed change adds `licenses: p.licenses` to the existing owned JSON response.
It does not certify, normalize, infer, clear or write any license.

## Fresh canonical read-only evidence

Supported Supabase connector `execute_sql`, project `leqcwgzvjsxugfgzdmth`, catalog
SELECTs only. No keys, personal rows, helper ACL changes, provider calls or mutations.

`public.rpc_get_worker_profile_for_edit()`:

- Normalized body MD5: `12ce32620e04ad369ccc239234d4213a`.
- Body matches `20260911174500_clean_pre_v3_worker_capacity.sql` exactly after CRLF
  normalization. It checks `auth.uid()`, selects only that account's WORKER profile,
  returns null when absent, and admits DRAFT/ACTIVE/SUSPENDED status only.
- Owner postgres; language plpgsql; STABLE; SECURITY DEFINER; non-strict;
  parallel unsafe; non-leakproof; cost 100; rows 0; no arguments; scalar jsonb result;
  `search_path=pg_catalog`; null comment.
- Exact ACL: `{postgres=X/postgres,authenticated=X/postgres}`. No PUBLIC, anon or
  service_role grant. Complete semantic `pg_proc` metadata is pinned in the candidate;
  all metadata including the function OID is compared before/after its one replacement.
- `app_profiles.licenses` is existing `text[] NOT NULL DEFAULT ARRAY[]::text[]`.
- Expected one-key body after the patch: MD5 `61e77f00205f93704af5951c112f38d3`.

Both complete certificate rows currently contain `singleton:true` and SHA256
`cc248ff125c67146bb343db7d222230cb291be99048125d55f6b547ce49e36f7`.

The connector returned the complete source definitions of the certificate inventory:

| Function | Normalized body MD5 |
| --- | --- |
| `private.closure_schema_digest_v5_139()` | `988b9d3ab9c0dc7341cd30a391184e40` |
| `private.closure_source_digest_v5()` | `7840a7e70cd12bd599fa6d3bb3300cc7` |
| `private.closure_erasure_program_digest_v5()` | `3ec8d244730415d3a047312366672375` |
| `private.retention_ai_source_ready()` | `483af845f6b2bfaf57fbf1e5ab74e050` |

The reader is absent from the enumerated certified function sets and has zero
trigger memberships. The schema digest covers relations/constraints/triggers, not
this reader. The erasure program adds named functions and relation-trigger functions,
also excluding this reader. Thus the proposed body-only change is outside the current
certificate inventory. This is source membership evidence, not a new live execution
of the private digest/readiness helpers. The disposable candidate will require a
ready, internally consistent predecessor and prove unchanged digest, complete
certificate rows, readiness definition and binding. **No certificate update is
requested or included.** If inventory changes, the candidate refuses; any resulting
recertification would require a separately specified and approved package.

## Files and proof boundary

- `supabase/candidates/worker_profile_licenses_owned_projection.sql`: one atomic DO
  statement; exact old body and metadata admission; one JSON anchor replacement;
  exact remaining-body/metadata and certificate preservation checks. Its deliberate
  `LOCAL_ONLY_ROLLBACK` admission prevents treating this source revision as an approved
  application package. There is no COMMIT or permanent grant/policy/schema/data write.
- `supabase/proofs/worker_profile_licenses_owned_projection_proof.sql`: includes the
  candidate verbatim inside BEGIN/ROLLBACK. Fresh synthetic local users exercise SQL
  roles, not real Auth sessions. The old reader is a temporary, narrowly granted oracle.
  Normal resource validation is retained. DRAFT to ACTIVE uses the canonical completion
  RPC. SUSPENDED/CLOSED fixtures are explicitly synthetic, using the existing top-level
  transaction-local replication-role pattern; origin is restored before all reads.
- `supabase/proofs/worker_profile_licenses_owned_projection_proof.mjs`: rejects remote
  API/DB URLs and alternate libpq target overrides before IO; binds all seven source inputs
  to `GITHUB_SHA`, including its workflow; runs the SQL; independently
  checks rollback even if SQL fails.
  The report exposes fixed check/stage names, hashes and booleans only, never errors,
  SQL, identities, bodies, credentials or URLs.
- `.github/workflows/worker-profile-licenses-owned-projection-proof.yml`: manual
  dispatch plus push registration restricted to `work/uskoci-ui-unification-20260924`
  and the exact five P5 package paths; no caller inputs or DEV target. Exact existing predecessor stages,
  private raw logs, bounded sanitized artifact allowlist and unconditional teardown.

Prepared checks:

1. Exact predecessor, authority and unmoved certificates.
2. DRAFT response equals old output plus the exact self-declared array.
3. Own/foreign separation, stored empty array and absent profile remains null.
4. Canonical activation preserves the array and every existing output key.
5. Synthetic SUSPENDED output and CLOSED refusal retain predecessor behavior.
6. Missing subject, anon and service_role refusals never clear stored licenses.
7. Independent post-rollback catalog/history and local fixture data restoration.

Rollback comparison includes the full public/private/rls_private function metadata,
comments, existing surface inventory (tables, columns, constraints, triggers, policies,
indexes), authority, publications, dataset catalog, certificate/binding/readiness and
migration history; local profile/account/Auth-user row hashes remain in memory only.
It is not a session revocation, real account closure, HTTP, device or performance proof.
The existing reader's authorization is preserved, not strengthened or newly certified.

## Execution and remaining work

The dedicated workflow reuses the current disposable setup from
`chat-p4-exact-message-proof.yml`: live79, source147, existing ordered stages through
PKG050, A1 and applied B3a/B3b. It runs this runner instead of the P4 phase after
committing the exact source. It requires the same
explicit loopback `RU5_DEVICE_SUPABASE_URL`, `RU5_DEVICE_DB_URL`, matching `DB_URL`,
`GITHUB_SHA`, and optionally `WORKER_PROFILE_LICENSES_ARTIFACT_DIR`. No Auth keys are
required by this runner. Always discard the disposable stack afterwards. No CI was
dispatched. Push registration follows the prior P4 pattern, restricted to the named
canonical work branch and exactly these five new P5 files (candidate, SQL proof,
runner, workflow and this report). Manual dispatch remains available without inputs.
No other branch/path trigger or source ref override is accepted by the workflow.

Completed checks: Node syntax PASS; frozen predecessor body hash and unique patch
anchor PASS; six SQL check names and exact candidate include/rollback shape PASS;
independent static review found no concrete defect. Workflow YAML/admission and
unchanged predecessor commands checked; scoped whitespace check PASS.
The workstation has no `psql` or Docker on PATH;
**SQL and the seven runtime checks remain NOT RUN**.

Before DEV application: execute and review the disposable proof, obtain explicit
approval for this exact body-only reader change, prepare the reviewed application
wrapper/revision, and repeat fresh predecessor/certificate admission. Do not remove
the local-only gate as part of unrelated work.

Only after application/readback may the client add a required validated `licenses`
field to the owned projection and expose “Licence koje navodiš”. A missing field is
an unsupported/unknown reader contract, **not `[]`**; it must never silently produce
a clearing write. Existing self-declared semantics and write/readback ownership remain.

Documentation checked: Supabase changelog index and current function security/RLS
documentation through the supported connector. No dependency or server API changes
were needed for this source preparation.

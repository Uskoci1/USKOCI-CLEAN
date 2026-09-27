# P5 owned worker licenses projection — application candidate preparation

2026-09-27. **APPLICATION REVISION PREPARED / EXACT-BYTE REPROOF PENDING / DEV UNAPPLIED / CLIENT UNWIRED.**
The original local-only revision passed 7/7 disposable checks. That result does not
yet prove the revised application bytes below or authorize DEV application.
This is a small next contract step, not matching completion or deployment readiness.

## Proven predecessor package and revised bytes

The original exact package at `cb63b847cd39980f0b67fd437d07c3e4d8e78328` passed
[disposable run 36340619418](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36340619418).
The independently verified receipt is preserved unchanged in
`P5_LICENSES_PASS_20260927_RECEIPT.json`, committed in `4a533848`. All seven checks,
catalog/data restoration and teardown passed; `certificateMoved=false`. Original
candidate bytes remain in Git history at that exact source commit.

| Source | Original proven SHA256 | Revised SHA256, reproof pending |
| --- | --- | --- |
| Candidate | `0712d4e5936814c75b83bb764b49ba9dc2ca8415b19df85061eb5a8e18f89518` | `38d4ec8a408d9e283414ae89059dddfa7b887f57ce8802fb083e55df742717ad` |
| SQL proof | `50d1223dedf8a2c832d20863cc44c834179a8fc71583ad6d2d24a72d20a74d13` | `7e9f2836d86c7bed135404ca28853a11960c5dad619be91ef1e80cbd0a9ef076` |
| Runner | `e66369e8e238c353d8d8bb77688561183e0c6b659efe69c3b80fad220ba63079` | `0ba76abf8b755428ec3941fd8c4bb18ee662583c330f4b698db49bb85f5856c2` |

The only executable change removes the candidate's artificial
`LOCAL_ONLY_ROLLBACK` GUC admission and its matching proof SET. All actual
predecessor/body/metadata/ACL, certificate and postcondition guards are unchanged;
the intended RPC body remains MD5 `61e77f00205f93704af5951c112f38d3`.
Runner changes are status comments only. Workflow bytes remain unchanged at SHA256
`b561a39e9fb2e844a0f9c79f80051cf12ec74dd5ae5dab98233ae6a0a355114c`.
No wrapper, commit, grant or other application side effect was introduced.
The same local-only runner includes the revised candidate verbatim inside rollback
and binds all seven exact source inputs to the next CI commit before execution.

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
  exact remaining-body/metadata and certificate preservation checks. The artificial
  proof-only admission has been removed in this separately reprovable revision.
  There is no COMMIT or permanent grant/policy/table/data write. The only persistent
  effect after future approved application is the one existing function body replacement.
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
required by this runner. Always discard the disposable stack afterwards. The original
revision's successful CI is recorded above; revised-byte CI remains pending and is
owned by root. Push registration follows the prior P4 pattern, restricted to the named
canonical work branch and exactly these five new P5 files (candidate, SQL proof,
runner, workflow and this report). Manual dispatch remains available without inputs.
No other branch/path trigger or source ref override is accepted by the workflow.

Completed checks: Node syntax PASS; frozen predecessor body hash and unique patch
anchor PASS; six SQL check names and exact candidate include/rollback shape PASS;
independent static review found no concrete defect. Workflow YAML/admission and
unchanged predecessor commands checked; scoped whitespace check PASS.
For this revision, static comparison against the original proven commit confirms
that only the artificial admission and matching SET changed executable SQL, while
runner logic is identical. Node syntax and scoped whitespace checks pass.
The workstation has no `psql` or Docker on PATH;
**the revised bytes still require a new seven-check disposable CI result**.

Before DEV application: execute and review the same proof on these exact revised
bytes, obtain explicit owner approval for this body-only reader change, and repeat
fresh predecessor/certificate admission. The complete atomic application statement
is already prepared; no additional wrapper or certificate movement is needed or
authorized. Removing the artificial gate is source preparation, not permission to apply.

Only after application/readback may the client add a required validated `licenses`
field to the owned projection and expose “Licence koje navodiš”. A missing field is
an unsupported/unknown reader contract, **not `[]`**; it must never silently produce
a clearing write. Existing self-declared semantics and write/readback ownership remain.

Documentation checked: Supabase changelog index and current function security/RLS
documentation through the supported connector. No dependency or server API changes
were needed for this source preparation.

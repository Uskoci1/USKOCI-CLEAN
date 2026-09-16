# USKOČI mass-user / chaos harness

This directory is intentionally isolated from the product engine. It exists to pressure the same Auth/RLS/read boundaries with many real synthetic Supabase sessions without changing the canonical application branch.

## Safety boundary

`mass_user_chaos.mjs` **refuses the canonical project** `leqcwgzvjsxugfgzdmth`. Run it only against a staging/disposable Supabase project cloned from the exact source being evaluated.

The service-role key is used only to create/delete synthetic Auth users and to verify cleanup residue. Every simulated user action runs with that user's own real JWT. The script never forges JWT claims and never uses the service role for product actions.

The first phase makes **zero real AI provider calls**. AI provider proof is intentionally separated from mass load so thousands of users cannot consume Gemini/OpenAI budget or hit provider rate limits.

## What Phase 1 proves

For N real synthetic accounts it performs:

1. Admin provisioning on the disposable target with confirmed synthetic emails.
2. Ordinary password-grant login for every account.
3. `/auth/v1/user` identity readback.
4. Own `app_profiles` read through the same RLS-protected table boundary used by `ownProfileClientService`.
5. Ring hostile-read test: A tries to read B's private `app_profiles` rows, B tries C, etc. Every result must be empty.
6. Concurrent own-profile read pressure with latency samples.
7. Cleanup by hard-deleting all synthetic Auth users unless `MASS_KEEP_DATA=1`.
8. Service-role residue readback for `app_profiles`; expected residue is zero.

A PASS means zero cross-account profile leakage, zero auth mismatch, zero pressure errors and zero cleanup residue. It does **not** yet claim the complete Task → Application → Selection → Agreement → Completion journey; that is the next harness layer.

## Required environment

- `MASS_TARGET_URL` — staging/disposable `https://<ref>.supabase.co`; canonical is refused.
- `MASS_PUBLISHABLE_KEY` — publishable/anon key for that target.
- `MASS_SERVICE_ROLE_KEY` — secret used only for provisioning/cleanup.

Optional:

- `MASS_USERS` — default `20`, range `2..5000`.
- `MASS_CONCURRENCY` — default `min(20, users)`, range `1..250`.
- `MASS_READS_PER_USER` — default `4`, range `1..100`.
- `MASS_WORKER_RATIO` — default `0.70`.
- `MASS_KEEP_DATA=1` — diagnostic only; normally leave unset.
- `MASS_OUT` — default `artifacts/mass-user-chaos`.
- `MASS_RUN_ID` — optional stable run identifier.

Run:

```bash
node scripts/load/mass_user_chaos.mjs
```

The machine-readable receipt is written to:

```text
artifacts/mass-user-chaos/mass-user-chaos-report.json
```

No password or JWT is written to the report.

## Ramp plan

Do not jump directly to 5000 users. Use the same exact staging source and ramp only after each previous tier is green:

- 20 users: harness/config smoke.
- 100 users: first RLS/account isolation run.
- 500 users: concurrency/latency baseline.
- 1000 users: marketplace journey + hostile/race layer once implemented.
- 5000 users: release-candidate load/chaos gate after PKG-021-equivalent A/B acceptance.

## Next layer

Phase 2 should add real product journeys over canonical RPCs, not direct business-table seeding:

- Requester creates a Task through the manual/confirmed Need authority.
- Worker submits through `rpc_submit_response`.
- Requester selects through `rpc_select_response`.
- Agreement messaging/change/completion use the same command adapters as the app.
- Idempotent same-key replay, changed-payload rejection and concurrent one-seat/two-seat races.
- Post-run invariant checks: no duplicate Agreement per Selection, no over-capacity Worker, no orphan responses/messages, no invalid lifecycle state and zero cross-account private reads.

Real AI remains a separate bounded canary: a small fixed number of real provider turns proves provider integration; mass tests use provider stubs/fault injection.

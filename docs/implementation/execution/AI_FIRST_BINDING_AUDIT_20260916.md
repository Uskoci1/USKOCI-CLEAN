# AI-first binding audit — conversation to canonical data (2026-09-16)

Read-only audit on head `0f2da47`..`cffd03d` (branch `work/pre-v3-engine-integration-20260911`) and on
canonical DEV/ALPHA `leqcwgzvjsxugfgzdmth`. No engine, writer, migration or Edge change was made; every
live statement below is a `select` against catalog or evidence tables. Owner question: does a natural AI
conversation reach the real canonical writers, or does the owner have to refill four forms by hand?

**Answer: the binding exists, is complete and is live byte-identical to source, for both WORKER_PROFILE and
NEED. No `AI_FIRST_BINDING_GAP` was found. What is broken on DEV is the provider runtime, not the binding.**

## WORKER_PROFILE — one conversation, one review, one save, four canonical writers

`src/app/(app)/profil/razgovor.tsx` (entered from `profil/radnik.tsx`) → `workerAiClientService`
→ `rpc_open_worker_ai` → Edge `uskoci-worker-interview` (WORKER_PROFILE_V1 patch) → `rpc_patch_worker_ai`
→ `rpc_prepare_worker_ai_review` (immutable envelope + `displayedContentDigest`, shown as "Pregledaj profil")
→ **one** `rpc_save_worker_ai_review` → fan-out below → receipt + `rpc_read_worker_ai` readback.

`rpc_save_worker_ai_review` runs the whole fan-out in one transaction, under an advisory lock per
(account, clientRequestId), with revision + `base_hash` staleness fences and an idempotent receipt.

| FACT KEY | CURRENT CLIENT OWNER | CANONICAL WRITER | LIVE DEV RPC | READBACK | TEST/PROOF | STATUS |
| --- | --- | --- | --- | --- | --- | --- |
| `worker.services` (`skills`), `tools`, `vehicles`, `licenses`, plus `displayName`, `bio` | AI: `razgovor.tsx` + `workerAiClientService.save`. Manual: `workerProfileClientService.azurirajRadnikProfil` (`profil/radnik.tsx`) | `rpc_save_worker_ai_review` writes `public.app_profiles` columns directly, under `private.guard_profile_write` (`validate_need_v2_fact`) | yes, `authenticated` EXECUTE; live body md5 `67d015b0…` = source md5 | receipt `{profileId, profileStatus, saved, authoritative}`; `rpc_read_worker_ai`; `rpc_get_worker_profile_for_edit` | `supabase/proofs/pre_v3/v5_worker_profile_proof.mjs` (real disposable DB, asserts `skills`, `licenses`); jest `worker-ai-client.test.ts` | FULLY_BOUND |
| `worker.team_capacity` | same review; manual `workerCapacityClientService` | `rpc_save_worker_capacity(revision, value)`, called with `private.worker_capacity_document(...)->>'revision'`; sets `uskoci.profile_mutation='CAPACITY_REVIEW'` so `pre_v3_worker_fact_authority` admits the write | yes, live | `rpc_get_worker_capacity()`; proof asserts `team_capacity=3` and that a stale concurrent edit keeps `3` | v5_worker_profile_proof; jest `worker-capacity-client.test.ts` | FULLY_BOUND |
| `worker.radius_km` / područje rada (`city`, `operatingCountryCode`, `radiusKm`) | same review; manual `profil/lokacija.tsx` | `rpc_save_worker_location(revision, value, confirmed=true)`, called only when the candidate differs from the current document; sets `LOCATION_REVIEW` | yes, live | `private.worker_location_document`; proof asserts `operating_country_code='RS'`, `city='Beograd'` | v5_worker_profile_proof; W02 location proof | FULLY_BOUND |
| `worker.regular_availability` (rules, windows, timezone) | same review (`ruleChanges` / `windowsUpsert` / `windowIdsRemove`, normalized by `private.normalize_worker_ai_availability` at prepare time); manual `profil/dostupnost.tsx` | `rpc_save_worker_availability(revision, value)`, called on every save; sets `AVAILABILITY_REVIEW`; writes `profile_availability_rules`, `profile_availability_windows`, `worker_match_preferences.timezone` | yes, live | `private.worker_availability_document`; proof asserts 2 rule rows and 1 window row | v5_worker_profile_proof; jest `w02-worker-availability-client.test.ts` | FULLY_BOUND |
| `worker.same_day_available` | same review (`availability.availableNow`); manual availability screen | `rpc_save_worker_availability` → `update public.app_profiles set available_now=…`, the only writer of that column | yes, live | proof asserts `available_now=true` | v5_worker_profile_proof | FULLY_BOUND, see naming note |
| activation (`profile_status` → ACTIVE) | the same review, only when the owner ticks activate | `rpc_complete_worker_profile(profileId)` | yes, live | receipt `profileStatus='ACTIVE'` | v5_worker_profile_proof | FULLY_BOUND |

Naming note: there is no `same_day_available` column. The canonical flag is `public.app_profiles.available_now`
("Dostupan sada"). The only `same_day_*` column in the schema is `same_day_urgent_notifications` on the
notification preferences, which is a push preference, not a worker availability fact. A dormant
`available_now_expires_at` column exists and this path never sets it.

Deliberately MANUAL_ONLY: `location.approximatePosition` — the provider schema rejects it
(`WORKER_AI_OUTPUT_INVALID`), so the precise point stays with the existing location screen.

The separate Profil / Lokacija / Kapacitet / Dostupnost screens are therefore correction and recovery
surfaces, exactly as the owner wants; they are not a required second entry of the same data.

## NEED — conversation, one review, accept, publish

`rpc_ai_open_need_conversation_owned_v2` → Edge `uskoci-ai-interview` → `rpc_ai_claim/dispatch/complete_need_turn_v2_service`
→ proposals land in `public.ai_structured_facts` (`NEED_FACT_V2`, `AI_INFERENCE` / `NEEDS_CONFIRMATION`)
→ `rpc_prepare_ai_task_review` → screen `pregled-zadatka.tsx` → **one** `rpc_accept_ai_task_review`
→ `rpc_publish_accepted_ai_task_review` → readback of the published Need.

`rpc_accept_ai_task_review` (live md5 `98483642…` = source) does, in one transaction:
`rpc_save_need_location_review(..., confirmed=true)` → a loop of `rpc_ai_confirm_fact(f.id)` for the facts in
the envelope (bulk human confirmation, no per-fact clicking) → `rpc_save_need_draft_from_review` → the
publication command. `rpc_save_need_draft_from_review` (live md5 `a334717a…` = source) maps
`need.title`, `description`, `category`, `price_mode`, `price_rsd`, `schedule_kind`, `starts_at`, `ends_at`,
`people_needed`, `required_skills` / `tools` / `vehicles` / `licenses`, `minimum_experience_years`,
`critical_conditions`, `task_country_code`, `task_geography` into `public.needs` + `public.need_geography`,
and the private `exact_address` / `access_notes` into `public.need_sensitive`. Publication goes through
`rpc_publish_need_canonical` (fail-closed D-0140 evaluator). Status for every one of those keys:
**FULLY_BOUND**.

MANUAL_ONLY by contract (`src/contracts/needFactsV2.ts`, enforced by `rejectManualOnlyFacts` in the Edge
function): `need.verified_identity_required`, `need.public_photo_paths`, `need.resolved_location`.

Proof: `supabase/proofs/pre_v3/v5_review_acceptance_proof.mjs`, W03 owned-intake proof; jest
`ai-task-review-client.test.ts`, `v5-review-screen.test.tsx`.

Legacy: `src/app/(app)/pregled-nacrta.tsx` is the only screen that still confirms facts one by one
(`aiNeedV2Izvor.confirmFact`). It is the PKG-023 retirement candidate, not the current entry.

## Provider truth on DEV (read-only)

- **Only Gemini.** The deployed `uskoci-ai-interview` (version 32, updated 2026-09-13 13:33:26Z) calls
  `generativelanguage.googleapis.com` and nothing else. There is no second provider adapter anywhere in the
  source tree. The runtime really selects it, and refuses everything else: the gate is
  `AI_PROVIDER === 'gemini' && GEMINI_MODEL === 'gemini-3.8-flash' && GEMINI_API_KEY && USKOCI_GEMINI_PAID_TEST_ENABLED === 'true'`,
  otherwise `503 AI_PROVIDER_NOT_CONFIGURED`. The same gate is in `uskoci-worker-interview`.
- **The gate did pass on 2026-09-13.** `private.ai_need_turn_commands` has 6 turns with
  `provider_dispatched=true` between 13:09 and 13:42, and `private.ai_test_reservations_v5` has 7 LLM
  reservations totalling 1.75 USD of the 5.00 USD ceiling. So the model value really was
  `gemini-3.8-flash` at that time.
- **No AI turn has ever succeeded on DEV.** Need turns: 15 FAILED, 1 stuck PROCESSING (2026-09-13 13:42,
  `provider_dispatched=true`, no receipt). Worker turns: 3 FAILED, none dispatched, and
  `private.worker_ai_saves` is empty — the fan-out above has never run against DEV.
- **The deployed function is older than the fix for that failure.** Two source commits touch the provider
  wire *after* the 13:33:26Z deployment: `37fcf56` (17:02Z) makes the non-stream path send the Gemini 3.8
  body through `geminiRequestBody(...)`, and `eb2b500` (15:46Z) rewrites the stream helper with a closed
  diagnostic vocabulary. The deployed version still sends the pre-3.8 wire on the non-stream path.
  `uskoci-worker-interview` (v11, 09:18:36Z) does match source head.
- **The owner's test account is not admitted.** The account that owns the PROFILE conversations and the
  worker turns, `1c489b37-1290-4bc2-999d-7f77a05cd342`, is absent from `private.ai_test_accounts_v5`
  (admitted: `2e7310cf…`, `0640a1bd…`). Every turn from it, including today's 2026-09-16 12:59 attempt,
  fails before any provider dispatch or budget reservation. That is the immediate reason the AI chat does
  nothing for the owner, and it is an admission-list fact, not a binding gap.
- **Migrations.** DEV has 146 history rows: 144 of the 147 source migrations plus two operational rows
  (`dev_alpha_confirmed_qa_ai_budget_activation`, `dev_alpha_owner_ai_test_admission`). Missing:
  `clean_v5_self_reported_identity_requirement`, `clean_v5_event_bound_account_erasure`,
  `clean_v5_qa_owner_product_activation`. None of them belongs to the AI-first chain above.

## What would actually unblock the AI-first flow

1. Deploy the current `uskoci-ai-interview` (PKG-014 gate: the owner authorizes the exact batch).
2. Admit the owner's test account in `private.ai_test_accounts_v5` (AF-D20 admission; a live write, so it
   waits for the same authorization).
3. Settle the one stuck PROCESSING turn honestly (it is an unknown outcome, never a silent retry).
4. Then, and only then, PKG-018 can diagnose whether any dispatched turn still fails at the provider.

Nothing in this list requires a new writer, a new fact key or a change to the verified engine.

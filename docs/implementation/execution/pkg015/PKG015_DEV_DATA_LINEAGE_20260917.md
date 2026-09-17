# PKG-015 — DEV data lineage and isolated test accounts

GAP-0018. Started 2026-09-17 on `work/pre-v3-engine-integration-20260911` (PR #102).

## Step 1 is read-only, and this document is it

Nothing below changed canonical DEV/ALPHA `leqcwgzvjsxugfgzdmth`. Every number is a live read taken
on 2026-09-17. The package's source candidate and proof follow from these facts, not the reverse.

## The gap, stated precisely

There is **no lineage marker anywhere in the schema**. Searching every column in `public` and
`private` for `synthetic`, `is_test`, `test_`, `lineage`, `fixture`, `seed`, `origin` or
`provenance` returns nine columns, and every one of them is about *policy review* provenance
(`reviewer_provenance`, `rule_provenance_snapshot`, `service_provenance`, `review_provenance`) or
about retention (`ai_conversations.retention_unbound_origin`). Not one records where a row came
from.

The practical consequence is visible in the account list below: two accounts exist whose names
suggest they are synthetic, and nothing in the database or the repository confirms it.

## The five accounts on canonical DEV

| Account | Created (Belgrade) | AI allowlisted | Proposed lineage | Basis |
| --- | --- | --- | --- | --- |
| `adversarial_a@example.com` | 2026-08-30 17:32 | no | `SYNTHETIC_ACCEPTANCE_FIXTURE` | reserved example domain, adversarial name, created in a pair |
| `adversarial_b@example.com` | 2026-08-30 17:32 | no | `SYNTHETIC_ACCEPTANCE_FIXTURE` | same |
| `msljivic031@…` | 2026-09-01 17:14 | yes | `OWNER_PERSONAL` | the owner's own account |
| `msljivic031+uskoci-qa@…` | 2026-09-13 11:53 | yes | `DEV_ACCEPTANCE_QA` | the dedicated QA account AF-D20 authorized; drove the PKG-014 acceptance |
| `uskocibusiness@…` | 2026-09-13 12:14 | yes | `OWNER_BUSINESS` | the owner's business account |

When this census was first written the two `adversarial` accounts looked unattributable, because
nothing in the **current tree** mentions them. That was too shallow a search.

**Update, 2026-09-17, after the owner asked for provenance or nothing:** searching the full git
history rather than the current tree found them. `adversarial_a@example.com` is named verbatim in
`adversarial_read.js`, `adversarial_read2.js` and `rls_test.js`, committed in `0aa18af` and later
removed as scratch files, which sign in to this exact project ref with a hardcoded test password.
`HANDOFF.md` from `df5b81f`, committed eight minutes after the accounts were created, records an
authenticated adversarial harness passing 11 of 11. Both accounts were created 331 milliseconds
apart on a domain reserved by RFC 2606 that cannot receive mail, so neither can belong to a real
person and both were made by a script. The full determination, including the one discrepancy that
remains, is in `PKG015_PROMOTION_PLAN_20260917.md`.

## Full row census, by account

Every non-empty table that references an account, counted exactly. Configuration and catalog tables
(`need_fact_registry`, `retention_data_classes`, `closure_dataset_catalog_v5`,
`publication_policy_*`, `marketplace_config`, `processor_provider_inventory`,
`location_market_configs`, `connection_policy_versions`) are excluded: they hold system rules, not
account data.

| Table | Column | adversarial_a | adversarial_b | owner personal | QA dedicated | uskocibusiness |
| --- | --- | --- | --- | --- | --- | --- |
| `public.app_profiles` | `account_id` | 2 | 2 | 2 | 2 | 2 |
| `public.needs` | `requester_account_id` | 6 | — | 1 | 1 | — |
| `public.ai_conversations` | `account_id` | 12 | — | 20 | 7 | 5 |
| `public.ai_messages` | `account_id` | — | — | 43 | 17 | — |
| `public.ai_structured_facts` | `account_id` | 82 | — | 93 | 17 | — |
| `public.ai_action_proposals` | `account_id` | 2 | — | — | — | — |
| `public.agreements` | `requester_account_id` / `worker_account_id` | 2 | 2 | — | — | — |
| `public.agreement_versions` | `created_by_account_id` | 2 | — | — | — | — |
| `public.agreement_messages` | `sender_account_id` | 2 | — | — | — | — |
| `public.need_selections` | `selected_by` / `worker` | 2 | 2 | — | — | — |
| `public.marketplace_responses` | `worker_account_id` | — | 4 | — | — | — |
| `public.worker_match_preferences` | `worker_account_id` | 1 | — | 1 | 1 | 1 |
| `public.data_export_requests` | `account_id` | — | — | 1 | — | — |
| `private.ai_need_open_commands` | `account_id` | — | — | 7 | 5 | 5 |
| `private.ai_need_turn_commands` | `account_id` | — | — | 3 | 6 | 12 |
| `private.ai_task_reviews` | `account_id` | — | — | 1 | 1 | — |
| `private.ai_task_review_commands` | `account_id` | — | — | — | 1 | — |
| `private.need_draft_save_commands` | `account_id` | — | — | 1 | 1 | — |
| `private.worker_ai_sessions` | `account_id` | — | — | 1 | 2 | — |
| `private.worker_ai_turns` | `account_id` | — | — | 3 | 7 | — |
| `private.worker_ai_reviews` | `account_id` | — | — | 1 | 2 | — |
| `private.worker_ai_saves` | `account_id` | — | — | — | 1 | — |
| `private.response_submit_commands` | `worker_account_id` | — | 4 | — | — | — |
| `private.agreement_media_snapshots_v5` | `account_id` | 2 | — | — | — | — |
| `private.ai_test_accounts_v5` | `account_id` | — | — | 1 | 1 | 1 |
| `private.ai_test_reservations_v5` | `account_id` | — | — | — | 12 | 7 |

Two observations worth recording. The only completed marketplace journey on DEV, two agreements
with versions, messages, selections and responses, belongs entirely to the pair of unattributable
`adversarial` accounts. And the owner's personal account carries the largest AI history of any
account, 20 conversations and 93 facts, mixed in with everything else.

## AF-D20 isolation: what is actually true today

AF-D20 requires that test accounts must not affect real reputation, statistics, ranking, billing or
production notifications. Live state on 2026-09-17:

| Subsystem | Live reading | Isolation today |
| --- | --- | --- |
| billing | no billing subsystem exists in the schema | **structural**: there is nothing to affect |
| reputation | `private.agreement_reviews` 0 rows; 0 profiles carry a rating | **incidental**: the tables exist and are simply empty |
| ranking and opportunity delivery | 16 dispatch rounds executed, `opportunity_deliveries` 0 rows | **incidental** |
| production notifications | one Android push device registered, for `uskocibusiness`, `active = false`; `notification_push_attempts` 0 rows ever | **incidental**, and the inactive flag is doing the work |
| marketplace visibility | needs by status: 4 PUBLISHED, 2 ACTIVE, 2 DRAFT | **incidental**: published test needs are visible to every account on the project |

**This is the honest finding, and it is a real one: test accounts are not structurally isolated.**
They are harmless today only because canonical DEV has no real users and those tables are empty. If
a real account were ever created on this project, the four published `adversarial` needs would be
visible to it, and nothing in the engine would stop a test account from accumulating reputation or
receiving a dispatch. AF-D20 is satisfied in effect, not by design.

Recording that distinction is the point of this package. It does not mean the engine is wrong: DEV
is not production, and AF-D26 keeps production a separate project behind a separate gate.

## What this package will and will not do

**Will**: add a lineage registry as a source candidate, so that every account on a non-production
project carries a recorded, operator-set class with a reason and an append-only history; prove it on
a disposable database; and record the census above as evidence.

**Will not**: change reputation, ranking, dispatch, notification or any other domain behaviour.
Making the engine *enforce* isolation is a different and larger change that would touch the verified
engine, and the gap for it has only just been proven here. It is named as a finding for the owner,
not slipped into this package.

**Will not**: delete, rewrite or reassign a single existing DEV row. The `adversarial` accounts and
their agreements stay exactly as they are. Classifying data is not the same as cleaning it, and
cleanup belongs to PKG-023 where the owner already placed it.

**Will not, at the time this census was written**: apply anything to canonical DEV. The SQL landed
in `supabase/candidates/`, outside `supabase/migrations/`, awaiting its own owner-authorized batch.

**Update, 2026-09-17:** the owner authorized exactly that batch, as a minimal and isolated PKG-015
promotion. The plan, the discovered constraint that forced the route taken, the preflight and the
readback are in `PKG015_PROMOTION_PLAN_20260917.md`.

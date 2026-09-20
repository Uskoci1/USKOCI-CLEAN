# Executable Q&A policy candidate

`PRESELECTION_QA_EXECUTABLE_POLICY.json` translates the existing public Q&A contract, OC-006 and owner decisions AF-D11/AF-D12. It adds no provider, privacy, numeric or retention decision. Numeric rules remain canonical SQL134 authority. Unsafe content is evaluated under the supplied active D-0140 Task policy; Task completeness rules do not turn a question into a new listing.

Sources:

- `docs/authority/sources/owner-history/01_CURRENT_CANON/PUBLIC_PRESELECTION_QA_CONTRACT.md`, sections 1 and 4–6.
- `docs/authority/sources/owner-history/01_CURRENT_CANON/OWNER_IMPLEMENTATION_CLOSURE_2026-09-03.md`, OC-006.
- `docs/implementation/v5-ai-first/QA_POLICY_PROPOSAL.md`, current AF-D11 and AF-D12 decisions.
- The active reviewed `RS_PUBLICATION_POLICY_MINIMUM` executable policy, bound by SQL125. Its exact document is part of every classification source hash.

Run `node scripts/render-qa-policy-bundle.mjs` from the repository root to print the candidate SQL for review. The renderer has no database connection or deployment action. The printed transaction inserts only an **inactive, unreviewed** `PRESELECTION_QA_V1 / RS / 1` bundle. An existing identity causes an error; it never overwrites an existing reviewed policy.

The bundle records the artifact SHA256 and per-rule sources. PostgreSQL assembles rules in `rule_id` order and computes `evaluatorContentSha256` from canonical `jsonb::text`, matching the existing W05 policy reader. The postcondition checks the exact executable document and verifies that the bundle is still not ready for production.

Root review and any later owner-approved concrete live batch must bind the resulting document and review record before setting reviewed/active flags. The renderer neither performs nor implies that activation. The Q&A Edge additionally requires the existing approved Gemini configuration, shared paid-test gate, admitted test account, remaining internal test budget, and `USKOCI_QA_CLASSIFIER_ENABLED=true`.

SQL135 stores only command identity, hashes, bounded classification metadata and the canonical receipt. It does not store proposed text or the provider response. The approved public proposal and relevant public Task are transient provider input; the canonical RU4B writer stores accepted question/answer text. Read recovery never invokes the provider. Expired or unknown dispatched work is never automatically retried. Explicit cancellation fences late completion and submission under the same command locks, while an already committed canonical receipt wins.

Validation: the actual SQL proof installs the same candidate, confirms it is inactive, and explicitly activates it only in the disposable database. It deactivates that fixture afterward. Its latest-handler journey uses real local Auth, SQL, budget and canonical Q&A RPCs, with only the Gemini response synthesized. Unit transports and the actual SQL proof are labelled separately; neither is a live provider or Android device proof.

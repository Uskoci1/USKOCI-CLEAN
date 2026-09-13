# V5 own-account export projection

136 preserves the existing export request, private artifact ledger, physical Storage verification, download grant and cleanup workers. It replaces only the compiled dataset catalog, owned JSON projection and reviewed delivery binding. No policy, Privacy text, retention duration, export lifetime or scheduler is activated.

The prior 18-dataset projection covered 14 classes. SQL120 added the required `AGREEMENT_REVIEWS` class, so an old delivery binding cannot cover the current class inventory. The new projection has **37 datasets across all 15 required classes**. Its binding requires `USKOCI_EXPORT_DELIVERY_V2`, `OWN_ACCOUNT_V5_1` and the SHA-256 of the current compiled catalog, projection and nested sanitizers. Old bindings, missing datasets/classes, unknown fields and changed source remain unavailable until a reviewed binding explicitly covers them.

Existing datasets retained: account, profiles, availability windows/rules, calendar, owned Tasks and private Task location, own responses, own questions/answers, agreements, own agreement messages, legal acceptance, notifications, owned AI messages, Storage media metadata, export requests and own audit metadata.

New explicit projections:

| Datasets | Ownership and exported scope |
| --- | --- |
| ownAgreementReviews | Only ratings/tags authored by the account on an agreement in which it participates; no incoming review or reciprocal completion status. |
| ownSafetyReports, ownBlocks | Account-authored report text/status and outgoing block records. No counterparty profile, incoming report or incoming block. |
| workerAiDrafts, workerAiReviews | Owned conversation and account must agree. Only typed profile, skills/tools/licences/vehicles, coarse location, availability and review metadata. |
| taskAiFacts, taskAiReviews | Owned parent conversation. Fixed NEED_FACT_V2 keys and typed values; geography/points use explicit fields. No provider origin, evidence, source hash or arbitrary envelope properties. |
| workerAiTurns, workerAiSaves, taskReviewCommands, taskAiTurns | Opaque record references, state and timestamps. No request hashes, provider attempts, budgets or unfiltered receipts. |
| qaClassifications, qaCommands | Owned classification/command metadata and canonical outcome. No proposed text archive, classifier hashes, provider provenance or request key. Own accepted Q&A text remains in existing datasets. |
| ownedMediaAssets | Owned asset state, selection, context references, dimensions and byte count; `bytesIncluded: false`. No original input, audio, pixels, input hash or upload capability. |
| testAdmission, testAllocations | Account-specific admission timestamps and conservative allocation amount/type/time. Explicitly not measured provider charges. No global budget totals, reservation capability or operation key. |
| closureRequests, closureExecution, closureActions | Own request/action state, timestamps and terminal evidence codes. No raw binding, download grants, object paths or internal receipts. |

Every INCLUDE entry selects from a fixed field list; EXCLUDE requires a reviewed reason code. The account ID and explicit `bytesIncluded` marker cannot be omitted from their required projections. Nested JSON is reconstructed from typed, fixed keys, including rejection of unknown fact keys and non-scalar values in scalar fields.

This is an explicitly reviewed JSON projection, not a claim that every internal database field or binary object is included. Records retained for internal security, private counterpart data and original audio/pixels are outside it. The file itself lists reviewed omissions and per-dataset counts.

Verification source: `v5_owned_export_proof.mjs` requires exact committed136 after135 on the disposable Auth/PostgreSQL/Storage stack. It checks two accounts, own-authored versus peer reviews, cross-account parent references, hostile nested extras, reviewed INCLUDE/EXCLUDE, class/catalog/source drift and grants, then uses the actual existing worker and download handlers. Its policy and Privacy entries are synthetic test data; predecessor pointers are restored in `finally`. Node syntax verification is separate from actual database compilation and execution.

## Measured materialization correction, awaiting actual-function verification

Run34736927496 at dc0f08a confirmed an actual snapshot timeout of20001ms after
its binding and catalog checks passed. A SHA-bound read-only copy of the exact
body also timed out. Changing only `owned_rows` to `AS MATERIALIZED` in that copy
completed in278ms and passed all existing owned/nested-allowlist assertions.
A separate actual-function call with session-local jit=off still timed out.
The two EXPLAIN costs were3412.49 and3420.65, so the correction is not justified
by an asserted lower planner cost or an assumed JIT cause.

The undeployed136 candidate now computes the owned JSON rows once before their
per-field projection. All ownership filters, fields, policies, grants, function
volatility/search path and timeouts are byte-unchanged. Its new SHA256 is
43f42b801e4bb06245aac6e5dd42c719ba808d88dce57357ffd8b8b1c2efadb6. Live history
still ends at108; no applied live migration or previous source commit was edited.
The full original136 is preserved in the proof fixture136_before_materialization.sql
with SHA25673e5f3b0fab4fd8ca096ca3ef75a49054e06b1cc3583950b2f9223759dea7dad.
The historical diagnostic helper rejects the new bytes before supplemental SQL;
its old plan/hash cannot be silently attributed to the corrected function.

Successor137/138/139/141 extend the same function body and retain this CTE marker;
140 does not replace the export projection. Source review and focused tests
support this narrow candidate, but actual136 handler/Storage and137–141 execution
are still required. The successful diagnostic copy is not marked as a PASS of
the corrected SECURITY DEFINER function or as exact content parity across separate
MVCC snapshots.

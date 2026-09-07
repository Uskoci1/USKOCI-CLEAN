# AI mobile input, human review and saved-draft read — 2026-09-07

## Scope and status

IMPLEMENTED / SOURCE TESTED in the isolated `fix/ai-vertical-recovery-20260907` worktree, based on PR49 source `29271e6be7fc519e40941531d37c6d48b0db7ef3`. This checkpoint is **not canonical, live, native acceptance or actual-provider proof**. The current UI is a functional scaffold; future Figma work owns final visual design.

The unit repairs the existing R02 `nova` → R07 `pregled-nacrta` → owner Need DRAFT → `potrebe/[id]/pregled` path. It uses the existing Supabase project/backend and existing RPC/Edge command names. It adds no migration, provider call, privileged secret, EAS environment mutation or feature activation.

Dependency: the separately reviewed AI server authority unit adds authoritative `review.safety` and refuses new DRAFT save on latest persisted BLOCK. The strict mobile DTO requires that server contract; missing/invalid safety fails closed. Do not run this source against an old review DTO and label the resulting failure a provider failure. Server promotion and its proof are separate owner work.

Relative-date interpretation is server-owned. The separate Edge context unit supplies the server time and Europe/Belgrade reference and preserves recent interview history; its source/proof/deployment are not part of this mobile result. This card only formats the timestamps that were actually confirmed and materialized.

## Behavior

- One focus-owned controller captures the actor/accountRevision, input, conversation and operation generation. It synchronously serializes send/confirm/correct/save. Late reads/results cannot publish after account transition, ABA, route change or blur. Token refresh does not destroy the draft.
- Known Edge status/code refusals that occur before provider/persistence keep a fixed safe message and machine code, clear the uncertain-send latch, and retain editable input for manual retry. These include exact503/`AI_PROVIDER_NOT_CONFIGURED`,400/message/identity validation,401/auth,404/conversation,500/config/identity and502/conversation-context reads. Wrong status/code combinations, malformed success, transport failure and `AI_TURN_PERSIST_FAILED` remain unknown.
- Unknown Edge sends are not automatically replayed. The text stays visible/selectable in this mounted controller; explicit refresh reads current persisted history. A new matching owner message is described only as **observed matching text**, never as a deduplicated command receipt. After the owner reviews it, explicit continuation clears the latch. Without such an observation, retrying the non-idempotent turn remains blocked; Back and copy remain available.
- Confirm/correct/save always perform a fresh typed review before command dispatch. Fresh BLOCK, missing/superseded facts or read failure disable the operation. One local correction cannot race Save. Inline correction starts from the typed value; one item per line preserves commas inside array entries. Timestamp correction requires an explicit ISO offset/Z and a real calendar day; it never guesses the device timezone or silently normalizes30 February to another day.
- The human-review completeness gate exposes every unconfirmed proposal, including optional vehicle/requirements, and requires explicit confirmation/correction. It never blanket-confirms or silently omits those proposals. This is client review completeness; the server alone owns required fields, admission, safety and materialization.
- Save holds one client request key for its confirmed-fact snapshot across an uncertain result and retries only that key. A changed snapshot blocks key reuse. A fresh bound Need receipt opens the existing saved draft.
- The actual Need read contract includes public topology, schedule kind/start/end, category, people, price mode/amount, every requirement, critical conditions and public-photo count. The temporary card displays both route endpoints/waypoints, full fixed timestamps in Europe/Belgrade, REMOTE, OFFERS and all persisted requirements. Relative schedule labels retain the original conversation wording instead of rebasing “tomorrow” to the device's current day. It never reconstructs missing route facts, exposes `need_sensitive`, presents a fake photo viewer, or offers applications on an unpublished draft.
- Loading/failure/unavailable/success, retry and Back are explicit. The initial AI facts and history share a scroll surface; composer and Back remain outside it. Fact actions have distinct screen-reader labels.

## Architecture and authority review

| Layer | Ownership |
| --- | --- |
| `nova.tsx`, `pregled-nacrta.tsx` | Presentation, input/edit formatting, safe navigation and human action wiring |
| `useAiNeedFlow.ts` | Focus/AppState/accountRevision binding |
| `aiNeedFlow.ts` | Local serialization, immutable captures, freshness, unknown-outcome recovery and review completeness |
| `contracts/aiNeedV2.ts` | Typed read/command/context/error DTO |
| `aiNeedV2Production.ts` | SDK owner, authenticated actor check, narrow Edge/RPC calls, strict projection and fixed safe errors |
| `needClientService.ts` / `needDisplayProjection.ts` | Existing canonical read boundary and public persisted-field formatting |
| Existing server | Authentication/RLS, safety, required facts, idempotent DRAFT command, confirmed-fact materialization, business rules |

The AST scan inspected65 client source files including25 presentation files with0 findings. It checks raw presentation SDK/network access and privileged client secret references; it is a bounded static check, not proof of every business invariant. The inspected screen code contains no direct Supabase write or AI provider secret. Public Firebase identity is unrelated to AI provider credentials; no Firebase change belongs to this unit.

## Verification observed locally

- Full Jest at the final reviewed mobile source: **50 suites /379 tests PASS**. The66 added tests comprise16 controller,24 production-port,12 actual route/hook,12 persisted-field read/correction and2 explicit-zone/valid-calendar timestamp cases. The earlier374 run preceded the last5 tests.
- TypeScript: `npx tsc --noEmit` PASS.
- Migration integrity:85 source / live snapshot85 / pending0 PASS. This is local source integrity, not a new live read.
- `git diff --check` PASS.
- `scripts/audit_client_architecture.cjs`: STATIC_BOUNDARY_PASS; fingerprints in `evidence/ai-vertical-20260907/client-boundary.json`.

Tests include double tap, retained unknown/known503 input, malformed DTO, stale auth/read/save, account ABA, focus generation, correction→save serialization, optional vehicle confirmation, latest BLOCK refusal, stable-key retry, route A→B, read error/retry/Back, fixed schedule/route/REMOTE/people/OFFERS/all requirements, and no private-field projection. Read tests inject query replies at the real client adapter; they do not pretend to be a database materialization proof.

## Explicit remaining boundaries

1. Existing Edge turn has no durable client request ID or server dedup receipt. Unknown-send state and the save intent key are memory-held for this controller lifetime, not durable across route unmount/app restart. Do not claim end-to-end exactly-once AI turns.
2. Existing save RPC has no expected review hash/revision parameter. Local serialization plus fresh read does **not** atomically prevent another device changing confirmed facts between review read and save. The server uses its own current snapshot. Cross-device review-to-save CAS is a separate server contract gap; current proof is a single owned session with exact post-save field inspection.
3. No whole-product, RU4 command-idempotency, publish/editor, final design or actual-provider success is claimed. Existing non-DRAFT remaining-search behavior only gains local stale-context/double-tap guards in the touched card route.
4. A native disposable human-review proof is prepared in this branch and independently reviewed, preserving all27 original Auth/Inbox/account checkpoints;48 Python and23 Node harness checks pass. It applies only the exact reviewed21141-byte two-RPC candidate to historical79+N02/N03, without fabricating migration history. This is not a full canonical DB replay. Fixture service-writer proposals prove native human confirmation/correction and DRAFT/read behavior, **not model inference**. Exact native artifacts and actual-provider proof remain pending.
5. Actual user input, address and provider credentials must not enter GitHub fixtures, repository evidence or this document.

No source from an older build, duplicate backend, production fixture or fake feature is introduced.

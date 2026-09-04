# USKOČI — CURRENT IMPLEMENTATION HANDOFF

Checkpoint: 2026-09-04T05:51:50Z

## Canonical identity

- Repo: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- RU-2 canonical source promotion head: `47ce475030cc1ab5908f014d6d7398a0e2cb7754`
- Supabase project: `leqcwgzvjsxugfgzdmth`
- Production migration state: `60 / 20260903222333_clean_ru2_ai_fact_transition_guard`
- Edge: `uskoci-ai-interview` ACTIVE v5, `verify_jwt=true`, EZBR SHA-256 `5003809f31681eb396713ffc66a1adf979d62a39312dcb833ead67df180954ca`

## Last fully completed unit

`RU-2 — Need V2 + R02/R07 canonical DRAFT`

State: `CLOSED`

Canonical source migrations:
- `20260903190000_clean_ru2_need_v2_draft.sql` — MD5 `f95fadda53d8d803faac4498d860c31b`
- `20260903190100_clean_ru2_ai_fact_transition_guard.sql` — MD5 `95145c601b6366f1a98e8566b3307515`

Live Supabase aliases:
- source `20260903190000` -> live `20260903222139_clean_ru2_need_v2_draft`; 1 statement; 47143 UTF-8 bytes; MD5 `f95fadda53d8d803faac4498d860c31b`; exact byte identity `true`
- source `20260903190100` -> live `20260903222333_clean_ru2_ai_fact_transition_guard`; 1 statement; 9438 UTF-8 bytes; MD5 `95145c601b6366f1a98e8566b3307515`; exact byte identity `true`

## RU-2 contract now live

`R02 AI conversation -> R07 Human Review -> canonical DRAFT`

- 20-key server-owned typed Need fact registry is live.
- AI V2 turn persistence is service-role only; authenticated/anon cannot execute it.
- Owner typed correction and Human Review are live.
- `rpc_save_need_draft_from_review` materializes an idempotent owner DRAFT only.
- Exact/private address/access remains separate from public/coarse task geography.
- Authenticated direct write to `need_sensitive` is revoked.
- AI fact transition guard has no ambient `uskoci.ai_mutation` bypass; it explicitly permits only owner confirmation, owner/service supersession and one-time owner V2 NULL->DRAFT Need binding.
- Legacy conversations/facts remain classified `LEGACY_TEXT_V1`.
- Legacy AI publish remains fail-closed (`PACKAGE_4_NOT_READY`). RU-2 does not authorize public publish/admission.

## Proof

- Combined disposable DB + Edge + RN run `33806989549`: PASS, including owner/attacker/service, Human Review, DRAFT idempotency, privacy, repeated-key supersession, zero residue, TypeScript, Deno and Jest.
- Promotion integrity run `33811732899`: PASS — MD5/provenance + TS + Deno + Jest + draft-only source contract.
- Canonical PRE-P4 run `33812075892` on source head `47ce475030cc1ab5908f014d6d7398a0e2cb7754`: PASS.
- Fresh production preflight before write matched exactly `58 / 20260903184545`, Edge v4 and preserved row fingerprints.
- Live DB post-apply: `60 / 20260903222333`, registry 20, grants/guards correct, business rows preserved: AI facts 82, conversations 15, Needs 6, profiles 6.
- Live Edge v5: ACTIVE, `verify_jwt=true`, deployed from the Deno-proven canonical v5 source plus `src/contracts/needFactsV2.ts`.

## Closed units — DO NOT REDO

- Edge source reconciliation: DONE
- RU-0 Authority Closure: CLOSED — live `20260903160812_clean_ru0_authority_closure`
- RU-1 Worker Readiness: CLOSED — live `20260903184545_clean_ru1_worker_readiness`
- RU-2 Need V2 + R02/R07 DRAFT: CLOSED — live head `20260903222333_clean_ru2_ai_fact_transition_guard`, Edge v5

Quarantine remains quarantine: `repair/ru0-ru1-backend-20260902` — no merge/cherry-pick/apply.

## Next allowed action

Fresh read-only GitHub/Supabase preflight against this checkpoint. If physical state matches `60 / 20260903222333` and Edge v5, read the governing master for the next dependency-ordered implementation unit. Do not infer publish/admission semantics from RU-2 and do not reapply RU-0/RU-1/RU-2.

Continuity rule:
`READ MASTER -> HANDOFF -> LIVE NETWORK -> LEDGER -> LIVE MIGRATION STATE -> FRESH PHYSICAL READ -> CONTINUE OR RECONCILE`

**AI agent is replaceable. Canonical project state is not.**

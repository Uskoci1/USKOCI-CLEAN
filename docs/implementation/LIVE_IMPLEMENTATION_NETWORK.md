# USKOČI — LIVE IMPLEMENTATION NETWORK

Last updated: 2026-09-04T05:51:50Z
Authority: governing master + fresh physical GitHub/Supabase reads

## Canonical physical baseline

- Repository: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- Canonical source promotion head: `47ce475030cc1ab5908f014d6d7398a0e2cb7754`
- Supabase: `leqcwgzvjsxugfgzdmth`
- Live migrations: `60`
- Live head: `20260903222333_clean_ru2_ai_fact_transition_guard`
- Edge: `uskoci-ai-interview` ACTIVE v5, `verify_jwt=true`, EZBR `5003809f31681eb396713ffc66a1adf979d62a39312dcb833ead67df180954ca`

## Closed dependency chain

`RU-0 Authority Closure -> RU-1 Worker Readiness -> RU-2 Need V2 + R02/R07 canonical DRAFT`

RU-0: CLOSED, do not reapply. Live `20260903160812_clean_ru0_authority_closure`.

RU-1: CLOSED, do not reapply. Live `20260903184545_clean_ru1_worker_readiness`.

RU-2: CLOSED.

RU-2 network:
`authenticated R02 -> V2 conversation -> Edge v5 provider-neutral extraction -> service-only typed writer -> owner confirmation/correction -> R07 Human Review -> idempotent server materializer -> DRAFT -> canonical reread`

RU-2 live invariants:
- fact registry 20;
- V2 service writer executable only by service_role;
- owner opener/review/correct/save RPCs exposed narrowly;
- direct authenticated `ai_structured_facts` UPDATE false;
- private guard API execute false;
- no ambient `uskoci.ai_mutation` bypass;
- exact/private Need mutation server-owned;
- existing 82 facts + 15 conversations + 6 Needs + 6 profiles preserved;
- all preexisting AI facts/conversations remain `LEGACY_TEXT_V1`;
- public publish/admission remains fail-closed for the next governing unit.

Live migration aliases:
- `20260903190000` -> `20260903222139` `clean_ru2_need_v2_draft`, MD5 `f95fadda53d8d803faac4498d860c31b`, 47143 bytes, exact-byte `true`.
- `20260903190100` -> `20260903222333` `clean_ru2_ai_fact_transition_guard`, MD5 `95145c601b6366f1a98e8566b3307515`, 9438 bytes, exact-byte `true`.

Proof chain:
- combined disposable run `33806989549`: PASS;
- promotion integrity `33811732899`: PASS;
- canonical PRE-P4 `33812075892`: PASS;
- fresh production preflight: PASS;
- live structural post-apply: PASS;
- Edge v5 ACTIVE/verify_jwt=true: PASS.

## Next allowed action

Fresh read-only physical preflight. If state remains `60 / 20260903222333` + Edge v5, read governing master and begin the next dependency-ordered unit. Do not reopen RU-0/RU-1/RU-2.

Principle: **AI agent is replaceable. Canonical project state is not.**

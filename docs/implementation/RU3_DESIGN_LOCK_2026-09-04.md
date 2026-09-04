# USKOČI — RU-3 ADMISSION/PUBLISH DESIGN LOCK — 2026-09-04

State: PROOF_BRANCH_ONLY / PRODUCTION_POLICY_ACTIVATION_BLOCKED

Canonical predecessor:
- GitHub `clean-alpha-backend` @ `60afa008e5608a4479b06817eb7f78ecb7f4b015`
- Supabase `leqcwgzvjsxugfgzdmth`
- live migrations `60 / 20260903222333_clean_ru2_ai_fact_transition_guard`
- Edge `uskoci-ai-interview` ACTIVE v5, verify_jwt=true

Governing contract:
- RU-3 is the D-0140 admission/publish unit after RU-2.
- Final outcomes are `ALLOW / CLARIFY / REVIEW / BLOCK`.
- Model memory/output is not normative authority.
- A publish decision binds exact Need ID + revision + canonical fingerprint + current reviewed policy bundle.
- `REVIEW`, `CLARIFY`, `BLOCK`, missing policy, stale decision, stale fingerprint, unknown/unreviewed policy all fail closed.
- Existing PUBLISHED/ACTIVE Needs are not rewritten or automatically unpublished.
- Canonical publish is owner command + exact ALLOW + semantic idempotency; ordinary legacy publishers remain retired.

Critical NO-GO:
- The governing package does not contain a production-reviewed Serbian rule bundle that may be activated as legal/safety authority.
- Therefore this unit may build and prove fail-closed infrastructure, but MUST NOT seed or activate substantive ALLOW/BLOCK/CLARIFY legal rules in production.
- No source migration may contain invented legal categories, permissions, licence rules, exceptions or Serbia-specific normative content.

Infrastructure target:
1. migration-owned versioned policy bundle/rule metadata; no client/service raw mutation and no production seed;
2. canonical private Need publication fingerprint including public Need content/geography/conditions/media and a non-public hash marker for exact/private access facts;
3. append-only service-only publication decision ledger with rule references constrained to the active reviewed bundle;
4. owner-safe publication-state projection exposing outcome/reason codes only, never internal rule payload/reasoning;
5. owner canonical publish command requiring current DRAFT/revision + exact fingerprint + latest exact ALLOW under the current ACTIVE reviewed bundle;
6. semantic idempotency receipt and existing Need lifecycle/dispatch trigger reuse;
7. legacy `rpc_publish_need` and `rpc_ai_publish_need` remain non-authoritative/retired.

Proof strategy:
- Disposable/local DB only.
- Production migration itself contains zero active policy rows.
- Runtime proof may insert an explicitly `TEST_ONLY` reviewed bundle/rule inside one rollback-only transaction solely to prove the machinery.
- Prove owner/attacker/service, no-bundle REVIEW, stale fingerprint denial, REVIEW/BLOCK denial, exact ALLOW publish, decision/publish idempotency, dispatch enqueue and zero residue.

Production boundary:
- Do not live-apply RU-3 until the deployment gate is reconciled with actual reviewed D-0140 policy content or an explicit owner-approved partial infrastructure deployment plan that remains incapable of ALLOW.

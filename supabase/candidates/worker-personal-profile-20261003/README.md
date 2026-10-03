# WPP01 — personal worker profile, per-offer people

Status: authored locally; offline generation, SQL/PLpgSQL grammar and JavaScript syntax checks pass. **No database execution proof or DEV application has been performed by this package's author.** The manual workflow produces execution evidence against its exact Git source. A green source check is not database acceptance.

## Behavior

The worker profile represents one person. A response can commit multiple people for that particular task without requiring a permanent team size on the profile. This candidate removes the profile-capacity comparison from submission, selection, stale-response reconfirmation and both paged/unpaged candidate-state helpers. It retains the offered `covered_slots`, immutable application snapshots, task remaining-slot checks, positive-slot validation, database 1–50 constraints, calendar checks, profile readiness, ownership, version checks, price authority and idempotency.

Licenses no longer block either the detailed matching function or the cheap dispatch prefilter. They no longer affect the detailed resource score. Tools, vehicles, work skills, experience, identity requirements, exclusions, availability, location/radius and preferences remain governed by their existing functions. This package does not send a push or start dispatch.

The AI review save no longer writes `licenses` or invokes the permanent-capacity writer. Existing stored values, old snapshots and schema remain intact. New profile insertion uses the existing defaults. The exact nine-key `WORKER_PROFILE_V1` document remains wire-compatible: `licenses` and `teamCapacity` remain present in existing read/review documents.

An unsaved legacy review that requests any change to these two retired fields is refused with `WORKER_AI_STALE` / `PT409` before any canonical write. The reviewed values are compared with the locked current profile, including license order, rather than silently dropping reviewed changes. A legacy review whose retired values are unchanged can save the other fields. An already successful save still returns its original receipt, even after later canonical changes. The original source hash includes the full profile, location, availability and capacity documents; it remains unchanged in this package, so a concurrent canonical change invalidates an unsaved review.

Client/Edge rollout must stop asking for or patching retired fields. Old unsaved drafts that changed those values must be abandoned and reopened from current canonical data; replaying the same stale save cannot succeed. Historical successful receipts stay recoverable.

## Exact boundaries

`live-functions.json` contains read-only metadata captured from canonical DEV `leqcwgzvjsxugfgzdmth`: twelve function definitions/bodies, no user rows. `body.diff` is the complete intended body delta. `manifest.json` records exact before/after MD5 values for the eight changed functions, four unchanged dependency pins and generated-file SHA256 values.

| Function | Change |
| --- | --- |
| `public.rpc_submit_response` | Remove personal-profile capacity comparison |
| `public.rpc_select_response` | Remove personal-profile capacity comparison |
| `public.rpc_resolve_stale_response_after_need_edit` | Remove capacity comparison for KEEP/UPDATE |
| `private.need_candidate_states_v5(uuid)` | Remove profile-capacity stale classification |
| `private.need_candidate_states_v5(uuid,uuid[])` | Same change for paged candidate projection |
| `private.match_detail_without_calendar` | Remove license gate and license contribution to resources |
| `private.dispatch_cheap_candidate_admitted` | Remove license gate |
| `public.rpc_save_worker_ai_review` | Refuse retired-field changes, preserve historical values, stop retired-field writes |

There are no table, column, constraint, RLS, trigger, ACL, grant, retention-program or certificate changes, and no stored-data cleanup. Four further bodies are pinned: price assertion, AI source, AI source hash and AI prepare review. Every target is replaced in place using its exact current definition, with unchanged OID, all `pg_proc` metadata except `prosrc`, and comment.

`candidate.sql` is one transaction. It checks ready closure/erasure certificates and the erasure-program digest before and after, exact predecessor and payload MD5 values, unique body anchors and unchanged function metadata. Any difference aborts the entire transaction. None of the eight bodies belongs to the current closure source/program digest or a table trigger. Therefore the intended candidate is certificate-neutral; the transaction proves this for the actual admitted target. It does not rebind a certificate to make a mismatch pass.

`revert.sql` is the exact inverse and admits only this package's exact postimages. It restores function behavior, not data created while the new behavior was active. Reverting after accepting multi-person offers on a capacity-one profile can make those offers fail the old capacity gate; assess that operational consequence before a later revert. Use a serialized deployment window; calls already in flight can finish using an old function body.

Forward candidate SHA256: `a685f8867a9e94f0333b61d239950ed6fab1f410e934cc7e35fc56db04f17008`.

Revert SHA256: `b2bb4427fd31f4202bdf9f0cf7746168c68ec4e2447ab12bb28abd5765ddbebc`.

## Reproducible proof

Offline, from the repository root:

```sh
python -m pip install pglast==8.4
python supabase/candidates/worker-personal-profile-20261003/check-source.py
node --check supabase/candidates/worker-personal-profile-20261003/prepare-chain.mjs
node --check supabase/candidates/worker-personal-profile-20261003/runtime.proof.mjs
```

The generator uses unique anchored edits, not a global deletion. `--check` compares generated bytes. The grammar check parses candidate/revert SQL, DO bodies, function bodies and SQL fixtures. For standalone parsing only, project composite row declarations are replaced with `record`, since that parser has no database catalog. Only database execution validates actual types and contracts.

The manual `.github/workflows/worker-personal-profile-proof.yml` reuses the existing disposable live79 + source147 → PKG050 chain, followed by exact EX04d, EX06a and EX06b candidates. `prepare-chain.mjs` requires all twelve relevant bodies to match the captured DEV bodies; it permits only a byte-exact older body whose quoted `PT409` conflicts are still `40001`, converting precisely those literals while preserving metadata and closure digests. No other drift is repaired or ignored. **This is bounded relevant-body fidelity, not overall equivalence to current DEV.** The source SHA and tree, exact relevant-body admission and each result are emitted as bounded artifacts.

`runtime.proof.mjs` uses the established loopback-only adapter. It creates synthetic Auth users and published-task fixtures, then exercises real authenticated PostgREST RPCs. It checks:

- A wrong last-function preimage aborts all eight replacements without catalog/certificate changes.
- The real AI open/patch/prepare/save path preserves unchanged retired keys, rejects changed retired keys before partial writes, invalidates an unsaved review after a canonical tool edit, and retains exact historical receipt replay.
- Only the eight bodies change; all function metadata and certificates remain unchanged.
- A profile with stored capacity one submits and is selected for three people, while its historical snapshot truthfully keeps capacity one and offered slots three.
- Four offered places on a three-place task and zero places are refused.
- Paged/unpaged candidate documents agree for SELECTABLE and OVERFILL, and selection refuses an otherwise valid three-person offer after another person was selected; covered slots stay at one.
- TOTAL/PER_PERSON price authority remains unchanged.
- A license mismatch no longer blocks either matcher; missing tools/vehicles still block both.
- Stale response KEEP and UPDATE accept per-offer people after a synthetic need revision.
- Exact revert restores the complete function catalog and ready certificates.

The AI consistency proof is a rollback-only SQL-role proof with local JWT claims; it does not call an AI provider. Its candidate, synthetic rows and temporary helpers all roll back before the Auth/PostgREST proof starts. Actual RPC execution creates only disposable rows. Every workflow outcome discards the entire temporary stack. No real profile, device, push transport, billing provider or DEV write is accessed. Neither throughput nor simultaneous-selection stress is claimed by this focused proof; the existing task-row lock and overfill check are preserved and the changed-capacity/remaining-slot behavior is exercised.

## Deliberately remaining work

This is not a complete profile contract version migration. The old direct capacity RPC and legacy wire fields remain for API compatibility; UI/Edge must retire their use. Removing columns, old source/read fields or old APIs would require a separate coordinated migration with closure and old-client implications. No historical profile value is fabricated or deleted here.

Desired work vs. excluded work, a user-writable exclusion flow, nuanced urgent-job preferences, preference review/source hashing and their AI tools need a separate reviewed contract. Current matching already reads exclusions and push preferences, but the AI source hash does not include the proactive/urgent preference document. This candidate does not pretend those interview-to-dispatch gaps are closed. Full app visuals, phone behavior, provider quality and real push delivery are outside this package's proof.

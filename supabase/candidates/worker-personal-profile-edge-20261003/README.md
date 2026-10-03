# Personal worker profile — minimal Edge candidate

**PREPARED, NOT APPLIED.** This package contains no SQL, secret, provider, budget or deployment mutation. It has not called a live model. It does not certify conversation quality or native acceptance.

The predecessor is the root agent's exact readback of canonical DEV `leqcwgzvjsxugfgzdmth`: worker interview **v17**, task interview **v51**, both `verify_jwt=true`, no import map. `MANIFEST.json` pins every before/after file. `before-bundle.json` is each function's complete rollback bundle; `after-bundle.json` is its complete candidate. Keep the worker and task bundles separate: their live `geminiTaskStream.ts` copies differ and each is preserved byte-for-byte.

Only entrypoints change. `prepare.py` transplants exactly the normalized source hunks from `4081d682^..4081d682`, preserving untouched live bytes and line endings. There were no context conflicts. `ENTRY.diff` files expose the entire delta. All dependencies remain exact live bytes, including the full readable NEED_FACT_V2 registry and task location helper.

- Worker: one personal profile, contextual task/tool/vehicle/area/availability interview; no license or permanent team-capacity input or proposal; the old V1 document remains readable.
- Task: new license requirements are omitted from provider schema/context/registry and rejected in output. Historical license facts remain readable in the claim contract, then are filtered before inference.
- Claim ownership, budget admission, dispatch, cancellation, completion, recovery, calendars, location, provider/model selection and JWT verification are unchanged.

## Deliberately excluded

The repository's AI-availability diagnostic is still a separate unapplied package (`docs/implementation/ui-ux-pass-20261002/AI_AVAILABILITY_UNAPPLIED_20261002.md`). These bundles contain **no** `aiAvailability.ts`, `GeminiCreditsUnavailableError`, new diagnostics headers or HTTP-402 behavior. New APKs continue to receive the existing generic errors. Do not deploy the current full repository entrypoints in place of these frozen bundles if only this personal-profile package is intended.

## Synthetic verification

Run from repository root:

```powershell
python -X utf8 supabase/candidates/worker-personal-profile-edge-20261003/verify.py
node --test supabase/candidates/worker-personal-profile-edge-20261003/proof/worker.candidate.test.mjs supabase/candidates/worker-personal-profile-edge-20261003/proof/task.candidate.test.mjs
```

The exact candidate worker bundle passed **30 tests** and task bundle **81 tests**: **111/111**. The test harnesses come from commit4081d682 and redirect their loader to these frozen bundles. The worker harness removes evaluation of the absent diagnostic module. The task harness excludes only the typed-402-specific source assertion introduced for the unapplied diagnostic; the original closed failure-list/log-safety assertions still run. No functional license/personal-profile tests are skipped. Transport, Auth, SQL and provider responses are synthetic; this is not live end-to-end evidence.

## Integration conditions

Coordinate with the reviewed personal-profile SQL candidate and compatible APK. Removing questions must not leave license matching or permanent capacity gates active, and a save must not write hidden legacy review values. Preserve all slot-count/offer/Agreement rules and old documents. These dependencies are not included in this Edge-only package.

Before any application, read the two live functions again and compare every file against the pinned before hashes; version-only matching is insufficient. Any difference requires review rather than overwriting it. After application, read both complete bundles back and compare exact after hashes plus JWT/config. Rollback, if needed, uses each exact `before-bundle.json`, without reverting unrelated SQL or location work. Root remains the sole live writer and decides whether the existing owner authorization covers this exact package.

# Round40 — P5 ready task surface and matching truth

Date: 2026-09-28. Production/UI source introduced at `5cafcde35040e10c9d1344f5dc4b0d297ec3604f`; regression-alignment and workflow history through `830f0c40f3c11dfc559d10915329d1379ec3e45f`. GitHub Actions run [36420684845](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36420684845).

## User-facing decision

The AI task conversation keeps a compact collapsible draft while information is still being collected. When the current authoritative conversation has no visible/hidden/map-point gap and can enter the explicit review path, it no longer looks like an unfinished "Nacrt":

- status becomes **Spremno za pregled** (or **Izmena spremna za pregled** for an edit);
- the existing TaskFace summary language is retained, not the published TaskCard/Peek;
- location/work mode, accepted schedule and people count are visible without a second disclosure tap;
- price remains the existing TaskFace value row;
- there is one primary footer action: **Pregledaj zadatak / Pregledaj izmene**;
- review remains a separate route and publication still requires its own explicit command/readback;
- no private exact address or resolved coordinates are added to the live public summary.

This package does not claim that AI extraction is generally correct. The historical provider-quality issue where a clear painting description did not derive category remains open until authorized real-provider samples prove it.

## Worker matching explanation

The frozen worker review now explains the actual distinction already present in source/server contracts:

- skills, work area and availability affect automatic recommendation/eligibility;
- declared tools, vehicles and licenses are checked against task requirements;
- team capacity limits how many people a response can cover;
- display name and biography are profile presentation, not a matching score;
- no verification badge, percentage or fabricated ranking is shown.

A source-contract regression binds that copy to existing authoritative code:
- task AI facts `need.required_skills/tools/vehicles/licenses/people_needed` materialize to the Need fields consumed by matching;
- current dispatch reads worker skills/tools/vehicles/licenses/radius/availability;
- selection revalidates `team_capacity` and `private.match_detail`;
- display name/bio are not match-detail ranking inputs.

This is source-contract evidence, not a live worker activation/dispatch proof.

## Regression history

The first full run correctly exposed ten historical tests in one intake suite that explicitly required a ready task to remain a collapsible "Nacrt". Their actual safety/behavior guarantees were preserved while the presentation expectation was updated: private facts remain hidden, unsent composer text survives review/return, schedule formatting and people plurals stay correct, and review routing is unchanged.

Final exact run 36420684845:
- TypeScript: **PASS**.
- Focused P5: **4 suites / 130 tests PASS**.
- Full Jest: **345 suites / 7,265 tests PASS**.
- `ai-owned-intake-screen.test.tsx`: PASS in the full run.
- `p5-matching-field-contract.test.ts`: PASS in focused and full runs.

## Boundaries

No TaskCard/Peek replacement. No DEV/Edge/database/certificate/dependency/payment/provider call. No APK/build/install/device check. No claim of category quality, geocoder quality, live matching dispatch, worker activation, or general AI accuracy. The two deferred privacy branches remain deferred.

P5 remains open for authorized real-provider extraction/location samples, actual worker save/activation → matching behavior, and the consolidated native checkpoint.

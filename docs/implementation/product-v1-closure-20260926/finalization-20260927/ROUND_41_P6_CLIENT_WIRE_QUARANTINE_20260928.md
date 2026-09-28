# Round41 — P6 bounded Discovery client wire quarantine

Date: 2026-09-28.

## Scope

This round does **not** wire bounded Discovery into the production app and does **not** apply any server candidate.

It adds strict client-side decoders for the proposed `DISCOVERY_V1` wire so a later server/client integration cannot silently reinterpret malformed paging, map or locality-facet data.

### PAGE / EXACT_PUBLIC quarantine

History through `0f651cc74b63277f443f4927d7e7ba186f6e8408`.

The decoder accepts only the explicit PAGE/EXACT allowlists, validates:
- UUID/revision/published sort identity;
- public schedule, country/timezone and location mode;
- coarse public pin precision;
- required/covered capacity;
- capability arrays and identity requirement;
- price mode/basis/value coherence;
- response deadline and `acceptsApplications`;
- public topology/location-mode agreement;
- anchor/filter/cursor binding;
- exact-live count relations and page/count coherence;
- no extra/private response fields.

CI run [36422264288](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36422264288): TypeScript PASS, strict contract PASS, production-wiring guard PASS.

### MAP / PLACES quarantine

Source introduced at `8e6f203af026cfdd1e955c7bed6a93f36d2d73a6`, final test history `851e20792f7f625e21aeba65249b9af5574d4d94`.

MAP wire is deliberately minimal:
- max 256 buckets;
- coverage bounds + effective grid + optional whole-filter bounds;
- exact-live mapped/point-free counts;
- TASK = coarse public point + task UUID only;
- PLACE = one identical public point + task count, no member-ID array;
- CLUSTER = representative public point + task count + distinct-point count + member bounds.

It carries no TaskCard/detail/private address/profile/storage/application payload. TASK still requires an exact public read before showing card/details.

PLACES returns only `{key,text,count}` plus exact-live Everywhere/map-area counts and bounded continuation. The key must equal the current Serbian client `placeKey(text)`; malformed order/count/cursor state is rejected rather than repaired client-side.

CI run [36428704323](https://github.com/Uskoci1/USKOCI-CLEAN/actions/runs/36428704323): TypeScript PASS, spatial contract PASS, premature-production-wiring guard PASS.

## Existing server proof retained

The earlier PAGE/EXACT SQL disposable proof remains narrower but useful:
- run 36346675417;
- SQL-role parity PASS;
- 208 parity assertions and 1,004 synthetic rows;
- rollback-only, NOT DEV applied;
- no MAP/PLACES, Auth/PostgREST cost/native proof.

## Hard rollout boundary

Current production `supabaseIzvor`, ports and Discovery screens still do **not** call `rpc_discovery_v1`.

Before P6 can be wired, the project still needs:
1. server candidate implementing and proving PAGE + MAP + PLACES in one compatible version;
2. real Auth/PostgREST boundary proof where required;
3. EXPLAIN (ANALYZE, BUFFERS) and larger sparse/dense/skewed data evidence;
4. client paging owner, map bucket adapter and locality facet adapter;
5. native map/list/filter acceptance under large data;
6. explicit server application authorization under the repository procedure.

No DEV/database/Edge/provider/certificate mutation happened in Round41.

# P6 MAP / PLACES exact wire — client quarantine

2026-09-28. **SOURCE CONTRACT ONLY / NOT SERVER-APPLIED / NOT CLIENT-WIRED.**

This file makes the previously prose-only MAP/PLACES response shapes explicit so a later server candidate and native adapter cannot invent incompatible payloads.

## MAP

MAP is independent of PAGE. It returns only bounded spatial aggregates for the requested coverage box:

- at most 256 buckets;
- `coverageBounds`, `effectiveGrid`, optional whole-filter `wholeBounds`;
- exact-live `mapped` and `withoutPoint` counts;
- bucket kinds:
  - `TASK`: coarse public point + one task UUID only;
  - `PLACE`: one identical coarse public point + task count, no member-ID array;
  - `CLUSTER`: representative public point + task count + distinct-point count + member bounds.

MAP deliberately carries no title, description, requester profile, exact address, resolved coordinate, photo/storage URL, relationship, application state or TaskCard payload. A TASK tap must use an exact public reader. PLACE drills into bounded `POINT_MEMBERS`; CLUSTER drills spatially. Current TaskCard/Peek remains untouched.

## PLACES

PLACES returns only `{key,text,count}` locality facets, ordered by count descending then Serbian display text, plus exact-live Everywhere / optional map-area counts. `key` must equal the current client `placeKey(text)`; the client does not silently repair drift.

## Safety / rollout

The decoders reject extra fields, malformed bounds/points, bucket over-counting, duplicates, invalid cursor state and contradictory counts. They are not imported by the production Supabase source. CI fails if the partial `rpc_discovery_v1` becomes wired before MAP/PLACES server proof and the paging owner are finished.

This is not performance proof, Auth/PostgREST proof, DEV deployment, native map acceptance or store readiness.

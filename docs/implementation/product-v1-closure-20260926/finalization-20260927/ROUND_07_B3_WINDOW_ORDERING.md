# Round 07 — B3b fixture ordering oracle

Status: SOURCE FIXED; Node syntax and scoped diff check PASS; disposable rerun pending. Only `supabase/proofs/chat/message_window_proof.mjs` changed. Candidate SQL is unchanged.

CI `36312008697` (`ROUND_07_B3_CI_THIRD.log`) passed every B3a stage, including the canonical NOT NULL negative proof. B3b passed source/body/authority/certificate checks, then failed its window assertions with two additional leading IDs.

The fixture oracle selected `to_jsonb(created_at) AS created_at` and used unqualified `ORDER BY created_at,id`. [PostgreSQL resolves this ambiguous ORDER BY name to the output column](https://www.postgresql.org/docs/15/queries-order.html); [JSONB strings use the database's default collation](https://www.postgresql.org/docs/16/datatype-json.html). That oracle therefore sorted timestamp strings, while both candidate RPCs sort the actual `(timestamptz, uuid)` tuple. The B3b before/after branches and final aggregate consistently qualify `m.created_at,m.id`.

The fixture's integer `x.ord/3` gives ordinals 1 and 2 exactly zero microseconds; subsequent values include a fractional timestamp component. This provides a source explanation for a two-row edge discrepancy. The saved failure does not print ID-to-timestamp mappings, so it does not independently identify those two UUIDs as the zero-microsecond rows or establish the failed loop iteration.

The correction qualifies the oracle's input sort keys as `m.created_at,m.id` while preserving raw JSON timestamp precision. New preconditions require exactly all 121 generated fixture IDs, the two known zero-microsecond IDs first, and the two known 40-microsecond IDs last, with UUID order for ties. No rows are deleted/filtered, no counts or expected window slices are relaxed, and existing cursor, bound, membership and no-side-effect assertions remain.

No tests, SQL proof, CI, build or provider execution occurred during diagnosis/correction. No commit or push. Runtime acceptance requires the next exact-source disposable run; this source diagnosis does not establish a candidate SQL defect.

# v0.5 Search + Inspector source contract

SOURCE ONLY. No DEV apply.

## Global Search

Bounded to 20 results. It can match:
- USER by exact UUID, name prefix, exact email, exact phone;
- TASK by UUID or title prefix;
- APPLICATION by UUID or task title prefix;
- AGREEMENT by UUID or task title prefix.

Email/phone are lookup-only server inputs. They are never returned.

## User Inspector

Returns safe account/profile facts, work-profile capabilities, aggregate lifecycle counts, account reputation aggregate and the last 25 received durable events. It explicitly keeps last activity UNKNOWN because there is no canonical cross-app activity signal yet.

## Task Inspector

Returns public task facts, authoritative coverage via fn_need_covered_slots(), status buckets, selected-slot projection, bounded Agreements and recent NEED events. Exact address/coordinates are replaced by hasExactLocation. Search authority remains UNKNOWN until the exact canonical authority is read back.

## Agreement Inspector

Returns current Agreement/version/execution, safe party summaries, accepted price/slots/time keys only, message count + lastMessageAt, review completion metadata and approximate task location. It never returns message body, scope_note or exact address/coordinates.

## Required before DEV

- exact current schema/function/ACL readback;
- security definer ownership and search_path proof;
- anon/authenticated denial + server-only success;
- EXPLAIN/BUFFERS for search and inspector paths;
- bounded cardinality proof;
- privacy payload negative tests;
- explicit owner approval for the exact package.

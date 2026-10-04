# Control — canonical DEV readback, 2026-10-04

## Access is now verified

A project-list response omitted the canonical project, but direct get_project and execute_sql calls to `leqcwgzvjsxugfgzdmth` succeeded. Do not infer lack of access solely from list_projects. The first readback at 20:13:51 UTC returned transaction_read_only=on. The existing Control RPC name family was empty: none was installed by this work.

## Work performed

All database calls used BEGIN READ ONLY, session-local statement/lock limits, SELECT or EXPLAIN ANALYZE of SELECT, and ROLLBACK. No DDL, business DML, scheduler changes, provider calls, account actions or certificate writes were performed.

The owner received a separate business-console HTML and source/test bundle in the conversation. That UI is an offline snapshot viewer with Users, Tasks, Applications and Agreements linked through snapshot-local aliases. It is NOT a hosted service and does not claim automatic refresh. Its source starts disconnected. Runtime snapshots and screenshots are intentionally NOT committed to the public repository. The new business-console UI remains in the conversation bundle; do not claim it is in the GitHub tree.

Overview capture: 20:15:01 UTC. Detail capture: 20:16:31 UTC. These are two separate read-only captures, not one atomic cross-query snapshot. Names, contacts, exact places, UUIDs, chat content and scope-note text were not exported to the viewer.

## Correctness finding

The previous Overview candidate counted PUBLISHED/SELECTION and deadline only. A direct read-only comparison proved that this includes human-closed search. The source candidate now also requires remaining_search_closed_at IS NULL and uses the existing fn_need_covered_slots(id) < required_slots. This is a search-gate count, NOT a candidate-eligibility or dispatch-success assertion.

The observer never clears human closure or calls reopen/dispatch. No lifecycle repair from the main app work was applied here.

## Cache correction

The previous service worker cached every same-origin GET, which would include a future private API. The replacement admits only four exact public shell URLs, refuses query strings and Authorization requests, respects private/no-store responses, and removes only obsolete Control shell caches. API/auth/snapshot responses are excluded. Offline shell availability begins after an admitted shell resource has been fetched; this is not a promise of first-visit offline installation.

## Evidence and limits

Local business-view checks: 26 model/validation checks and 13 browser scenario groups, including all six surfaces at 320/390/768/1440 widths. Browser testing used local Chromium, not a physical phone. Cache regression suite: 15 checks. Search predicate guard: 6 static checks. These do not prove deployed owner authentication or SQL function ACLs.

A small DEV SELECT baseline measured 1.916 ms execution and 6.359 ms planning, with no shared/temp blocks written. This is NOT a large-data scalability proof or a frontend latency measurement.

Remaining gates: deployed owner authentication/session revocation, durable access audit, route-specific full payload validation, service-only RPC execution and negative permission proof, live-versus-snapshot provenance, large-data query budgets, and owner approval for the exact server package. No production readiness or live business monitoring completion is asserted.

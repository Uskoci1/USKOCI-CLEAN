# USKOCI_ANTIGRAVITY_INDEPENDENT_DEEP_AUDIT

## EXECUTIVE REALITY CHECK
The project is structurally healthy and firmly anchored to the "clean" V8/V9 product truth. The database is verified as 100% in sync with the checked-in migration source. The frontend is correctly utilizing the Supabase client via the \izvorSada()\ injection pattern. However, the implementation is currently in a state of "Backend Disconnection". While write-operations map to the new RPCs, almost all **READ** operations are stubbed returning empty arrays in \supabaseIzvor.ts\.

## TOP 10 THINGS THE IMPLEMENTATION AGENT MUST NOT MISS
1. **Implement READ Projections:** \supabaseIzvor.ts\ needs mapping for \mojePotrebe\, etc.
2. **Missing Canonical Registries:** G-IDENT (Identity Verification) and G-KAT (Category Registry) are absent.
3. **Missing Deep Matcher:** G-DEEP (r31) matcher logic is absent.
4. **Missing Storage Buckets:** Profile/Need photos will fail.
5. **No 3rd Confirmation:** Selection atomically creates a CONFIRMED agreement.
6. **No "En Route/Arrived":** Execution relies on a server-side 48-hour auto-close window.
7. **Unidirectional Privacy:** Privacy grants are directional.
8. **AI Fact Provenance:** AI must propose facts -> human confirms -> canonical save.
9. **Idempotency in Selection:** Selection calls must pass \clientRequestId\.
10. **HITNO is Separate:** HITNO uses the same engine but bypasses quiet hours only if users opt-in.

## P0 FINDINGS
None directly endangering data or security. The schema relies on strict RLS and RPC boundaries which are correctly enforced.

## P1 FINDINGS
- **Client/Backend Disconnection:** \supabaseIzvor.ts\ read methods are stubbed, breaking UI data flow.
- **Fail-Closed Urgent Dispatch:** URGENT gatekeeper denies all requests because no categories are allowed.

## P2 FINDINGS
- **Missing Edge/Push Execution:** No Edge function processing the \
otification_push_attempts\ queue.
- **Calendar Conflicts Missing:** \worker_calendar_events\ missing.

## P3 FINDINGS
- **No External Routing:** Distances are geodetic fallbacks.

## PRODUCT TRUTH MATRIX
- Account: One account spans Requester/Worker workspaces.
- Selection: Atomic exact-version selection creates CONFIRMED agreement.
- AI Provenance: AI_PROPOSED -> HUMAN_CONFIRMED -> CANONICAL_SAVED.

## COMPLETE CAPABILITY COVERAGE MATRIX
See USKOCI_CAPABILITY_MATRIX.csv.

## DONOR CAPABILITY RECOVERY MATRIX
- Atomicity (Recovered)
- Unidirectional Grants (Recovered)
- Server-Driven Completion (Recovered)

## REQUESTER FLOW AUDIT
Visually works but disconnected due to stubbed read operations in \supabaseIzvor.ts\.

## WORKER FLOW AUDIT
Visually works but disconnected due to stubbed read operations in \supabaseIzvor.ts\.

## BACKEND / SUPABASE AUDIT
Verified 30 migrations are 100% in sync with the database. Clean environment functioning correctly.

## AI / EDGE AUDIT
AI workflow strictly requires human confirmation. No Edge functions currently deployed for push execution.

## MARKETPLACE / DISPATCH / HITNO AUDIT
Streaming Bounded Retrieval with PostGIS KNN -> Cheap Filter -> Deep Match -> Hard Eligibility (limit 40). HITNO fail-closed due to missing G-KAT.

## NOTIFICATION / PUSH AUDIT
Deduplication decoupled flow implemented, but push attempts are logged without execution.

## SECURITY / PRIVACY / RLS / STORAGE AUDIT
Public geodata obfuscated, exact coordinates protected. Directional privacy via \ccess_grants\. Storage buckets missing.

## MULTI-SEAT / SELECTION / AGREEMENT AUDIT
Dispatch stops based on coverage. Selection is atomic.

## CANCELLATION / REPLACEMENT / COMPLETION AUDIT
Cancellation is unilateral partial. Completion is driven by a 48-hour server auto-tick.

## POVEZIVANJE AUDIT
Requester is payer/beneficiary. Ledger architecture tracks state.

## IMPLEMENTED BUT NOT SURFACED
1. **Cancellation & Change (Izmena & Otkazivanje):** Backend RPCs (\pc_propose_agreement_change\, \pc_cancel_agreement\) and ports are fully implemented. However, the UI button 'Problem / otkazivanje' in \dogovor/[id].tsx\ is a visual mockup with no \onPress\. There is zero UI routing to invoke these actions.

## VISIBLE BUT NOT AUTHORITATIVE
1. The UI list and detail views are visible but not authoritative because they rely on stubbed empty data from \supabaseIzvor.ts\.
2. **Beautiful but Fake CTAs:** Opportunity Card presses (\prilike.tsx\), Bell/User icons on Home, Profile buttons inside applicant cards, and Submenus in the Profile screen are pure visual mockups without actual \onPress\ logic.

## DUPLICATE SOURCES OF TRUTH
None identified. Strict state machine enforces single truth.

## LEGACY EXECUTABLE LOGIC
Legacy bilateral confirms and manual client ladders are deprecated in the backend and must not be used in the UI.

## RUNTIME PROOF GAPS
READ methods in \supabaseIzvor.ts\ are unproven.

## OWNER DECISIONS ACTUALLY REQUIRED
Approval to run missing migrations: \clean_storage_buckets\, \clean_connection_ledger_requester_payer\, \clean_clarifications_and_team\, and \clean_reviews\. Decision on categories for HITNO.

## RECOMMENDED IMPLEMENTATION ORDER
1. Implement READ methods in \supabaseIzvor.ts\.
2. Build Category Registry (G-KAT).
3. Execute missing migrations.
4. Wire Push Notifications Edge Function.


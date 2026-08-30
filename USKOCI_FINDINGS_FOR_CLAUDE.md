# USKOCI_FINDINGS_FOR_CLAUDE.md

## CONFIRMED P0
- No critical P0 findings so far. Supabase connection and client bindings are verified and functional. 

## CONFIRMED P1
- **Broken Privacy Reveal (Phone):** \pp_accounts\ has a strict \SELECT auth.uid() = id\ policy. Even if a \PHONE\ grant exists in \ccess_grants\, the counterparty cannot read the phone number.
- **Broken Avatars:** \profile-media\ bucket restricts read access strictly to the owner. Users cannot see other workers' avatars.
- **Missing AI Safety Gates Backend:** AI safety states (BLOCK, REVIEW) exist in the UI mock but the DB schema/RPCs entirely lack support to persist or enforce them.
- The UI directly uses izvorSada() via useIzvor(), but currently supabaseIzvor.ts has multiple unimplemented methods returning empty arrays or 
ull (e.g. mojePotrebe(), potreba(), otvorenePrilike(), prilika(), prijaveZaPotrebu()). This creates a "Backend no Client" disconnect for reading data, even though RPCs for commands exist.
- Edge functions, Cron scheduling, and Push providers are not currently active/live.

## HIGH-VALUE P2
- The configuration enabled: false and llowedCategories: [] inside the URGENT policy gate disables HITNO completely in the backend, meaning any URGENT actions in UI will hit a fail-closed gate.

## DONOR CAPABILITIES AT RISK
- **G-IDENT** (Identity Verification) is missing. private.identity_admitted() returns false, meaning needs with erified_identity_required=true yield 0 eligible candidates.
- **G-KAT** (Category Registry) is missing.
- **G-DEEP** (Deep Matcher) is missing.
- **G-KAL** (Calendar Conflicts) is missing.
- **G-ROUTE** (Routing Provider) is missing.
- **G-OVR** (Availability Overrides) is missing.

## CLIENT/BACKEND DISCONNECTIONS
- **UI Mockups:** 'Problem / otkazivanje' button, profile submenus, and Opportunity Card presses have no \onPress\ routing. They are purely visual.
- **AI Edge:** \posaljiKorisnikovuPoruku\ is stubbed. No AI edge function exists.
- **READ paths** in src/data/supabaseIzvor.ts are heavily stubbed (eturn []; or eturn null;). Needs to be wired to Supabase views or RPCs (e.g. 
eeds, marketplace_responses, greements).

## RECOMMENDED NEXT ORDER
1. Implement the READ methods in src/data/supabaseIzvor.ts (Phase D Runtime Proof).
2. Wire the PostGIS search logic for fetching otvorenePrilike() and mapping needs.
3. Build the backend capabilities for G-IDENT and G-KAT if product requires them for MVP.


## SECOND-PASS EVIDENCE (HARD PROOF FOR FIXES)
- **Broken Phone Privacy:** Fix \pp_accounts\ RLS or create a \SECURITY DEFINER\ RPC to fetch counterparty phone if \ccess_grants\ says 'PHONE'. Currently, \pp_accounts_select_own\ at \20260825115040_cloud_profile_foundation_1_3b.sql:197\ blocks all cross-user reads.
- **Broken Profile Media:** \profile-media\ bucket has \public=false\ and its \SELECT\ policy hard-blocks reads from anyone but the owner (\20260825115040_cloud_profile_foundation_1_3b.sql:301\). Avatars will fail to load for other users.
- **Dead CTAs:** In \src/app/dogovor/[id].tsx\, the \<Press>\ for "Problem / otkazivanje" literally has no \onPress\ prop. It's a dead component.
- **AI Safety Missing:** \BLOCK\/\REVIEW\ gates do not exist in the DB schema. No SQL file contains these states.

## THIRD-PASS CROSS-CAPABILITY CRITICAL FIXES
- **Account Deletion Blocker:** \greements\ uses \ON DELETE RESTRICT\ on \ccount_id\. Users can never delete their accounts if they have any history. You must refactor to a soft-delete/anonymization architecture or \SET NULL\.
- **Multi-Seat Cancellation Starvation:** \pc_cancel_agreement\ sets status to \SELECTION\ when a partial cancellation occurs. Because the status was already \SELECTION\, the \
eeds_enqueue_dispatch\ trigger ignores it. You must explicitly wake the dispatch engine in the RPC to find replacements.
- **Worker Capability Race Condition:** \pc_select_response\ fails to re-evaluate worker capabilities at selection time. A worker can apply, remove their truck from their profile, and still be selected.
- **Storage Leak:** There are no triggers to delete \storage.objects\ when profiles/needs are deleted.
- **No Tests:** \supabase/tests/\ is completely missing.

## FOURTH-PASS CRITICAL FIXES (PRIVACY & CAPABILITY GAPS)
- **Forever Grant Privacy Leak (P1):** \
eed_sensitive_granted_read\ (RLS) only checks \ccess_grants.status = 'GRANTED'\. Since \pc_cancel_agreement\ NEVER revokes grants, cancelled workers retain permanent access to exact coordinates. You MUST update the RLS policy to join \greements\ and enforce \.status = 'CONFIRMED'\.
- **Missing Domain Cancel/Withdraw (P1):** There is no \pc_cancel_need\ or \pc_withdraw_response\. Requesters cannot cancel a need before selection. Workers cannot withdraw an application before selection. You must write these two RPCs to prevent users from being trapped.
- **Ghost Notifications (P2):** Cancellation does not purge \
otification_deliveries\.
- **Role Switching Data Leak (P2):** \uloga.ts\ flips roles but UI state/cache isn't cleared.

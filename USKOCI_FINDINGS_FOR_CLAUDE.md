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


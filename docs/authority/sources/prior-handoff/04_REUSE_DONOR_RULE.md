# REUSE / DONOR RULE

Before implementing a capability or missing sub-capability, physically inspect:
- current CLEAN source;
- historical donor packages/patches;
- RC2/R26.x foundations;
- existing migrations;
- existing services/contracts;
- existing proof branches/artifacts.

Preferred order:
REUSE EXISTING CLEAN
→ PORT/ADAPT VERIFIED DONOR
→ EXTEND EXISTING CANONICAL MODEL
→ WRITE NEW ONLY IF NECESSARY.

Donor is never authority for current product semantics. Current CLEAN + latest owner decisions are authority.

Do not:
- blindly copy donor code;
- restore superseded semantics;
- create a parallel table/model where CLEAN already owns the concept;
- create a new function when an existing one can safely be extended;
- overwrite historical Application/Agreement snapshots with later profile edits.

Preserve lineage/provenance for any donor adaptation and prove the adapted result against current CLEAN.

Included `reference/R47_HISTORICAL_DONOR.patch` is historical donor material only. It is NOT automatically applicable and must not be merged wholesale.

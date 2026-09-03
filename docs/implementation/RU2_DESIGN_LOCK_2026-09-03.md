# RU-2 Need V2 + R07 — design lock

Source basis: governing RU-2 deployment unit + fresh physical GitHub/Supabase reads at 58 / 20260903184545.

No production write is authorized by this document.

Locked migration strategy:
- Existing ai_structured_facts rows remain LEGACY_TEXT_V1; no legacy row is rewritten or promoted to V2.
- Existing ai_conversations remain LEGACY_TEXT_V1; only newly opened NEED_INTAKE conversations use NEED_FACT_V2.
- New V2 facts are typed JSONB with server-validated key/value type, display_value and evidence.
- V2 writer is service-role only; authenticated clients never write AI facts directly.
- Legacy string correction is rejected for V2; V2 correction accepts typed JSONB + display value and preserves supersession/provenance.
- R02 routes to R07 Human Review. R02 does not publish.
- R07 canonical save sends only conversation id, requester profile id and semantic client request id. Server reconstructs confirmed V2 facts and saves DRAFT only.
- Existing PUBLISHED/ACTIVE Needs are unchanged.
- Public coarse task geography and private exact/access data remain separate. REMOTE carries no fake physical geography.
- RU-3 remains the publication/admission owner; RU-2 creates no public marketplace transition.

Required proof before canonical promotion:
- full 58-migration predecessor replay or equivalent verified predecessor;
- existing legacy facts/Needs unchanged;
- new NEED_INTAKE V2 conversation;
- service-only V2 fact writer; unknown/wrong-type key fails closed;
- typed human correction + same-key supersession;
- wrong-owner/legacy-conversation canonical save denial;
- DRAFT materialization and private/public geography separation;
- semantic replay: same key/same snapshot exact result, same key/different snapshot reject;
- R02 -> R07 source contract; no R02 publish CTA;
- TypeScript/regression tests;
- zero proof residue.

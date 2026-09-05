# CDL-A12 — Legacy AI publish shadow elimination

Scope: `objaviPotrebu` only.

Pre-change canonical: `1be672dc649fee102a66c826c86b0e5609a43315`.

Active production winner: `src/data/productionAuthorityOverrides.ts`.

Lower shadow: `src/data/supabaseIzvor.ts` calls `rpc_ai_publish_need` without required `p_profile_id`.

Fresh live authority proof on 2026-09-05: `public.rpc_ai_publish_need(uuid,uuid)` is authenticated-only, anon denied, and intentionally raises `PACKAGE_4_NOT_READY`; canonical D0140 publication remains fail-closed.

No backend migration, Edge change, publication activation, RU semantic change, monetization change or UI redesign is in scope.

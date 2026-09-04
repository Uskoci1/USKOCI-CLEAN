# USKOČI — LIVE IMPLEMENTATION NETWORK

Last updated: 2026-09-04T10:29:18Z
Authority: governing master + fresh physical GitHub/Supabase reads

## Canonical physical baseline

- Repository: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- B06 source promotion head: `4d735390e32c530a323b24dad95ddaa0422bd493`
- Supabase: `leqcwgzvjsxugfgzdmth`
- Live migrations: `62`
- Live head: `20260904102429_clean_ru3_need_publication_decision`
- Edge: `uskoci-ai-interview` ACTIVE v5, `verify_jwt=true`, EZBR `5003809f31681eb396713ffc66a1adf979d62a39312dcb833ead67df180954ca`

## Dependency chain

`RU-0 CLOSED -> RU-1 CLOSED -> RU-2 CLOSED -> RU-3/B05 LIVE_STRUCTURAL_PROVEN -> RU-3/B06 LIVE_STRUCTURAL_PROVEN -> reviewed D-0140/evaluator dependency`

RU-3 is **not** closed. B05 and B06 are live/proven, but publication remains fail-closed.

B06 network:
`DRAFT Need exact revision -> canonical public-content/geography/media fingerprint + private-materiality digest -> current reviewed complete policy bundle + exact rule provenance -> immutable decision record -> ALLOW still disabled -> publish remains closed`

B06 live invariants:
- 0 publication decision rows after migration;
- RLS enabled on the private decision table;
- anon/authenticated/service_role direct table CRUD denied;
- private fingerprint helper EXECUTE denied to anon/authenticated/service_role;
- service decision writer EXECUTE only for service_role;
- service writer contains `RU3_ALLOW_NOT_ENABLED`;
- authenticated legacy `rpc_publish_need` execute remains false;
- legacy AI publish still contains `PACKAGE_4_NOT_READY`;
- B05 policy tables remain empty: 0 bundles + 0 rule refs;
- existing 82 facts + 15 conversations + 6 Needs + 6 profiles preserved;
- Edge v5 unchanged.

Live migration alias:
- `20260904103000` -> `20260904102429` `clean_ru3_need_publication_decision`; source raw MD5 `3974c57c159f3c7c9262db4b296729c3`; recorded MD5 `693e3c31a5647b8a63932f3b1ab13eb0`; 19746 recorded UTF-8 bytes; exact-byte identity not claimed because the connected apply path omitted the terminal newline byte.

Proof chain:
- disposable B06 run `33857742442`: PASS;
- clean promotion `33862361633`: PASS;
- canonical PRE-P4 `33862478205`: PASS;
- fresh production preflight: PASS;
- live apply: PASS;
- live structural post-apply: PASS.

## Next allowed action

Fresh read-only physical preflight against `62 / 20260904102429` + Edge v5. Continue RU-3 only with fail-closed structural work or authoritative reviewed/versioned/applicable D-0140 policy/evaluator content. **Do not activate canonical publish and do not invent policy rules.**

Principle: **AI agent is replaceable. Canonical project state is not.**

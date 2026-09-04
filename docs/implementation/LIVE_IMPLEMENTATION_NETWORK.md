# USKOČI — LIVE IMPLEMENTATION NETWORK

Last updated: 2026-09-04T09:06:24Z
Authority: governing master + fresh physical GitHub/Supabase reads

## Canonical physical baseline

- Repository: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- B05 source promotion head: `ac70e1e66375a9e1be602808a3d4d3a2735f1b3b`
- Supabase: `leqcwgzvjsxugfgzdmth`
- Live migrations: `61`
- Live head: `20260904090147_clean_ru3_policy_bundle_foundation`
- Edge: `uskoci-ai-interview` ACTIVE v5, `verify_jwt=true`, EZBR `5003809f31681eb396713ffc66a1adf979d62a39312dcb833ead67df180954ca`

## Dependency chain

`RU-0 CLOSED -> RU-1 CLOSED -> RU-2 CLOSED -> RU-3/B05 LIVE_STRUCTURAL_PROVEN -> B06 NEXT`

RU-3 is **not** closed. Only B05 is live/proven.

B05 network:
`server-owned policy bundle metadata -> reviewed+complete+active readiness gate -> exact jurisdiction selector -> no client/service direct access -> no seeded policy content -> publish still fail-closed`

B05 live invariants:
- 0 policy bundle rows;
- 0 policy rule-reference rows;
- RLS enabled on both private tables;
- anon/authenticated/service_role direct table access denied;
- private helper EXECUTE denied to anon/authenticated/service_role;
- authenticated legacy `rpc_publish_need` execute remains false;
- legacy AI publish still contains `PACKAGE_4_NOT_READY`;
- existing 82 facts + 15 conversations + 6 Needs + 6 profiles preserved;
- Edge v5 unchanged.

Live migration alias:
- `20260904090000` -> `20260904090147` `clean_ru3_policy_bundle_foundation`; source raw MD5 `e65a1d1658938ffdca07c88c246e660c`; recorded MD5 `6ca4db41a4c23dd9bd85fc2e76ea2af8`; 8506 recorded UTF-8 bytes; exact-byte identity not claimed.

Proof chain:
- disposable B05 run `33854188735`: PASS;
- canonical PRE-P4 `33855138395`: PASS;
- fresh production preflight: PASS;
- live apply: PASS;
- live structural post-apply: PASS.

## Next allowed action

Fresh read-only physical preflight against `61 / 20260904090147` + Edge v5. Then implement **B06 immutable admission/publication decision + canonical input fingerprint** as a fail-closed structural unit. Missing/unreviewed/incomplete policy must never yield ALLOW. Do not reopen RU-0/RU-1/RU-2 and do not activate publish yet.

Principle: **AI agent is replaceable. Canonical project state is not.**

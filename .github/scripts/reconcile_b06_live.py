import json
from pathlib import Path
from datetime import datetime, timezone


ts = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
canonical_head = '4d735390e32c530a323b24dad95ddaa0422bd493'
live_version = '20260904102429'
live_name = 'clean_ru3_need_publication_decision'
source_version = '20260904103000'
source_file = '20260904103000_clean_ru3_need_publication_decision.sql'
source_raw_md5 = '3974c57c159f3c7c9262db4b296729c3'
recorded_md5 = '693e3c31a5647b8a63932f3b1ab13eb0'
recorded_bytes = 19746

# Canonical migration provenance: move B06 from pending to live without rewriting old history.
pp = Path('supabase/migrations/MIGRATION_PROVENANCE.json')
prov = json.loads(pp.read_text())
prov['generated_at_utc'] = ts
prov['repository_base_head'] = canonical_head
hist = prov['live_history_snapshot']
hist['migration_count'] = 62
hist['last'] = {'name': live_name, 'version': live_version}
hist['entries'] = [e for e in hist.get('entries', []) if e.get('name') != live_name]
hist['entries'].append({
    'name': live_name,
    'version': live_version,
    'file': source_file,
    'source_version': source_version,
    'exact_byte_mirror': False,
    'live_recorded_statement_md5': recorded_md5,
    'recorded_statement_utf8_bytes': recorded_bytes,
})
prov['pending_forward_migrations'] = [
    e for e in prov.get('pending_forward_migrations', []) if e.get('name') != live_name
]
pp.write_text(json.dumps(prov, indent=2, ensure_ascii=False) + '\n')

# Machine-readable live implementation state.
sp = Path('docs/implementation/LIVE_MIGRATION_STATE.json')
state = json.loads(sp.read_text())
state['updated_at'] = ts
state['live_migration_count'] = 62
state['live_head'] = {'version': live_version, 'name': live_name}
state.setdefault('provenance', {})['state'] = 'NORMALIZED_TO_LIVE_62'
state['provenance']['pending_forward_migrations'] = 0
state['provenance']['ru3_b06_live_alias'] = {
    'live_version': live_version,
    'source_version': source_version,
    'source_file': source_file,
    'exact_byte_identity': False,
    'recorded_statement_md5': recorded_md5,
    'recorded_statement_utf8_bytes': recorded_bytes,
    'source_raw_md5': source_raw_md5,
}
ru3 = state.setdefault('ru3', {})
ru3['status'] = 'OPEN_B05_B06_LIVE_STRUCTURAL_PROVEN'
ru3['full_ru3_closed'] = False
ru3['b06'] = {
    'status': 'LIVE_STRUCTURAL_PROVEN',
    'canonical_source_head': canonical_head,
    'source_version': source_version,
    'source_file': 'supabase/migrations/' + source_file,
    'source_raw_md5': source_raw_md5,
    'live_version': live_version,
    'recorded_statement_utf8_bytes': recorded_bytes,
    'recorded_statement_md5': recorded_md5,
    'exact_byte_identity_with_source': False,
    'disposable_runtime_proof_run': 33857742442,
    'clean_promotion_run': 33862361633,
    'canonical_integrity_run': 33862478205,
    'zero_decision_rows': True,
    'allow_enabled': False,
    'legacy_publish_closed': True,
    'ai_publish_fail_closed': True,
    'business_rows_preserved': {
        'ai_structured_facts': 82,
        'ai_conversations': 15,
        'needs': 6,
        'app_profiles': 6,
    },
}
ru3['next_dependency'] = 'REVIEWED_VERSIONED_APPLICABLE_D0140_POLICY_CONTENT_AND_EVALUATOR_BEFORE_CANONICAL_PUBLISH'
ru3['activation_blocker'] = 'No reviewed/versioned/applicable D-0140 policy content exists yet; B06 intentionally refuses ALLOW and canonical publish must remain disabled.'
state['next_allowed_action'] = 'Fresh physical preflight against live 62/20260904102429 and Edge v5. Continue RU-3 only with fail-closed structural work or authoritative reviewed D-0140 policy/evaluator content. Do not activate canonical publish or invent policy rules.'
sp.write_text(json.dumps(state, indent=2, ensure_ascii=False) + '\n')

# Human handoff.
Path('docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md').write_text(f'''# USKOČI — CURRENT IMPLEMENTATION HANDOFF

Checkpoint: {ts}

## Canonical identity

- Repo: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- RU-3/B06 canonical source promotion head: `{canonical_head}`
- Supabase project: `leqcwgzvjsxugfgzdmth`
- Production migration state: `62 / {live_version}_{live_name}`
- Edge: `uskoci-ai-interview` ACTIVE v5, `verify_jwt=true`, EZBR SHA-256 `5003809f31681eb396713ffc66a1adf979d62a39312dcb833ead67df180954ca`

## Current live unit

`RU-3 / B06 — immutable Need publication decision + canonical fingerprint`

State: `LIVE_STRUCTURAL_PROVEN`

Important: **RU-3 as a whole is still OPEN.** B05 and B06 are live/proven structural subunits only. No reviewed D-0140 policy content has been seeded and B06 explicitly refuses `ALLOW`.

Canonical source migration:
- `{source_file}` — raw MD5 `{source_raw_md5}`

Live Supabase alias:
- source `{source_version}` -> live `{live_version}_{live_name}`; recorded 1 statement; {recorded_bytes} UTF-8 bytes; recorded MD5 `{recorded_md5}`; exact raw-byte identity with canonical source `false` because the connected apply path did not preserve the terminal newline byte.

## B06 contract now live

- `private.need_publication_decisions` exists as an append-only decision ledger.
- The table contains **0 decision rows** after live apply.
- RLS is enabled and anon/authenticated/service_role have no direct table CRUD.
- The private fingerprint helper is not executable by anon/authenticated/service_role.
- Only `service_role` may execute the service decision writer.
- The service decision writer requires exact current Need revision, canonical geography, current reviewed+complete active policy bundle and exact rule provenance.
- Public media remains fail-closed until review authority exists.
- `ALLOW` is explicitly disabled with `RU3_ALLOW_NOT_ENABLED`.
- Authenticated legacy `rpc_publish_need` remains unavailable.
- Legacy AI publish remains fail-closed with `PACKAGE_4_NOT_READY`.
- Existing business rows remain preserved: 82 AI facts, 15 conversations, 6 Needs, 6 profiles.
- Edge v5 remains unchanged.

## Proof

- Disposable B06 runtime proof run `33857742442`: PASS — fail-closed policy, auth/service boundaries, stale revision, fingerprint materiality, immutable decision ledger, media gate and zero residue.
- Clean promotion run `33862361633`: PASS — clean 4-file promotion, migration integrity, TypeScript and regression tests.
- Canonical PRE-P4 run `33862478205` on `{canonical_head}`: PASS — migration integrity, TypeScript and regression tests.
- Fresh production preflight before live write: PASS at 61 migrations with B06 absent.
- Live apply: PASS -> `{live_version}_{live_name}`.
- Live structural post-apply: PASS — 0 decision rows, RLS/ACL closed, service-only writer, ALLOW disabled, legacy publish closed, business rows preserved.
- Edge v5 unchanged.

## Closed units — DO NOT REDO

- Edge source reconciliation: DONE
- RU-0 Authority Closure: CLOSED
- RU-1 Worker Readiness: CLOSED
- RU-2 Need V2 + R02/R07 DRAFT: CLOSED
- RU-3/B05 structural foundation: LIVE_STRUCTURAL_PROVEN
- RU-3/B06 structural decision/fingerprint: LIVE_STRUCTURAL_PROVEN

Quarantine remains quarantine: `repair/ru0-ru1-backend-20260902` — no merge/cherry-pick/apply.

## Current blocker / next dependency

There is still no reviewed, versioned and applicable D-0140 policy content. Therefore canonical admission/publish must remain fail-closed. B06 is intentionally unable to emit `ALLOW`.

Next allowed work: fresh physical preflight against live 62 + Edge v5, then continue only with fail-closed RU-3 structure or authoritative reviewed D-0140 policy/evaluator content. Do not activate canonical publish yet and do not invent legal/safety rules.

Continuity rule:
`READ MASTER -> HANDOFF -> LIVE NETWORK -> LEDGER -> LIVE MIGRATION STATE -> FRESH PHYSICAL READ -> CONTINUE OR RECONCILE`

**AI agent is replaceable. Canonical project state is not.**
''')

# Human dependency network.
Path('docs/implementation/LIVE_IMPLEMENTATION_NETWORK.md').write_text(f'''# USKOČI — LIVE IMPLEMENTATION NETWORK

Last updated: {ts}
Authority: governing master + fresh physical GitHub/Supabase reads

## Canonical physical baseline

- Repository: `Uskoci1/USKOCI-CLEAN`
- Branch: `clean-alpha-backend`
- B06 source promotion head: `{canonical_head}`
- Supabase: `leqcwgzvjsxugfgzdmth`
- Live migrations: `62`
- Live head: `{live_version}_{live_name}`
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
- `{source_version}` -> `{live_version}` `{live_name}`; source raw MD5 `{source_raw_md5}`; recorded MD5 `{recorded_md5}`; {recorded_bytes} recorded UTF-8 bytes; exact-byte identity not claimed because the connected apply path omitted the terminal newline byte.

Proof chain:
- disposable B06 run `33857742442`: PASS;
- clean promotion `33862361633`: PASS;
- canonical PRE-P4 `33862478205`: PASS;
- fresh production preflight: PASS;
- live apply: PASS;
- live structural post-apply: PASS.

## Next allowed action

Fresh read-only physical preflight against `62 / {live_version}` + Edge v5. Continue RU-3 only with fail-closed structural work or authoritative reviewed/versioned/applicable D-0140 policy/evaluator content. **Do not activate canonical publish and do not invent policy rules.**

Principle: **AI agent is replaceable. Canonical project state is not.**
''')

# Append B06 status ledger row once.
lp = Path('docs/implementation/IMPLEMENTATION_STATUS_LEDGER.csv')
ledger = lp.read_text()
if 'RU-3_B06_PUBLICATION_DECISION_FINGERPRINT' not in ledger:
    if not ledger.endswith('\n'):
        ledger += '\n'
    ledger += (
        'RU-3_B06_PUBLICATION_DECISION_FINGERPRINT,LIVE_STRUCTURAL_PROVEN,'
        f'{canonical_head},source={source_version}_{live_name};live={live_version}_{live_name},'
        'immutable publication decision ledger + canonical Need fingerprint + service-only authority,'
        'none yet; canonical publish remains closed,'
        'run 33857742442 + clean promotion 33862361633 + canonical 33862478205 + live structural proof + provenance reconciliation,'
        'DISPOSABLE_RUNTIME_PROVEN+ZERO_RESIDUE_PROVEN+LIVE_STRUCTURAL_PROVEN+PROVENANCE_RECONCILED,YES,'
        'Reviewed/versioned/applicable D-0140 policy content and evaluator authority are not yet present; ALLOW remains disabled,'
        'Fresh physical preflight against live 62; continue fail-closed RU-3 or authoritative D-0140 evaluator work; DO_NOT_ACTIVATE_PUBLISH\n'
    )
lp.write_text(ledger)

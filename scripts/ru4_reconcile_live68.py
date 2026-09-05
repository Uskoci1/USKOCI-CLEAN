#!/usr/bin/env python3
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FUNCTIONAL_HEAD = 'a271d6084b4648e757d2230d0a208f558c802a14'
CLEAN_PROOF_RUN = 33946688625
RECON_PROOF_RUN = 33947156991
RECON_SOURCE_FILE = '20260904230200_clean_ru4_ai_edit_conversation_live_transfer_reconcile.sql'
RECON_SOURCE_VERSION = '20260904230200'
RECON_MD5 = '6be6134441a81a4550710969cac89d85'
now = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')

manifest = ROOT / 'supabase/migrations/MD5_MANIFEST.txt'
manifest_entries = []
for line in manifest.read_text().splitlines():
    checksum, filename = line.split('  ', 1)
    manifest_entries.append((filename, checksum))
manifest_entries = [e for e in manifest_entries if e[0] != RECON_SOURCE_FILE]
manifest_entries.append((RECON_SOURCE_FILE, RECON_MD5))
manifest_entries.sort(key=lambda x: x[0])
manifest.write_text(''.join(f'{checksum}  {filename}\n' for filename, checksum in manifest_entries))

prov_path = ROOT / 'supabase/migrations/MIGRATION_PROVENANCE.json'
prov = json.loads(prov_path.read_text())
prov['generated_at_utc'] = now
prov['repository_base_head'] = FUNCTIONAL_HEAD
snapshot = prov.setdefault('live_history_snapshot', {})
snapshot['migration_count'] = 68
snapshot['last'] = {'name': 'clean_ru4_ai_edit_replay_boundary', 'version': '20260905052713'}
history_entries = snapshot.setdefault('entries', [])
by_version = {e.get('version'): e for e in history_entries}
ru4_entries = [
    {
        'name': 'clean_ru4_owner_edit_lock', 'version': '20260905052130',
        'file': '20260904214500_clean_ru4_owner_edit_lock.sql', 'source_version': '20260904214500',
        'exact_byte_mirror': True, 'canonical_raw_md5': '10b57d64ab0d58e6e96b7e09cbd3c748',
        'live_recorded_statement_md5': '10b57d64ab0d58e6e96b7e09cbd3c748'
    },
    {
        'name': 'clean_ru4_close_remaining_search', 'version': '20260905052224',
        'file': '20260904223000_clean_ru4_close_remaining_search.sql', 'source_version': '20260904223000',
        'exact_byte_mirror': True, 'canonical_raw_md5': '4e4e27d9e71be5f51ef5d892884b63a7',
        'live_recorded_statement_md5': '4e4e27d9e71be5f51ef5d892884b63a7'
    },
    {
        'name': 'clean_ru4_ai_edit_conversation', 'version': '20260905052336',
        'file': '20260904230000_clean_ru4_ai_edit_conversation.sql', 'source_version': '20260904230000',
        'exact_byte_mirror': False, 'canonical_raw_md5': 'b976f1ccc2c329d7f2fe0bc43ef36606',
        'live_recorded_statement_md5': 'd3fb1fe33fffcd3c7314a9fa2238de3',
        'transport_deviation': 'one identifier arrived as requester_rsd instead of canonical requester_price_rsd',
        'forward_reconciled_by_live_version': '20260905052651'
    },
    {
        'name': 'clean_ru4_ai_edit_conversation_live_transfer_reconcile', 'version': '20260905052651',
        'file': RECON_SOURCE_FILE, 'source_version': RECON_SOURCE_VERSION,
        'exact_byte_mirror': True, 'canonical_raw_md5': RECON_MD5,
        'live_recorded_statement_md5': RECON_MD5, 'proof_run_id': RECON_PROOF_RUN
    },
    {
        'name': 'clean_ru4_ai_edit_replay_boundary', 'version': '20260905052713',
        'file': '20260904230500_clean_ru4_ai_edit_replay_boundary.sql', 'source_version': '20260904230500',
        'exact_byte_mirror': True, 'canonical_raw_md5': '2a1fdea9f612394709afc44cc6f6b1b9',
        'live_recorded_statement_md5': '2a1fdea9f612394709afc44cc6f6b1b9'
    }
]
for entry in ru4_entries:
    if entry['version'] in by_version:
        by_version[entry['version']].update(entry)
    else:
        history_entries.append(entry)
history_entries.sort(key=lambda e: e.get('version', ''))
prov['pending_forward_migrations'] = []
prov['ru4_live_reconciliation'] = {
    'status': 'CLOSED_LIVE_STRUCTURAL_PROVEN',
    'functional_canonical_source_head': FUNCTIONAL_HEAD,
    'clean_production_proof_run': CLEAN_PROOF_RUN,
    'live_transfer_reconciliation_proof_run': RECON_PROOF_RUN,
    'live_migration_count': 68,
    'live_head': {'version': '20260905052713', 'name': 'clean_ru4_ai_edit_replay_boundary'},
    'transport_incident': {
        'affected_live_version': '20260905052336',
        'historical_record_preserved': True,
        'canonical_raw_md5': 'b976f1ccc2c329d7f2fe0bc43ef36606',
        'live_recorded_statement_md5': 'd3fb1fe33fffcd3c7314a9fa2238de3',
        'repair_live_version': '20260905052651',
        'repair_source_version': RECON_SOURCE_VERSION,
        'repair_source_file': RECON_SOURCE_FILE,
        'repair_raw_md5': RECON_MD5
    },
    'post_live': {
        'needs': 6, 'marketplace_responses': 4, 'agreements': 2, 'app_profiles': 6,
        'need_edit_commands': 0, 'need_revision_events': 0,
        'response_revision_resolution_commands': 0, 'remaining_search_close_commands': 0,
        'policy_bundles': 0, 'policy_rule_refs': 0, 'publication_decisions': 0,
        'd0140_production_publish': 'FAIL_CLOSED'
    }
}
prov_path.write_text(json.dumps(prov, indent=2, ensure_ascii=False) + '\n')

checkpoint = f'''<!-- RU4_LIVE_CHECKPOINT_20260905 -->
## LATEST PHYSICAL CHECKPOINT — RU-4 OWNER EDIT LOCK LIVE / RECONCILED

This block supersedes all older RU-4 target/proof-only/no-live cursor text below.

- functional canonical source promotion: `{FUNCTIONAL_HEAD}`
- exact clean production proof: GitHub Actions `{CLEAN_PROOF_RUN}` — PASS (live-63 replay, owner edit authority, stale/reconfirm, first-Dogovor lock, close remaining search, AI authority, true concurrency, zero residue, D0140 fail-closed, TypeScript, regression)
- live Supabase project: `leqcwgzvjsxugfgzdmth`
- live migration count: `68`
- live head: `20260905052713_clean_ru4_ai_edit_replay_boundary`
- RU-4 live applies:
  - `20260905052130_clean_ru4_owner_edit_lock` <- canonical `20260904214500_clean_ru4_owner_edit_lock.sql` (MD5 exact)
  - `20260905052224_clean_ru4_close_remaining_search` <- canonical `20260904223000_clean_ru4_close_remaining_search.sql` (MD5 exact)
  - `20260905052336_clean_ru4_ai_edit_conversation` <- canonical source had one live-transport identifier deviation; historical live migration preserved
  - `20260905052651_clean_ru4_ai_edit_conversation_live_transfer_reconcile` <- canonical `{RECON_SOURCE_FILE}`, forward-only reconciliation, proof `{RECON_PROOF_RUN}` PASS, MD5 exact
  - `20260905052713_clean_ru4_ai_edit_replay_boundary` <- canonical `20260904230500_clean_ru4_ai_edit_replay_boundary.sql` (MD5 exact)
- post-live structural/auth proof: PASS
- business rows preserved: `needs=6`, `marketplace_responses=4`, `agreements=2`, `app_profiles=6`
- RU-4 command/revision ledgers after deployment: all `0`
- D-0140 production rows: policy bundles `0`, policy rule refs `0`, publication decisions `0`; production publication remains `FAIL_CLOSED`
- authenticated owner boundaries are exposed only where intended; anon is denied; inner AI writer is not authenticated-executable and replay-safe v2 wrapper is the public authenticated boundary
- owner contract now live: edit only before first Dogovor; explicit confirmation -> next DRAFT revision; old unselected Prijave -> `STALE_REVIEW_REQUIRED`; explicit KEEP/UPDATE/WITHDRAW; no auto-republish; first Dogovor permanently locks ordinary parent-Zadatak edit; `Ne traži više nikoga` closes remaining search without rewriting terms
- RU-4 verdict: **CLOSED / LIVE_STRUCTURAL_PROVEN / DO NOT REDO**
- exact next cursor: fresh physical preflight from live `68 / 20260905052713`; resolve the next implementation unit from the governing master/current network; keep D-0140 production policy activation deferred/fail-closed.

'''
for rel in ['docs/implementation/CURRENT_IMPLEMENTATION_HANDOFF.md', 'docs/implementation/LIVE_IMPLEMENTATION_NETWORK.md']:
    path = ROOT / rel
    text = path.read_text()
    if '<!-- RU4_LIVE_CHECKPOINT_20260905 -->' not in text:
        path.write_text(checkpoint + text)

ledger = ROOT / 'docs/implementation/IMPLEMENTATION_STATUS_LEDGER.csv'
rows = list(csv.reader(ledger.open(newline='')))
unit = 'RU-4_OWNER_EDIT_LOCK_READMISSION'
if not any(row and row[0] == unit for row in rows):
    rows.append([
        unit, 'CLOSED', FUNCTIONAL_HEAD,
        'source=20260904214500+20260904223000+20260904230000+20260904230200_forward_reconcile+20260904230500;live=20260905052130+20260905052224+20260905052336+20260905052651+20260905052713',
        'pre-Dogovor owner edit revision authority + stale Prijava resolution + first-Dogovor permanent lock + remaining-search close + replay-safe AI edit',
        'R04/R07/W06 via src/data/ru4Production.ts and promoted screens',
        f'clean production run {CLEAN_PROOF_RUN}; live transfer reconciliation run {RECON_PROOF_RUN}; post-live structural/auth/zero-row proof',
        'DISPOSABLE_RUNTIME_PROVEN+TRUE_CONCURRENCY_PROVEN+ZERO_RESIDUE_PROVEN+LIVE_STRUCTURAL_PROVEN+RN_ALIGNED+PROVENANCE_RECONCILED',
        'YES', 'NONE; D0140 production policy activation remains separate/deferred',
        'DO_NOT_REDO_RU4; fresh physical preflight and resolve next governing-master unit'
    ])
with ledger.open('w', newline='') as handle:
    csv.writer(handle, lineterminator='\n').writerows(rows)

state_path = ROOT / 'docs/implementation/LIVE_MIGRATION_STATE.json'
state = json.loads(state_path.read_text())
state['updated_at'] = now
state['continuity_reconciliation'] = {
    'canonical_base_observed_before_docs_reconciliation': FUNCTIONAL_HEAD,
    'note': 'RU-4 functional source was promoted first; this continuity reconciliation records physical live 68 including the forward-only transfer reconciliation. Resolve current Git HEAD physically before every write.'
}
state['live_migration_count'] = 68
state['live_head'] = {'version': '20260905052713', 'name': 'clean_ru4_ai_edit_replay_boundary'}
pstate = state.setdefault('provenance', {})
pstate['file'] = 'supabase/migrations/MIGRATION_PROVENANCE.json'
pstate['state'] = 'NORMALIZED_TO_LIVE_68_RU4_RECONCILED'
pstate['pending_forward_migrations'] = 0
pstate['ru4_live_aliases'] = ru4_entries
state['ru4'] = {
    'status': 'CLOSED_LIVE_STRUCTURAL_PROVEN',
    'functional_canonical_source_head': FUNCTIONAL_HEAD,
    'owner_lock_document': 'docs/implementation/ru4/RU4_OWNER_LOCK_V1.md',
    'clean_production_proof_run': CLEAN_PROOF_RUN,
    'live_transfer_reconciliation_proof_run': RECON_PROOF_RUN,
    'live_apply': ru4_entries,
    'post_live': prov['ru4_live_reconciliation']['post_live'],
    'auth_boundary': {
        'confirm_need_edit_authenticated': True, 'confirm_need_edit_anon': False,
        'close_remaining_search_authenticated': True, 'close_remaining_search_anon': False,
        'ai_open_edit_authenticated': True, 'ai_open_edit_anon': False,
        'inner_ai_writer_authenticated': False, 'replay_safe_ai_wrapper_authenticated': True,
        'replay_safe_ai_wrapper_anon': False
    },
    'transport_reconciliation': prov['ru4_live_reconciliation']['transport_incident']
}
state['next_allowed_action'] = 'Fresh physical preflight from live 68 / 20260905052713 clean_ru4_ai_edit_replay_boundary; RU-4 is CLOSED/DO_NOT_REDO; resolve the next implementation unit from governing master/current network; keep production D-0140 activation fail-closed/deferred.'
state_path.write_text(json.dumps(state, indent=2, ensure_ascii=False) + '\n')

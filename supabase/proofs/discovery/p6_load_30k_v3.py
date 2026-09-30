"""P6-02 drift confirmation: the 30000-Need sustained SQL screening on the DEPLOYED rollout v3, against the composition the earlier 30k screening measured.

Master plan P6-02: "compare the exactly tested source hashes with the current candidate ... drift or unexplained changes: do not combine different packages as the same proof".
The earlier 30k screening (Round 67) measured the frozen rollout + the proven visibility and PLACES layers, whose TEST-world visibility helper was a hard-coded list of lineages.
The rollout applied to canonical DEV (v3, ledger 212) is that composition with ONE change: the helper derives the TEST-world set from the account classifier. This job
measures BOTH compositions in the same run on the same runner (A = v2 = the tested composition, B = v3 on a lineage table shaped like canonical DEV), with the very same
30k harness (`p6_load_30k.sql`, unchanged): three blocks x 30 samples x 8 cases per composition, then compares them case by case.

Subcommands (the workflow drives them):  measure A | measure B | seed-lineage | compare
It is a disposable local SQL-only benchmark (no canonical DEV access, no native/HTTP claim, not concurrency); it does not change any existing proof.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import platform
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

PUBLIC = Path('/tmp/p6-load-v3-evidence')
PRIVATE = Path('/tmp/p6-load-v3-private')
SQL = Path('supabase/proofs/discovery/p6_load_30k.sql')
BASE_SCRIPT = Path('supabase/proofs/discovery/p6_load_30k.py')
V2 = Path('supabase/candidates/p6_discovery_rollout_v2.sql')
V3 = Path('supabase/candidates/p6_discovery_rollout_v3.sql')
REVERT = Path('supabase/candidates/p6_discovery_rollout_v2_revert.sql')
LIVE = Path('supabase/proofs/discovery/p6_rollout_v3_live_observation.json')
OWN = Path('supabase/proofs/discovery/p6_load_30k_v3.py')
WORKFLOW = Path('.github/workflows/p6-round71-load-v3.yml')
PINNED_SHA256 = {
    V2: 'da01a4f1bd6454a8229c2d7c3fdcc951e944d0af69d4e99fc637d42f8c72f346',
    V3: 'ec92c2ee50b3191655f8036ae2391c6bacd0f571cc7a1f2c3252c891122cecc9',
    REVERT: '96ec31a0b3e171c32874d9c5976cd55000786430fd0b8e82c62488867261ff30',
}
# What canonical DEV runs (readback of 2026-09-30, receipts/20260930_p6_rollout_v3_application.receipt.json): the RPC body is byte-identical in v2 and v3.
RPC_BODY_MD5 = '1c60224483697732c496df5b9207f08f'
V3_HELPER_DEF_MD5 = '4ee16169f4ee6ba7f79f4bd11b172ad8'
RPC_CASES = ('PAGE_ALL', 'PAGE_PEOPLE2', 'MAP_DENSE', 'MAP_SPARSE', 'PLACES_SPARSE', 'EXACT_PUBLIC')
DRIFT_LIMIT = 1.25   # the plan's own same-runner stability tolerance (25 %), applied to the median block p95 of B against A

CATALOG_SQL = r"""select jsonb_build_object(
 'rpcBodyMd5',(select md5(replace(p.prosrc,E'\r\n',E'\n')) from pg_proc p where p.oid=to_regprocedure('public.rpc_discovery_v1(jsonb)')),
 'helper',(select jsonb_build_object('defMd5',md5(pg_get_functiondef(p.oid)),'src',p.prosrc) from pg_proc p where p.oid=to_regprocedure('rls_private.p6_discovery_test_world_accounts()')),
 'lineage',(select coalesce(jsonb_object_agg(x.lineage,x.n),'{}'::jsonb) from (select lineage,count(*) n from private.account_lineage_v5 group by 1) x),
 'policyUsesHelper',position('p6_discovery_test_world_accounts' in coalesce((select qual from pg_policies where schemaname='public' and tablename='needs' and policyname='needs_public_discovery'),''))>0,
 'authTableSelect',has_table_privilege('authenticated','public.needs','SELECT'),
 'anonTableSelect',has_table_privilege('anon','public.needs','SELECT'))"""


def require(value, code):
    if not value:
        raise ValueError(code)


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def psql(text: str, timeout: int = 120) -> subprocess.CompletedProcess:
    return subprocess.run(['psql', os.environ['DB_URL'], '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', text], capture_output=True, text=True, timeout=timeout)


def base_module():
    spec = importlib.util.spec_from_file_location('p6_load_30k_base', BASE_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def admission(report: dict) -> None:
    require(os.getenv('CI') == '1' and os.getenv('GITHUB_ACTIONS') == 'true', 'P6_V3LOAD_CI_ONLY')
    u = urlparse(os.environ['DB_URL'])
    require(u.hostname == '127.0.0.1' and u.port == 54322 and u.path == '/postgres' and u.username == 'postgres', 'P6_V3LOAD_LOCAL_ONLY')
    require(os.environ['DB_URL'] == os.environ['RU5_DEVICE_DB_URL'], 'P6_V3LOAD_TARGET_MISMATCH')
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    require(head == report['sourceSha'], 'P6_V3LOAD_HEAD')
    hashes = {}
    for path in (SQL, BASE_SCRIPT, V2, V3, REVERT, LIVE, OWN, WORKFLOW):
        raw = path.read_bytes()
        require(raw == subprocess.check_output(['git', 'show', head + ':' + str(path)]), 'P6_V3LOAD_UNCOMMITTED_SOURCE')
        hashes[str(path)] = hashlib.sha256(raw).hexdigest()
    for path, expected in PINNED_SHA256.items():
        require(hashes[str(path)] == expected, 'P6_V3LOAD_CANDIDATE_DRIFT')
    report['sourceHashes'] = hashes


def catalog() -> dict:
    run = psql(CATALOG_SQL)
    require(run.returncode == 0, 'P6_V3LOAD_CATALOG')
    return json.loads(run.stdout.strip().splitlines()[-1])


def measure(variant: str) -> int:
    require(variant in ('A', 'B'), 'P6_V3LOAD_VARIANT')
    PUBLIC.mkdir(parents=True, exist_ok=True)
    PRIVATE.mkdir(parents=True, exist_ok=True)
    report = {'unit': 'P6_30000_LOAD_V3_CONFIRMATION', 'variant': variant,
              'composition': 'A: rollout v2 = frozen rollout + visibility layer with a fixed lineage list + PLACES layer (the composition the earlier 30k screening measured)' if variant == 'A'
              else 'B: rollout v3 = the same composition with the TEST-world set derived from the account classifier (what canonical DEV runs), lineage table shaped like canonical DEV',
              'sourceSha': os.getenv('GITHUB_SHA'), 'result': 'FAIL', 'sourceHashes': {}, 'liveAccess': False, 'native': False, 'p6Finished': False}
    stage = 'ADMISSION'
    try:
        admission(report)
        stage = 'STATE'
        state = catalog()
        require(state['rpcBodyMd5'] == RPC_BODY_MD5, 'P6_V3LOAD_RPC_BODY_NOT_THE_DEPLOYED_ONE')
        require(state['helper'] is not None and state['policyUsesHelper'], 'P6_V3LOAD_HELPER_ABSENT')
        require(state['authTableSelect'] is False and state['anonTableSelect'] is False, 'P6_V3LOAD_PKG045B_NOT_RESTRICTED')
        live = json.loads(LIVE.read_text(encoding='utf-8'))
        if variant == 'A':
            require('DEV_ACCEPTANCE_QA' in state['helper']['src'] and 'account_visibility_world' not in state['helper']['src'], 'P6_V3LOAD_A_HELPER_IS_NOT_THE_FIXED_LIST')
            require(state['lineage'] == {}, 'P6_V3LOAD_A_LINEAGE_TABLE_NOT_EMPTY')
        else:
            require(state['helper']['defMd5'] == V3_HELPER_DEF_MD5 and 'account_visibility_world' in state['helper']['src'], 'P6_V3LOAD_B_HELPER_IS_NOT_THE_DEPLOYED_ONE')
            require(state['lineage'] == live['accountLineageCounts'], 'P6_V3LOAD_B_LINEAGE_SHAPE')
        report['admittedState'] = {'rpcBodyMd5': state['rpcBodyMd5'], 'helperDefMd5': state['helper']['defMd5'], 'lineage': state['lineage']}

        stage = 'SQL_LOAD'
        run = subprocess.run(['psql', os.environ['DB_URL'], '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-f', str(SQL)],
                             capture_output=True, text=True, timeout=5400)
        (PRIVATE / f'load-{variant}.stdout').write_text(run.stdout)
        (PRIVATE / f'load-{variant}.stderr').write_text(run.stderr)
        if run.returncode:
            match = re.search(r'(?:ERROR|FATAL):\s+([0-9A-Z]{5}):', run.stderr)
            if match:
                report['sqlState'] = match.group(1)
            diagnostic = re.search(r'(P6_[A-Z0-9_]+(?::[^\n]*)?)', run.stderr)
            if diagnostic:
                report['diagnostic'] = diagnostic.group(1)[:240]
            raise ValueError('P6_V3LOAD_SQL_REFUSED')
        require('PASS P6_LOAD_30000_CORRECTNESS_AND_720_SAMPLES' in run.stdout.splitlines(), 'P6_V3LOAD_PASS_MARKER')

        stage = 'EVIDENCE'
        lines = run.stdout.splitlines()
        env = json.loads(next(x[len('P6_LOAD_ENV '):] for x in lines if x.startswith('P6_LOAD_ENV ')))
        samples = json.loads(next(x[len('P6_LOAD_SAMPLES '):] for x in lines if x.startswith('P6_LOAD_SAMPLES ')))
        metrics = base_module().summarize(samples)
        require(env['syntheticNeeds'] == 30000 and env['dense'] == 12000 and env['sparse'] == 12000 and env['remote'] == 3000 and env['pointFreeOnsite'] == 3000, 'P6_V3LOAD_ENV_COUNTS')
        require(env['rlsBypassed'] is False and env['blocks'] == 3 and env['samplesPerBlockCase'] == 30, 'P6_V3LOAD_ENV_AUTH')
        cpu = next((x.split(':', 1)[1].strip() for x in Path('/proc/cpuinfo').read_text().splitlines() if x.startswith('model name')), 'unknown')
        report.update(result='PASS', environment={**env, 'os': platform.platform(), 'cpuCount': os.cpu_count(), 'cpuModel': cpu, 'runner': os.getenv('RUNNER_NAME'),
                                                  'quantiles': 'nearest-rank; 30 per block/case; no pooled percentile',
                                                  'cache': 'warm after three warmups per case; single backend; no cold-cache claim'},
                      metrics=metrics, performanceScreeningPass=metrics['allRpcUnder1000Ms'], sameRunnerStabilityPass=metrics['allRpcSpreadWithin25Percent'])
        payload = json.dumps(samples, indent=2) + '\n'
        (PUBLIC / f'samples-{variant}.json').write_text(payload)
        report['sampleSha256'] = hashlib.sha256(payload.encode()).hexdigest()
    except Exception as error:  # noqa: BLE001
        report['failure'] = {'stage': stage, 'code': str(error) if re.fullmatch(r'P6_[A-Z0-9_]+', str(error)) else 'P6_V3LOAD_FAILED'}
        if isinstance(error, subprocess.TimeoutExpired):
            report['failure']['code'] = 'P6_V3LOAD_TIMEOUT'
    finally:
        (PUBLIC / f'receipt-{variant}.json').write_text(json.dumps(report, indent=2) + '\n')
        print(report['result'] + f' P6_30000_LOAD_V3_CONFIRMATION variant={variant}')
    return 0 if report['result'] == 'PASS' else 1


def seed_lineage() -> int:
    """The lineage table of canonical DEV (5 rows, all TEST world), created the way the rollout v3 proof creates it."""
    require(os.getenv('CI') == '1' and urlparse(os.environ['DB_URL']).hostname == '127.0.0.1', 'P6_V3LOAD_LOCAL_ONLY')
    counts = json.loads(LIVE.read_text(encoding='utf-8'))['accountLineageCounts']
    rows = [lineage for lineage, n in counts.items() for _ in range(n)]
    values = ','.join(f"(ids[{at + 1}],'{lineage}','Disposable proof shaped like canonical DEV','p6-load-v3')" for at, lineage in enumerate(rows))
    run = psql(f"""do $seed$
declare ids uuid[]:=array(select gen_random_uuid() from generate_series(1,{len(rows)}));
begin
  insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  select id,'authenticated','authenticated','p6-lineage-'||id||'@proof.invalid',statement_timestamp(),
    '{{"provider":"email","providers":["email"]}}'::jsonb,'{{"full_name":"Disposable lineage proof"}}'::jsonb,statement_timestamp(),statement_timestamp()
  from unnest(ids) id;
  insert into private.account_lineage_v5(account_id,lineage,reason,source_ref) values {values};
end $seed$;""")
    require(run.returncode == 0, 'P6_V3LOAD_SEED_LINEAGE')
    print(f'seeded {len(rows)} lineage rows: {counts}')
    return 0


def median_block_p95(case_row: dict) -> float:
    return sorted(block['p95Ms'] for block in case_row['blocks'])[1]


def compare() -> int:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    report = {'unit': 'P6_30000_LOAD_V3_COMPARISON', 'sourceSha': os.getenv('GITHUB_SHA'), 'result': 'FAIL', 'p6Finished': False}
    try:
        a = json.loads((PUBLIC / 'receipt-A.json').read_text())
        b = json.loads((PUBLIC / 'receipt-B.json').read_text())
        require(a['result'] == 'PASS' and b['result'] == 'PASS', 'P6_V3LOAD_A_OR_B_FAILED')
        require(a['sourceSha'] == b['sourceSha'] and a['environment']['runner'] == b['environment']['runner'], 'P6_V3LOAD_NOT_THE_SAME_RUN')
        rows = []
        for case in RPC_CASES:
            ra = next(x for x in a['metrics']['cases'] if x['case'] == case)
            rb = next(x for x in b['metrics']['cases'] if x['case'] == case)
            ma, mb = median_block_p95(ra), median_block_p95(rb)
            rows.append({'case': case, 'A_worstP95Ms': ra['worstP95Ms'], 'B_worstP95Ms': rb['worstP95Ms'], 'A_medianBlockP95Ms': ma, 'B_medianBlockP95Ms': mb,
                         'ratioB_over_A': round(mb / ma, 3) if ma > 0 else None, 'B_under1000Ms': rb['under1000Ms'], 'A_under1000Ms': ra['under1000Ms']})
        report['cases'] = rows
        report['deployedCompositionUnder1000Ms'] = all(x['B_under1000Ms'] for x in rows)
        report['testedCompositionUnder1000Ms'] = all(x['A_under1000Ms'] for x in rows)
        report['noMaterialDrift'] = all(x['ratioB_over_A'] is not None and x['ratioB_over_A'] <= DRIFT_LIMIT for x in rows)
        report['driftLimit'] = DRIFT_LIMIT
        report['sameRunner'] = a['environment']['runner']
        print(f"{'case':<14}{'A worst p95':>12}{'B worst p95':>12}{'A med p95':>11}{'B med p95':>11}{'B/A':>7}")
        for x in rows:
            print(f"{x['case']:<14}{x['A_worstP95Ms']:>12}{x['B_worstP95Ms']:>12}{x['A_medianBlockP95Ms']:>11}{x['B_medianBlockP95Ms']:>11}{str(x['ratioB_over_A']):>7}")
        require(report['deployedCompositionUnder1000Ms'], 'P6_V3LOAD_DEPLOYED_OVER_1000MS')
        require(report['noMaterialDrift'], 'P6_V3LOAD_MATERIAL_DRIFT')
        report['result'] = 'PASS'
    except Exception as error:  # noqa: BLE001
        report['failure'] = {'code': str(error) if re.fullmatch(r'P6_[A-Z0-9_]+', str(error)) else 'P6_V3LOAD_COMPARE_FAILED'}
    finally:
        report['limits'] = [
            'Disposable local SQL-only benchmark on one runner, one backend connection, warm cache; not HTTP, not network, not native, not concurrent users.',
            'Both compositions are measured with the same unchanged 30k harness (two actors; the lineage table is empty for A and has the 5 rows of canonical DEV for B).',
            'The 1000 ms ceiling is the existing SQL screening ceiling, not an end-to-end SLA; the drift limit is the plan\'s 25 % same-runner tolerance on the median block p95.',
            'A PASS confirms that the deployed v3 keeps the tested composition\'s cost; it does not re-open or replace the earlier 30k screening.']
        (PUBLIC / 'comparison-receipt.json').write_text(json.dumps(report, indent=2) + '\n')
        print(report['result'] + ' P6_30000_LOAD_V3_COMPARISON')
    return 0 if report['result'] == 'PASS' else 1


def main(argv: list[str]) -> int:
    command = argv[1] if len(argv) > 1 else ''
    if command == 'measure' and len(argv) == 3:
        return measure(argv[2])
    if command == 'seed-lineage':
        return seed_lineage()
    if command == 'compare':
        return compare()
    print('usage: p6_load_30k_v3.py measure A|B | seed-lineage | compare', file=sys.stderr)
    return 2


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))

"""P6 Round49: repeated timings with access controls intact; never a live apply."""
from __future__ import annotations
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import re
import subprocess
import sys
from urllib.parse import urlparse

PREFIX = 'supabase/proofs/discovery/'
PRIVATE = Path('/tmp/p6-discovery-private')
PUBLIC = Path('/tmp/p6-discovery-evidence')
DOCS = Path('docs/implementation/product-v1-closure-20260926/finalization-20260927')
CASES = ('PAGE', 'MAP', 'PLACES', 'EXACT_PUBLIC', 'PAGE_PEOPLE2', 'SCAN', 'AREA', 'COVERAGE')
RPC_CASES = CASES[:5]
CANDIDATES = {
 'supabase/candidates/p6_discovery_all.sql': '1d7edb92f85cb84099f0bc02a3b8edebea40907ec18fa861c14408bcf10f6e2e',
 'supabase/candidates/p6_discovery_cost_v2.sql': '4eae3b7befc498318c504bc40c344d72962c0a7e97dcb426bb65df3637944ba3',
 'supabase/candidates/p6_discovery_cost_v3.sql': '88cc4d2271ac4a5695a7b831737f80ffcaecc40b2cc9e887200d90825191d05b',
}
ORIGINAL_PROOF = PREFIX + 'p6_discovery_all_proof.sql'
GROUPS = ('CURRENT_CLIENT_ORACLE_208_VECTORS', 'HELPERS_AND_INVOKER_ENVELOPE',
 '1004_ROWS_TIES_MICROSECONDS_SCOPES_EXACT_ALLOWLIST', 'ZERO_ONE_AND_STRICT_CURSOR_ANCHOR_REFUSALS',
 'MAP_0_1_100_1000_3000_BOUNDED_COMPLETE_COVERAGE', 'MAP_DENSE_SPARSE_WRAPPED_REMOTE_AND_STRICT_REQUEST',
 'PLACES_EXACT_COUNTS_COMPLETE_TUPLE_PAGING_AND_SCOPE_BINDING', 'AUTH_AND_ANON_REFUSALS',
 'COVERAGE_WITH_RESTRICTED_COLUMNS', 'EXISTING_AUTHORITY_UNCHANGED', 'ROLLBACK_NO_RPC_OR_FIXTURES_RETAINED',
 'REPEAT_720_SAMPLES_RLS_AND_PAYLOAD_GUARDS')
OWN_FILES = (PREFIX+'p6_repeatability.py', PREFIX+'p6_repeatability.sql',
 PREFIX+'test_p6_repeatability.py', '.github/workflows/p6-repeatability-proof.yml')


def require(condition: bool, code: str) -> None:
    if not condition:
        raise ValueError(code)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def summarize(samples: list[dict]) -> dict:
    """Do not manufacture a percentile from missing, duplicated or mixed samples."""
    require(len(samples) == 720, 'P6_REPEAT_SAMPLE_COUNT')
    seen = set()
    rows = []
    keys = {'block', 'case', 'sample', 'ms', 'responseBytes', 'resultSize'}
    for x in samples:
        require(isinstance(x, dict) and set(x) == keys, 'P6_REPEAT_SAMPLE_SHAPE')
        require(type(x['block']) is int and x['block'] in (1, 2, 3), 'P6_REPEAT_BLOCK')
        require(type(x['sample']) is int and 1 <= x['sample'] <= 30 and x['case'] in CASES, 'P6_REPEAT_CASE')
        identity = (x['block'], x['case'], x['sample'])
        require(identity not in seen, 'P6_REPEAT_DUPLICATE')
        seen.add(identity)
        require(type(x['ms']) in (int, float) and math.isfinite(x['ms']) and x['ms'] >= 0, 'P6_REPEAT_TIME')
        for field in ('responseBytes', 'resultSize'):
            require(type(x[field]) is int and x[field] >= 0, 'P6_REPEAT_SIZE')
    for case in CASES:
        blocks = []
        for block in (1, 2, 3):
            selected = [x for x in samples if x['case'] == case and x['block'] == block]
            require(len(selected) == 30, 'P6_REPEAT_INCOMPLETE_BLOCK')
            times = sorted(x['ms'] for x in selected)
            blocks.append({'block': block, 'n': 30, 'p50Ms': times[14], 'p95Ms': times[28], 'maxMs': times[-1],
              'maxResponseBytes': max(x['responseBytes'] for x in selected), 'maxResultSize': max(x['resultSize'] for x in selected)})
        p95 = [x['p95Ms'] for x in blocks]
        low, high = min(p95), max(p95)
        # Ratio is undefined for a zero-duration control, not Infinity in JSON.
        spread = high / low if low > 0 else (1.0 if high == 0 else None)
        rows.append({'case': case, 'blocks': blocks, 'worstP95Ms': high,
          'p95SpreadRatio': None if spread is None else round(spread, 6),
          'within20Percent': spread is not None and spread <= 1.2,
          'under1000Ms': high <= 1000})
    rpc = [x for x in rows if x['case'] in RPC_CASES]
    return {'cases': rows, 'samples': len(samples),
      'allRpcBlocksUnder1000Ms': all(x['under1000Ms'] for x in rpc),
      'allRpcBlockSpreadsWithin20Percent': all(x['within20Percent'] for x in rpc),
      'p6Finished': False, 'productionPerformanceAccepted': False}


def compose(root: Path) -> str:
    proof = (root/ORIGINAL_PROOF).read_text()
    require(digest((root/ORIGINAL_PROOF).read_bytes()) == '007098b59de47872c726fe50a8ec92e1fc6fb2fe2e31595d0eb112c8bc345c59', 'P6_ORIGINAL_PROOF_DRIFT')
    for path, sha in CANDIDATES.items():
        require(digest((root/path).read_bytes()) == sha, 'P6_CANDIDATE_DRIFT')
    anchor = "select set_config('request.jwt.claim.sub','',true);"
    include = '\\ir ../../candidates/p6_discovery_all.sql'
    require(proof.count(anchor) == proof.count(include) == 1, 'P6_PROOF_ANCHOR_DRIFT')
    # The original authority, anonymous, auth-null and rollback checks remain.
    proof = proof.replace(include, '\n'.join("\\i '"+str(root/path)+"'" for path in CANDIDATES))
    return proof.replace(anchor, (root/(PREFIX+'p6_repeatability.sql')).read_text()+'\n'+anchor)


def run() -> int:
    result = {'unit': 'P6_REPEATABILITY_AND_AUTHORIZED_SCAN', 'result': 'FAIL', 'sourceSha': os.getenv('GITHUB_SHA'),
      'liveAccess': False, 'serverApplied': False, 'providerCalled': False, 'nativeProven': False,
      'productionWired': False, 'p6Finished': False, 'sourceHashes': {}}
    stage = 'ADMISSION'
    try:
        require(os.getenv('CI') == '1' and os.getenv('GITHUB_ACTIONS') == 'true', 'P6_CI_ONLY')
        require(os.getenv('PRE_V3_ARTIFACT_DIR') == str(PRIVATE) and os.getenv('P6_PUBLIC_ARTIFACT_DIR') == str(PUBLIC), 'P6_ARTIFACT_SCOPE')
        url = urlparse(os.environ['DB_URL'])
        require(url.hostname == '127.0.0.1' and url.port == 54322 and url.path == '/postgres' and url.username == 'postgres', 'P6_LOOPBACK_ONLY')
        require(os.environ['DB_URL'] == os.environ['RU5_DEVICE_DB_URL'], 'P6_LOCAL_TARGET_MISMATCH')
        subprocess.run(['node', '--input-type=module', '-e', "import {assertLocalDeviceProofTargets} from './supabase/proofs/ru5_device_ui_local_guard.mjs';assertLocalDeviceProofTargets(process.env.RU5_DEVICE_SUPABASE_URL,process.env.RU5_DEVICE_DB_URL)"], check=True)
        root = Path.cwd()
        sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
        require(sha == result['sourceSha'], 'P6_CHECKOUT_MISMATCH')
        stage = 'SOURCE_BINDING'
        for path in (*CANDIDATES, ORIGINAL_PROOF, *OWN_FILES, PREFIX+'p6_discovery_parity_vectors.mjs', 'package.json', 'package-lock.json'):
            raw = (root/path).read_bytes()
            require(raw == subprocess.check_output(['git', 'show', sha+':'+path]), 'P6_UNCOMMITTED_SOURCE')
            result['sourceHashes'][path] = digest(raw)
        result['candidateStackHashes'] = CANDIDATES
        text = compose(root)
        PRIVATE.mkdir(exist_ok=True); PUBLIC.mkdir(exist_ok=True)
        composed = PRIVATE/'p6-repeat.sql'; composed.write_text(text)
        result['composedProofSha256'] = digest(text.encode())
        stage = 'CURRENT_CLIENT_ORACLE'
        vectors = subprocess.check_output(['node', PREFIX+'p6_discovery_parity_vectors.mjs'], text=True, timeout=30)
        require(len(re.findall(r'^do \$p6_vector\$', vectors, re.M)) == 208, 'P6_ORACLE_COUNT')
        vp = PRIVATE/'repeat-vectors.sql'; vp.write_text(vectors)
        stage = 'REAL_SQL'
        command = ['psql', os.environ['DB_URL'], '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose',
         '-v', 'p6_disposable=SOURCE_ONLY_ROLLBACK', '-v', 'p6_vectors_path='+str(vp), '-f', str(composed)]
        with (PRIVATE/'repeat.stdout').open('w') as output, (PRIVATE/'repeat.stderr').open('w') as error:
            process = subprocess.run(command, stdout=output, stderr=error, timeout=1800)
        stdout = (PRIVATE/'repeat.stdout').read_text(); stderr = (PRIVATE/'repeat.stderr').read_text()
        result['checks'] = [{'name': x, 'result': 'PASS' if 'PASS P6_'+x in stdout.splitlines() else 'NOT_PASSED'} for x in GROUPS]
        if process.returncode:
            state = re.search(r'(?:ERROR|FATAL):\s+([0-9A-Z]{5}):', stderr)
            code = re.search(r'(P6_REPEAT_[A-Z0-9_]+)', stderr)
            if state: result['sqlState'] = state[1]
            if code: result['diagnosticCode'] = code[1]
            raise ValueError('P6_SQL_PROOF_REFUSED')
        require(all(x['result'] == 'PASS' for x in result['checks']), 'P6_REQUIRED_CHECK_MISSING')
        stage = 'MEASUREMENT_VALIDATION'
        raw = json.loads(next(x[len('P6_REPEAT_SAMPLES '):] for x in stdout.splitlines() if x.startswith('P6_REPEAT_SAMPLES ')))
        env = json.loads(next(x[len('P6_REPEAT_ENV '):] for x in stdout.splitlines() if x.startswith('P6_REPEAT_ENV ')))
        metrics = summarize(raw)
        require(env['rlsBypassed'] is False and env['blocks'] == 3 and env['concurrency'] == 1, 'P6_ENV_SCOPE')
        cpu_line = next((x.split(':',1)[1].strip() for x in Path('/proc/cpuinfo').read_text().splitlines() if x.startswith('model name')), 'unknown')
        result['environment'] = {**env, 'os': platform.platform(), 'cpuCount': os.cpu_count(), 'cpuModel': cpu_line,
          'runner': os.getenv('RUNNER_NAME'), 'quantiles': 'nearest-rank, 30 per block/case; no pooled percentile',
          'cache': 'warm; 5 warmups per case; three interleaved blocks in one backend; not cold-cache'}
        result['metrics'] = metrics
        payload = json.dumps(raw, indent=2)+'\n'
        (PUBLIC/'p6-repeat-samples.json').write_text(payload)
        result['sampleFileSha256'] = digest(payload.encode())
        result['result'] = 'PASS'  # Evidence validity, explicitly not budget or P6 acceptance.
    except Exception as exc:
        result['result'] = 'FAIL'
        result['failure'] = {'stage': stage, 'category': 'PROOF_REFUSED'}
        if re.fullmatch(r'P6_[A-Z0-9_]+', str(exc)): result['failure']['code'] = str(exc)
    finally:
        PUBLIC.mkdir(exist_ok=True)
        result['limits'] = ['Historical PKG045b target, not live DEV or native acceptance',
          'One skewed synthetic distribution, one connection, warm cache; no concurrent or 30000-scale proof',
          'SCAN includes storage, visibility and RLS; it is not a pure RLS timer and subtraction is not exact attribution',
          'AREA/COVERAGE controls retain RLS and differ in projection only; they are not application readers',
          'No new HTTP proof; same candidate bytes had Round48 Auth/PostgREST evidence',
          'All completion conditions, production integration and exact native proof still govern P6 closure']
        (PUBLIC/'p6-repeatability-receipt.json').write_text(json.dumps(result, indent=2)+'\n')
        print(result['result']+' P6_REPEATABILITY_AND_AUTHORIZED_SCAN')
    return 0 if result['result'] == 'PASS' else 1


def record() -> None:
    require(os.getenv('CI') == '1' and os.getenv('GITHUB_ACTIONS') == 'true', 'P6_CI_ONLY')
    result = json.loads((PUBLIC/'p6-repeatability-receipt.json').read_text())
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    require(result['result'] == 'PASS' and result['sourceSha'] == sha, 'P6_RECORD_SOURCE_OR_RESULT')
    require(result['p6Finished'] is False and result['metrics']['productionPerformanceAccepted'] is False, 'P6_FALSE_COMPLETION')
    require('teardown exit=0' in (PUBLIC/'stages.txt').read_text(), 'P6_TEARDOWN_REQUIRED')
    require(digest((PUBLIC/'p6-repeat-samples.json').read_bytes()) == result['sampleFileSha256'], 'P6_SAMPLE_HASH_DRIFT')
    require(summarize(json.loads((PUBLIC/'p6-repeat-samples.json').read_text())) == result['metrics'], 'P6_METRICS_DRIFT')
    run_id = os.environ['GITHUB_RUN_ID']; require(bool(re.fullmatch(r'\d+', run_id)), 'P6_RUN_ID')
    report = DOCS/'ROUND_49_P6_REPEATABILITY.md'; receipt = DOCS/'ROUND_49_P6_CHECKS.json'
    require(not report.exists() and not receipt.exists(), 'P6_ROUND_ALREADY_RECORDED')
    (DOCS/'round49').mkdir(exist_ok=True)
    sample_path = DOCS/'round49/p6-repeat-samples.json'
    sample_path.write_bytes((PUBLIC/'p6-repeat-samples.json').read_bytes())
    result.update(run=run_id, teardown='PASS', samplePath=str(sample_path))
    receipt.write_text(json.dumps(result, indent=2)+'\n')
    metrics = result['metrics']; by_case = {x['case']: x for x in metrics['cases']}
    table = '\n'.join('| '+x['case']+' | '+' | '.join(str(b['p95Ms']) for b in x['blocks'])+' | '+str(x['worstP95Ms'])+' |' for x in metrics['cases'])
    report.write_text(f'''# Round49 — same-process repeatability and authorized scan controls

## Problem / decision / exact scope

Round48 improved same-run collection timings, but identical SQL passed the 1000ms ceiling on one runner and failed it on another. Do not select only the faster run. This package changes no candidate or production application behavior: it repeats the exact original+cost_v2+cost_v3 stack with three interleaved measurement blocks on one runner/backend, and adds authorized minimal-scan, locality and coverage controls.

Tested source: {sha}. Actions run: {run_id}. The eleven original SQL groups plus the 720-sample/RLS/payload group PASS. The exact candidate hashes are in ROUND_49_P6_CHECKS.json. Canonical DEV, Edge, certificate-controlled functions, RLS/policies, grants, dependencies, TaskCard/Peek and FULL-return code are unchanged.

## Predeclared method and results (milliseconds)

Eight cases, three blocks, 30 samples per block/case = 720; five warmups per case. Nearest-rank p50/p95/max and response sizes are retained per block; no pooled percentile. Each read is a separate psql statement under the original 60-second timeout. Order reverses across samples to reduce fixed ordering bias. Every read asserts authenticated identity, active RLS and normal trigger mode; every response matches the initial authoritative payload after observation timestamps only are removed. RPC cursors/anchors remain real and frozen for these static fixtures. No filtering, policy or authorization check is disabled to improve timings.

| Case | Block 1 p95 | Block 2 p95 | Block 3 p95 | Worst p95 |
| --- | --- | --- | --- | --- |
{table}

All five RPC cases under1000ms in all three blocks: {metrics['allRpcBlocksUnder1000Ms']}. All five RPC p95 spreads at most20% within this runner: {metrics['allRpcBlockSpreadsWithin20Percent']}. The20% spread is a diagnostic screening rule set before execution, not an owner-approved production target or proof of performance on other machines. Valid evidence PASS is distinct from either screening result and from P6 acceptance.

SCAN counts public eligible IDs with the same unchanged row policies, without P6 text/date/locality/capacity projection. AREA adds public display-locality work; COVERAGE adds the exact existing covered_slots authority using the allowed ID-only composite input. Their worst p95 is respectively {by_case['SCAN']['worstP95Ms']}, {by_case['AREA']['worstP95Ms']}, {by_case['COVERAGE']['worstP95Ms']}ms. These observations distinguish an authorized-scan baseline from added projection work; do not subtract timings and call the difference exact RLS cost. PAGE_PEOPLE2 exercises the full-set capacity predicate rather than the people=1 fast path.

Environment: PostgreSQL {result['environment']['postgres']}; {result['environment']['cpuModel']}; {result['environment']['cpuCount']} reported CPUs; {result['environment']['totalNeeds']} total Needs /3000 matched. One skewed distribution with1500 coincident points, sparse public points and100 point-free tasks. Warm cache, one connection, no network transfer, device rendering, concurrency or30000-scale acceptance. Source-bound samples and environment are retained in the receipt and round49/. Previous slower runs remain valid historical evidence.

## Authority and safety / applied or not

All synthetic data and P6 helper installation stay in the existing disposable transaction and roll back. Original anonymous/auth-null, private-column, unchanged function/ACL/policy/certificate and rollback assertions are retained. Existing PKG045b is replayed only as the documented historical test target; no new DEV package or approval is exercised. Teardown without backup PASS. This package does not claim a new live, HTTP, provider or native test.

## Owner completion instruction (supersedes automatic phase continuation)

Continue the existing P6 priority only. Do not declare completion from source, SQL, CI or candidate readiness. P6 completion requires stable sufficiently evidenced performance; all four modes; paging owner and stale-response fencing; an actually connected production client; integrated map/list/filters; preserved FULL/pin/Peek/detail/Back with scroll/viewport/selection; large-data and memory/ANR acceptance; any necessary authorized and confirmed server rollout; and exact matching native build evidence.

Only when all applicable conditions are closed, stop and write **P6 ZAVRŠEN**, followed by what closed, final HEAD, DEV changes, native build, final tests/performance and anything remaining. Do not proceed to another large phase without the owner's next instruction. Current P6 status: **OPEN**. Missing current-native, client integration and rollout evidence is not supplied by this measurement package.

## Control / next action

The existing redovi.json B04/B05 and root finalization carry the result and stop instruction; the existing generator must run before its views are committed. No second tracker, hosted dashboard replacement or false phone light is created. Hosted publication remains unverified. Next: use the authorized-scan/control findings to choose the smallest safe performance repair or a specifically scoped authority candidate, then complete wider distributions/capacity/load evidence and the planned paging/map/locality client work. Protected live application and device acceptance remain separate; no priority change or next-phase work is authorized here.

Method references: PostgreSQL17 row security and EXPLAIN documentation (https://www.postgresql.org/docs/17/ddl-rowsecurity.html ; https://www.postgresql.org/docs/17/using-explain.html). These explain measurement boundaries, not USKOČI acceptance.
''')
    tracker_path = Path('docs/control/redovi.json'); tracker = json.loads(tracker_path.read_text())
    root = tracker['finalization']
    root['p6_owner_stop'] = {'date':'2026-09-28','instruction':'P6 only; when all relevant server/client/performance/native conditions close, report P6 ZAVRŠEN and STOP for owner instruction.',
     'evidence':str(report),'completed':False}
    root['p6_discovery_contract'] = 'Round49 exact unchanged cost_v3 candidate: repeated SQL evidence; production wiring, rollout, wider load and native acceptance remain OPEN. '+str(report)
    for name in ('B04','B05'):
        row = next(x for x in tracker['redovi'] if x['id'] == name); f = row['finalization']
        f['round49'] = {'source':sha,'run':run_id,'samples':720,'rpcScreening':metrics['allRpcBlocksUnder1000Ms'],
          'sameRunnerSpreadScreening':metrics['allRpcBlockSpreadsWithin20Percent'],'applied':False,'native':False,'p6Finished':False}
        f['evidence'] = '; '.join(filter(None, (f.get('evidence'),str(report),str(receipt))))
        f['performance'] = 'Round49: three blocks x30 x8 cases on one runner, same RLS/identity/payload guards; 720 timings. RPC1000ms all blocks: '+str(metrics['allRpcBlocksUnder1000Ms'])+'. Other distributions/concurrency/native remain OPEN.'
        f['test'] += ' Round49 '+sha[:8]+' / run'+run_id+': original11 SQL groups + repeatability guards;720 samples. No new native/HTTP acceptance.'
        f['status'] = 'P6 REPEATED COST EVIDENCE / PRODUCTION INTEGRATION+ROLLOUT+NATIVE OPEN / STOP ONLY AFTER FULL P6'
        row['sledece'] = 'Follow existing P6 priority: diagnose authorized-scan vs projection cost, wider distributions/capacity/load, paging/fences/adapters, authorized rollout and native acceptance; STOP at complete P6 for owner.'
    tracker_path.write_text(json.dumps(tracker,ensure_ascii=False,indent=2)+'\n')


if __name__ == '__main__':
    if len(sys.argv) != 2 or sys.argv[1] not in ('run','record'):
        raise SystemExit('Expected run or record')
    if sys.argv[1] == 'record': record()
    else: raise SystemExit(run())

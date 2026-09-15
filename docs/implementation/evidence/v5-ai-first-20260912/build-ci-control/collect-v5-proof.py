"""Verify a completed GitHub test artifact; retain only bounded public evidence in Git."""
import argparse
import hashlib
import json
import math
import pathlib
import re
import subprocess
import zipfile
from datetime import datetime

parser = argparse.ArgumentParser()
parser.add_argument('--run', required=True)
parser.add_argument('--source', required=True)
parser.add_argument('--expected-reports', type=int, choices=(17, 19, 21, 24, 26, 28, 29, 30, 31, 33, 34, 35, 36, 37), default=17)
args = parser.parse_args()
assert re.fullmatch('[0-9]+', args.run) and re.fullmatch('[a-f0-9]{40}', args.source)
repo = 'repos/Uskoci1/USKOCI-CLEAN'


def api(path):
    return json.loads(subprocess.run(['gh', 'api', path], capture_output=True, text=True, check=True).stdout)


run = api(f'{repo}/actions/runs/{args.run}')
assert run['status'] == 'completed', 'WAIT_FOR_COMPLETED_TEST_RUN'
attempt = run.get('run_attempt', 1)
started = datetime.fromisoformat(run['run_started_at'].replace('Z', '+00:00'))
artifacts = [item for item in api(f'{repo}/actions/runs/{args.run}/artifacts')['artifacts']
             if datetime.fromisoformat(item['created_at'].replace('Z', '+00:00')) >= started]
# Never substitute a previous failed attempt's artifact for the current run.
assert len(artifacts) == 1 and not artifacts[0]['expired']
artifact = artifacts[0]
expected_digest = artifact['digest'].removeprefix('sha256:')
assert re.fullmatch('[a-f0-9]{64}', expected_digest)
suffix = '' if attempt == 1 else '-attempt' + str(attempt)
raw = pathlib.Path('C:/Users/user/AppData/Local/Temp/uskoci-v5-proof-run' + args.run + suffix)
raw.mkdir(parents=True, exist_ok=True)
archive = raw / ('artifact-' + str(artifact['id']) + '.zip')
if not archive.exists():
    with archive.open('xb') as output:
        subprocess.run(['gh', 'api', f"{repo}/actions/artifacts/{artifact['id']}/zip"], stdout=output, check=True)
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
assert digest == expected_digest, 'DOWNLOADED_ARTIFACT_HASH_MISMATCH'
with zipfile.ZipFile(archive) as bundle:
    for entry in bundle.infolist():
        target = (raw / entry.filename).resolve()
        assert target.is_relative_to(raw.resolve()), 'ARTIFACT_PATH_OUTSIDE_EVIDENCE_DIRECTORY'
    bundle.extractall(raw)
receipt_path = raw / 'package-integration-receipt.json'
receipt = json.loads(receipt_path.read_text())
assert receipt['sourceCommit'] == args.source and str(receipt['runId']) == args.run
assert len(receipt['reports']) == args.expected_reports
summary = {key: receipt.get(key) for key in ['sourceCommit', 'sourceTree', 'runId', 'finalHistoryCount', 'result', 'liveChanged', 'providerProven', 'deviceProven']}
summary.update(controlCommit=run['head_sha'], runAttempt=attempt, runConclusion=run['conclusion'], url=run['html_url'])
source = receipt['sourceRegression']
summary['sourceRegression'] = {key: source.get(key) for key in ['regressionScope', 'result', 'gates', 'jest', 'node', 'nodeFiles']}
report_keys = ['unit', 'result', 'sourceSha', 'historyCount', 'actualAuth', 'actualDatabase', 'actualClient', 'actualClientAuthority', 'providerCalled', 'liveAccess', 'deviceProven']


def migration_evidence(report):
    # Keep only the proof adapter's bounded catalog/lock metadata. Never copy a
    # SQL query, process arguments, environment, arbitrary stderr or row values.
    result = {}
    if isinstance(report.get('migrationStage'), dict):
        result['migrationStage'] = {key: report['migrationStage'].get(key) for key in ('file', 'phase')}
    if report.get('migrationLockObserverUnavailable') is True:
        result['migrationLockObserverUnavailable'] = True
    if isinstance(report.get('migrationLockObservations'), list):
        def locks(items):
            return [{key: item.get(key) for key in ('locktype', 'mode', 'relation')}
                    for item in items[:8]]
        result['migrationLockObservations'] = [
            {**{key: wait.get(key) for key in ('elapsedMilliseconds', 'pid', 'state', 'wait_event_type', 'wait_event', 'blocking_pids')},
             'requested_locks': locks(wait.get('requested_locks', [])),
             'blockers': [{**{key: blocker.get(key) for key in ('pid', 'state', 'wait_event_type', 'wait_event')},
                           'held_conflicting_relations': locks(blocker.get('held_conflicting_relations', []))}
                          for blocker in wait.get('blockers', [])[:8]]}
            for wait in report['migrationLockObservations'][:12]]
    return result


def sql_diagnostics_evidence(report):
    # Explicit diagnostic DTO only. Never retain SQL, stderr, result bytes,
    # process arguments, credentials or arbitrary fields from the raw artifact.
    operations = {'BIND_FULL', 'SNAPSHOT_FULL', 'ALLOCATION_COUNT', 'LIMITED_POLICY_UPDATE',
                  'BIND_LIMITED', 'SNAPSHOT_LIMITED', 'RESTORE_FULL_DELIVERY',
                  'RETIRE_FIXTURE_POLICY', 'RETIRE_FIXTURE_PRIVACY',
                  'RESTORE_PREDECESSOR_POLICY', 'RESTORE_PREDECESSOR_PRIVACY',
                  'DIAG_SOURCE_BINDING', 'DIAG_PLAN_ORIGINAL', 'DIAG_PLAN_MATERIALIZED',
                  'DIAG_EXECUTE_ORIGINAL', 'DIAG_EXECUTE_MATERIALIZED', 'DIAG_EXECUTE_FUNCTION_LOCAL_JIT_OFF'}
    states = {'active', 'idle', 'idle in transaction', 'idle in transaction (aborted)',
              'fastpath function call', 'disabled'}
    modes = {'AccessShareLock', 'RowShareLock', 'RowExclusiveLock', 'ShareUpdateExclusiveLock',
             'ShareLock', 'ShareRowExclusiveLock', 'ExclusiveLock', 'AccessExclusiveLock', 'SIReadLock'}
    lock_types = {'relation', 'page', 'tuple', 'transactionid', 'virtualxid', 'object',
                  'userlock', 'advisory', 'applytransaction', 'spectoken', 'frozenid'}

    def integer(value, minimum=0, maximum=2147483647):
        return value if type(value) is int and minimum <= value <= maximum else None

    def number(value):
        try:
            return value if type(value) in (int, float) and math.isfinite(value) else None
        except OverflowError:
            return None

    def member(value, allowed):
        return isinstance(value, str) and value in allowed

    def items(value, limit):
        return value[:limit] if isinstance(value, list) else []

    def label(value, pattern):
        return value if isinstance(value, str) and re.fullmatch(pattern, value) else None

    def failure(value):
        if not isinstance(value, dict):
            return None
        code = value.get('code')
        if not member(value.get('operation'), operations | {'UNKNOWN'}) or not member(code, {
                'ENOENT', 'EACCES', 'ETIMEDOUT', 'ENOBUFS', 'PROCESS_EXIT', 'ASSERTION_FAILED', 'PROOF_FAILURE'}):
            return None
        return {'operation': value['operation'], 'code': code,
                'exitStatus': integer(value.get('exitStatus'), maximum=255),
                'sqlState': label(value.get('sqlState'), r'[0-9A-Z]{5}')}

    def locks(value):
        return [{'locktype': item['locktype'], 'mode': item['mode'],
                 'relationOid': integer(item.get('relationOid'), minimum=1),
                 'relation': label(item.get('relation'), r'(public|private|storage|auth|cron|supabase_migrations|pg_catalog)\.[a-z_][a-z0-9_]{0,62}')}
                for item in items(value, 8) if isinstance(item, dict)
                and member(item.get('locktype'), lock_types) and member(item.get('mode'), modes)]

    def activity(value):
        if not isinstance(value, dict) or integer(value.get('pid'), minimum=1) is None or not member(value.get('state'), states):
            return None
        return {'pid': value['pid'], 'state': value['state'],
                'waitEventType': label(value.get('waitEventType'), r'[A-Za-z][A-Za-z0-9_ ]{0,63}'),
                'waitEvent': label(value.get('waitEvent'), r'[A-Za-z][A-Za-z0-9_ ]{0,63}')}

    def settings(value):
        if not isinstance(value, dict) or value.get('source') != 'SAME_DATABASE_OBSERVER_SESSION' or type(value.get('jit')) is not bool:
            return None
        names = ('jit_above_cost', 'jit_inline_above_cost', 'jit_optimize_above_cost')
        if any(number(value.get(name)) is None for name in names) or not member(value.get('plan_cache_mode'), {
                'auto', 'force_generic_plan', 'force_custom_plan'}) or integer(value.get('server_version_num'), minimum=1) is None:
            return None
        return {'source': value['source'], 'jit': value['jit'], **{name: value[name] for name in names},
                'plan_cache_mode': value['plan_cache_mode'], 'server_version_num': value['server_version_num']}

    def plan(value):
        if not isinstance(value, dict):
            return None
        numeric = ('startupCost', 'totalCost')
        if any(number(value.get(name)) is None or value[name] < 0 for name in numeric):
            return None
        bounded = {'nodeCount': (1, 4096), 'maxDepth': (0, 128),
                   'cteScans': (0, 4096), 'functionScans': (0, 4096), 'subplans': (0, 4096)}
        if any(integer(value.get(name), *bounds) is None for name, bounds in bounded.items()):
            return None
        safe = {name: value[name] for name in (*numeric, *bounded)}
        for name in ('estimatedRows', 'estimatedWidth', 'plannedWorkers'):
            if integer(value.get(name), maximum=9007199254740991) is not None:
                safe[name] = value[name]
        for name in ('planningMilliseconds', 'executionMilliseconds'):
            if number(value.get(name)) is not None and value[name] >= 0:
                safe[name] = value[name]
        raw_jit = value.get('jit')
        if isinstance(raw_jit, dict):
            jit = {}
            if integer(raw_jit.get('functions'), maximum=9007199254740991) is not None:
                jit['functions'] = raw_jit['functions']
            for group, names, predicate in (
                    ('options', ('inlining', 'optimization', 'expressions', 'deforming'), lambda v: type(v) is bool),
                    ('milliseconds', ('generation', 'inlining', 'optimization', 'emission', 'total'), lambda v: number(v) is not None and v >= 0)):
                raw_group = raw_jit.get(group)
                if isinstance(raw_group, dict):
                    values = {name: raw_group[name] for name in names if name in raw_group and predicate(raw_group[name])}
                    if values:
                        jit[group] = values
            if jit:
                safe['jit'] = jit
        raw_settings = value.get('nonDefaultSettings')
        if isinstance(raw_settings, dict):
            settings = {name: raw_settings[name] for name in ('jit_above_cost', 'jit_inline_above_cost', 'jit_optimize_above_cost')
                        if name in raw_settings and number(raw_settings[name]) is not None}
            if type(raw_settings.get('jit')) is bool:
                settings['jit'] = raw_settings['jit']
            if member(raw_settings.get('plan_cache_mode'), {'auto', 'force_generic_plan', 'force_custom_plan'}):
                settings['plan_cache_mode'] = raw_settings['plan_cache_mode']
            if settings:
                safe['nonDefaultSettings'] = settings
        return safe

    def performance(value):
        # Pin this one proof-only contract; no generic plan tree or source text.
        required = {
            'migrationSha256': '73e5f3b0fab4fd8ca096ca3ef75a49054e06b1cc3583950b2f9223759dea7dad',
            'bodySha256': 'bc8886d050f08c0c23cc995347b6aba4c9449e826e13f3c8babc59445f476bfc',
            'signature': 'private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)',
            'scope': 'TYPED_CLONES_AND_SESSION_JIT_FUNCTION_PROBE',
            'cloneScope': 'TOP_LEVEL_TYPED_PREPARED_LATERAL_BODY',
            'singleVariantDifference': 'OWNED_ROWS_MATERIALIZED',
            'cloneFunctionInvocation': False, 'functionSessionLocalJitOffProbe': True,
            'securityDefinerFunctionPlanEquivalent': False, 'coldCacheGuaranteed': False,
            'separateTransactionSnapshots': True, 'contentParityEstablished': False,
            'parameterValuesRetained': False, 'productionSqlChanged': False, 'originalFailurePreserved': True,
        }
        if not isinstance(value, dict) or any(type(value.get(key)) is not type(expected) or value[key] != expected
                                              for key, expected in required.items()):
            return None
        safe = dict(required)
        if member(value.get('sourceBinding'), {'MATCHED', 'REJECTED', 'UNAVAILABLE'}):
            safe['sourceBinding'] = value['sourceBinding']
        for name in ('sourceFailure', 'trigger'):
            decoded = failure(value.get(name))
            if decoded is not None:
                safe[name] = decoded
        safe['steps'] = []
        admitted = {'PLAN_ORIGINAL', 'PLAN_MATERIALIZED', 'EXECUTE_ORIGINAL',
                    'EXECUTE_MATERIALIZED', 'EXECUTE_FUNCTION_LOCAL_JIT_OFF'}
        seen = set()
        for step in items(value.get('steps'), 5) if safe.get('sourceBinding') == 'MATCHED' else []:
            if not isinstance(step, dict) or not member(step.get('operation'), admitted) or step['operation'] in seen:
                continue
            operation = step['operation']
            actual_function = operation == 'EXECUTE_FUNCTION_LOCAL_JIT_OFF'
            if not member(step.get('status'), {'RUNNING', 'SUCCEEDED', 'FAILED'}) or step.get('functionInvocation') is not actual_function:
                continue
            seen.add(operation)
            entry = {'operation': operation, 'status': step['status'], 'functionInvocation': actual_function}
            local_settings = step.get('requestedSessionLocalSettings')
            if actual_function and isinstance(local_settings, dict) and local_settings.get('jit') is False:
                entry['requestedSessionLocalSettings'] = {'jit': False}
            decoded = failure(step.get('failure'))
            if decoded is not None:
                entry['failure'] = decoded
            if operation.startswith('PLAN_') and step['status'] == 'SUCCEEDED':
                decoded = plan(step.get('plan'))
                if decoded is not None:
                    entry['plan'] = decoded
            elif operation.startswith('EXECUTE_') and step['status'] == 'SUCCEEDED' and step.get('ownedProjectionAssertionsPassed') is True:
                entry['ownedProjectionAssertionsPassed'] = True
            safe['steps'].append(entry)
        return safe

    result = {}
    decoded = performance(report.get('exportPerformanceDiagnostics'))
    if decoded is not None:
        result['exportPerformanceDiagnostics'] = decoded
    decoded = failure(report.get('exportPerformanceDiagnosticFailure'))
    if decoded is not None:
        result['exportPerformanceDiagnosticFailure'] = decoded
    if isinstance(report.get('sqlDiagnostics'), list):
        result['sqlDiagnostics'] = []
        for entry in items(report['sqlDiagnostics'], 32):
            if not isinstance(entry, dict) or not member(entry.get('operation'), operations) or not member(entry.get('status'), {'RUNNING', 'SUCCEEDED', 'TIMED_OUT', 'FAILED'}):
                continue
            safe = {'operation': entry['operation'], 'ordinal': integer(entry.get('ordinal'), 1, 32),
                    'status': entry['status'], 'elapsedMilliseconds': integer(entry.get('elapsedMilliseconds')),
                    'observations': []}
            for entry_observation in items(entry.get('observations'), 12):
                observed = activity(entry_observation)
                if observed is None:
                    continue
                observed.update({name: integer(entry_observation.get(name)) for name in (
                    'elapsedMilliseconds', 'lastSeenElapsedMilliseconds', 'sampleCount')})
                observed['blockingPids'] = [pid for pid in items(entry_observation.get('blockingPids'), 8) if integer(pid, minimum=1) is not None]
                observed['requestedLocks'] = locks(entry_observation.get('requestedLocks'))
                observed['blockers'] = []
                for blocker in items(entry_observation.get('blockers'), 8):
                    bounded = activity(blocker)
                    if bounded is not None:
                        bounded['heldConflictingRelations'] = locks(blocker.get('heldConflictingRelations'))
                        observed['blockers'].append(bounded)
                safe['observations'].append(observed)
            if entry.get('observerUnavailable') is True:
                safe['observerUnavailable'] = True
            if integer(entry.get('droppedDistinctObservations')) is not None:
                safe['droppedDistinctObservations'] = entry['droppedDistinctObservations']
            for name, decoded in (('failure', failure(entry.get('failure'))), ('settings', settings(entry.get('settings')))):
                if decoded is not None:
                    safe[name] = decoded
            result['sqlDiagnostics'].append(safe)
    primary = failure(report.get('sqlPrimaryFailure'))
    if primary is not None:
        result['sqlPrimaryFailure'] = primary
    if isinstance(report.get('sqlCleanupFailures'), list):
        result['sqlCleanupFailures'] = [decoded for raw in items(report['sqlCleanupFailures'], 32)
                                        if (decoded := failure(raw)) is not None]
    return result


summary['reports'] = {name: {**{key: report.get(key) for key in report_keys},
                            **migration_evidence(report),
                            **sql_diagnostics_evidence(report),
                            'checks': [{key: check[key] for key in ['name', 'result']} for check in report.get('checks', [])]}
                      for name, report in receipt['reports'].items()}
summary['artifact'] = {'id': artifact['id'], 'sha256': digest, 'independentlyDownloadedAndDigestVerified': True, 'rawDirectory': str(raw)}
summary['rawReceiptSha256'] = hashlib.sha256(receipt_path.read_bytes()).hexdigest()
out = pathlib.Path(__file__).resolve().parent / ('run' + args.run + suffix + '-summary.json')
out.write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8', newline='\n')
print(json.dumps({'runId': args.run, 'result': summary['result'], 'conclusion': run['conclusion'], 'artifactSha256Verified': True, 'summary': str(out)}))

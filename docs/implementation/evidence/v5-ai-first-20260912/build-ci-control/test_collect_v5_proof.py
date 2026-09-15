"""Collector DTO tests only. AST extraction never runs GitHub/network/main code."""
import ast
import copy
import json
import math
import pathlib
import re
import unittest

tree = ast.parse(pathlib.Path(__file__).with_name('collect-v5-proof.py').read_text())
function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'sql_diagnostics_evidence')
namespace = {'math': math, 're': re}
exec(compile(ast.Module(body=[function], type_ignores=[]), '<collector-pure-dto>', 'exec'), namespace)
sanitize = namespace['sql_diagnostics_evidence']
SECRET = 'PRIVATE_QUERY_POLICY_TOKEN_FILTER_RESULT'


def fixture():
    plan = {'startupCost': 1.25, 'totalCost': 987654.5, 'nodeCount': 3, 'maxDepth': 2,
            'cteScans': 1, 'functionScans': 1, 'subplans': 1, 'estimatedRows': 1,
            'jit': {'functions': 30, 'options': {'inlining': True, 'secret': SECRET},
                    'milliseconds': {'generation': 1, 'total': 10, 'secret': SECRET}},
            'nonDefaultSettings': {'jit': True, 'jit_above_cost': 100000, 'plan_cache_mode': 'auto', 'search_path': SECRET},
            'Filter': SECRET, 'Output': [SECRET], 'Relation Name': SECRET, 'Plans': [{'private': SECRET}]}
    operations = ['PLAN_ORIGINAL', 'PLAN_MATERIALIZED', 'EXECUTE_ORIGINAL', 'EXECUTE_MATERIALIZED', 'EXECUTE_FUNCTION_LOCAL_JIT_OFF']
    evidence = {
        'migrationSha256': '73e5f3b0fab4fd8ca096ca3ef75a49054e06b1cc3583950b2f9223759dea7dad',
        'bodySha256': 'bc8886d050f08c0c23cc995347b6aba4c9449e826e13f3c8babc59445f476bfc',
        'signature': 'private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)',
        'scope': 'TYPED_CLONES_AND_SESSION_JIT_FUNCTION_PROBE', 'cloneScope': 'TOP_LEVEL_TYPED_PREPARED_LATERAL_BODY',
        'singleVariantDifference': 'OWNED_ROWS_MATERIALIZED', 'cloneFunctionInvocation': False,
        'functionSessionLocalJitOffProbe': True, 'securityDefinerFunctionPlanEquivalent': False,
        'coldCacheGuaranteed': False, 'separateTransactionSnapshots': True, 'contentParityEstablished': False,
        'parameterValuesRetained': False, 'productionSqlChanged': False, 'originalFailurePreserved': True,
        'sourceBinding': 'MATCHED', 'query': SECRET, 'parameters': {'policy': SECRET},
        'trigger': {'operation': 'SNAPSHOT_FULL', 'code': 'ETIMEDOUT', 'exitStatus': None, 'stderr': SECRET},
        'steps': [{'operation': operation, 'status': 'SUCCEEDED', 'functionInvocation': operation == operations[-1],
                   'requestedSessionLocalSettings': {'jit': False, 'query': SECRET}, 'plan': copy.deepcopy(plan),
                   'ownedProjectionAssertionsPassed': True, 'snapshot': SECRET, 'sql': SECRET} for operation in operations],
    }
    diagnostics = [{'operation': 'DIAG_' + operation, 'ordinal': 1, 'status': 'SUCCEEDED', 'elapsedMilliseconds': 12,
                    'observations': [], 'query': SECRET} for operation in ['SOURCE_BINDING', *operations]]
    return {'exportPerformanceDiagnostics': evidence, 'sqlDiagnostics': diagnostics, 'secret': SECRET}


class CollectorDiagnosticTests(unittest.TestCase):
    def test_numeric_plan_and_every_new_operation_survive_without_any_payload(self):
        safe = sanitize(fixture())
        self.assertEqual(len(safe['sqlDiagnostics']), 6)
        value = safe['exportPerformanceDiagnostics']
        self.assertEqual(len(value['steps']), 5)
        self.assertEqual(value['steps'][0]['plan']['totalCost'], 987654.5)
        self.assertEqual(value['steps'][0]['plan']['jit']['functions'], 30)
        self.assertEqual(value['steps'][-1]['requestedSessionLocalSettings'], {'jit': False})
        self.assertNotIn('requestedSessionLocalSettings', value['steps'][0])
        self.assertNotIn('plan', value['steps'][-1])
        self.assertFalse(value['contentParityEstablished'])
        self.assertNotIn(SECRET, json.dumps(safe))

    def test_wrong_source_or_scope_and_boolean_coercion_fail_closed(self):
        for key, bad in [('migrationSha256', '0' * 64), ('bodySha256', SECRET), ('scope', SECRET),
                         ('cloneFunctionInvocation', 0), ('separateTransactionSnapshots', 1), ('productionSqlChanged', True)]:
            raw = fixture()
            raw['exportPerformanceDiagnostics'][key] = bad
            self.assertNotIn('exportPerformanceDiagnostics', sanitize(raw))

    def test_malformed_numerics_collections_and_settings_are_never_admitted(self):
        for bad in [None, True, SECRET, [], {}, float('nan'), float('inf'), 10 ** 1000, -1]:
            raw = fixture()
            raw['exportPerformanceDiagnostics']['steps'][0]['plan']['startupCost'] = bad
            self.assertNotIn('plan', sanitize(raw)['exportPerformanceDiagnostics']['steps'][0])
        for bad in [None, SECRET, {}, 1, True]:
            raw = fixture()
            raw['exportPerformanceDiagnostics']['steps'] = bad
            raw['sqlDiagnostics'] = bad
            safe = sanitize(raw)
            self.assertEqual(safe['exportPerformanceDiagnostics']['steps'], [])
        raw = fixture()
        plan = raw['exportPerformanceDiagnostics']['steps'][0]['plan']
        plan['estimatedRows'] = True
        plan['jit']['functions'] = float('inf')
        plan['nonDefaultSettings'] = {'jit': 1, 'jit_above_cost': float('nan'), 'plan_cache_mode': SECRET}
        safe_plan = sanitize(raw)['exportPerformanceDiagnostics']['steps'][0]['plan']
        self.assertNotIn('estimatedRows', safe_plan)
        self.assertNotIn('functions', safe_plan['jit'])
        self.assertNotIn('nonDefaultSettings', safe_plan)

    def test_caps_duplicates_wrong_step_scope_and_failure_cannot_claim_assertion_pass(self):
        raw = fixture()
        raw['sqlDiagnostics'] *= 20
        raw['exportPerformanceDiagnostics']['steps'] *= 20
        safe = sanitize(raw)
        self.assertEqual(len(safe['sqlDiagnostics']), 32)
        self.assertEqual(len(safe['exportPerformanceDiagnostics']['steps']), 5)
        raw = fixture()
        raw['exportPerformanceDiagnostics']['steps'][1] = copy.deepcopy(raw['exportPerformanceDiagnostics']['steps'][0])
        raw['exportPerformanceDiagnostics']['steps'][2]['functionInvocation'] = True
        raw['exportPerformanceDiagnostics']['steps'][3]['status'] = 'FAILED'
        steps = sanitize(raw)['exportPerformanceDiagnostics']['steps']
        self.assertEqual(len(steps), 3)
        self.assertNotIn('ownedProjectionAssertionsPassed', steps[1])
        raw['exportPerformanceDiagnostics']['sourceBinding'] = 'REJECTED'
        self.assertEqual(sanitize(raw)['exportPerformanceDiagnostics']['steps'], [])

    def test_safe_diagnostic_failure_and_previous_observer_scope_are_preserved(self):
        raw = fixture()
        raw['exportPerformanceDiagnosticFailure'] = {'operation': 'UNKNOWN', 'code': 'PROOF_FAILURE', 'stderr': SECRET}
        raw['sqlDiagnostics'][-1]['settings'] = {'source': 'SAME_DATABASE_OBSERVER_SESSION', 'jit': True,
                                               'jit_above_cost': 100000, 'jit_inline_above_cost': 500000,
                                               'jit_optimize_above_cost': 500000, 'plan_cache_mode': 'auto',
                                               'server_version_num': 170006, 'query': SECRET}
        safe = sanitize(raw)
        self.assertEqual(safe['exportPerformanceDiagnosticFailure']['code'], 'PROOF_FAILURE')
        self.assertTrue(safe['sqlDiagnostics'][-1]['settings']['jit'])
        self.assertFalse(safe['exportPerformanceDiagnostics']['steps'][-1]['requestedSessionLocalSettings']['jit'])
        self.assertNotIn(SECRET, json.dumps(safe))


if __name__ == '__main__':
    unittest.main()

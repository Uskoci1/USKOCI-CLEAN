import json
import unittest
from p6_cost_parse import MODES, internal_plans, project_plan, summarize

class CostEvidenceTests(unittest.TestCase):
    def rows(self):
        return [{"mode":m,"sample":i,"ms":i,"responseBytes":100,"resultSize":1} for m in MODES for i in range(1,31)]
    def test_nearest_rank(self):
        self.assertTrue(all(x['p50Ms']==15 and x['p95Ms']==29 and x['maxMs']==30 for x in summarize(self.rows())))
    def test_no_percentile_from_short_set(self):
        with self.assertRaises(ValueError): summarize(self.rows()[:-1])
    def test_duplicate_sample_rejected(self):
        rows=self.rows(); rows[1]['sample']=1
        with self.assertRaises(ValueError): summarize(rows)
    def test_nonfinite_rejected(self):
        rows=self.rows(); rows[1]['ms']=float('inf')
        with self.assertRaises(ValueError): summarize(rows)
    def test_slow_is_not_relabelled_pass(self):
        self.assertTrue(all(not x['screeningBudgetPass'] for x in summarize(self.rows(),10)))
    def plan(self):
        return {'Query Text':'with base as materialized (select ...)', 'Plan':{'Node Type':'Result','Actual Loops':1,'Shared Hit Blocks':10,
            'Output':['secret payload'],'Plans':[{'Node Type':'Seq Scan','Relation Name':'needs','Actual Loops':1,'Shared Hit Blocks':5,'Filter':'PRIVATE'}]}}
    def trace(self, obj):
        return ''.join('NOTICE: P6_TRACE_BEGIN_'+m+'\nNOTICE: duration: 42 ms plan:\n'+json.dumps(obj)+'\n' for m in MODES[:3])
    def test_nested_structure_preserved_without_private_expressions(self):
        result=internal_plans(self.trace(self.plan())); self.assertEqual(len(result),3)
        self.assertNotIn('PRIVATE',json.dumps(result));self.assertNotIn('secret',json.dumps(result))
    def test_wrapper_is_not_internal_plan(self):
        p=self.plan();p['Query Text']='select public.rpc_discovery_v1(...)'
        with self.assertRaises(ValueError): internal_plans(self.trace(p))
    def test_missing_buffers_not_proof(self):
        p=self.plan();del p['Plan']['Shared Hit Blocks'];del p['Plan']['Plans'][0]['Shared Hit Blocks']
        with self.assertRaises(ValueError): internal_plans(self.trace(p))
    def test_missing_mode_not_proof(self):
        with self.assertRaises(ValueError): internal_plans('')
    def test_labels_cannot_hold_payloads(self):
        with self.assertRaises(ValueError): project_plan({'Alias':'somebody@example.com'})

if __name__=='__main__': unittest.main()

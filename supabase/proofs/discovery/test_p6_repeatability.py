import copy
import unittest
from p6_repeatability import CASES, summarize

class RepeatabilityTests(unittest.TestCase):
    def samples(self):
        return [{'block':b,'case':c,'sample':s,'ms':s,'responseBytes':100,'resultSize':1}
          for b in (1,2,3) for c in CASES for s in range(1,31)]
    def test_30_per_block_not_pooled(self):
        r=summarize(self.samples())
        self.assertEqual(r['samples'],720)
        for c in r['cases']:
            self.assertEqual([b['n'] for b in c['blocks']],[30,30,30])
            self.assertTrue(all(b['p50Ms']==15 and b['p95Ms']==29 and b['maxMs']==30 for b in c['blocks']))
    def test_missing_sample_fails(self):
        with self.assertRaises(ValueError):summarize(self.samples()[:-1])
    def test_duplicate_sample_fails(self):
        x=self.samples();x[-1]=copy.deepcopy(x[0])
        with self.assertRaises(ValueError):summarize(x)
    def test_unknown_case_fails(self):
        x=self.samples();x[0]['case']='DELETED_CASE'
        with self.assertRaises(ValueError):summarize(x)
    def test_unknown_block_fails(self):
        x=self.samples();x[0]['block']=4
        with self.assertRaises(ValueError):summarize(x)
    def test_extra_payload_fails(self):
        x=self.samples();x[0]['token']='not allowed'
        with self.assertRaises(ValueError):summarize(x)
    def test_nonfinite_fails(self):
        for v in (float('inf'),float('nan'),True,-1):
            x=self.samples();x[0]['ms']=v
            with self.assertRaises(ValueError):summarize(x)
    def test_boolean_or_negative_size_fails(self):
        for v in (True,-1):
            x=self.samples();x[0]['responseBytes']=v
            with self.assertRaises(ValueError):summarize(x)
    def test_last_block_failure_not_averaged_away(self):
        x=self.samples()
        for r in x:
            if r['case']=='PAGE' and r['block']==3:r['ms']*=100
        r=summarize(x)
        self.assertFalse(r['allRpcBlocksUnder1000Ms'])
        self.assertFalse(r['allRpcBlockSpreadsWithin20Percent'])
    def test_capacity_case_is_gating(self):
        x=self.samples()
        for r in x:
            if r['case']=='PAGE_PEOPLE2':r['ms']+=2000
        self.assertFalse(summarize(x)['allRpcBlocksUnder1000Ms'])
    def test_control_cost_not_false_rpc_failure(self):
        x=self.samples()
        for r in x:
            if r['case']=='COVERAGE':r['ms']+=2000
        self.assertTrue(summarize(x)['allRpcBlocksUnder1000Ms'])
    def test_zero_does_not_write_infinity(self):
        x=self.samples()
        for r in x:
            if r['case']=='SCAN' and r['block']==1:r['ms']=0
        scan=next(c for c in summarize(x)['cases'] if c['case']=='SCAN')
        self.assertIsNone(scan['p95SpreadRatio'])
        self.assertFalse(scan['within20Percent'])
    def test_good_numbers_never_mean_p6_finished(self):
        r=summarize(self.samples())
        self.assertTrue(r['allRpcBlocksUnder1000Ms'])
        self.assertFalse(r['productionPerformanceAccepted'])
        self.assertFalse(r['p6Finished'])

if __name__=='__main__':unittest.main()

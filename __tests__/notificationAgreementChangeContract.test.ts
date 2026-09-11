import {readFileSync} from 'fs';
import {join} from 'path';
import {runInNewContext} from 'vm';
const sql=readFileSync(join(__dirname,'../supabase/proofs/notifications/n05_agreement_change_candidate.sql'),'utf8');
const proof=readFileSync(join(__dirname,'../supabase/proofs/notifications/n05_agreement_change_proof.mjs'),'utf8');
describe('N05 bilateral change event boundary',()=>{
  it('guards both exact predecessors and checks resulting bodies',()=>{
    expect(sql).toContain('7972e42a84293de069a1ce4b159cd6fd');expect(sql).toContain('e0b2079739f81646f592a6575085401b');
    expect(sql.match(/BODY_MISMATCH/g)).toHaveLength(2);
    expect(sql).not.toMatch(/create\s+(or replace\s+)?function|grant\s+execute|alter\s+table/i);
  });
  it('emits only existing events and binds counterpart/version/server proposal ID',()=>{
    expect(sql.match(/perform private\.emit_event\(/g)).toHaveLength(3);
    for(const type of ['AGREEMENT_CHANGE_PROPOSED','AGREEMENT_CHANGE_REJECTED','AGREEMENT_VERSION_CHANGED']) expect(sql).toContain(`'${type}'`);
    expect(sql).toContain('v_proposal.proposed_by_account_id');expect(sql).toContain('v_agreement.id,v_new_version');
    expect(sql).not.toMatch(/jsonb_build_object\([^)]*(?:p_reason|p_patch|proposed_terms)/);
  });
  it('requires authenticated mutation and real rollback, not a static-only proof',()=>{
    expect(proof.indexOf('assertLocalDeviceProofTargets(url,db)')).toBeLessThan(proof.indexOf('createClient(url,'));
    expect(proof).toContain('PROPOSAL_EVENT_FAILURE_ROLLS_BACK_COMMAND');
    expect(proof).toContain('REVERSE_PARTY_PROPOSAL_AND_ACCEPT_FAILURE_FULL_ROLLBACK');
    expect(proof).toContain('assert.deepEqual(snapshot(),before)');
  });
});

describe('M05 actual responder lock observation',()=>{
  const source=proof.split('// BEGIN_M05_OBSERVED_WAITER_GRAPH')[1].split('// END_M05_OBSERVED_WAITER_GRAPH')[0];
  const observe=runInNewContext(source+'\nobservedResponderWaitGraph');
  const row=(waiter_pid:number,blocking_pids:number[])=>({waiter_pid,holder_pid:10,wait_event_type:'Lock',blocking_pids});
  it('admits two direct waits and the actual row-lock queue through the other observed responder',()=>{
    for(const rows of [[row(20,[10]),row(30,[10])],[row(20,[10]),row(30,[20])],[row(20,[30]),row(30,[10])]]){
      const result=observe(rows,10);expect(result).toHaveLength(2);
      expect(result.every((x:{blocker_graph_reaches_holder:boolean})=>x.blocker_graph_reaches_holder)).toBe(true);
    }
  });
  it('rejects missing or duplicated observations, unknown blockers, cycles and non-lock waits',()=>{
    for(const rows of [[],[row(20,[10])],[row(20,[10]),row(20,[10])],
      [row(20,[10]),row(30,[99])],[row(20,[30]),row(30,[20])],
      [row(20,[10]),{...row(30,[20]),wait_event_type:'Client'}],
      [row(20,[10]),{...row(30,[20]),holder_pid:99}],
      [row(20,[10]),row(30,[])],[row(20,[10]),row(30,[30])]])expect(observe(rows,10)).toBeNull();
  });
});

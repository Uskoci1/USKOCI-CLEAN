import {readFileSync} from 'fs';
import {join} from 'path';
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

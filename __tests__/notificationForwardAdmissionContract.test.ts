import {createHash} from 'crypto';
import {readFileSync} from 'fs';
import {join} from 'path';
const root=join(__dirname,'..');
const read=(path:string)=>readFileSync(join(root,path),'utf8');
describe('N07 exact per-unit forward admission',()=>{
  it('retains candidate SQL byte-for-byte after only a provenance comment prefix',()=>{
    const pending=JSON.parse(read('supabase/migrations/MIGRATION_PROVENANCE.json')).pending_forward_migrations;
    expect(pending.map((x:any)=>x.unit)).toEqual(['N01','N02','N03','N05','N06']);
    for(const item of pending){
      const sql=read(`supabase/migrations/${item.file}`);
      expect(sql).toBe(`-- Forward admission of canonical ${item.unit}; NOT LIVE until approved promotion.\n-- Embedded candidate comments below are retained pre-admission provenance.\n`+read(item.candidate_file));
      expect(createHash('md5').update(sql).digest('hex')).toBe(item.raw_md5);
      expect(createHash('sha256').update(sql).digest('hex')).toBe(item.sha256);
      expect(item.live_applied).toBe(false);
    }
  });
  it('never replays new pending files before the historical live-79 predecessor',()=>{
    const env=read('supabase/proofs/ru5_device_ui_live79_env.sh');
    expect(env.indexOf('if [[ "${b:0:14}" > "20260901114029" ]]; then continue; fi')).toBeLessThan(env.indexOf('*) cp "$f"'));
  });
  it('uses local-target guard before any auth/SQL operation and records each actual forward file',()=>{
    const proof=read('supabase/proofs/notifications/n07_forward_promotion_proof.mjs');
    expect(proof.indexOf('assertLocalDeviceProofTargets(url,db)')).toBeLessThan(proof.indexOf('createClient(url,'));
    expect(proof).toContain('`supabase/migrations/${item.file}`');expect(proof).toContain('history_count:80+index');
    expect(proof).toContain('assert.deepEqual(snapshot(),before)');
  });
});

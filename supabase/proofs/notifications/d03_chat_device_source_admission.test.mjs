import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {readD03ChatSourceAdmission} from './d03_chat_device_source_admission.mjs';

const manifestPath='supabase/proofs/notifications/n07_forward_files.json';
const provenancePath='supabase/migrations/MIGRATION_PROVENANCE.json';
const readWith=overrides=>path=>overrides.has(path)?overrides.get(path):readFileSync(path);
const jsonBytes=value=>Buffer.from(JSON.stringify(value));
const current=readD03ChatSourceAdmission();
const sources=[...current.alreadyApplied,...current.additions];

test('actual canonical inputs admit all seven bindings and never reapply N02/N03',()=>{
  assert.deepEqual(current.alreadyApplied.map(x=>x.unit),['N02','N03']);
  assert.deepEqual(current.additions.map(x=>x.unit),['N01','N05','N06','N08','D03']);
  for(const source of sources){
    assert.equal(source.bytes-source.candidateBytes,source.unit==='N08'||source.unit==='D03'?0:150);
  }
  assert.equal(current.alreadyApplied[0].bytes,2287);
  assert.equal(current.alreadyApplied[0].candidateBytes,2137);
  assert.equal(current.additions.at(-1).bytes,4277);
});

for(const source of sources){
  const forward=`supabase/migrations/${source.file}`;
  test(`${source.unit} changed candidate is refused`,()=>{
    const overrides=new Map([[source.candidate,Buffer.concat([readFileSync(source.candidate),Buffer.from('\n-- changed')])]]);
    assert.throws(()=>readD03ChatSourceAdmission(readWith(overrides)),new RegExp(`${source.unit} candidate relationship`));
  });
  test(`${source.unit} changed forward is refused`,()=>{
    const overrides=new Map([[forward,Buffer.concat([readFileSync(forward),Buffer.from('\n-- changed')])]]);
    assert.throws(()=>readD03ChatSourceAdmission(readWith(overrides)),new RegExp(`${source.unit} candidate relationship`));
  });
  test(`${source.unit} coherent candidate and forward change still fails the frozen canonical hash`,()=>{
    const suffix=Buffer.from('\n-- changed');
    const overrides=new Map([[forward,Buffer.concat([readFileSync(forward),suffix])],
      [source.candidate,Buffer.concat([readFileSync(source.candidate),suffix])]]);
    assert.throws(()=>readD03ChatSourceAdmission(readWith(overrides)),new RegExp(`${source.unit} canonical MD5`));
  });
}

for(const mutation of ['missing','wrong-unit','duplicate']){
  test(`N07 ${mutation} provenance header is refused rather than stripping arbitrary comments`,()=>{
    const source=current.alreadyApplied[0],forward=`supabase/migrations/${source.file}`;
    const raw=readFileSync(forward),candidate=readFileSync(source.candidate),header=raw.subarray(0,raw.length-candidate.length);
    const bytes=mutation==='missing'?candidate:mutation==='wrong-unit'?
      Buffer.from(raw.toString('utf8').replace('canonical N02;','canonical N03;')):Buffer.concat([header,raw]);
    assert.throws(()=>readD03ChatSourceAdmission(readWith(new Map([[forward,bytes]]))),/N02 candidate relationship/);
  });
}

for(const mutation of ['missing','duplicate','reordered']){
  test(`N07 ${mutation} historical unit binding is refused`,()=>{
    const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
    if(mutation==='missing')manifest.splice(2,1);
    else if(mutation==='duplicate')manifest[2]=manifest[1];
    else manifest.reverse();
    assert.throws(()=>readD03ChatSourceAdmission(readWith(new Map([[manifestPath,jsonBytes(manifest)]]))),/all five historical N07 bindings/);
  });
}

test('a missing canonical alias cannot be hidden by valid physical source hashes',()=>{
  const provenance=JSON.parse(readFileSync(provenancePath,'utf8'));
  const missing=current.alreadyApplied[0].file;
  const keep=entry=>(entry.file||`${entry.version}_${entry.name}.sql`)!==missing;
  provenance.pending_forward_migrations=provenance.pending_forward_migrations.filter(keep);
  provenance.live_history_snapshot.entries=provenance.live_history_snapshot.entries.filter(keep);
  assert.throws(()=>readD03ChatSourceAdmission(readWith(new Map([[provenancePath,jsonBytes(provenance)]]))),/N02 canonical provenance binding/);
});

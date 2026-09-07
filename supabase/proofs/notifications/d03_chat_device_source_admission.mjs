// Pure source admission; importing this module cannot contact Auth/Postgres or apply SQL.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

const digest=(algorithm,bytes)=>createHash(algorithm).update(bytes).digest('hex');
const n07Units=['N01','N02','N03','N05','N06'];
export function readD03ChatSourceAdmission(read=readFileSync){
  const n07=JSON.parse(read('supabase/proofs/notifications/n07_forward_files.json').toString('utf8'));
  assert.deepEqual(n07.map(item=>item.unit),n07Units,'all five historical N07 bindings are required');
  const provenance=JSON.parse(read('supabase/migrations/MIGRATION_PROVENANCE.json').toString('utf8'));
  const registered=[...provenance.pending_forward_migrations,...provenance.live_history_snapshot.entries];
  function exact(unit,file,candidate,md5,sha256,prefix=''){
    const bytes=read(`supabase/migrations/${file}`),candidateBytes=read(candidate);
    // N07 canon explicitly admits an unchanged candidate after exactly these two
    // provenance comments. N08/D03 are direct byte mirrors with no such prefix.
    assert.deepEqual(bytes,Buffer.concat([Buffer.from(prefix,'utf8'),candidateBytes]),`${unit} candidate relationship`);
    assert.equal(digest('md5',bytes),md5,`${unit} canonical MD5`);
    assert.equal(digest('sha256',bytes),sha256,`${unit} canonical SHA256`);
    assert.ok(registered.some(entry=>(entry.file||`${entry.version}_${entry.name}.sql`)===file),`${unit} canonical provenance binding`);
    return {unit,file,candidate,bytes:bytes.length,md5,sha256,
      candidateBytes:candidateBytes.length,candidateSha256:digest('sha256',candidateBytes),
      relationship:prefix?'EXACT_PROVENANCE_HEADER_PLUS_CANDIDATE':'EXACT_CANDIDATE_MIRROR'};
  }
  const n07Sources=n07.map(item=>exact(item.unit,item.file,item.candidate_file,item.raw_md5,item.sha256,
    `-- Forward admission of canonical ${item.unit}; NOT LIVE until approved promotion.\n-- Embedded candidate comments below are retained pre-admission provenance.\n`));
  const alreadyApplied=n07Sources.filter(item=>['N02','N03'].includes(item.unit))
    .map(item=>({...item,appliedBy:'n04_inbox_device_fixture.mjs',historyRowAdded:false}));
  const additions=n07Sources.filter(item=>['N01','N05','N06'].includes(item.unit));
  additions.push(exact('N08','20260907100000_clean_n08_notification_preferences.sql',
    'supabase/proofs/notifications/n08_preferences_candidate.sql','349e81a12760af65dc4d5d98a7677333',
    'f1829f054b79e5c2f8cba529711185a530949d371b9de552af6997ebabe0ec16'));
  additions.push(exact('D03','20260907110000_clean_d03_message_retry.sql',
    'supabase/proofs/notifications/d03_message_retry_candidate.sql','ea4ebf5cc6f24f103bdb9c854f55463d',
    'f7768b8feaefa54090bfdc66a7183089dd72fda21995dcc2beeb0dd6d6494889'));
  assert.equal(additions.at(-1).bytes,4277);
  return {alreadyApplied,additions};
}

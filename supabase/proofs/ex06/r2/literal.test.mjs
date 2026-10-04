import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {once,compile} from './build.mjs';
test('SQL dollar quotes are inserted literally, never as JavaScript replacement patterns',()=>{
 const value="$tag$'x' $& $` $'";
 assert.equal(once('before ANCHOR after','ANCHOR',value),'before '+value+' after');
});
test('shared-key lock uses the same newline separator and seed as the pinned live close body',()=>{
 const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
 const built=compile(read('../../../candidates/ex06e_lifecycle_recovery.sql'),read('../../../candidates/ex06e_lifecycle_recovery_revert.sql'),read('./time-body.sql'),read('./scenarios.inc.mjs'),read('../ex06e_lifecycle_recovery_proof.mjs'));
 const line=built.candidate.split('\n').find(x=>x.includes('pg_advisory_xact_lock('));
 assert.equal(line.trim(),String.raw`perform pg_advisory_xact_lock(hashtextextended(v_actor::text || E'\n' || ('reopen:'||v_request_id), 4410));`);
 assert.ok(!line.includes(String.raw`E'\\n'`));
});

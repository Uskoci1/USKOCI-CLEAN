import './literal.test.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compile,once,replacements,md5,sha256} from './build.mjs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const input=[read('../../../candidates/ex06e_lifecycle_recovery.sql'),read('../../../candidates/ex06e_lifecycle_recovery_revert.sql'),read('./time-body.sql'),read('./scenarios.inc.mjs'),read('../ex06e_lifecycle_recovery_proof.mjs')];
const built=compile(...input);
test('pinned inputs generate one transaction and one epoch-bound authenticated command',()=>{
 assert.match(built.candidate,/p_expected_closed_at timestamptz/);assert.match(built.candidate,/STALE_SEARCH_STATE/);
 assert.match(built.candidate,/expectedClosedAtEpoch/);assert.match(built.candidate,/REOPEN_REMAINING_SEARCH_V1/);
 assert.match(built.candidate,/4410/);assert.doesNotMatch(built.candidate,/4411/);
 assert.equal((built.candidate.match(/^commit;$/gm)||[]).length,1);
 assert.equal(sha256(built.candidate),built.manifest.candidateSha256);
});
test('source pin rejects changed original candidate or revert',()=>{
 for(const i of [0,1,4]){const broken=[...input];broken[i]+='\n';assert.throws(()=>compile(...broken));}
});
test('exact anchors fail closed on absence and duplication',()=>{assert.throws(()=>once('abc','x','y'));assert.throws(()=>once('xx','x','y'));assert.equal(once('abc','b','z'),'azc');});
test('clock transformation changes replacement but never the predecessor anchor',()=>{
 const s='$anchor$private.enqueue_dispatch(v_need.id, statement_timestamp())$anchor$ $replacement$private.enqueue_dispatch(v_need.id, statement_timestamp())$replacement$';
 const out=replacements(s);assert.ok(out.includes('$anchor$private.enqueue_dispatch(v_need.id, statement_timestamp())$anchor$'));assert.ok(out.includes('$replacement$private.enqueue_dispatch(v_need.id, clock_timestamp())$replacement$'));
});
test('time is sampled after locking and exact end is closed',()=>{
 const reopen=built.candidate.slice(built.candidate.indexOf('create function public.rpc_reopen_remaining_search('));
 assert.ok(reopen.indexOf('for update;')<reopen.indexOf('v_at := clock_timestamp();'));
 assert.match(built.candidate,/n.ends_at <= p_at/);assert.match(built.candidate,/p_at < execution_end/);
 assert.doesNotMatch(built.candidate,/p_at <= execution_end/);
});
test('revert pins both new bodies and privileges before their removal',()=>{
 assert.ok(built.revert.indexOf('EX06E_R2_NEW_FUNCTION_DRIFT')<built.revert.indexOf('drop function public.rpc_reopen_remaining_search'));
 assert.match(built.revert,/p.proacl/);assert.match(built.revert,/p.proargnames/);assert.match(built.revert,/p.proowner/);
 for(const hash of [built.manifest.functions.reopen,built.manifest.functions.timeHelper])assert.ok(built.revert.includes(hash));
});
test('no new persistent table, certified trigger rewrite, deadline feature or 24h extension',()=>{
 assert.doesNotMatch(built.candidate,/create table private\./i);assert.doesNotMatch(built.candidate,/create or replace function private.guard_remaining_search_close_fields/i);
 assert.doesNotMatch(built.candidate,/interval '24 hours'/);
});
test('generated proof retains all original groups and injects seven hardening groups',()=>{
 assert.match(built.proof,/rememberedReopen/);assert.match(built.proof,/delayed FIRST reopen/);assert.match(built.proof,/actualLockWaitObserved/);
 assert.match(built.proof,/same-key concurrent/);assert.match(built.proof,/oneMicrosecondAfter:false/);
});

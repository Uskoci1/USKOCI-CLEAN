import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {compose,sha256,md5,relativeSignature,readerSignatures} from './build.mjs';
const here=path.dirname(new URL(import.meta.url).pathname),read=n=>fs.readFileSync(path.join(here,n),'utf8');
let base;
if(process.env.R3_LOCAL_VERIFIED_DIR){const d=process.env.R3_LOCAL_VERIFIED_DIR;base={candidate:fs.readFileSync(d+'/candidate.sql','utf8'),revert:fs.readFileSync(d+'/revert.sql','utf8'),proof:null,manifest:JSON.parse(fs.readFileSync(d+'/manifest.json','utf8'))};}
else{const {build}=await import('../r2/build.mjs');base=build(process.cwd(),'/tmp/ex06e-r3-test-base');}
const inputs=[base,read('readers.sql'),read('relative.before.sql'),read('relative.after.sql'),read('scenarios.inc.mjs')];const built=compose(...inputs);
test('R2 inputs remain pinned',()=>{for(const key of ['candidate','revert'])assert.throws(()=>compose({...base,[key]:base[key]+'\n'},...inputs.slice(1)));});
test('combined application and code rollback each have one transaction',()=>{for(const s of [built.candidate,built.revert])assert.equal((s.match(/^commit;$/gm)||[]).length,1);});
test('calendar rule is anchored to publication and local calendar week',()=>{assert.match(inputs[3],/date_trunc\('week', p_published_at at time zone tz\)/);assert.match(inputs[3],/interval '1 week'/);assert.doesNotMatch(inputs[3],/interval '7 days'/);});
test('only replacement helper body changes; caller metadata is retained',()=>{assert.match(built.candidate,/to_jsonb\(p\)-'prosrc' is distinct from m/);assert.ok(built.manifest.relativeHash===md5(inputs[3]));});
test('read-only APIs are owner restricted and private ledger never granted',()=>{assert.equal((inputs[1].match(/requester_account_id=actor/g)||[]).length,3);assert.equal((inputs[1].match(/stable security definer/g)||[]).length,2);assert.doesNotMatch(inputs[1],/grant.*on table/i);});
test('receipt inspection never invokes reopen or enqueue',()=>{const body=inputs[1].split('as $r3_receipt$')[1].split('$r3_receipt$;')[0];assert.doesNotMatch(body,/rpc_reopen_remaining_search\(|enqueue_dispatch\(|\b(update|insert|delete)\b/i);assert.match(body,/NOT_CONFIRMED/);assert.match(body,/REOPEN_REMAINING_SEARCH_V1/);});
test('state projection uses existing time and coverage authorities',()=>{assert.match(inputs[1],/fn_need_covered_slots\(n.id\)/);assert.match(inputs[1],/need_search_time_admitted_v1\(n.id,at_now\)/);assert.match(inputs[1],/coveredSlots/);assert.match(inputs[1],/missingSlots/);});
test('new read functions are pinned before revert drops them',()=>{assert.ok(built.revert.indexOf('R3_READER_DRIFT')<built.revert.indexOf('drop function '+readerSignatures[0]));for(const s of built.manifest.readers)assert.ok(built.revert.includes(s.bodyMd5));});
test('SQL dollar quoted strings survive generation',()=>{assert.ok(built.candidate.includes('as $r3_state$'));assert.ok(built.candidate.includes('$r3_receipt$;'));assert.equal(sha256(built.candidate),built.manifest.candidateSha256);});
test('future accepted Agreement is not used to extend an expired Need',()=>{assert.match(inputs[4],/passed Need window keeps accepted future Agreement intact/);assert.match(inputs[4],/noNeedTimeExtension:true/);assert.doesNotMatch(inputs[1],/update public.agreement/);});

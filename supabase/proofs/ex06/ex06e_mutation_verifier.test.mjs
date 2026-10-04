import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyClosedSearchMutationDenied as verify} from './ex06e_mutation_verifier.mjs';
const before = () => ({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', remaining_search_closed_at:'2026-10-04T18:00:00+00:00', need_hash:'a'.repeat(32), covered_slots:1, required_slots:2, queued:false});
test('RLS zero rows plus unchanged owned readback proves denial', () => {
  const b=before(); assert.equal(verify({error:null,data:[]},b,{...b}).denialMechanism,'RLS_ZERO_ROWS');
});
test('permission error still requires unchanged owned readback', () => {
  const b=before(); assert.equal(verify({error:{code:'42501'},data:null},b,{...b}).stateUnchanged,true);
});
for (const [name,patch] of [ ['cleared closure',{remaining_search_closed_at:null}], ['changed timestamp',{remaining_search_closed_at:'2026-10-04T18:01:00+00:00'}], ['changed task hash',{need_hash:'b'.repeat(32)}], ['changed coverage',{covered_slots:0}], ['queued dispatch',{queued:true}], ['wrong task',{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}] ]) {
  test(`rejects ${name} even when HTTP returned zero rows`, () => { const b=before(); assert.throws(()=>verify({error:null,data:[]},b,{...b,...patch})); });
}
test('does not accept a missing readback', () => assert.throws(()=>verify({error:null,data:[]},before(),null)));
test('does not accept a successful returned row', () => {const b=before();assert.throws(()=>verify({error:null,data:[{id:b.id}]},b,b));});
test('does not treat transport failures as security evidence', () => {const b=before();assert.throws(()=>verify({error:{code:'08006'},data:null},b,b));});
test('does not manufacture denial for an initially open search', () => {const b={...before(),remaining_search_closed_at:null};assert.throws(()=>verify({error:null,data:[]},b,b));});
test('does not accept an empty or untyped response', () => {const b=before();for(const res of [null,{}, {error:null,data:null},{error:undefined,data:[]}]) assert.throws(()=>verify(res,b,b));});

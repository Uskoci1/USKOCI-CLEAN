import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const c=fs.readFileSync(new URL('../../candidates/ex06e_lifecycle_recovery.sql',import.meta.url),'utf8');
const r=fs.readFileSync(new URL('../../candidates/ex06e_lifecycle_recovery_revert.sql',import.meta.url),'utf8');
const p=fs.readFileSync(new URL('./ex06e_lifecycle_recovery_proof.mjs',import.meta.url),'utf8');

test('candidate keeps coverage, search authority and time authority separate',()=>{
  assert.match(c,/remaining_search_closed_at is not null/);
  assert.match(c,/need_search_time_admitted_v1/);
  assert.match(c,/REMAINING_SEARCH_CLOSED/);
  assert.match(c,/SEARCH_WINDOW_CLOSED/);
  assert.match(c,/rpc_reopen_remaining_search/);
  assert.match(c,/REOPEN_REMAINING_SEARCH/);
  assert.match(c,/reopenedRemainingSlots/);
  assert.match(c,/response_deadline is not null and n\.response_deadline <= p_at/);
  assert.match(c,/interval '24 hours'/);
  assert.doesNotMatch(c,/create\s+type|alter\s+type|new\s+status/i);
});
test('remaining-search guard remains fail closed for a null token',()=>{
  assert.match(c,/is distinct from 'CLOSE_REMAINING_SEARCH'[\s\S]*is distinct from 'REOPEN_REMAINING_SEARCH'/);
  assert.doesNotMatch(c,/not in \('CLOSE_REMAINING_SEARCH'/i);
});
test('revert restores all four predecessor hashes and removes only EX06E functions',()=>{
  for(const hash of ['1fd8c51ef026ece24471e2f68250ecc5','e568b033b9457736869fc5829ffc5511','ce59ad1cdee98518950e289aa5c329a4','f3ca4d5f8bdf324d5773d887d0a2d093']) assert.ok(r.includes(hash));
  assert.match(r,/drop function public\.rpc_reopen_remaining_search/);
  assert.match(r,/drop function private\.need_search_time_admitted_v1/);
});
test('behavioral proof names every owner-required scenario',()=>{
  for(const phrase of ['2->1 OPEN searches missing 1','2->1 OPEN cancel searches missing 2','2->2 one cancel searches missing 1',
    '2->1 CLOSED cancel keeps human authority and ZERO automatic matching','CLOSED + missing -> canonical reopen -> only missing capacity',
    'expired accepted window +24h does not revive matching']) assert.ok(p.includes(phrase),phrase);
});

test('candidate is schema neutral and reuses the existing close-command ledger with a reopen namespace',()=>{
  assert.doesNotMatch(c,/create table private\.remaining_search_reopen_commands/i);
  assert.match(c,/private\.remaining_search_close_commands/);
  assert.match(c,/'reopen:'\|\|v_request_id/);
});

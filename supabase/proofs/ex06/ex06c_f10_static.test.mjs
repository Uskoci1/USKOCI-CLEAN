import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const candidate = fs.readFileSync(new URL('../../candidates/ex06c_f10_closed_search_dispatch.sql', import.meta.url), 'utf8');
const revert = fs.readFileSync(new URL('../../candidates/ex06c_f10_closed_search_dispatch_revert.sql', import.meta.url), 'utf8');
const postflight = fs.readFileSync(new URL('./ex06c_f10_postflight.readonly.sql', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('./README_EX06C_F10.md', import.meta.url), 'utf8');

test('F10 package is exactly the two-function terminal-stop correction', () => {
  for (const text of [candidate, revert, postflight]) assert.equal(text.includes('\r'), false, 'LF-only SQL');
  assert.match(candidate, /private\.dispatch_next_wave\(uuid\)/);
  assert.match(candidate, /private\.dispatch_tick\(integer,timestamptz\)/);
  assert.match(candidate, /remaining_search_closed_at is not null/);
  assert.match(candidate, /'REMAINING_SEARCH_CLOSED'/);
  assert.match(candidate, /1fd8c51ef026ece24471e2f68250ecc5/);
  assert.match(candidate, /e568b033b9457736869fc5829ffc5511/);
  assert.match(candidate, /3cc3af3cdbafbfbc51a491ac2ce6581d/);
  assert.match(candidate, /1600e4e3402d59c3ada13e3226a467c1/);
  assert.equal(/alter\s+table|create\s+table\s+(?!ex06c_f10_before)|drop\s+table|insert\s+into\s+public\.|update\s+public\.|delete\s+from\s+public\./i.test(candidate), false);
  assert.equal(candidate.includes('40001'), false);
});

test('revert is exact inverse and pins the applied bodies', () => {
  assert.match(revert, /3cc3af3cdbafbfbc51a491ac2ce6581d/);
  assert.match(revert, /1600e4e3402d59c3ada13e3226a467c1/);
  assert.match(revert, /execute replace\(def,wave_replacement,wave_anchor\)/);
  assert.match(revert, /execute replace\(def,tick_replacement,tick_anchor\)/);
  assert.match(revert, /1fd8c51ef026ece24471e2f68250ecc5/);
  assert.match(revert, /e568b033b9457736869fc5829ffc5511/);
});

test('postflight is read-only and fails closed on the exact new bodies', () => {
  assert.match(postflight, /WAVE_BODY_MISMATCH/);
  assert.match(postflight, /TICK_BODY_MISMATCH/);
  assert.match(postflight, /CLOSURE_DIGEST_MISMATCH/);
  assert.equal(/\b(insert|update|delete|create|alter|drop|truncate)\b/i.test(postflight.replace(/^--.*$/gm,'')), false);
});

test('README keeps the named approval boundary and proof limits explicit', () => {
  assert.match(readme, /DISPOSABLE PROOF PENDING/);
  assert.match(readme, /NOT APPLIED TO DEV/);
  assert.match(readme, /PRIMENI EX-06 ex06c-F10/);
});

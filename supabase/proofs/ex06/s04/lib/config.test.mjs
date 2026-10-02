// EX-06 S04: offline tests of the dispatch configuration reader.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEV_CONFIG, readConfig} from './config.mjs';

const devRows = () => [
  {key: 'dispatch_normal', sha256: DEV_CONFIG.dispatch_normal.sha256, wave_sizes: [5, 5, 10, 20], target_responses: '3', window_minutes: '15'},
  {key: 'dispatch_urgent', sha256: DEV_CONFIG.dispatch_urgent.sha256, wave_sizes: [10, 10, 20], target_responses: '3', window_minutes: '3'},
  {key: 'urgent_activation_policy', sha256: DEV_CONFIG.urgent_activation_policy.sha256, wave_sizes: null, target_responses: null, window_minutes: null},
];

test('the DEV values are the ones read on DEV: three rows, 64-hex sha256, and the numbers of dispatch_normal that the pinned wave body reads', () => {
  for (const key of ['dispatch_normal', 'dispatch_urgent', 'urgent_activation_policy']) assert.match(DEV_CONFIG[key].sha256, /^[0-9a-f]{64}$/, key);
  assert.deepEqual(DEV_CONFIG.dispatch_normal.waveSizes, [5, 5, 10, 20]);
  assert.equal(DEV_CONFIG.dispatch_normal.windowMinutes, 15);
  assert.equal(DEV_CONFIG.dispatch_normal.targetResponses, 3);
  const body = readFileSync(new URL('../dev_bodies/dispatch_next_wave.txt', import.meta.url), 'utf8');
  assert.match(body, /key = case when urg = 'URGENT' then 'dispatch_urgent' else 'dispatch_normal' end/);
  assert.match(body, /sizes := cfg->'waveSizes'/);
  assert.match(body, /target := \(cfg->>'targetResponses'\)::integer/);
  assert.match(body, /windowm := \(cfg->>'windowMinutes'\)::integer/);
});

test('the rows of DEV are read as plain numbers and equal DEV', () => {
  const config = readConfig(devRows());
  assert.equal(config.ok, true);
  assert.deepEqual(config.problems, []);
  assert.deepEqual(config.waveSizes, [5, 5, 10, 20]);
  assert.equal(config.windowMinutes, 15);
  assert.equal(config.targetResponses, 3);
  assert.equal(config.equalsDev, true);
  assert.deepEqual(config.rows.map(row => row.equalsDev), [true, true, true]);
});

test('a chain whose row differs from DEV is still usable: the values come from the chain, equalsDev says false (informational)', () => {
  const rows = devRows();
  rows[0] = {...rows[0], sha256: 'a'.repeat(64), wave_sizes: [3, 3], window_minutes: '10'};
  const config = readConfig(rows);
  assert.equal(config.ok, true);
  assert.deepEqual(config.waveSizes, [3, 3]);
  assert.equal(config.windowMinutes, 10);
  assert.equal(config.equalsDev, false);
  assert.equal(config.rows[1].equalsDev, true, 'the other rows are compared one by one');
});

test('a row the wave could not use is a problem, never a default', () => {
  assert.equal(readConfig([]).ok, false);
  assert.match(readConfig([]).problems[0], /dispatch_normal .* does not exist/);
  for (const [patch, text] of [[{wave_sizes: []}, /waveSizes/], [{wave_sizes: null}, /waveSizes/], [{wave_sizes: [5, 0]}, /waveSizes/], [{wave_sizes: [5, 2.5]}, /waveSizes/], [{window_minutes: '0'}, /windowMinutes/],
    [{window_minutes: null}, /windowMinutes/], [{target_responses: 'x'}, /targetResponses/], [{target_responses: '3.5'}, /targetResponses/]]) {
    const rows = devRows();
    rows[0] = {...rows[0], ...patch};
    const config = readConfig(rows);
    assert.equal(config.ok, false, JSON.stringify(patch));
    assert.match(config.problems.join(' | '), text, JSON.stringify(patch));
  }
});

test('not an array of rows is a problem, not an exception', () => {
  assert.equal(readConfig(undefined).ok, false);
  assert.equal(readConfig(null).ok, false);
});

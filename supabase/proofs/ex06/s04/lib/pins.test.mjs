// EX-06 S04: offline tests of the DEV pin table and the chain-fidelity gate (no database).
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {CORE_NAMES, DEV_BODY_CAPTURES, DEV_READ, S04_PINS, chainLabel, chainVerdict, evaluateS04Pins, s04PinQuery} from './pins.mjs';
import {PINS as S03_PINS} from '../../lib/pins.mjs';

const md5 = text => createHash('md5').update(text).digest('hex');
const here = relative => new URL(relative, import.meta.url);

test('the pin table is well formed: unique (name, nargs), 32 hex md5, a tier, a role and a use for every pin', () => {
  const seen = new Set();
  for (const pin of S04_PINS) {
    assert.match(pin.name, /^(public|private)\.[a-z_0-9]+$/, pin.name);
    assert.ok(Number.isInteger(pin.nargs) && pin.nargs >= 0, pin.name);
    assert.match(pin.md5, /^[0-9a-f]{32}$/, pin.name);
    assert.ok(['CORE', 'SUPPORTING', 'INFORMATIONAL'].includes(pin.tier), pin.name);
    assert.ok(pin.role && pin.use, pin.name + ' says what it is and what uses it');
    const key = pin.name + '/' + pin.nargs;
    assert.ok(!seen.has(key), 'duplicate ' + key);
    seen.add(key);
  }
  assert.ok(S04_PINS.length >= 50, 'the table covers the dispatch lifecycle: ' + S04_PINS.length);
});

test('the DEV reading is stamped: when, where, which ledger and which certificate', () => {
  assert.equal(DEV_READ.project, 'leqcwgzvjsxugfgzdmth');
  assert.match(DEV_READ.readAtUtc, /^2026-10-02 \d\d:\d\d/);
  assert.equal(DEV_READ.ledger, 221);
  assert.equal(DEV_READ.closureDigest, '0579191d8ef6ef2d9625569cd64e65ad1398c4e9cc176404beff253a10853431');
  assert.match(DEV_READ.how, /read-only SELECT/);
});

test('CORE is exactly the twelve bodies the corpus proofs already proved equal on the chain (the S03 eleven with the two ex06a bodies, ex06a applied)', () => {
  assert.equal(CORE_NAMES.length, 12);
  const core = S04_PINS.filter(pin => pin.tier === 'CORE');
  assert.deepEqual(core.map(pin => pin.name).sort(), [...CORE_NAMES].sort());
  // The eleven S03 pins: same names; every one equals the S01/S03 pin except match_detail_without_calendar, which ex06a (ledger 220) changed on DEV
  const s03 = new Map(S03_PINS.filter(pin => pin.stage === 'PROOF_POINT').map(pin => [pin.name, pin.md5]));
  assert.equal(s03.size, 11);
  for (const [name, md5Value] of s03) {
    const pin = core.find(item => item.name === name);
    assert.ok(pin, name + ' is a CORE pin');
    if (name === 'private.match_detail_without_calendar') {
      assert.equal(md5Value, '9180606a038f3606b0906ab4aefdd0c1');
      assert.equal(pin.md5, 'c8aaf3da761242397243fc56262d1aeb', 'the ex06a body of DEV, read again on 2026-10-02');
    } else assert.equal(pin.md5, md5Value, name + ' is unchanged since S01');
  }
  assert.equal(core.find(pin => pin.name === 'private.worker_dispatch_time_admitted').md5, '4f0beb65922d2b3d947d69e68a56a956');
  for (const name of ['private.match_detail_without_calendar', 'private.worker_dispatch_time_admitted']) {
    assert.equal(core.find(pin => pin.name === name).chain.expect, 'AFTER_EX06A');
  }
});

test('the B24 part 1 targets are named with their pre-image and are the only pins a derivation may explain', () => {
  const b24 = S04_PINS.filter(pin => pin.chain.expect === 'B24_PART1');
  assert.deepEqual(b24.map(pin => pin.name).sort(), ['public.rpc_close_remaining_search', 'public.rpc_confirm_need_edit', 'public.rpc_save_worker_availability', 'public.rpc_save_worker_capacity',
    'public.rpc_save_worker_location', 'public.rpc_set_account_block', 'public.rpc_set_notification_preferences']);
  for (const pin of b24) assert.match(pin.chain.preImageDev, /^[0-9a-f]{32}$/, pin.name);
});

test('the four DEV body captures are byte-exact: their md5 is the pin', () => {
  for (const [name, file] of Object.entries(DEV_BODY_CAPTURES)) {
    const text = readFileSync(here('../dev_bodies/' + file), 'utf8').replace(/\r/g, '');
    const pin = S04_PINS.find(item => item.name === name);
    assert.ok(pin, name);
    assert.equal(md5(text), pin.md5, name + ' capture');
  }
  assert.deepEqual(Object.keys(DEV_BODY_CAPTURES).sort(), ['private.dispatch_cheap_candidate_admitted', 'private.dispatch_next_wave', 'private.marketplace_tick', 'private.push_suppression']);
});

test('s04PinQuery reads every pinned name, with the B24 derivation column', () => {
  const query = s04PinQuery();
  for (const pin of S04_PINS) assert.ok(query.includes(`('${pin.name.split('.')[0]}','${pin.name.split('.')[1]}')`), pin.name);
  assert.match(query, /derived_b24_part1_pt409/);
});

const rowsFor = (overrides = {}) => S04_PINS.map(pin => ({name: pin.name, nargs: pin.nargs, args: 'x', md5: pin.md5, derived_b24_part1_pt409: 'f'.repeat(32), ...(overrides[pin.name] ?? {})}));

test('every pin equal: verdict EQUAL, nothing fatal', () => {
  const evaluation = evaluateS04Pins(rowsFor());
  const verdict = chainVerdict(evaluation);
  assert.equal(verdict.verdict, 'EQUAL');
  assert.deepEqual(verdict.fatal, []);
  assert.match(chainLabel(verdict), /^FUNCTION BODIES == DEV/);
  assert.match(chainLabel(verdict), /RLS policies, config rows and triggers are not pinned/);
});

test('a B24 target whose chain body derives to the DEV pin is EXPLAINED, and says so when it also equals the pre-image', () => {
  const target = S04_PINS.find(pin => pin.name === 'public.rpc_set_account_block');
  const rows = rowsFor({'public.rpc_set_account_block': {md5: target.chain.preImageDev, derived_b24_part1_pt409: target.md5}});
  const verdict = chainVerdict(evaluateS04Pins(rows));
  assert.equal(verdict.verdict, 'EXPLAINED');
  assert.deepEqual(verdict.fatal, []);
  const row = verdict.rows.find(item => item.name === 'public.rpc_set_account_block');
  assert.equal(row.verdict, 'EXPLAINED');
  assert.equal(row.preImageEqual, true);
  assert.match(row.explanation, /B24 part 1/);
  assert.match(chainLabel(verdict), /1 explained by B24 part 1/);
  // a different, unknown pre-image that still derives to the pin is explained but not pre-image equal
  const other = chainVerdict(evaluateS04Pins(rowsFor({'public.rpc_set_account_block': {md5: 'a'.repeat(32), derived_b24_part1_pt409: target.md5}})));
  assert.equal(other.rows.find(item => item.name === 'public.rpc_set_account_block').preImageEqual, false);
});

test('a derivation never excuses a pin that is not a B24 target', () => {
  const pin = S04_PINS.find(item => item.name === 'private.dispatch_next_wave');
  const verdict = chainVerdict(evaluateS04Pins(rowsFor({'private.dispatch_next_wave': {md5: 'b'.repeat(32), derived_b24_part1_pt409: pin.md5}})));
  assert.equal(verdict.verdict, 'DIFFERS');
  assert.deepEqual(verdict.fatal, ['private.dispatch_next_wave']);
});

test('a CORE difference is fatal in every mode; a SUPPORTING difference is fatal in strict mode and reported in report mode', () => {
  const core = chainVerdict(evaluateS04Pins(rowsFor({'private.emit_event': {md5: 'c'.repeat(32)}})), {mode: 'report'});
  assert.equal(core.verdict, 'DIFFERS');
  assert.deepEqual(core.fatal, ['private.emit_event']);
  const support = rowsFor({'public.rpc_cancel_need': {md5: 'd'.repeat(32)}});
  const strict = chainVerdict(evaluateS04Pins(support));
  assert.equal(strict.verdict, 'DIFFERS');
  assert.deepEqual(strict.fatal, ['public.rpc_cancel_need']);
  assert.match(chainLabel(strict), /^FUNCTION BODIES != DEV/);
  const report = chainVerdict(evaluateS04Pins(support), {mode: 'report'});
  assert.equal(report.verdict, 'DIFFERS_SUPPORTING_ONLY');
  assert.deepEqual(report.fatal, []);
  assert.deepEqual(report.supportingDifferences, ['public.rpc_cancel_need']);
  assert.match(chainLabel(report), /SUPPORTING/);
});

test('an INFORMATIONAL difference is listed and never fatal', () => {
  const info = S04_PINS.find(pin => pin.tier === 'INFORMATIONAL');
  assert.ok(info, 'there is at least one informational pin (private.marketplace_tick)');
  const verdict = chainVerdict(evaluateS04Pins(rowsFor({[info.name]: {md5: 'e'.repeat(32)}})));
  assert.equal(verdict.verdict, 'EQUAL');
  assert.deepEqual(verdict.fatal, []);
  assert.deepEqual(verdict.informational, [info.name]);
  assert.match(chainLabel(verdict), /informational/);
});

test('a missing function and an ambiguous overload are fatal for CORE and SUPPORTING', () => {
  const rows = rowsFor().filter(row => row.name !== 'private.candidate_profile_ids');
  const missing = chainVerdict(evaluateS04Pins(rows));
  assert.equal(missing.verdict, 'DIFFERS');
  assert.ok(missing.fatal.includes('private.candidate_profile_ids'));
  assert.equal(missing.rows.find(row => row.name === 'private.candidate_profile_ids').verdict, 'MISSING');
  const duplicate = [...rowsFor(), {name: 'private.dispatch_tick', nargs: 2, args: 'y', md5: '9'.repeat(32), derived_b24_part1_pt409: '9'.repeat(32)}];
  const ambiguous = chainVerdict(evaluateS04Pins(duplicate));
  assert.ok(ambiguous.fatal.includes('private.dispatch_tick'));
  assert.equal(ambiguous.rows.find(row => row.name === 'private.dispatch_tick').verdict, 'AMBIGUOUS');
});

test('rows carry what a reader needs: the name, the tier, the role, both md5s, the verdict and the proof level', () => {
  const verdict = chainVerdict(evaluateS04Pins(rowsFor()));
  for (const row of verdict.rows) {
    for (const key of ['name', 'tier', 'role', 'expected', 'actual', 'verdict', 'proven', 'use']) assert.ok(key in row, row.name + ' has ' + key);
  }
  assert.ok(verdict.rows.some(row => row.proven === 'CI'), 'the pins the corpus proofs proved equal are marked CI');
  assert.ok(verdict.rows.some(row => row.proven === 'EXPECTED'), 'the others are marked EXPECTED, never CI');
});

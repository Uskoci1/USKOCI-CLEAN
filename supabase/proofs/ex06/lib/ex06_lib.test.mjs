// Offline tests of the EX-06 S03/S04 harness helpers (no database, no network, no dependency): `node --test supabase/proofs/ex06/lib/`.
// They check the harness, not the chain: the pins against the S01 document (each pin against ITS OWN row), the gate logic, the expectation comparison (including that every negative control
// reports a mismatch and that a negative without a named cause is refused), the corpus validation (nested profile keys included), the city table and the time helpers, and the call sequence
// of the fixture builders against a recording fake of the proof adapter (abort signals, read-back, the world option, activate-then-clear, the S04 helpers).
process.env.EX06_QUIET = '1';
import assert from 'node:assert/strict';
import test from 'node:test';
import {DEPENDENCY_FUNCTIONS, EXTENSION_PINS, EXTRA_PINS, PINS, PROOF_POINT_PINS, bodyMd5Map, bodyQuery, catalogLines, catalogQuery, configQuery, dependencyBodies, dependencyQuery, diffCatalog,
  evaluatePins, evidenceLabel, pinGate, pinQuery, pinRowsOf, s01TableRows} from './pins.mjs';
import {NEGATIVE_CONTROLS, annotationsFor, classifyFields, compareExpectation, comparisonRows, failedNegativeControls, gatesOf, renderMarkdown, resultLine, sortedSet, validateExpectation} from './compare.mjs';
import {CANARY_CORPUS, CONTROL_RESTRICTED, SMOKE_CORPUS, capFromEnv, chooseCorpusPath, checkWorkerProfile, containsPersonalDataPattern, deriveReferenceWorkers, factsAtTime, hasBypassFacts,
  normaliseCorpus, referenceWorkerPlan, resolveRelativeTime, unreachableReason} from './corpus.mjs';
import {CITY_CENTRES, cityCentre, haversineKm, pinFor, primaryCity} from './geo.mjs';
import {availabilityFor, computeRebase, coverageFor, materialiseTimes, parseIso, rebaseIso, utcOffsetMinutes, zonedParts} from './timeutil.mjs';
import {createFixtures, diffNeedReadBack, diffWorkerReadBack, locationValueFor, proposalsFor, slotCity, slotsForGeography} from './fixtures.mjs';
import {STAND_IN_REGISTRY as REGISTRY, S01_PATH, fakeRuntime, readText} from './test_support.mjs';

const S01 = readText(S01_PATH);

// ------------------------------------------------------------------ pins
/** Problems (strings) of pinning every pin to ITS OWN row of the S01 table; a swap of two md5s between two functions shows up here. */
function pairingProblems(pins, markdown) {
  const rowsOfTable = s01TableRows(markdown), problems = [];
  for (const pin of pins) {
    const short = pin.name.split('.')[1];
    const row = rowsOfTable.find(item => item.text.includes('`' + pin.name + '(') || item.text.includes('`' + short + '('));
    if (!row) { problems.push('no S01 row names ' + pin.name); continue; }
    const position = row.md5s.length > 1 ? [...row.text.matchAll(/`(?:private\.)?(closure_[a-z_0-9]+)\(/g)].map(match => match[1]).indexOf(short) : 0;
    if (row.md5s[position] !== pin.md5) problems.push(`${pin.name}: the S01 row carries ${row.md5s[position]}, the pin says ${pin.md5}`);
  }
  return problems;
}

test('the 12 pins are the S01 table: every pin equals the md5 of ITS OWN S01 row, names and md5 are unique, 11 are read at the proof point and the 12th after the extension', () => {
  assert.equal(PINS.length, 12);
  assert.equal(PROOF_POINT_PINS.length, 11);
  assert.deepEqual(EXTENSION_PINS.map(pin => pin.name), ['public.rpc_begin_push_send']);
  assert.equal(new Set(PINS.map(pin => pin.name)).size, 12);
  assert.equal(new Set(PINS.map(pin => pin.md5)).size, 12);
  for (const pin of [...PINS, ...EXTRA_PINS]) {
    assert.match(pin.md5, /^[0-9a-f]{32}$/);
    for (const predecessor of pin.predecessors) assert.match(predecessor.md5, /^[0-9a-f]{32}$/);
  }
  assert.deepEqual(pairingProblems([...PINS, ...EXTRA_PINS], S01), []);
  assert.deepEqual(PINS.filter(pin => pin.reach === 'EXTENSION_ONLY').map(pin => pin.name), ['public.rpc_begin_push_send']);
  assert.equal(EXTRA_PINS.find(pin => pin.name === 'private.closure_source_digest_v5').reach, 'NOT_REACHED_BY_CHAIN');
});

test('two md5s swapped between two functions are detected by the row pairing (the old "md5 and name appear somewhere" check would have passed)', () => {
  const swapped = PINS.map(pin => (pin.name === 'private.match_detail' ? {...pin, md5: PINS.find(other => other.name === 'private.dispatch_next_wave').md5}
    : pin.name === 'private.dispatch_next_wave' ? {...pin, md5: PINS.find(other => other.name === 'private.match_detail').md5} : pin));
  const problems = pairingProblems(swapped, S01);
  assert.equal(problems.length, 2);
  assert.ok(swapped.every(pin => S01.includes(pin.md5) && S01.includes(pin.name.split('.')[1])), 'each swapped md5 and name still appear somewhere in the document');
  const swappedExtra = EXTRA_PINS.map(pin => ({...pin, md5: EXTRA_PINS.find(other => other !== pin).md5}));
  assert.equal(pairingProblems(swappedExtra, S01).length, 2, 'the two certificate pins share one S01 row and are told apart by position');
});

test('pinQuery reads every overload by schema.name and normalises carriage returns the S01 way; the dependency, config and catalog queries read what the label does not pin', () => {
  const query = pinQuery();
  for (const pin of PINS) assert.ok(query.includes(`('${pin.name.split('.')[0]}','${pin.name.split('.')[1]}')`));
  assert.ok(query.includes("replace(p.prosrc, E'\\r', '')"));
  assert.ok(query.includes("'''40001''', '''PT409'''"));
  assert.ok(!/;\s*$/.test(query), 'the query is wrapped by rt.rows and must not end with a semicolon');
  const dependencies = dependencyQuery();
  for (const name of DEPENDENCY_FUNCTIONS) assert.ok(dependencies.includes(`('${name.split('.')[0]}','${name.split('.')[1]}')`), name);
  assert.ok(!dependencies.includes('PT409'));
  assert.deepEqual(DEPENDENCY_FUNCTIONS.length, 10);
  for (const name of ['schedule_fit', 'worker_dispatch_time_admitted', 'worker_available_periods', 'availability_is_future', 'worker_calendar_conflict', 'lower_arr', 'haversine_km', 'effective_radius_km', 'identity_admitted', 'candidate_budget']) {
    assert.ok(DEPENDENCY_FUNCTIONS.includes('private.' + name), name);
  }
  const config = configQuery();
  for (const key of ['dispatch_normal', 'dispatch_urgent', 'urgent_activation_policy']) assert.ok(config.includes(`'${key}'`));
  assert.ok(config.includes('waveSizes') && config.includes("'sha256'") && !/;\s*$/.test(config));
  const catalog = catalogQuery();
  assert.ok(catalog.includes("n.nspname in ('public', 'private')") && catalog.includes('pg_get_triggerdef') && !/;\s*$/.test(catalog));
  assert.ok(bodyQuery(['private.a', 'private.a']).split("('private','a')").length === 2, 'names are de-duplicated');
});

function rowsFor(pins, override = {}) {
  return pins.map(pin => ({name: pin.name, nargs: pin.nargs, args: 'x', md5: override[pin.name]?.md5 ?? pin.md5, derived_b24_part1_pt409: override[pin.name]?.derived ?? 'f'.repeat(32)}));
}

test('evaluatePins: equal, different (with the explanation of a known predecessor), missing, ambiguous; the label names exactly what the pins cover', () => {
  const clean = evaluatePins(rowsFor(PINS));
  assert.deepEqual(Object.keys(clean), ['equal', 'different', 'missing']);
  assert.equal(clean.equal.length, 12);
  assert.equal(evidenceLabel(clean, 12), 'MATCH/DISPATCH/EVENT FUNCTION BODIES == DEV (12 pins; helper functions, config rows and triggers not pinned)');
  const proof = evaluatePins(rowsFor(PROOF_POINT_PINS), PROOF_POINT_PINS);
  assert.equal(evidenceLabel(proof, 11), 'MATCH/DISPATCH/EVENT FUNCTION BODIES == DEV (11 of 12 pins read at the proof point, all equal; the others are read after the extension; helper functions, config rows and triggers not pinned)');

  const wave = PINS.find(pin => pin.name === 'private.dispatch_next_wave');
  const mixed = rowsFor(PINS, {'private.dispatch_next_wave': {md5: wave.predecessors[0].md5}, 'private.emit_event': {md5: '0'.repeat(32)}}).filter(row => row.name !== 'private.work_kinds_v5');
  mixed.push({...mixed[0], md5: 'a'.repeat(32)});   // a second overload of match_detail with the same argument count
  const result = evaluatePins(mixed);
  assert.deepEqual(result.missing, ['private.work_kinds_v5']);
  const byName = Object.fromEntries(result.different.map(item => [item.name, item]));
  assert.match(byName['private.dispatch_next_wave'].explanation, /^KNOWN_PREDECESSOR/);
  assert.equal(byName['private.emit_event'].explanation, null);
  assert.match(byName['private.match_detail'].actual, /^AMBIGUOUS_OVERLOADS:2/);
  assert.equal(evidenceLabel(result, 12), 'MATCH/DISPATCH/EVENT FUNCTION BODIES != DEV (4 of 12 pins differ or are missing; helper functions, config rows and triggers not pinned)');
});

test('evaluatePins: a difference that is only B24 part 1 is recognised by the derivation, and is still a difference', () => {
  const begin = PINS.find(pin => pin.name === 'public.rpc_begin_push_send');
  const preB24 = begin.predecessors.find(item => item.md5.startsWith('ea801be7')).md5;
  const result = evaluatePins(rowsFor(PINS, {'public.rpc_begin_push_send': {md5: preB24, derived: begin.md5}}));
  assert.equal(result.different.length, 1);
  assert.equal(result.different[0].derivesToPin, 'B24_PART1_PT409');
  assert.match(result.different[0].explanation, /KNOWN_PREDECESSOR.*DERIVES_TO_PIN/);
  assert.match(evidenceLabel(result, 12), /^MATCH\/DISPATCH\/EVENT FUNCTION BODIES != DEV/);
});

test('pinGate runs one SELECT through the injected row reader; bodyMd5Map reports MISSING; pinRowsOf marks every pin; dependencyBodies groups by name', async () => {
  const seen = [];
  const gate = await pinGate(async text => { seen.push(text); return rowsFor(PINS).filter(row => row.name !== 'private.match_detail'); });
  assert.equal(seen.length, 1);
  assert.deepEqual(gate.missing, ['private.match_detail']);
  assert.equal(bodyMd5Map(rowsFor(PINS).slice(1))['private.match_detail'], 'MISSING');
  await assert.rejects(() => pinGate(async () => 'not rows'), /PIN_GATE_ROWS_NOT_AN_ARRAY/);
  const table = pinRowsOf(gate, PINS);
  assert.equal(table.length, 12);
  assert.equal(table.find(row => row.name === 'private.match_detail').verdict, 'MISSING');
  assert.equal(table.filter(row => row.verdict === 'EQUAL').length, 11);
  const grouped = dependencyBodies([{name: 'private.lower_arr', nargs: 1, md5: 'x'}, {name: 'private.schedule_fit', nargs: 4, md5: 'y'}, {name: 'private.unrelated', nargs: 0, md5: 'z'}]);
  assert.deepEqual(grouped['private.lower_arr'], [{nargs: 1, md5: 'x'}]);
  assert.deepEqual(grouped['private.haversine_km'], []);
  assert.equal('private.unrelated' in grouped, false);
});

test('the catalog fingerprint: lines are name:md5 sorted, counts are split by kind, and a diff lists what an extension added, removed and changed', () => {
  const before = [{name: 'function:private.a()', md5: '1'}, {name: 'function:private.b()', md5: '2'}, {name: 'trigger:public.t.x', md5: '3'}];
  const after = [{name: 'function:private.a()', md5: '9'}, {name: 'function:private.c()', md5: '4'}, {name: 'trigger:public.t.x', md5: '3'}];
  assert.deepEqual(catalogLines(before), {functions: 2, triggers: 1, lines: ['function:private.a():1', 'function:private.b():2', 'trigger:public.t.x:3']});
  assert.deepEqual(diffCatalog(before, after), {added: ['function:private.c()'], removed: ['function:private.b()'], changed: [{name: 'function:private.a()', before: '1', after: '9'}]});
  assert.throws(() => catalogLines('x'), /CATALOG_ROWS_NOT_AN_ARRAY/);
});

// ------------------------------------------------------------------ compare
test('every negative control reports a mismatch (the comparison cannot pass vacuously)', () => {
  assert.deepEqual(failedNegativeControls(), []);
  assert.ok(NEGATIVE_CONTROLS.length >= 8);
  const classes = NEGATIVE_CONTROLS.map(control => control.gate).join(' ');
  for (const word of ['hard gate', 'soft gate', 'dispatchEligible', 'responseAllowed', 'delivery', 'event']) assert.ok(classes.includes(word), word);
});

test('compareExpectation: exact sets ignore order, include keys check membership, booleans are strict, reasonUnspecified is never compared', () => {
  const actual = {hardBlockers: ['B', 'A'], dispatchBlockers: [], dispatchEligible: false, responseAllowed: false, reasonCodes: ['SERVICE_MATCH'], delivery: false, event: false};
  assert.ok(compareExpectation({hardBlockers: ['A', 'B'], dispatchBlockers: [], dispatchEligible: false, delivery: false, event: false}, actual).ok);
  assert.ok(compareExpectation({hardBlockersInclude: ['A'], reasonCodesInclude: ['SERVICE_MATCH']}, actual).ok);
  const bad = compareExpectation({hardBlockers: ['A'], hardBlockersInclude: ['C'], delivery: true}, actual);
  assert.deepEqual(bad.mismatches.map(item => item.field), ['hardBlockers', 'hardBlockersInclude', 'delivery']);
  assert.deepEqual(bad.asserted, ['hardBlockers', 'hardBlockersInclude', 'delivery']);
  assert.deepEqual(comparisonRows({hardBlockers: ['A', 'B'], delivery: true}, actual).map(row => row.verdict), ['PASS', 'FINDING']);
  const marked = compareExpectation({delivery: false, reasonUnspecified: true}, actual);
  assert.deepEqual(marked.asserted, ['delivery']);
  assert.equal(comparisonRows({delivery: false, reasonUnspecified: true}, actual).length, 1);
});

test('validateExpectation refuses an unknown key, an empty expectation, a wrong type, an empty include list and a negative outcome that names no cause', () => {
  assert.throws(() => validateExpectation({hardBlocker: []}), /EXPECTATION_UNKNOWN_KEY/);
  assert.throws(() => validateExpectation({}), /EXPECTATION_EMPTY/);
  assert.throws(() => validateExpectation({delivery: 'yes'}), /EXPECTATION_WRONG_TYPE/);
  assert.throws(() => validateExpectation({hardBlockers: 'A'}), /EXPECTATION_WRONG_TYPE/);
  assert.throws(() => validateExpectation({hardBlockersInclude: []}), /EXPECTATION_EMPTY/);
  assert.throws(() => validateExpectation({reasonUnspecified: true}), /EXPECTATION_EMPTY/);
  assert.throws(() => validateExpectation({delivery: false, reasonUnspecified: false}), /EXPECTATION_WRONG_TYPE/);
  assert.deepEqual(sortedSet(['b', 'a', 'b']), ['a', 'b']);
  for (const bare of [{dispatchEligible: false}, {responseAllowed: false}, {delivery: false}, {event: false}, {delivery: false, hardBlockers: []}, {dispatchEligible: false, dispatchBlockers: []}]) {
    assert.throws(() => validateExpectation(bare), /NEGATIVE_EXPECTATION_WITHOUT_CAUSE/, JSON.stringify(bare));
  }
  assert.throws(() => validateExpectation({responseAllowed: false, dispatchBlockersInclude: ['OUTSIDE_AVAILABILITY']}), /NEGATIVE_EXPECTATION_WITHOUT_CAUSE.*hard blocker/, 'a soft blocker cannot explain a refused manual application');
  assert.ok(validateExpectation({responseAllowed: false, hardBlockers: ['MISSING_REQUIRED_TOOL']}));
  assert.ok(validateExpectation({dispatchEligible: false, dispatchBlockersInclude: ['OUTSIDE_AVAILABILITY']}));
  assert.ok(validateExpectation({delivery: false, event: false, hardBlockersInclude: ['X']}));
  assert.ok(validateExpectation({delivery: false, reasonUnspecified: true}));
  assert.ok(validateExpectation({dispatchEligible: true, delivery: true}), 'positives need no cause');
});

test('classifyFields and gatesOf: positives and negatives are told apart, and the distinct gates collapse the correlated fields', () => {
  const split = classifyFields({hardBlockers: [], dispatchBlockers: ['OUTSIDE_PREFERRED_RADIUS'], dispatchEligible: false, responseAllowed: true, delivery: false, event: false, reasonCodesInclude: ['SERVICE_MATCH']});
  assert.deepEqual(split.positive.sort(), ['hardBlockers', 'reasonCodesInclude', 'responseAllowed']);
  assert.deepEqual(split.negative.sort(), ['delivery', 'dispatchBlockers', 'dispatchEligible', 'event']);
  assert.deepEqual(gatesOf({hardBlockers: [], dispatchBlockers: ['OUTSIDE_PREFERRED_RADIUS'], dispatchEligible: false, responseAllowed: true, delivery: false, event: false}),
    ['HARD:NONE', 'OUTCOME:NOT_DELIVERED', 'OUTCOME:NOT_ELIGIBLE', 'OUTCOME:NO_EVENT', 'SOFT:OUTSIDE_PREFERRED_RADIUS']);
  assert.deepEqual(gatesOf({hardBlockersInclude: ['A'], delivery: true}), ['HARD:A', 'OUTCOME:DELIVERED']);
});

test('resultLine prints the corpus, the cases ran/total, what was asserted, product/direct and the findings; annotations say what is not evidence', () => {
  const report = {result: 'PARTIAL', evidenceLabel: 'LABEL', corpus: {label: 'CORPUS', ran: 37, totalCases: 66, skipped: new Array(29).fill({}), capped: false, cap: null, unconsumed: {total: 80}},
    assertions: {matcher: 300, positive: 120, negative: 180, distinct: 150, derived: {positive: 40, negative: 60}, preconditions: 200}, paths: {product: 37, direct: 0}, findings: [{}, {}], harnessErrors: [],
    degradedCases: [{}], warnings: []};
  const line = resultLine(report);
  for (const part of ['RESULT PARTIAL', 'corpus=CORPUS', 'cases ran 37/66', 'skipped 29', 'asserted 300', 'distinct 150', 'derived 100', 'product 37 / direct 0', 'unconsumed 80', 'findings 2', 'LABEL']) assert.ok(line.includes(part), part);
  const notes = annotationsFor(report);
  assert.ok(notes.some(text => text.startsWith('::error::') && text.includes('PARTIAL')));
  assert.ok(notes.some(text => text.startsWith('::warning::') && text.includes('2 finding')));
  assert.ok(notes.some(text => text.includes('80 corpus expectation')));
  assert.ok(annotationsFor({...report, result: 'SMOKE_ONLY'}).some(text => text.startsWith('::error::') && text.includes('SMOKE')));
  assert.ok(annotationsFor({...report, result: 'HARNESS_BROKEN'}).some(text => text.startsWith('::error::')));
  assert.deepEqual(annotationsFor({...report, result: 'PASS', findings: [], corpus: {...report.corpus, unconsumed: {total: 0}}}), []);
});

test('renderMarkdown renders the result, the canary, the pin table, the expected-versus-actual rows, the skipped and unconsumed sections and the findings', () => {
  const report = {evidenceLabel: 'MATCH/DISPATCH/EVENT FUNCTION BODIES != DEV (1 of 11 pins differ or are missing; helper functions, config rows and triggers not pinned)', result: 'FINDINGS',
    corpus: {label: 'CORPUS', id: 'EX06_CONTRACT_CORPUS', version: 1, totalCases: 3, ran: 1, cap: null, capped: false, sha256: 'a'.repeat(64), skipped: [{id: 'W-1', family: 'WORKER', reason: 'not consumed'}],
      unconsumed: {total: 1, byKey: {applicationTimeBlockers: 1}, list: [{caseId: 'c', worker: 'fits', key: 'applicationTimeBlockers', value: ['TEAM_CAPACITY_EXCEEDED'], reason: 'application time'}]},
      leaves: {present: 10, consumed: 8, unconsumed: 2}, rebase: {ciNowUtc: '2026-10-01T12:00:00Z', corpusNowUtc: '2026-10-05T08:00:00Z', deltaHours: -92}},
    canary: {status: 'PASS', cases: [{id: 'canary-fit-unfit', status: 'PASS'}]},
    findings: [{caseId: 'c', worker: 'fit', field: 'delivery', expected: true, actual: false, bodiesShort: 'x:1234abcd', materialisation: 'PRODUCT_PATH', kind: 'CORPUS'}], harnessErrors: [],
    pinRows: [{name: 'private.match_detail', role: 'MATCH', expected: 'a', actual: 'b', verdict: 'DIFFERENT', explanation: 'x | y'}],
    digest: {before: {live: 'd1', certified: 'd1', erasure: 'd1', binding: 'd1', ready: true}, after: {live: 'd1'}, startConsistent: true, unchanged: true, note: 'n'},
    cases: [{id: 'c', status: 'FINDING', materialisation: 'PRODUCT_PATH', synthetic: ['S'], notes: [], workers: [{label: 'fit', rows: [{field: 'delivery', expected: true, actual: false, verdict: 'FINDING'}],
      derivedRows: [{field: 'eligible => delivered', expected: true, actual: false, verdict: 'FINDING'}]}], checks: []}, {id: 'r', status: 'PRODUCT_PATH_REFUSED', step: 'publish', error: 'refused', workers: []}],
    bypasses: [], degradedCases: [{id: 'd', reason: 'direct', dropped: ['need.price_basis']}], unreachableCases: [], unattributed: [{caseId: 'c', worker: 'x'}],
    assertions: {matcher: 1, positive: 1, negative: 0, distinct: 1, derived: {positive: 1, negative: 0}, preconditions: 2, degraded: 0, unreachable: 0}, paths: {product: 1, direct: 0}, needPath: 'product',
    warnings: ['w'], stages: null};
  const text = renderMarkdown(report);
  for (const part of ['**Result: FINDINGS**', 'FUNCTION BODIES != DEV', '## Canary', 'canary-fit-unfit PASS', '| private.match_detail |', '| c | fit | delivery | true | false | FINDING |', 'derived invariant', 'x:1234abcd', 'PRODUCT_PATH',
    'x \\| y', 'Cases not run', 'W-1 (WORKER): not consumed', 'NOT consumed by S03', 'applicationTimeBlockers x1', 'PRODUCT_PATH_REFUSED_READY_CASE', 'DEGRADED d', 'UNATTRIBUTED c', 'Clock rebase', 'erasure d1']) {
    assert.ok(text.includes(part), part);
  }
});

// ------------------------------------------------------------------ geo and time
test('the city table: two-decimal centres of the S02 cities, an unknown city is EX06_CITY_UNKNOWN (never a default), and the distances behave like the real ones', () => {
  assert.deepEqual(Object.keys(CITY_CENTRES).sort(), ['Beograd', 'Futog', 'Niš', 'Novi Sad', 'Petrovaradin', 'Sremska Mitrovica', 'Subotica', 'Zrenjanin']);
  for (const centre of Object.values(CITY_CENTRES)) assert.ok(Math.round(centre.latitude * 100) / 100 === centre.latitude && Math.round(centre.longitude * 100) / 100 === centre.longitude);
  assert.deepEqual(cityCentre('Novi Sad'), {latitude: 45.27, longitude: 19.83});
  assert.deepEqual(cityCentre('Niš'), cityCentre('Niš'.normalize('NFD')), 'a decomposed spelling reaches the same city');
  assert.throws(() => cityCentre('Kragujevac'), /EX06_CITY_UNKNOWN/);
  assert.throws(() => cityCentre(undefined), /EX06_CITY_UNKNOWN/);
  const novi = cityCentre('Novi Sad'), nis = cityCentre('Niš'), pet = cityCentre('Petrovaradin');
  const toNis = haversineKm(novi.latitude, novi.longitude, nis.latitude, nis.longitude);
  assert.ok(toNis > 260 && toNis < 290, String(toNis) + ' km: well beyond the 25 km radius of the S02 workers, and inside the 300 km candidate search of the wave');
  assert.ok(haversineKm(novi.latitude, novi.longitude, pet.latitude, pet.longitude) < 10);
  assert.equal(haversineKm(novi.latitude, novi.longitude, novi.latitude, novi.longitude), 0);
  assert.equal(haversineKm(null, 1, 2, 3), null);
  assert.deepEqual(pinFor('start', 'Niš'), {slot: 'start', latitudeE6: 43322500, longitudeE6: 21902500, origin: {kind: 'MANUAL_PIN'}});
  for (const city of Object.keys(CITY_CENTRES)) {
    const pin = pinFor('start', city), centre = cityCentre(city);
    assert.equal(Math.round((pin.latitudeE6 / 1e6) * 100) / 100, centre.latitude, city + ' rounds to the table centre');
    assert.equal(Math.floor((pin.latitudeE6 / 1e6) * 100 + 1e-9) / 100, centre.latitude, city + ' floors to the table centre');
    assert.equal(Math.round((pin.longitudeE6 / 1e6) * 100) / 100, centre.longitude);
    assert.equal(Math.floor((pin.longitudeE6 / 1e6) * 100 + 1e-9) / 100, centre.longitude);
  }
  assert.equal(primaryCity({mode: 'POINT_TO_POINT', start: {city: 'A'}, end: {city: 'B'}}), 'A');
  assert.equal(primaryCity({mode: 'AREA_BASED', serviceArea: {city: 'S'}}), 'S');
  assert.equal(primaryCity({mode: 'REMOTE'}), null);
});

test('zonedParts and the UTC offset follow Europe/Belgrade through the DST change (2026-10-25), weekday 0 = Sunday', () => {
  const summer = Date.parse('2026-10-10T07:00:00Z'), winter = Date.parse('2026-10-31T09:00:00Z');
  assert.equal(utcOffsetMinutes(summer), 120);
  assert.equal(utcOffsetMinutes(winter), 60);
  assert.deepEqual([zonedParts(summer).date, zonedParts(summer).time, zonedParts(summer).weekday], ['2026-10-10', '09:00:00', 6]);
  assert.deepEqual([zonedParts(winter).date, zonedParts(winter).time, zonedParts(winter).weekday], ['2026-10-31', '10:00:00', 6]);
  assert.equal(zonedParts(Date.parse('2026-10-11T22:30:00Z')).date, '2026-10-12', 'late evening UTC is the next local day');
  assert.equal(zonedParts(Date.parse('2026-10-11T22:30:00Z')).weekday, 1);
});

test('relative times resolve to ISO-8601 UTC without milliseconds, other values are untouched; absolute times are rebased with their own offset text and duration', () => {
  const now = Date.UTC(2026, 9, 1, 12, 0, 0);
  assert.equal(resolveRelativeTime('@now+3d', now), '2026-10-04T12:00:00Z');
  assert.equal(resolveRelativeTime('@now+1d+2h', now), '2026-10-02T14:00:00Z');
  assert.equal(resolveRelativeTime('@now-90m', now), '2026-10-01T10:30:00Z');
  assert.equal(resolveRelativeTime('2026-12-01T10:00:00Z', now), '2026-12-01T10:00:00Z');
  assert.throws(() => resolveRelativeTime('@now+3x', now), /RELATIVE_TIME_INVALID/);
  assert.deepEqual(factsAtTime({'need.starts_at': '@now+1d', 'need.title': '@now+1d'}, now), {'need.starts_at': '2026-10-02T12:00:00Z', 'need.title': '@now+1d'});
  const rebase = computeRebase({ciNowMs: Date.parse('2026-10-01T12:00:00Z'), corpusNowUtc: '2026-10-05T08:00:00Z'});
  assert.equal(rebase.deltaMs, -(3 * 86400000 + 20 * 3600000));
  assert.equal(rebase.deltaHours, -92);
  assert.equal(rebaseIso('2026-10-10T09:00:00+02:00', rebase.deltaMs), '2026-10-06T13:00:00+02:00');
  assert.equal(rebaseIso('2026-10-31T10:00:00+01:00', rebase.deltaMs), '2026-10-27T14:00:00+01:00');
  const start = rebaseIso('2026-10-10T09:00:00+02:00', rebase.deltaMs), end = rebaseIso('2026-10-10T12:00:00+02:00', rebase.deltaMs);
  assert.equal(parseIso(end).ms - parseIso(start).ms, 3 * 3600000, 'durations are preserved');
  assert.throws(() => computeRebase({ciNowMs: 0, corpusNowUtc: 'soon'}), /CORPUS_CLOCK_INVALID/);
  assert.throws(() => parseIso('2026-10-10 09:00:00'), /TIMESTAMP_SHAPE_INVALID/);
});

test('materialiseTimes: both times or neither, ordered, in the future; the S02 window rebased; a window that has aged out is CASE_TIME_NOT_FUTURE', () => {
  const now = Date.parse('2026-10-01T12:00:00Z'), rebase = computeRebase({ciNowMs: now, corpusNowUtc: '2026-10-05T08:00:00Z'});
  const facts = {'need.schedule_kind': 'FIXED_WINDOW', 'need.starts_at': '2026-10-06T14:00:00+02:00', 'need.ends_at': '2026-10-06T16:00:00+02:00', 'need.title': 't'};
  const done = materialiseTimes(facts, {nowMs: now, rebase});
  assert.deepEqual(done.rebased, ['need.starts_at', 'need.ends_at']);
  assert.equal(done.facts['need.starts_at'], '2026-10-02T18:00:00+02:00', '2026-10-06T14:00+02:00 minus 3 days 20 hours');
  assert.equal(done.interval.endMs - done.interval.startMs, 2 * 3600000);
  assert.equal(done.facts['need.title'], 't');
  assert.throws(() => materialiseTimes(facts, {nowMs: Date.parse('2026-10-20T00:00:00Z'), rebase: null}), /CASE_TIME_NOT_FUTURE/);
  assert.throws(() => materialiseTimes({...facts, 'need.ends_at': undefined, 'need.starts_at': '2026-12-06T14:00:00+01:00'}, {nowMs: now}), /TIMESTAMP_SHAPE_INVALID|CASE_TIME_INCOMPLETE/);
  assert.throws(() => materialiseTimes({'need.starts_at': '2026-12-06T14:00:00+01:00'}, {nowMs: now}), /CASE_TIME_INCOMPLETE/);
  assert.throws(() => materialiseTimes({...facts, 'need.starts_at': '2026-10-06T16:00:00+02:00', 'need.ends_at': '2026-10-06T14:00:00+02:00'}, {nowMs: now}), /CASE_TIME_ORDER/);
  assert.equal(materialiseTimes({'need.schedule_kind': 'FLEXIBLE'}, {nowMs: now}).interval, null);
  const relative = materialiseTimes({'need.schedule_kind': 'FIXED_WINDOW', 'need.starts_at': '@now+2d', 'need.ends_at': '@now+2d+2h'}, {nowMs: now});
  assert.equal(relative.facts['need.starts_at'], '2026-10-03T12:00:00Z');
});

test('coverageFor: a weekly rule in the zone\'s own weekday and wall clock when the window sits in one local day, an AVAILABLE window across midnight or near a DST change', () => {
  let n = 0;
  const newId = () => 'id-' + (n += 1);
  const saturday = coverageFor(Date.parse('2026-10-10T07:00:00Z'), Date.parse('2026-10-10T10:00:00Z'), {newId});
  assert.equal(saturday.kind, 'RULE');
  assert.deepEqual([saturday.rule.weekdays, saturday.rule.startTime, saturday.rule.endTime, saturday.rule.startsOn, saturday.rule.endsOn, saturday.rule.active], [[6], '09:00:00', '12:00:00', '2026-10-10', null, true]);
  const midnight = coverageFor(Date.parse('2026-10-10T20:00:00Z'), Date.parse('2026-10-10T22:00:00Z'), {newId});
  assert.deepEqual([midnight.kind, midnight.rule.endTime], ['RULE', '24:00:00'], 'ending exactly at local midnight is an end time of 24:00');
  const overnight = coverageFor(Date.parse('2026-10-10T20:00:00Z'), Date.parse('2026-10-11T02:00:00Z'), {newId});
  assert.equal(overnight.kind, 'WINDOW');
  assert.equal(overnight.window.state, 'AVAILABLE');
  assert.equal(overnight.window.startsAt, '2026-10-10T20:00:00Z');
  const dst = coverageFor(Date.parse('2026-10-24T23:30:00Z'), Date.parse('2026-10-25T01:30:00Z'), {newId});
  assert.equal(dst.kind, 'WINDOW', 'a window around the 2026-10-25 DST change is not described by a wall-clock rule');
  assert.throws(() => coverageFor(5, 5), /COVERAGE_WINDOW_INVALID/);
});

test('availabilityFor: the four S02 shapes become the availability document the product writer accepts; shapes that need a window refuse a task without one', () => {
  let n = 0;
  const newId = () => 'id-' + (n += 1);
  const interval = {startMs: Date.parse('2026-10-10T07:00:00Z'), endMs: Date.parse('2026-10-10T10:00:00Z')};
  const both = availabilityFor('AVAILABLE_NOW_AND_SCHEDULED', interval, {newId});
  assert.deepEqual([both.availability.availableNow, both.availability.rules.length, both.availability.windows.length, both.coverage, both.availability.timezone], [true, 1, 0, 'RULE', 'Europe/Belgrade']);
  assert.deepEqual(Object.keys(both.availability).sort(), ['availableNow', 'rules', 'timezone', 'windows']);
  const scheduled = availabilityFor('SCHEDULED_ONLY', interval, {newId});
  assert.deepEqual([scheduled.availability.availableNow, scheduled.availability.rules.length], [false, 1]);
  assert.deepEqual(availabilityFor('AVAILABLE_NOW_ONLY', interval).availability, {timezone: 'Europe/Belgrade', availableNow: true, rules: [], windows: []});
  assert.deepEqual(availabilityFor('NONE_DECLARED', interval).availability, {timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: []});
  assert.deepEqual(availabilityFor('AVAILABLE_NOW_AND_SCHEDULED', null).availability, {timezone: 'Europe/Belgrade', availableNow: true, rules: [], windows: []}, 'a flexible task needs no covering rule');
  const fromFacts = availabilityFor('AVAILABLE_NOW_AND_SCHEDULED', {'need.starts_at': '2026-10-10T09:00:00+02:00', 'need.ends_at': '2026-10-10T12:00:00+02:00'}, {newId});
  assert.deepEqual([fromFacts.coverage, fromFacts.availability.rules[0].weekdays, fromFacts.availability.rules[0].startTime], ['RULE', [6], '09:00:00'], 'the task facts themselves are accepted');
  assert.deepEqual(availabilityFor('AVAILABLE_NOW_AND_SCHEDULED', {'need.title': 't'}).availability.rules, [], 'facts without a window need no covering rule');
  assert.throws(() => availabilityFor('SCHEDULED_ONLY', null), /AVAILABILITY_SHAPE_NEEDS_A_TASK_WINDOW/);
  assert.throws(() => availabilityFor('SOMETIMES', interval), /AVAILABILITY_SHAPE_UNKNOWN/);
});

// ------------------------------------------------------------------ corpus
test('the SMOKE and CANARY corpora normalise against a registry: explicit and derived workers, every case with a positive and a named negative', () => {
  const corpus = normaliseCorpus(SMOKE_CORPUS, {registry: REGISTRY, label: 'SMOKE'});
  assert.equal(corpus.cases.length, 3);
  assert.equal(corpus.totalCases, 3);
  const plans = corpus.cases.map(item => referenceWorkerPlan(item).map(worker => worker.label));
  assert.deepEqual(plans[0], ['fit', 'unfit', 'unknown', CONTROL_RESTRICTED.label]);
  assert.deepEqual(plans[2], ['fit', 'unfit', 'unknown', 'paused', 'draft', CONTROL_RESTRICTED.label]);
  assert.deepEqual(referenceWorkerPlan(corpus.cases[0], {controls: false}).map(worker => worker.label), ['fit', 'unfit', 'unknown']);
  const third = referenceWorkerPlan(corpus.cases[2]);
  assert.equal(third.find(worker => worker.label === 'draft').profile.status, 'DRAFT');
  assert.equal(third.find(worker => worker.label === 'paused').profile.availability.availableNow, false);
  assert.deepEqual(third.find(worker => worker.label === 'paused').profile.licenses, ['kategorija b']);
  const control = third.find(worker => worker.control);
  assert.equal(control.profile.status, 'DRAFT');
  assert.deepEqual(control.profile.skills, third.find(worker => worker.label === 'fit').profile.skills);
  assert.ok(control.expect.hardBlockersInclude.includes('ACCOUNT_OR_PROFILE_RESTRICTED'));
  const all = corpus.cases.flatMap(item => referenceWorkerPlan(item).map(worker => worker.expect));
  assert.ok(all.some(expect => expect.hardBlockers?.length > 0) && all.some(expect => expect.dispatchBlockersInclude?.length > 0) && all.some(expect => expect.delivery === true));
  const canary = normaliseCorpus(CANARY_CORPUS, {registry: REGISTRY, label: 'CANARY'});
  assert.deepEqual(canary.cases.map(item => item.id), ['canary-fit-unfit', 'canary-scheduled', 'canary-radius']);
  assert.equal(canary.cases[1].expectedFacts['need.schedule_kind'], 'FIXED_WINDOW');
  assert.equal(referenceWorkerPlan(canary.cases[2]).find(worker => worker.label === 'far').profile.location.city, 'Niš');
});

test('deriveReferenceWorkers: fit declares all and is available for the task window; unfit declares a non-matching set; unknown declares nothing; a minimum experience is given to all by a labelled bypass', () => {
  const van = deriveReferenceWorkers({'need.required_skills': ['selidba'], 'need.required_vehicles': ['kombi'], 'need.required_tools': ['kolica']});
  assert.deepEqual(van.fit.profile, {availability: {shape: 'AVAILABLE_NOW_AND_SCHEDULED'}, skills: ['selidba'], tools: ['kolica'], vehicles: ['kombi'], licenses: []});
  assert.deepEqual(van.unfit.profile.vehicles, ['nepovezano vozilo']);
  assert.deepEqual(van.unfit.profile.tools, ['kolica']);
  assert.deepEqual([van.unknown.profile.skills, van.unknown.profile.tools, van.unknown.profile.vehicles], [['selidba'], [], []]);
  const skillOnly = deriveReferenceWorkers({'need.required_skills': ['x']});
  assert.deepEqual(skillOnly.unfit.profile.skills, ['nepovezano zanimanje']);
  assert.equal(skillOnly.unknown, undefined);
  assert.deepEqual(Object.keys(deriveReferenceWorkers({})), ['fit']);
  assert.deepEqual(deriveReferenceWorkers({}).fit.profile.skills, ['pomocni poslovi']);
  const experienced = deriveReferenceWorkers({'need.required_skills': ['x'], 'need.minimum_experience_years': 5});
  assert.deepEqual([experienced.fit.profile.bypass, experienced.unfit.profile.bypass], [{yearsExperience: 5}, {yearsExperience: 5}]);
});

const caseOf = (patch = {}) => ({id: 'c1', expectedFacts: {'need.title': 't', 'need.description': 'd', 'need.category': 'c', 'need.price_mode': 'OFFERS', 'need.schedule_kind': 'FLEXIBLE', 'need.people_needed': 1,
  'need.required_skills': ['a'], 'need.task_country_code': 'RS', 'need.task_geography': {mode: 'STATIONARY', start: {city: 'Novi Sad'}}}, expectedEligibility: {fit: {delivery: true}}, ...patch});

test('normaliseCorpus refuses what would make a proof wrong or unsafe, and a corpus whose cases are all skipped', () => {
  const run = patch => normaliseCorpus({synthetic: true, cases: [caseOf(patch)]}, {registry: REGISTRY});
  assert.equal(run({}).cases.length, 1);
  assert.throws(() => normaliseCorpus({cases: []}, {registry: REGISTRY}), /CORPUS_EMPTY/);
  assert.throws(() => normaliseCorpus({synthetic: false, cases: [caseOf()]}, {registry: REGISTRY}), /CORPUS_NOT_SYNTHETIC/);
  assert.throws(() => normaliseCorpus({nothing: true}, {registry: REGISTRY}), /CORPUS_SHAPE_UNRECOGNISED/);
  assert.throws(() => normaliseCorpus({cases: [caseOf(), caseOf()]}, {registry: REGISTRY}), /CASE_ID_DUPLICATE/);
  assert.throws(() => run({id: 'has space'}), /CASE_ID_INVALID/);
  assert.throws(() => run({expectedFacts: {'need.nonsense': 'x'}}), /CASE_FACT_KEY_UNKNOWN/);
  assert.throws(() => run({expectedFacts: {...caseOf().expectedFacts, 'need.people_needed': '1'}}), /CASE_FACT_VALUE_TYPE/);
  assert.throws(() => run({expectedFacts: {...caseOf().expectedFacts, 'need.description': 'pisi na pera@primer.rs'}}), /CASE_PERSONAL_DATA_PATTERN/);
  assert.throws(() => run({expectedFacts: {'need.title': 't'}}), /CASE_REQUIRED_FACTS_MISSING/);
  assert.throws(() => run({expectedFacts: {...caseOf().expectedFacts, 'need.task_geography': {mode: 'STATIONARY', start: {city: 'Kragujevac'}}}}), /EX06_CITY_UNKNOWN/);
  assert.throws(() => run({expectedEligibility: {fit: {}}}), /EXPECTATION_EMPTY/);
  assert.throws(() => run({expectedEligibility: {fit: {delivery: true}, extra: {delivery: false}}}), /REFERENCE_WORKER_WITHOUT_PROFILE/);
  assert.throws(() => run({expectedEligibility: {fit: {delivery: false}}}), /NEGATIVE_EXPECTATION_WITHOUT_CAUSE/);
  assert.throws(() => run({referenceWorkers: {fit: {profile: {skils: ['x']}}}}), /WORKER_PROFILE_UNKNOWN_KEY/);
  const skipped = normaliseCorpus({cases: [caseOf({outcomeClass: 'ASK'}), caseOf({id: 'c2'})]}, {registry: REGISTRY});
  assert.equal(skipped.cases.length, 1);
  assert.deepEqual(skipped.skipped.map(item => item.id), ['c1']);
  assert.equal(skipped.totalCases, 2);
  assert.throws(() => normaliseCorpus({cases: [caseOf({outcomeClass: 'ASK'})]}, {registry: REGISTRY}), /CORPUS_NOTHING_TO_RUN/);
  const withoutFacts = normaliseCorpus({cases: [{id: 'ask-1', outcomeClass: 'WITHHOLD'}, caseOf()]}, {registry: REGISTRY});
  assert.deepEqual(withoutFacts.skipped.map(item => item.id), ['ask-1']);
  assert.ok(containsPersonalDataPattern('064 123 4567') && containsPersonalDataPattern('a@b.rs') && !containsPersonalDataPattern('Ulica bez broja'));
});

test('nested worker-profile keys and types are validated exactly: a typo anywhere is a HarnessInputError, not a worker built from defaults', () => {
  const good = {skills: ['a'], radiusKm: 25, teamCapacity: 2, availability: {shape: 'NONE_DECLARED'}, location: {city: 'Niš'}, status: 'ACTIVE', world: 'TEST', bypass: {yearsExperience: 3, exclusions: ['x']}, skillsAfterActivation: []};
  assert.equal(checkWorkerProfile(good, 'w'), good);
  assert.ok(checkWorkerProfile({availability: {timezone: 'Europe/Belgrade', availableNow: false, rules: [], windows: []}, location: {countryCode: 'RS', city: 'Novi Sad', position: {latitude: 45.27, longitude: 19.83}}}, 'w'));
  assert.ok(checkWorkerProfile({availability: null, location: null}, 'w'));
  for (const [profile, pattern] of [
    [{skils: []}, /WORKER_PROFILE_UNKNOWN_KEY/], [{availability: 'NONE_DECLARED'}, /availability must be an object/], [{availability: {shape: 'SOMETIMES'}}, /availability.shape/],
    [{availability: {availableNow: false, available_now: false}}, /WORKER_PROFILE_UNKNOWN_KEY.*available_now/], [{availability: {availableNow: 'no'}}, /availability.availableNow/], [{availability: {rules: {}}}, /availability.rules/],
    [{location: 'Niš'}, /location must be an object/], [{location: {city: 'Kragujevac'}}, /EX06_CITY_UNKNOWN/], [{location: {cty: 'Niš'}}, /WORKER_PROFILE_UNKNOWN_KEY.*cty/],
    [{location: {position: {latitude: 45.271, longitude: 19.83}}}, /at most two decimals/], [{location: {position: {lat: 45.27, lng: 19.83}}}, /WORKER_PROFILE_UNKNOWN_KEY/], [{location: {countryCode: 'rs'}}, /countryCode/],
    [{bypass: {minimumFee: 5000}}, /WORKER_PROFILE_UNKNOWN_KEY.*minimumFee/], [{bypass: {yearsExperience: -1}}, /bypass.yearsExperience/], [{bypass: {exclusions: 'x'}}, /bypass.exclusions/],
    [{bypass: {proactiveNotifications: 'yes'}}, /bypass.proactiveNotifications/], [{bypass: []}, /bypass must be an object/],
    [{radiusKm: '25'}, /radiusKm/], [{radiusKm: 0}, /radiusKm/], [{teamCapacity: 1.5}, /teamCapacity/], [{status: 'SUSPENDED'}, /status/], [{world: 'PROD'}, /world/], [{busy: 'SOMETIMES'}, /busy/],
    [{skills: 'a'}, /skills/], [{skillsAfterActivation: 'a'}, /skillsAfterActivation/], [{displayName: 'x'}, /displayName/]]) {
    assert.throws(() => checkWorkerProfile(profile, 'w'), pattern, JSON.stringify(profile));
  }
});

test('chooseCorpusPath: EX06_CORPUS first and refused when missing, the two default locations, else null (SMOKE); EX06_REQUIRE_CORPUS=1 refuses the fall back to SMOKE', () => {
  const none = () => false;
  assert.equal(chooseCorpusPath({}, none), null);
  assert.equal(chooseCorpusPath({}, path => path === 'supabase/proofs/ex06/corpus/ex06_contract_corpus_v1.json'), 'supabase/proofs/ex06/corpus/ex06_contract_corpus_v1.json');
  assert.equal(chooseCorpusPath({}, () => true), 'supabase/proofs/ai/corpus/ex06_contract_corpus_v1.json');
  assert.equal(chooseCorpusPath({EX06_CORPUS: 'x.json'}, path => path === 'x.json'), 'x.json');
  assert.throws(() => chooseCorpusPath({EX06_CORPUS: 'x.json'}, none), /CORPUS_FILE_MISSING/);
  assert.throws(() => chooseCorpusPath({EX06_REQUIRE_CORPUS: '1'}, none), /CORPUS_REQUIRED_BUT_MISSING/);
  assert.equal(chooseCorpusPath({EX06_REQUIRE_CORPUS: '1'}, () => true), 'supabase/proofs/ai/corpus/ex06_contract_corpus_v1.json');
  assert.equal(chooseCorpusPath({EX06_REQUIRE_CORPUS: '0'}, none), null);
});

test('capFromEnv: unset is no cap, a positive integer is a cap, NaN, 0, a negative number or text is refused (never "run nothing")', () => {
  assert.equal(capFromEnv(undefined), null);
  assert.equal(capFromEnv(''), null);
  assert.equal(capFromEnv('5'), 5);
  for (const bad of ['0', '-1', 'abc', '1.5', 'NaN', '007x']) assert.throws(() => capFromEnv(bad), /CASE_CAP_INVALID/, bad);
});

test('facts the product cannot carry are recognised: bypass keys, and the states the product cannot reach (identity required, photos) with their reasons', () => {
  assert.equal(hasBypassFacts({'need.verified_identity_required': false}), true);
  assert.equal(hasBypassFacts({'need.title': 't'}), false);
  assert.match(unreachableReason({'need.verified_identity_required': true}), /verified identity/);
  assert.equal(unreachableReason({'need.verified_identity_required': false}), null);
  assert.match(unreachableReason({'need.public_photo_paths': ['x']}), /photo/);
  assert.equal(unreachableReason({'need.public_photo_paths': []}), null);
});

// ------------------------------------------------------------------ the read-back comparisons (pure)
const intentOf = patch => ({facts: {'need.category': 'Fizicki poslovi', 'need.required_skills': ['A '], 'need.required_tools': [], 'need.required_vehicles': ['Kombi'], 'need.required_licenses': [],
  'need.people_needed': 2, 'need.schedule_kind': 'FIXED_WINDOW', 'need.task_geography': {mode: 'STATIONARY', start: {city: 'Novi Sad'}}, 'need.price_mode': 'MY_PRICE', 'need.price_rsd': 4000, ...patch},
  interval: {startMs: Date.parse('2026-10-10T07:00:00Z'), endMs: Date.parse('2026-10-10T10:00:00Z')}});
const needRow = patch => ({status: 'PUBLISHED', category: 'fizicki poslovi', required_skills: ['a'], required_tools: [], required_vehicles: ['kombi'], required_licenses: [], minimum_experience_years: 0,
  verified_identity_required: false, required_slots: 2, schedule_kind: 'FIXED_WINDOW', starts_at: '2026-10-10T07:00:00+00:00', ends_at: '2026-10-10T10:00:00+00:00', execution_location_mode: 'STATIONARY',
  approximate_city: 'Novi Sad', approximate_lat: 45.27, approximate_lng: 19.83, mode: 'MY_PRICE', requester_price_rsd: 4000, ...patch});

test('diffNeedReadBack: an applied task has no mismatch (order and case of the lists are the only normalisation); every dropped or changed field is named', () => {
  assert.deepEqual(diffNeedReadBack(intentOf({}), needRow({})), []);
  for (const [patch, field] of [[{required_vehicles: []}, 'required_vehicles'], [{required_slots: 1}, 'required_slots'], [{schedule_kind: 'FLEXIBLE'}, 'schedule_kind'], [{approximate_lat: null}, 'approximate_lat'],
    [{approximate_lng: 21.9}, 'approximate_lng'], [{execution_location_mode: 'REMOTE'}, 'execution_location_mode'], [{requester_price_rsd: 100}, 'requester_price_rsd'], [{status: 'DRAFT'}, 'status'],
    [{starts_at: '2026-10-10T08:00:00+00:00'}, 'starts_at'], [{mode: 'OFFERS'}, 'mode'], [{approximate_city: 'Niš'}, 'approximate_city'], [{minimum_experience_years: 2}, 'minimum_experience_years'],
    [{verified_identity_required: true}, 'verified_identity_required'], [{category: 'drugo'}, 'category']]) {
    assert.deepEqual(diffNeedReadBack(intentOf({}), needRow(patch)).map(item => item.field), [field], field);
  }
  assert.deepEqual(diffNeedReadBack(intentOf({'need.task_geography': {mode: 'REMOTE'}}), needRow({execution_location_mode: 'REMOTE', approximate_lat: null, approximate_lng: null, approximate_city: ''})), []);
  assert.deepEqual(diffNeedReadBack(intentOf({}), needRow({approximate_city: ''})), [], 'a city the product does not store is not compared when the coordinates are there');
});

const workerSpec = patch => ({status: 'ACTIVE', radiusKm: 25, teamCapacity: 2, location: {countryCode: 'RS', city: 'Niš', position: {latitude: 43.32, longitude: 21.9}},
  availability: {timezone: 'Europe/Belgrade', availableNow: true, rules: [{id: 'r', active: true}], windows: []}, bypass: {yearsExperience: 6, exclusions: ['x']}, world: 'REAL',
  final: {skills: ['A'], tools: [], vehicles: ['kombi'], licenses: []}, ...patch});
const workerRow = patch => ({profile_status: 'ACTIVE', available_now: true, skills: ['a'], tools: [], vehicles: ['Kombi'], licenses: [], exclusions: ['x'], radius_km: 25, city: 'Niš', team_capacity: 2,
  years_experience: 6, lat: 43.32, lng: 21.9, rules: 1, windows: 0, lineage: 'UNCLASSIFIED', ...patch});

test('diffWorkerReadBack: an applied worker has no mismatch; a status, list, position, availability count, bypass or world the product did not apply is named', () => {
  assert.deepEqual(diffWorkerReadBack(workerSpec(), workerRow()), []);
  for (const [patch, field] of [[{profile_status: 'DRAFT'}, 'profile_status'], [{skills: []}, 'skills'], [{vehicles: []}, 'vehicles'], [{radius_km: 15}, 'radius_km'], [{city: 'Novi Sad'}, 'city'], [{lat: 45.27}, 'approximate_lat'],
    [{lng: null}, 'approximate_lng'], [{team_capacity: 1}, 'team_capacity'], [{available_now: false}, 'available_now'], [{rules: 0}, 'availability_rules'], [{windows: 1}, 'availability_windows'],
    [{years_experience: 0}, 'years_experience'], [{exclusions: []}, 'exclusions'], [{lineage: 'DEV_ACCEPTANCE_QA'}, 'world']]) {
    assert.deepEqual(diffWorkerReadBack(workerSpec(), workerRow(patch)).map(item => item.field), [field], field);
  }
  assert.deepEqual(diffWorkerReadBack(workerSpec({world: 'TEST'}), workerRow({lineage: 'SYNTHETIC_ACCEPTANCE_FIXTURE'})), []);
  assert.deepEqual(diffWorkerReadBack(workerSpec({final: {skills: [], tools: [], vehicles: ['kombi'], licenses: []}}), workerRow({skills: []})), [], 'activate-then-clear: the stored list is the cleared one');
  assert.deepEqual(diffWorkerReadBack(workerSpec({location: null, availability: null, teamCapacity: undefined, bypass: {}}), workerRow({exclusions: [], city: 'x', lat: null, lng: null})), []);
});

// ------------------------------------------------------------------ fixtures against a recording fake of the proof adapter
test('createWorker uses the product writers in order and every call carries an abort signal: update, location, capacity, availability, complete; the position is the city table\'s', async () => {
  const {rt, flow, log} = fakeRuntime();
  const fx = createFixtures(rt, {flow, needPath: 'product'});
  const worker = await fx.createWorker({label: 'w', skills: ['selidba'], vehicles: ['kombi'], teamCapacity: 2, bypass: {exclusions: ['x'], proactiveNotifications: false}});
  const mine = log.filter(item => item.who === 'actor:ex06-w');
  assert.deepEqual(mine.map(item => item.kind === 'update' ? 'update:' + item.table : item.name), ['update:app_profiles', 'rpc_get_worker_location', 'rpc_save_worker_location', 'rpc_get_worker_capacity', 'rpc_save_worker_capacity',
    'rpc_get_worker_availability', 'rpc_save_worker_availability', 'rpc_complete_worker_profile']);
  assert.ok(mine.every(item => item.signal instanceof AbortSignal), 'every fixture call carries an abort signal');
  assert.deepEqual(log.find(item => item.kind === 'update').patch.skills, ['selidba']);
  assert.deepEqual(log.find(item => item.name === 'rpc_save_worker_location').args.p_value, {operatingCountryCode: 'RS', city: 'Novi Sad', radiusKm: 15, approximatePosition: {latitude: 45.27, longitude: 19.83}});
  assert.equal(log.find(item => item.name === 'rpc_save_worker_availability').args.p_value.availableNow, true);
  assert.deepEqual(worker.bypassed, ['app_profiles:exclusions', 'worker_match_preferences:proactive_notifications']);
  assert.deepEqual(worker.spec.final.skills, ['selidba']);
  assert.deepEqual(fx.created.workers.map(item => item.label), ['w']);
});

test('createWorker: a worker in Niš gets Niš\'s coordinates (city text and position agree); an unknown city and an unknown profile key are refused before any write', async () => {
  const {rt, flow, log} = fakeRuntime();
  const fx = createFixtures(rt, {flow});
  await fx.createWorker({label: 'nis', skills: ['a'], location: {city: 'Niš'}, radiusKm: 25});
  assert.deepEqual(log.find(item => item.name === 'rpc_save_worker_location').args.p_value, {operatingCountryCode: 'RS', city: 'Niš', radiusKm: 25, approximatePosition: {latitude: 43.32, longitude: 21.9}});
  const before = log.length;
  await assert.rejects(() => fx.createWorker({label: 'x', skills: ['a'], location: {city: 'Kragujevac'}}), /EX06_CITY_UNKNOWN/);
  await assert.rejects(() => fx.createWorker({label: 'y', skills: ['a'], bypass: {minimumFee: 1}}), /WORKER_PROFILE_UNKNOWN_KEY/);
  await assert.rejects(() => fx.createWorker({label: 'z', skills: []}), /EX06_ACTIVE_WORKER_NEEDS_A_SKILL/);
  assert.equal(log.length, before, 'nothing was written');
});

test('createWorker: status DRAFT is never completed; availability null and location null are never written; SUSPENDED is not a status the product lets a profile choose', async () => {
  const {rt, flow, log} = fakeRuntime();
  const fx = createFixtures(rt, {flow, needPath: 'product'});
  await fx.createWorker({label: 'd', skills: ['a'], status: 'DRAFT', availability: null, location: null});
  assert.deepEqual(log.filter(item => item.kind === 'rpc').map(item => item.name), []);
  await assert.rejects(() => fx.createWorker({label: 'x', status: 'SUSPENDED'}), /WORKER_PROFILE_WRONG_TYPE/);
});

test('createWorker: a scheduled task gives the fit worker a covering weekly rule (resolved from the S02 shape and the rebased window); a flexible task none', async () => {
  const interval = {startMs: Date.parse('2026-10-10T07:00:00Z'), endMs: Date.parse('2026-10-10T10:00:00Z')};
  const {rt, flow, log} = fakeRuntime();
  const fx = createFixtures(rt, {flow});
  await fx.createWorker({label: 'sched', skills: ['a'], availability: {shape: 'AVAILABLE_NOW_AND_SCHEDULED'}, interval});
  const saved = log.find(item => item.name === 'rpc_save_worker_availability').args.p_value;
  assert.equal(saved.availableNow, true);
  assert.equal(saved.rules.length, 1);
  assert.deepEqual([saved.rules[0].weekdays, saved.rules[0].startTime, saved.rules[0].endTime, saved.rules[0].startsOn, saved.rules[0].endsOn], [[6], '09:00:00', '12:00:00', '2026-10-10', null]);
  await fx.createWorker({label: 'flex', skills: ['a'], availability: {shape: 'AVAILABLE_NOW_AND_SCHEDULED'}, interval: null});
  const flexible = log.filter(item => item.name === 'rpc_save_worker_availability').at(-1).args.p_value;
  assert.deepEqual([flexible.availableNow, flexible.rules, flexible.windows], [true, [], []]);
  await fx.createWorker({label: 'none', skills: ['a'], availability: {shape: 'NONE_DECLARED'}, interval});
  assert.deepEqual(log.filter(item => item.name === 'rpc_save_worker_availability').at(-1).args.p_value.availableNow, false);
});

test('createWorker: activate-then-clear writes the owner UPDATE of the lists again after rpc_complete_worker_profile; world TEST admits the account to the TEST lineage first', async () => {
  const {rt, flow, log} = fakeRuntime();
  const fx = createFixtures(rt, {flow});
  const worker = await fx.createWorker({label: 'clear', skills: ['ex06 aktivacija'], skillsAfterActivation: [], world: 'TEST'});
  const names = log.filter(item => item.who === 'actor:ex06-clear' || item.name === 'rpc_admit_account_lineage_service').map(item => item.kind === 'update' ? 'update:' + JSON.stringify(item.patch.skills) : item.name);
  assert.deepEqual(names, ['rpc_admit_account_lineage_service', 'update:["ex06 aktivacija"]', 'rpc_get_worker_location', 'rpc_save_worker_location', 'rpc_get_worker_availability', 'rpc_save_worker_availability',
    'rpc_complete_worker_profile', 'update:[]']);
  const admit = log.find(item => item.name === 'rpc_admit_account_lineage_service');
  assert.deepEqual([admit.args.p_lineage, admit.args.p_expected_revision, admit.args.p_source_ref], ['SYNTHETIC_ACCEPTANCE_FIXTURE', 0, 'EX06_FIXTURE']);
  assert.ok(admit.signal instanceof AbortSignal);
  assert.ok(worker.notes.some(note => note.startsWith('ACTIVATE_THEN_CLEAR')));
  assert.deepEqual(worker.spec.final.skills, []);
  const requester = await fx.createRequester({label: 'tester', world: 'TEST'});
  assert.equal(requester.world, 'TEST');
  assert.equal(log.filter(item => item.name === 'rpc_admit_account_lineage_service').length, 2);
});

test('createWorker: an existing account (a person with both roles) is reused; a worker is registered before its first write so a half-built one is retired', async () => {
  const {rt, flow} = fakeRuntime();
  const fx = createFixtures(rt, {flow});
  const account = {id: 'acct-both', client: (await rt.actor('both')).client};
  const worker = await fx.createWorker({label: 'both', account, skills: ['a']});
  assert.equal(worker.id, 'acct-both');
  const failing = {...rt, actor: async () => { throw new Error('AUTH_DOWN'); }};
  const fx2 = createFixtures(failing, {flow});
  await assert.rejects(() => fx2.createWorker({label: 'x', skills: ['a']}), /AUTH_DOWN/);
  const broken = createFixtures({...rt, rows: text => (/app_profiles where account_id/.test(text) ? [{id: 'p'}] : []), service: {rpc: () => { throw new Error('SERVICE_DOWN'); }}}, {flow});
  const mark = broken.mark();
  await assert.rejects(() => broken.createWorker({label: 'half', skills: ['a'], world: 'TEST'}), /SERVICE_DOWN/);
  assert.deepEqual(broken.created.workers.map(item => item.label), ['half'], 'registered before the failing write');
  broken.retireSince(mark);
});

test('createNeedFromFacts (product): 15 proposals take two turns, location facts are never proposals, the review gets the city table\'s pins, the evaluation is the product\'s and carries abort signals', async () => {
  const {rt, flow, log} = fakeRuntime();
  const fx = createFixtures(rt, {flow, needPath: 'product'});
  const requester = await fx.createRequester();
  const facts = {'need.title': 't', 'need.description': 'd', 'need.category': 'c', 'need.price_mode': 'OFFERS', 'need.schedule_kind': 'FLEXIBLE', 'need.people_needed': 1,
    'need.required_skills': ['a'], 'need.required_tools': ['b'], 'need.required_vehicles': ['c'], 'need.required_licenses': ['d'], 'need.minimum_experience_years': 0,
    'need.critical_conditions': ['e'], 'need.price_rsd': 100, 'need.price_basis': 'TOTAL', 'need.task_country_code': 'RS', 'need.exact_address': 'x', 'need.access_notes': 'y',
    'need.task_geography': {mode: 'POINT_TO_POINT', start: {city: 'Novi Sad'}, end: {city: 'Niš'}}};
  assert.equal(proposalsFor(facts).length, 14);
  const need = await fx.createNeedFromFacts(requester, facts);
  assert.equal(need.materialisation, 'PRODUCT_PATH');
  assert.deepEqual(need.droppedFacts, []);
  assert.equal(log.filter(item => item.name === 'rpc_ai_claim_need_turn_v2_service').length, 2);
  const complete = log.filter(item => item.name === 'rpc_ai_complete_need_turn_v2_service');
  assert.deepEqual(complete.map(item => item.args.p_proposals.length), [12, 2]);
  assert.ok(complete.flatMap(item => item.args.p_proposals).every(item => !['need.task_geography', 'need.task_country_code', 'need.exact_address', 'need.access_notes'].includes(item.key)));
  const review = log.find(item => item.kind === 'flow.review').location;
  assert.deepEqual(review.resolvedLocation.points, [pinFor('start', 'Novi Sad'), pinFor('end', 'Niš')]);
  assert.equal(review.exactAddress, 'x');
  assert.ok(need.synthetic.includes('EVALUATOR_DECISION_SYNTHETIC_ALLOW'));
  for (const name of ['rpc_ai_open_need_conversation_v2', 'rpc_ai_claim_need_turn_v2_service', 'rpc_ai_complete_need_turn_v2_service', 'rpc_get_need_publication_context', 'rpc_claim_ai_task_review_evaluation_service',
    'rpc_complete_ai_task_review_evaluation_service']) {
    assert.ok(log.filter(item => item.name === name).every(item => item.signal instanceof AbortSignal) && log.some(item => item.name === name), name + ' carries an abort signal');
  }
  assert.deepEqual(need.intent.facts['need.price_basis'], 'TOTAL');
  assert.ok(fx.created.needs.includes('need-1'));
});

test('createNeedFromFacts: the product path never falls back (the error names its step); auto falls back to the labelled direct insert and says so; a fact the product cannot carry is never dropped silently', async () => {
  const {rt, flow, sqlLog} = fakeRuntime({flowFails: true});
  const facts = {'need.title': 't', 'need.description': 'd', 'need.category': 'c', 'need.price_mode': 'OFFERS', 'need.schedule_kind': 'FLEXIBLE', 'need.people_needed': 2, 'need.price_basis': 'TOTAL',
    'need.required_vehicles': ['kombi'], 'need.task_geography': {mode: 'STATIONARY', start: {city: 'Niš'}}};
  const fxProduct = createFixtures(rt, {flow, needPath: 'product'});
  const requester = await fxProduct.createRequester();
  await assert.rejects(() => fxProduct.createNeedFromFacts(requester, facts), error => error.ex06Step === 'evaluate' && /POLICY_NOT_READY/.test(error.message));
  assert.ok(!sqlLog.some(text => text.includes('insert into public.needs')), 'a refused product path writes no direct row');
  const fx = createFixtures(rt, {flow, needPath: 'auto'});
  const need = await fx.createNeedFromFacts(requester, facts);
  assert.equal(need.materialisation, 'DIRECT_INSERT_PUBLISHED');
  assert.equal(need.productPathFailure.step, 'evaluate');
  assert.match(need.productPathFailure.message, /POLICY_NOT_READY/);
  assert.deepEqual(need.droppedFacts, ['need.price_basis']);
  const insert = sqlLog.find(text => text.includes('insert into public.needs'));
  assert.ok(insert.includes("set_config('uskoci.need_lifecycle', 'PUBLISH', true)") && insert.includes("array['kombi']::text[]") && insert.includes("'STATIONARY'"));
  assert.ok(insert.includes('43.32') && insert.includes('21.9'), 'the direct insert writes the city\'s coordinates so the radius branch is the one the product feeds');
  const identity = {...facts, 'need.verified_identity_required': true};
  await assert.rejects(() => createFixtures(rt, {flow, needPath: 'product'}).createNeedFromFacts(requester, identity), /EX06_FACT_NOT_CARRIABLE_BY_THE_PRODUCT_AI_PATH/);
  const bypassed = await fx.createNeedFromFacts(requester, identity);
  assert.match(bypassed.reason, /FACT_NOT_CARRIABLE_BY_THE_PRODUCT_AI_PATH:need\.verified_identity_required/);
  assert.equal(bypassed.productPathFailure, undefined);
  assert.throws(() => createFixtures(rt, {needPath: 'sideways'}), /EX06_NEED_PATH_INVALID/);
  const remote = await fx.createNeedFromFacts(requester, {...facts, 'need.task_geography': {mode: 'REMOTE'}});
  assert.match(sqlLog.filter(text => text.includes('insert into public.needs')).at(-1), /'', '', null,\s+null, 'OFFERS'/, 'a remote task has no coordinates');
  assert.equal(remote.needRevision, 1);
});

test('readers wrap the product functions by name: match_detail (not the interval variant), the interval variant apart, rounds, the full schedule row, expiry; retire suspends workers and drops schedule rows; nothing writes the certificate', async () => {
  const {rt, flow, sqlLog} = fakeRuntime();
  const fx = createFixtures(rt, {flow, needPath: 'direct'});
  fx.readMatch('n', 'p');
  fx.readMatchForInterval('n', 'p', {startsAt: '2026-10-10T07:00:00Z', endsAt: '2026-10-10T10:00:00Z'});
  fx.runWave('n');
  fx.runTick('2026-10-01T12:00:00Z', 10);
  fx.runExpiry('2026-10-01T12:00:00Z');
  fx.readDeliveries('n');
  fx.readRounds('n');
  fx.readSchedule('n');
  fx.readEvents('acct', {entityId: 'n'});
  fx.kindsOfStoredNeed('n');
  fx.retireFixtures({workers: [{profileId: 'p'}], needs: [{needId: 'n'}]});
  const text = sqlLog.join('\n');
  for (const part of ["select private.match_detail('n'::uuid, 'p'::uuid)", 'private.match_detail_for_calendar_interval(', 'private.dispatch_next_wave(', 'private.dispatch_tick(10,', 'private.expire_lifecycle(',
    'from public.opportunity_deliveries', 'from public.dispatch_rounds', 'locked_until, attempts, last_status, last_reason', "e.event_type = 'OPPORTUNITY_AVAILABLE'", "profile_status = 'SUSPENDED'",
    'delete from private.dispatch_schedule', 'array_prepend(n.category, n.required_skills)', 'private.work_kinds_v5(n.required_skills)']) assert.ok(text.includes(part), part);
  assert.ok(!/closure_source_v5\s+set|update private\.closure|alter function/i.test(text));
  assert.deepEqual(slotsForGeography({mode: 'MULTI_STOP', waypoints: [{}, {}]}), ['start', 'waypoints/0', 'waypoints/1', 'end']);
  assert.equal(locationValueFor({'need.task_geography': {mode: 'REMOTE'}}).resolvedLocation, null);
  assert.equal(locationValueFor({}).geography.mode, 'STATIONARY');
  assert.deepEqual(locationValueFor({}).resolvedLocation.points, [pinFor('start', 'Novi Sad')]);
  assert.equal(slotCity({mode: 'MULTI_STOP', start: {city: 'Niš'}, waypoints: [{label: 'x'}, {city: 'Beograd'}]}, 'waypoints/0'), 'Niš');
  assert.equal(slotCity({mode: 'MULTI_STOP', start: {city: 'Niš'}, waypoints: [{label: 'x'}, {city: 'Beograd'}]}, 'waypoints/1'), 'Beograd');
  assert.throws(() => slotCity({mode: 'STATIONARY', start: {label: 'x'}}, 'start'), /EX06_CITY_UNKNOWN/);
});

test('the certificate state reads the erasure source and the binding as well; the schedulers are paused; foreign workers are parked and restored; the isolation is by marks', async () => {
  const state = {cron: 't', jobs: [{jobid: 1, jobname: 'uskoci_marketplace_tick', active: true}], foreign: [{id: 'f1', profile_status: 'ACTIVE', available_now: true}]};
  const {rt, flow, sqlLog} = fakeRuntime({
    sqlAnswers: [[/to_regclass\('cron\.job'\)/, state.cron], [/select count\(\*\) from public\.app_profiles/, '2']],
    rows: [[/from cron\.job/, () => state.jobs.map(job => ({...job, active: sqlLogHas('alter_job') ? false : job.active}))], [/from public\.app_profiles where kind = 'WORKER' and profile_status = 'ACTIVE'/, state.foreign],
      [/closure_source_digest_v5/, [{live: 'a', certified: 'a', erasure: 'a', binding: 'a', ready: true}]]]});
  const sqlLogHas = needle => sqlLog.some(text => text.includes(needle));
  const fx = createFixtures(rt, {flow});
  assert.deepEqual(fx.closureState(), {live: 'a', certified: 'a', erasure: 'a', binding: 'a', ready: true});
  const closure = sqlLog.find(text => text.includes('closure_source_digest_v5'));
  for (const part of ['closure_erasure_source_v5', "closure_erasure_binding_v5() ->> 'sourceSha256'", 'retention_ai_source_ready']) assert.ok(closure.includes(part), part);
  const paused = fx.pauseSchedulers();
  assert.equal(paused.available, true);
  assert.deepEqual(paused.jobs, [{jobname: 'uskoci_marketplace_tick', activeBefore: true, activeAfter: false}]);
  assert.ok(sqlLog.some(text => text.includes('cron.alter_job') && text.includes("like 'uskoci%'")));
  const parked = fx.parkForeign({schedule: true});
  assert.equal(parked.parkedWorkers, 1);
  assert.deepEqual(parked.restore, state.foreign);
  assert.ok(sqlLog.some(text => text.includes("set profile_status = 'SUSPENDED'") && text.includes("'f1'::uuid")));
  assert.ok(sqlLog.some(text => text.includes('delete from private.dispatch_schedule')));
  assert.equal(fx.restoreForeign(parked), 1);
  assert.ok(sqlLog.some(text => text.includes("set profile_status = 'ACTIVE', available_now = true where id = 'f1'::uuid")));
  assert.equal(fx.countForeignActive(), 2);
  assert.equal(fx.restoreForeign({restore: []}), 0);
  const noCron = createFixtures(fakeRuntime({sqlAnswers: [[/to_regclass\('cron\.job'\)/, 'f']]}).rt, {flow});
  assert.deepEqual(noCron.pauseSchedulers(), {available: false, jobs: []});
});

test('the S04 helpers wrap the product RPCs by name: apply with a proposed window, select, withdraw, cancel, and book a worker through a booking task, an application and a selection', async () => {
  const {rt, flow, log, sqlLog} = fakeRuntime();
  const fx = createFixtures(rt, {flow});
  const worker = await fx.createWorker({label: 'w', skills: ['a']});
  const requester = await fx.createRequester();
  const need = {needId: 'n1', needRevision: 1};
  const application = await fx.submitApplication(worker, need, {slots: 2, price: 500, proposedStartAt: '2026-10-10T07:00:00Z', proposedEndAt: '2026-10-10T10:00:00Z'});
  assert.equal(application.ok, true);
  const submit = log.find(item => item.name === 'rpc_submit_response');
  assert.deepEqual([submit.args.p_covered_slots, submit.args.p_price_rsd, submit.args.p_proposed_start_at, submit.args.p_proposed_end_at], [2, 500, '2026-10-10T07:00:00Z', '2026-10-10T10:00:00Z']);
  await fx.selectResponse(requester, need, application.data);
  await fx.withdrawApplication(worker, application.data, {reason: 'r'});
  await fx.cancelNeed(requester, need);
  const select = log.find(item => item.name === 'rpc_select_response').args;
  assert.deepEqual([select.p_response_id, select.p_response_version, select.p_content_hash], ['resp-1', 1, 'h']);
  assert.equal(log.find(item => item.name === 'rpc_withdraw_response').args.p_reason, 'r');
  assert.equal(log.find(item => item.name === 'rpc_cancel_need').args.p_need_id, 'n1');
  const booked = await fx.bookWorker(worker, {startsAt: '2026-10-10T07:00:00Z', endsAt: '2026-10-10T10:00:00Z'});
  assert.ok(booked.needId);
  assert.ok(sqlLog.some(text => text.includes('insert into public.needs') && text.includes("'REMOTE'") && text.includes('FIXED_WINDOW')));
  assert.ok(worker.bypassed.some(item => item.startsWith('booking:')));
  assert.ok(log.filter(item => item.name === 'rpc_submit_response').length === 2 && log.filter(item => item.name === 'rpc_select_response').length === 2);
  fx.setWorkerStatusBypass(worker, 'SUSPENDED');
  assert.ok(sqlLog.some(text => text.includes("profile_status = 'SUSPENDED', available_now = false")));
  const calls = [];
  const withPrefs = createFixtures({...rt, prefs: async (...args) => { calls.push(args); return {revision: 'r'}; }}, {flow});
  await withPrefs.setNotificationPreferences(worker, 'WORKER', {pushEnabled: true});
  assert.deepEqual([calls[0][1], calls[0][2], calls[0][3]], [worker.id, 'WORKER', {pushEnabled: true}]);
  await assert.rejects(() => fx.setNotificationPreferences(worker, 'WORKER', {}), /EX06_PREFS_HELPER_MISSING/);
});

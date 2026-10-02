// EX05-S01: the pure check runner and result expectations shared by every updated proof copy.
// No I/O, no environment, no imports of the proof runtime: it is unit-tested offline (runner.test.mjs).
// Why a runner at all: the frozen originals stop at the FIRST failed assertion (rt.prove throws). A re-proof on a chain nobody has run yet must report EVERY broken
// assertion in one CI cycle, and must keep a harness defect (a fixture that did not build) apart from a product finding. The model is the voice B1 feature proof
// ("every check runs even after an earlier one failed"), with three additions: `requires` (a dependent check is SKIPPED, never silently green), `characterize`
// (an observation is RECORDED with a classifier verdict instead of asserted), and a message sanitizer (no JWT, no key, bounded length, never row data).
import assert from 'node:assert/strict';

export const MAX_MESSAGE = 900;
/** The one SQLSTATE a deterministic conflict raises since B24 (PostgREST answers HTTP 409 at once). 40001 would be retried without end by PostgREST 14. */
export const CONFLICT_CODE = 'PT409';
export const CONFLICT_HTTP_STATUS = 409;

const JWT = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g;
const SUPABASE_KEY = /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g;

/** The text of a thrown value, with JWTs and Supabase keys replaced and the length bounded. Never throws. */
export function sanitizeMessage(value) {
  const raw = value !== null && typeof value === 'object' && 'message' in value ? value.message : value;
  return String(raw).replace(JWT, '[jwt]').replace(SUPABASE_KEY, '[key]').slice(0, MAX_MESSAGE);
}

/** One line about a supabase-js style result: code, message and HTTP status, never the data (it may hold private rows). */
export function describeResult(result) {
  if (result === null || typeof result !== 'object') return 'no result';
  const parts = result.error
    ? ['code=' + result.error.code, 'message=' + sanitizeMessage(result.error.message)]
    : ['no error'];
  if (result.status !== undefined) parts.push('status=' + result.status);
  return parts.join(' ');
}

/** Asserts an error result with the given SQLSTATE `code` and/or exact `message`; the data must be absent. */
export function expectErrorResult(result, {code, message, status} = {}) {
  assert.ok(result && result.error, 'EXPECTED_ERROR_BUT_GOT: ' + describeResult(result));
  if (code !== undefined) assert.equal(result.error.code, code, 'EXPECTED_CODE ' + code + ' GOT ' + describeResult(result));
  if (message !== undefined) assert.equal(result.error.message, message, 'EXPECTED_MESSAGE ' + message + ' GOT ' + describeResult(result));
  if (status !== undefined && result.status !== undefined) assert.equal(result.status, status, 'EXPECTED_HTTP_STATUS ' + status + ' GOT ' + describeResult(result));
  assert.ok(result.data === null || result.data === undefined, 'EXPECTED_NO_DATA_ON_AN_ERROR: data was returned');
  return result.error;
}

/** A deterministic conflict as the post-B24 server answers it: SQLSTATE PT409 with the domain message, and HTTP 409 when the client exposes the status. Never 40001. */
export function expectConflictResult(result, message) {
  assert.ok(result && result.error, 'EXPECTED_CONFLICT_ERROR_BUT_GOT: ' + describeResult(result));
  assert.equal(result.error.code, CONFLICT_CODE, 'EXPECTED_PT409 (never 40001) GOT ' + describeResult(result));
  assert.equal(result.error.message, message, 'EXPECTED_MESSAGE ' + message + ' GOT ' + describeResult(result));
  if (result.status !== undefined) assert.equal(result.status, CONFLICT_HTTP_STATUS, 'EXPECTED_HTTP_409 GOT ' + describeResult(result));
  assert.ok(result.data === null || result.data === undefined, 'EXPECTED_NO_DATA_ON_A_CONFLICT: data was returned');
  return result.error;
}

const SETTLED_OK = new Set(['PASS', 'RECORDED']);

/**
 * createRunner({unit}) -> {check, characterize, summary}.
 *   check(name, fn, {requires, kind})        runs fn; a throw is a FAIL with the sanitized message; `requires` names earlier checks that must have PASSED (else SKIPPED).
 *   characterize(name, fn, {classify, failOn}) runs fn, stores its return value as an observation and the classifier's finding; only a throw or a finding in `failOn` is a FAIL.
 *   summary()                                the report body: result is PASS only when nothing failed, nothing was skipped and at least one check ran.
 */
export function createRunner({unit, print = console.log, printError = console.error} = {}) {
  const checks = [];
  const failures = [];
  const observations = {};
  const state = new Map();

  function begin(name, requires) {
    if (state.has(name)) throw new Error('DUPLICATE_CHECK_NAME ' + name);
    for (const required of requires) if (!state.has(required)) throw new Error('UNKNOWN_REQUIRED_CHECK ' + required);
    state.set(name, 'PENDING');
    return requires.filter(required => !SETTLED_OK.has(state.get(required)));
  }
  function skip(name, kind, unmet) {
    const reason = 'requires ' + unmet.join(', ');
    state.set(name, 'SKIPPED');
    checks.push({name, result: 'SKIPPED', kind, reason});
    print('SKIP ' + name + ' (' + reason + ')');
  }
  function fail(name, kind, message) {
    state.set(name, 'FAIL');
    checks.push({name, result: 'FAIL', kind});
    failures.push({name, message});
    printError('FAIL ' + name + ': ' + message);
  }

  async function check(name, fn, {requires = [], kind = 'BEHAVIOUR'} = {}) {
    const unmet = begin(name, requires);
    if (unmet.length) { skip(name, kind, unmet); return; }
    try { await fn(); } catch (error) { fail(name, kind, sanitizeMessage(error)); return; }
    state.set(name, 'PASS');
    checks.push({name, result: 'PASS', kind});
    print('PASS ' + name);
  }

  async function characterize(name, fn, {classify = null, failOn = [], requires = [], kind = 'CHARACTERIZATION'} = {}) {
    const unmet = begin(name, requires);
    if (unmet.length) { skip(name, kind, unmet); return; }
    let observation;
    try { observation = await fn(); } catch (error) { fail(name, kind, sanitizeMessage(error)); return; }
    let finding = null;
    try { finding = classify ? classify(observation) : null; } catch (error) { fail(name, kind, 'CLASSIFIER_THREW ' + sanitizeMessage(error)); return; }
    observations[name] = {observation, finding};
    if (finding !== null && failOn.includes(finding)) { fail(name, kind, 'finding ' + finding); return; }
    state.set(name, 'RECORDED');
    checks.push({name, result: 'RECORDED', kind});
    print('RECORD ' + name + (finding === null ? '' : ' finding=' + finding));
  }

  function summary() {
    const count = result => checks.filter(item => item.result === result).length;
    const passed = count('PASS'), recorded = count('RECORDED'), failed = count('FAIL'), skipped = count('SKIPPED');
    return {unit, result: failed === 0 && skipped === 0 && passed + recorded > 0 ? 'PASS' : 'FAIL',
      passed, recorded, failed, skipped, checks: checks.map(item => ({...item})), failures: failures.map(item => ({...item})), observations};
  }

  return {check, characterize, summary};
}

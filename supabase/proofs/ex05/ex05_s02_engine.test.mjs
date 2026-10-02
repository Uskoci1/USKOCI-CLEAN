// Offline tests of the EX-05 S02 session engine against a SIMULATED database (a scripted fake of psql and of pg_stat_activity): they prove the
// orchestration (observe before the next step, queue order, gate release, cycle evidence, exits, cleanup, kill) and that the verdict function
// turns what the simulation printed into the registered outcome. They claim nothing about PostgreSQL.
import assert from 'node:assert/strict';
import test from 'node:test';
import {EventEmitter} from 'node:events';
import {createEngine, runScenario, StepTimeout} from './ex05_s02_engine.mjs';
import * as C from './ex05_s02_catalog.mjs';

const U = n => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const ctxFor = (kind = 'task') => ({kind, owner: {id: U(1), session: U(2), claims: {sub: U(1), role: 'authenticated', session_id: U(2)}}, conv: U(3), key: U(4), asset: U(5),
  agreement: U(6), attempt: U(7), prepareId: U(8), sha: 'a'.repeat(64), stageSha: 'b'.repeat(64), cmid: 'ex05_' + 'c'.repeat(32)});
const specById = id => C.buildCatalog().find(spec => spec.id === id);

class FakeWorld {
  constructor({plan, finalState = {}}) {
    this.t = 0;
    this.plan = plan;
    this.finalState = finalState;
    this.sessions = [];
    this.byName = new Map();
    this.pid = 5000;
    this.released = null;
    this.releasedAt = null;
    this.killed = [];
    this.cleanups = [];
    this.heads = [];
    this.polls = 0;
    this.spawnArgs = [];
  }

  spawn = args => {
    this.spawnArgs.push(args);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    const sess = {child, name: null, app: null, pid: null, exited: false, waitingFor: [], gate: false, tag: null, deadlockMs: null, writes: []};
    child.stdin = {on() {}, write: text => { this.write(sess, text, false); return true; }, end: text => { this.write(sess, text ?? '', true); }};
    child.kill = signal => { this.killed.push({name: sess.name, signal}); this.exit(sess, null, '', '', signal); };
    this.sessions.push(sess);
    return child;
  };

  write(sess, text, ended) {
    sess.writes.push(text);
    if (!sess.name) {
      const app = /application_name = '([^']+)'/.exec(text)?.[1];
      assert.ok(app, 'the first write carries the session head');
      sess.app = app;
      sess.name = app.split(':').pop();
      sess.pid = ++this.pid;
      sess.gate = text.includes("'READY|'");
      sess.deadlockMs = Number(/deadlock_timeout = '(\d+)ms'/.exec(text)?.[1] ?? 0) || null;
      sess.tag = /'RES\|([A-Za-z0-9_]+)\|'/.exec(text)?.[1] ?? null;
      this.byName.set(sess.name, sess);
      this.heads.push(text.split('\n').slice(0, 6).join('\n'));
      if (sess.gate) sess.child.stdout.emit('data', 'READY|' + sess.pid + '\n');
    }
    if (ended && sess.gate) {
      this.released = /(commit|rollback);\s*$/.exec(text)?.[1] ?? 'commit';
      this.releasedAt = this.t;
      this.exit(sess, 0, '', '');
    }
    this.tick();
  }

  exit(sess, code, stdout, stderr, signal = null) {
    if (sess.exited) return;
    sess.exited = true;
    if (stdout) sess.child.stdout.emit('data', stdout);
    if (stderr) sess.child.stderr.emit('data', stderr);
    sess.child.emit('close', code, signal);
    this.tick();
  }

  tick() {
    for (const sess of this.sessions) {
      if (sess.exited || !sess.name || sess.gate) continue;
      const decision = this.plan(this, sess);
      if (decision?.wait) sess.waitingFor = decision.wait;
      else if (decision?.exit) {
        sess.waitingFor = [];
        this.exit(sess, decision.exit.code, decision.exit.stdout ?? '', decision.exit.stderr ?? '');
      }
    }
  }

  observation() {
    return this.sessions.filter(sess => !sess.exited && sess.name).map(sess => ({
      pid: sess.pid, application_name: sess.app, state: 'active', wait_event_type: sess.waitingFor.length ? 'Lock' : null, wait_event: sess.waitingFor.length ? 'transactionid' : null,
      blocked_by: sess.waitingFor.map(name => this.byName.get(name)?.pid).filter(Boolean), query_head: sess.tag ? 'select ' + sess.tag : null,
      waiting_on: sess.waitingFor.length ? [{locktype: 'transactionid', mode: 'ShareLock', relation: null, key: null, xid: '777'}] : [],
    }));
  }

  query = async text => {
    this.polls += 1;
    if (text.includes("application_name like 'ex05-s02:%'")) return JSON.stringify(this.observation());
    const pidMatch = /application_name = '([^']+)' limit 1/.exec(text);
    if (pidMatch) return String(this.sessions.find(sess => sess.app === pidMatch[1])?.pid ?? '');
    if (text.includes('jsonb_build_object')) return JSON.stringify(this.finalState);
    this.cleanups.push(text);
    return '';
  };

  sleep = async ms => { this.t += ms; this.tick(); };
  now = () => this.t;
}

const engineFor = world => createEngine({spawn: world.spawn, query: world.query, sleep: world.sleep, now: world.now, dbUrl: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'});
const deadlockText = (a, b) => ['ERROR:  40P01: deadlock detected', `DETAIL:  Process ${a} waits for ShareLock on transaction 700; blocked by process ${b}.`, `Process ${b} waits for ShareLock on transaction 701; blocked by process ${a}.`,
  'CONTEXT:  while locking tuple (0,1) in relation "ai_conversations"', 'PL/pgSQL function media_assert_task_edit(uuid,uuid) line 5 at SQL statement', 'LOCATION:  DeadLockReport, deadlock.c:1139'].join('\n');
const run = (world, spec, extra = {}) => runScenario({engine: engineFor(world), spec, ctx: ctxFor(spec.kind === 'task' ? 'task' : spec.kind), scenarioNo: 7, query: world.query, now: world.now, sleep: world.sleep, ...extra});

// plan of the T1A interleaving: REMOVE first behind the gate, CANCEL second behind REMOVE; after the release they wait on each other until the victim's timeout
const deadlockPlan = victim => (world, sess) => {
  if (!world.released) return {wait: [sess.name === 'REMOVE' ? 'H' : 'REMOVE']};
  const other = sess.name === 'REMOVE' ? 'CANCEL' : 'REMOVE';
  const peer = world.byName.get(other);
  if (peer?.exited) return {exit: {code: 0, stdout: `RES|${sess.tag}|${sess.name === 'CANCEL' ? '{"cancelled":true,"previousState":"READY","selected":false}' : '{"ready":true,"photos":[]}'}\n`}};
  if (sess.name === victim && world.t - world.releasedAt >= sess.deadlockMs) return {exit: {code: 3, stderr: deadlockText(sess.pid, peer.pid)}};
  return {wait: [other]};
};

test('a registered deadlock: the gate, the two queued callers, the release, the observed cycle and the victim are all recorded and judged AS_EXPECTED', async () => {
  const spec = specById('T1A_CANCEL_READY_VS_REMOVE_REMOVE_FIRST_VICTIM_REMOVE');
  const world = new FakeWorld({plan: deadlockPlan('REMOVE'), finalState: {rows: 1, state: 'READY', selected: false, inRefs: false, tombstone: false, closure: null, dispatch: 'NOT_DISPATCHED/-'}});
  const result = await run(world, spec);
  assert.equal(result.error, null);
  assert.deepEqual(result.steps.map(item => item.step).slice(0, 5), ['gate holds conversationRow', 'REMOVE is blocked behind the gate', 'CANCEL is blocked behind REMOVE', 'gate released (commit)', 'cycle observed']);
  assert.deepEqual(result.edges.map(edge => [edge.waiter, edge.blockedBy]), [['REMOVE', ['H']], ['CANCEL', ['REMOVE']]]);
  assert.equal(result.cycle.observed, true);
  assert.equal(result.cycle.edges.length, 2);
  assert.ok(result.snapshot.some(entry => entry.name === 'CANCEL' && entry.blockedBy.includes('REMOVE')));
  assert.equal(result.outcomes.REMOVE.sqlstate, '40P01');
  assert.equal(result.outcomes.REMOVE.edges.length, 2);
  assert.equal(result.outcomes.CANCEL.ok, true);
  assert.equal(result.outcomes.H.ok, true);
  assert.ok(Object.keys(result.statements).sort().join() === 'CANCEL,H,REMOVE');
  assert.ok(result.statements.REMOVE.includes('rpc_remove_task_photo'));
  const verdict = C.judge(spec, result);
  assert.deepEqual(verdict.problems, []);
  assert.equal(verdict.verdict, 'AS_EXPECTED');
  assert.equal(verdict.observedClass, 'DEADLOCK');
  assert.equal(verdict.victim, 'REMOVE');
  // the victim has the short deadlock timeout, the other session the long one, and the gate none
  const timeouts = Object.fromEntries(world.sessions.map(sess => [sess.name, sess.deadlockMs]));
  assert.deepEqual(timeouts, {H: null, REMOVE: 6000, CANCEL: 20000});
  assert.ok(world.sessions.every(sess => sess.exited));
});

test('the same interleaving with the other victim is judged by the registered victim, not by the first deadlock seen', async () => {
  const spec = specById('T1B_CANCEL_READY_VS_REMOVE_REMOVE_FIRST_VICTIM_CANCEL');
  const world = new FakeWorld({plan: deadlockPlan('CANCEL'), finalState: {rows: 1, state: 'READY', selected: false, inRefs: false}});
  const result = await run(world, spec);
  assert.equal(result.outcomes.CANCEL.sqlstate, '40P01');
  assert.equal(C.judge(spec, result).verdict, 'AS_EXPECTED');
  const wrong = await run(new FakeWorld({plan: deadlockPlan('REMOVE'), finalState: {rows: 1, state: 'READY', selected: false, inRefs: false}}), spec);
  const verdict = C.judge(spec, wrong);
  assert.equal(verdict.verdict, 'UNEXPECTED');
  assert.ok(verdict.problems.some(line => line.startsWith('WRONG_VICTIM')));
  // when the database refuses to set deadlock_timeout the victim cannot be steered: the victim assertion is dropped, the class is still asserted
  const loose = await run(new FakeWorld({plan: deadlockPlan('REMOVE'), finalState: {rows: 1, state: 'READY', selected: false, inRefs: false}}), spec, {deadlockSettable: false});
  assert.equal(C.judge(spec, loose).verdict, 'AS_EXPECTED');
});

test('deadlockSettable=false never writes a deadlock_timeout setting', async () => {
  const spec = specById('T1A_CANCEL_READY_VS_REMOVE_REMOVE_FIRST_VICTIM_REMOVE');
  const world = new FakeWorld({plan: deadlockPlan('REMOVE'), finalState: {rows: 1, state: 'READY', selected: false, inRefs: false}});
  await run(world, spec, {deadlockSettable: false});
  assert.ok(world.sessions.every(sess => !sess.writes.join('').includes('deadlock_timeout')));
  assert.ok(world.sessions.every(sess => sess.deadlockMs === null));
});

test('a serialized interleaving: both callers wait in the registered order, nobody errors, one documented final state', async () => {
  const spec = specById('T3_CANCEL_FIRST_THEN_REMOVE_SERIALIZED');
  const plan = (world, sess) => {
    if (!world.released) return {wait: [sess.name === 'CANCEL' ? 'H' : 'CANCEL']};
    if (sess.name === 'CANCEL') return {exit: {code: 0, stdout: 'RES|cancel|{"cancelled":true,"previousState":"READY","selected":false}\n'}};
    if (world.byName.get('CANCEL').exited) return {exit: {code: 0, stdout: 'RES|remove|{"ready":true,"photos":[]}\n'}};
    return {wait: ['CANCEL']};
  };
  const world = new FakeWorld({plan, finalState: {rows: 1, state: 'READY', selected: false, inRefs: false}});
  const result = await run(world, spec);
  assert.equal(result.cycle, null);
  const verdict = C.judge(spec, result);
  assert.deepEqual(verdict.problems, []);
  assert.equal(verdict.observedClass, 'SERIALIZED');
});

test('an interleaving that deadlocks although the registration says serialized is red, and so is a result or a final state that differs', async () => {
  const spec = specById('T3_CANCEL_FIRST_THEN_REMOVE_SERIALIZED');
  const plan = (world, sess) => {
    if (!world.released) return {wait: [sess.name === 'CANCEL' ? 'H' : 'CANCEL']};
    if (sess.name === 'CANCEL') return {exit: {code: 3, stderr: deadlockText(sess.pid, world.byName.get('REMOVE').pid)}};
    return {exit: {code: 0, stdout: 'RES|remove|{"ready":false,"photos":[1]}\n'}};
  };
  const result = await run(new FakeWorld({plan, finalState: {rows: 2, state: 'READY', selected: true, inRefs: false}}), spec);
  const verdict = C.judge(spec, result);
  assert.equal(verdict.verdict, 'UNEXPECTED');
  assert.ok(verdict.problems.some(line => line.startsWith('UNEXPECTED_DEADLOCK')));
  assert.ok(verdict.problems.some(line => line.startsWith('CLASS_MISMATCH')));
  assert.ok(verdict.problems.some(line => line.startsWith('RESULT_MISMATCH:result.REMOVE.ready')));
  assert.ok(verdict.problems.some(line => line.startsWith('FINAL_STATE_MISMATCH:final.rows')));
});

test('a caller that answers while the gate is still held (the cancel of a not-ready upload) is a registered "free" second caller', async () => {
  const spec = specById('T9_CANCEL_OF_A_NOT_READY_UPLOAD_DOES_NOT_WAIT_FOR_THE_CONVERSATION');
  const plan = (world, sess) => {
    if (sess.name === 'CANCEL') return {exit: {code: 0, stdout: 'RES|cancel|{"previousState":"STAGED","selected":false,"cancelled":true}\n'}};
    if (!world.released) return {wait: ['H']};
    return {exit: {code: 0, stdout: 'RES|complete|{"state":"READY","selected":false}\n'}};
  };
  const world = new FakeWorld({plan, finalState: {rows: 1, state: 'READY', selected: false, inRefs: false}});
  const result = await run(world, spec);
  assert.equal(result.error, null);
  assert.equal(result.edges[1].note, 'NOT_BLOCKED_ANSWERED_WHILE_THE_GATE_WAS_HELD');
  assert.equal(world.released, 'commit');
  const gateWrites = world.sessions.find(sess => sess.name === 'H');
  assert.ok(gateWrites.exited);
  assert.deepEqual(C.judge(spec, result).problems, []);
});

test('a second caller that is never observed waiting is a step timeout, not a silent pass', async () => {
  const spec = specById('T3_CANCEL_FIRST_THEN_REMOVE_SERIALIZED');
  const plan = (world, sess) => (sess.name === 'CANCEL' ? {wait: ['H']} : {wait: []});
  const world = new FakeWorld({plan, finalState: {}});
  const result = await run(world, spec);
  assert.match(result.error, /^STEP_TIMEOUT:blocked:REMOVE<-CANCEL/);
  assert.ok(world.sessions.every(sess => sess.exited), 'every session is killed in the end');
  assert.ok(world.killed.length >= 2);
  const verdict = C.judge(spec, result);
  assert.equal(verdict.verdict, 'UNEXPECTED');
  assert.ok(verdict.problems.some(line => line.startsWith('SCENARIO_ERROR')));
});

test('a session that dies before it was observed waiting is reported with its first error line', async () => {
  const spec = specById('T3_CANCEL_FIRST_THEN_REMOVE_SERIALIZED');
  const plan = (world, sess) => (sess.name === 'CANCEL' ? {exit: {code: 3, stderr: 'ERROR:  42501: permission denied for function rpc_cancel_media_upload\nLOCATION:  x'}} : {wait: ['CANCEL']});
  const result = await run(new FakeWorld({plan, finalState: {}}), spec);
  assert.match(result.error, /^SESSION_EXITED_EARLY:CANCEL:ERROR:  42501: permission denied/);
  assert.equal(result.outcomes.CANCEL.sqlstate, '42501');
});

test('a gate that dies without the READY marker is reported', async () => {
  const spec = specById('T3_CANCEL_FIRST_THEN_REMOVE_SERIALIZED');
  const world = new FakeWorld({plan: () => ({wait: []})});
  const original = world.write.bind(world);
  world.write = (sess, text, ended) => {
    if (!sess.name && text.includes("'READY|'")) {
      sess.writes.push(text);
      sess.app = /application_name = '([^']+)'/.exec(text)[1];
      sess.name = 'H';
      sess.pid = 9;
      world.byName.set('H', sess);
      world.exit(sess, 3, '', 'ERROR:  42501: permission denied for table x\nLOCATION:  y');
      return;
    }
    original(sess, text, ended);
  };
  const result = await run(world, spec);
  assert.match(result.error, /^GATE_EXITED_EARLY:H:ERROR:  42501/);
});

test('the cleanup runs in the end, also after an error, and its own failure is recorded', async () => {
  const spec = specById('CL2B_CANCEL_REFUSED_ACCOUNT_CLOSING_AFTER_THE_KEY');
  const plan = (world, sess) => {
    if (!world.released) return {wait: ['H']};
    return {exit: {code: 3, stderr: 'ERROR:  42501: ACCOUNT_CLOSING\nLOCATION:  exec_stmt_raise, pl_exec.c:3921'}};
  };
  const world = new FakeWorld({plan, finalState: {rows: 1, state: 'READY', selected: true, inRefs: true, closure: 'READY'}});
  const result = await run(world, spec);
  assert.equal(result.error, null);
  assert.equal(world.cleanups.length, 1);
  assert.match(world.cleanups[0], /^delete from private\.account_closure_requests where account_id = /);
  assert.deepEqual(C.judge(spec, result).problems, []);
  // a failing cleanup
  const failing = new FakeWorld({plan, finalState: {rows: 1, state: 'READY', selected: true, inRefs: true, closure: 'READY'}});
  const base = failing.query;
  failing.query = async text => { if (text.startsWith('delete from')) throw new Error('boom'); return base(text); };
  const bad = await runScenario({engine: engineFor(failing), spec, ctx: ctxFor(), scenarioNo: 7, query: failing.query, now: failing.now, sleep: failing.sleep});
  assert.equal(bad.cleanupError, 'boom');
  assert.ok(C.judge(spec, bad).problems.some(line => line.startsWith('CLEANUP_ERROR')));
});

test('the refusal that was registered is accepted, a success where a refusal was registered is not', async () => {
  const spec = specById('CL2B_CANCEL_REFUSED_ACCOUNT_CLOSING_AFTER_THE_KEY');
  const world = new FakeWorld({plan: (w, sess) => (w.released ? {exit: {code: 0, stdout: 'RES|cancel|{"cancelled":true}\n'}} : {wait: ['H']}), finalState: {rows: 1, state: 'READY', selected: true, inRefs: true, closure: 'READY'}});
  const verdict = C.judge(spec, await run(world, spec));
  assert.equal(verdict.verdict, 'UNEXPECTED');
  assert.ok(verdict.problems.some(line => line.startsWith('EXPECTED_ERROR_MISSING:CANCEL')));
});

test('a SQLSTATE 40001 in any session is always a problem, whatever else was registered', async () => {
  const spec = specById('T7B_CANCEL_THEN_CLAIM_OF_AN_ABSENT_COMMAND');
  const plan = (world, sess) => {
    if (!world.released) return {wait: ['H']};
    if (sess.name === 'CANCEL') return {exit: {code: 0, stdout: 'RES|cancel|{"cancelled":true,"previousState":null}\n'}};
    return {exit: {code: 3, stderr: 'ERROR:  40001: MEDIA_COMMAND_CANCELLED\nLOCATION:  exec_stmt_raise, pl_exec.c:3921'}};
  };
  const result = await run(new FakeWorld({plan, finalState: {rows: 1, state: 'CANCELLED', tombstone: true}}), spec);
  const verdict = C.judge(spec, result);
  assert.ok(verdict.problems.some(line => line.startsWith('SQLSTATE_40001_OBSERVED:CLAIM')));
  assert.equal(verdict.verdict, 'UNEXPECTED');
});

test('statement timeouts are reported as such', async () => {
  const spec = specById('T3_CANCEL_FIRST_THEN_REMOVE_SERIALIZED');
  const plan = (world, sess) => {
    if (!world.released) return {wait: [sess.name === 'CANCEL' ? 'H' : 'CANCEL']};
    return {exit: {code: 3, stderr: 'ERROR:  57014: canceling statement due to statement timeout\nLOCATION:  ProcessInterrupts, postgres.c:3351'}};
  };
  const verdict = C.judge(spec, await run(new FakeWorld({plan, finalState: {rows: 1, state: 'READY', selected: false, inRefs: false}}), spec));
  assert.ok(verdict.problems.some(line => line.startsWith('STATEMENT_TIMEOUT:')));
});

test('every session is opened with the psql arguments the real proof uses and the engine never writes to a session after it was ended', async () => {
  const spec = specById('T3_CANCEL_FIRST_THEN_REMOVE_SERIALIZED');
  const plan = (world, sess) => {
    if (!world.released) return {wait: [sess.name === 'CANCEL' ? 'H' : 'CANCEL']};
    return {exit: {code: 0, stdout: `RES|${sess.tag}|{}\n`}};
  };
  const world = new FakeWorld({plan, finalState: {}});
  await run(world, spec);
  for (const args of world.spawnArgs) assert.deepEqual(args.slice(0, 5), ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v']);
  for (const args of world.spawnArgs) assert.ok(args.includes('VERBOSITY=verbose') && args.at(-1).startsWith('postgresql://'));
  const callers = world.sessions.filter(sess => !sess.gate);
  for (const sess of callers) {
    assert.equal(sess.writes.length, 1, 'a caller gets its whole script in one write that ends stdin');
    assert.ok(sess.writes[0].endsWith('commit;\n'));
  }
  assert.ok(world.sessions.find(sess => sess.gate).writes.length >= 1);
});

test('the step timeout is a typed error', () => {
  const error = new StepTimeout('blocked', 'A<-B');
  assert.equal(error.name, 'StepTimeout');
  assert.equal(error.step, 'blocked');
  assert.equal(error.message, 'STEP_TIMEOUT:blocked:A<-B');
});

test('a row gate that locked no row is refused before anything is parked behind it', async () => {
  const spec = specById('T3_CANCEL_FIRST_THEN_REMOVE_SERIALIZED');
  const world = new FakeWorld({plan: () => ({wait: []})});
  const original = world.write.bind(world);
  world.write = (sess, text, ended) => {
    if (!sess.name && text.includes("'READY|'")) {
      original(sess, text, ended);
      return;
    }
    original(sess, text, ended);
  };
  const emit = world.spawn;
  world.spawn = args => {
    const child = emit(args);
    const sess = world.sessions.at(-1);
    child.stdout.on('data', () => {});
    const write = child.stdin.write;
    child.stdin.write = text => {
      if (text.includes("'READY|'")) sess.child.stdout.emit('data', 'LOCKED|0\n');
      return write(text);
    };
    return child;
  };
  const result = await run(world, spec);
  assert.match(result.error, /^GATE_LOCKED_NO_ROW:H/);
  assert.equal(world.sessions.filter(sess => !sess.gate && sess.name && sess.name !== 'H').length, 0, 'no caller was started behind a gate that holds nothing');
});

test('a row gate that locked its row passes', async () => {
  const spec = specById('T3_CANCEL_FIRST_THEN_REMOVE_SERIALIZED');
  const plan = (world, sess) => {
    if (!world.released) return {wait: [sess.name === 'CANCEL' ? 'H' : 'CANCEL']};
    return {exit: {code: 0, stdout: `RES|${sess.tag}|{"previousState":"READY","ready":true,"photos":[]}\n`}};
  };
  const world = new FakeWorld({plan, finalState: {rows: 1, state: 'READY', selected: false, inRefs: false}});
  const emit = world.spawn;
  world.spawn = args => {
    const child = emit(args);
    const sess = world.sessions.at(-1);
    const write = child.stdin.write;
    child.stdin.write = text => {
      if (text.includes("'READY|'")) sess.child.stdout.emit('data', 'LOCKED|1\n');
      return write(text);
    };
    return child;
  };
  const result = await run(world, spec);
  assert.equal(result.error, null);
});

// ---- the whole catalog through the engine and the verdict, against a simulated database that behaves exactly as each interleaving registers ----------
const resolveOneOf = value => JSON.parse(JSON.stringify(value), (key, inner) => (inner && Array.isArray(inner.$oneOf) ? inner.$oneOf[0] : inner));
function registeredPlan(spec) {
  const first = spec.first.name;
  const second = spec.second?.name ?? null;
  const exitFor = sess => {
    const registered = spec.expect.errors?.[sess.name]?.[0];
    if (registered) {
      const [state, message] = registered.split(':');
      return {exit: {code: 3, stderr: `ERROR:  ${state}: ${message}\nLOCATION:  exec_stmt_raise, pl_exec.c:3921`}};
    }
    const result = spec.expect.results?.[sess.name];
    return {exit: {code: 0, stdout: `RES|${sess.tag}|${JSON.stringify(result === undefined ? {} : result)}\n`}};
  };
  return (world, sess) => {
    if (spec.secondBlockedBy === 'free' && sess.name === second) return exitFor(sess);
    if (!world.released) {
      if (sess.name === first) return {wait: ['H']};
      return {wait: [spec.secondBlockedBy === 'gate' ? 'H' : first]};
    }
    const peerName = sess.name === first ? second : first;
    const peer = peerName ? world.byName.get(peerName) : null;
    if (spec.expect.class === 'DEADLOCK') {
      if (peer?.exited) return exitFor(sess);
      if (sess.name === spec.expect.victim && world.t - world.releasedAt >= sess.deadlockMs) return {exit: {code: 3, stderr: deadlockText(sess.pid, peer.pid)}};
      return {wait: [peerName]};
    }
    if (sess.name === first) return exitFor(sess);
    if (peer?.exited) return exitFor(sess);
    return {wait: [first]};
  };
}

test('every interleaving of the catalog runs through the engine and the verdict against a simulated database that behaves as registered', async () => {
  const catalog = C.buildCatalog();
  assert.equal(catalog.length, 35);
  const verdicts = [];
  const runs = new Map();
  for (const spec of catalog) {
    const world = new FakeWorld({plan: registeredPlan(spec), finalState: resolveOneOf(spec.expect.final)});
    const result = await run(world, spec);
    runs.set(spec.id, result);
    verdicts.push(C.judge(spec, result));
    assert.equal(result.error, null, spec.id + ': ' + result.error);
    const verdict = C.judge(spec, result);
    assert.deepEqual(verdict.problems, [], spec.id);
    assert.equal(verdict.verdict, 'AS_EXPECTED', spec.id);
    assert.equal(verdict.observedClass, spec.expect.class, spec.id);
    assert.ok(world.sessions.every(sess => sess.exited), spec.id + ': every session ended');
    assert.equal(result.statements.H.length > 0, true);
    // the registered statements really name the functions the scenario is about
    const text = Object.values(result.statements).join(' ');
    if (spec.kind === 'voice') assert.ok(text.includes('voice'), spec.id);
    if (spec.kind === 'photo') assert.ok(text.includes('photo'), spec.id);
    if (spec.kind === 'task') assert.ok(!text.includes('agreement_'), spec.id);
    if (spec.cleanup) assert.equal(world.cleanups.length, 1, spec.id);
    assert.equal(world.heads.filter(head => head.includes('application_name')).length, world.sessions.length, spec.id);
  }
  // the findings and the controls, derived from those verdicts and raw runs exactly as the proof derives them
  assert.deepEqual(C.buildFindings(catalog, verdicts).map(finding => [finding.id, finding.status]), [['RC02-F1', 'REPRODUCED'], ['RC02-F2', 'REPRODUCED'], ['AGREEMENT-PATH', 'NO_INVERSION_OBSERVED']]);
  const controls = C.controlsSummary(catalog, verdicts, runs);
  assert.equal(controls.length, 3);
  for (const control of controls) assert.ok(control.detected && control.redUnderTheRealSiblingRegistration === true, control.id);
  for (const spec of catalog.filter(candidate => candidate.expect.class === 'DEADLOCK')) {
    const victimRun = runs.get(spec.id);
    assert.equal(victimRun.pids[spec.expect.victim] > 0, true, spec.id);
  }
});

test('the same simulation turns red for every deviation of one interleaving (the harness is not a tautology)', async () => {
  const spec = C.buildCatalog().find(candidate => candidate.id === 'A2_CANCEL_FIRST_THEN_SEND_VOICE');
  const good = registeredPlan(spec);
  const variants = {
    'the send succeeds although the cancel won': (world, sess) => (world.released && sess.name === 'SEND' && world.byName.get('CANCEL').exited ? {exit: {code: 0, stdout: 'RES|send|{"messageId":"x"}\n'}} : good(world, sess)),
    'the send fails with another refusal': (world, sess) => (world.released && sess.name === 'SEND' && world.byName.get('CANCEL').exited ? {exit: {code: 3, stderr: 'ERROR:  42501: MEDIA_NOT_FOUND\nLOCATION:  x'}} : good(world, sess)),
    'the two callers deadlock': (world, sess) => (world.released ? (sess.name === 'SEND' ? {exit: {code: 3, stderr: deadlockText(sess.pid, world.byName.get('CANCEL').pid)}} : {wait: ['SEND']}) : good(world, sess)),
    'the send is never observed waiting': (world, sess) => (sess.name === 'SEND' ? {wait: []} : good(world, sess)),
  };
  for (const [name, plan] of Object.entries(variants)) {
    const world = new FakeWorld({plan, finalState: resolveOneOf(spec.expect.final)});
    const verdict = C.judge(spec, await run(world, spec));
    assert.equal(verdict.verdict, 'UNEXPECTED', name);
  }
  const wrongFinal = new FakeWorld({plan: good, finalState: {...resolveOneOf(spec.expect.final), messages: 1}});
  assert.equal(C.judge(spec, await run(wrongFinal, spec)).verdict, 'UNEXPECTED');
});

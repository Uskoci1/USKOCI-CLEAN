// EX-05 S02: the session engine. ASCII only, LF only.
// A scenario is a small program over REAL psql sessions held open at the same time: a gate session holds one lock, callers are parked
// behind it in a chosen queue order (every step is OBSERVED in pg_stat_activity / pg_blocking_pids before the next one starts, never
// assumed from a sleep), the gate is released, and the outcome of every session is parsed. The engine takes its process spawner, its
// control query and its clock as parameters, so the offline tests drive it against a simulated database.
import {GATES, STATEMENTS, CLEANUPS, parseSession, sessionHead, readyStatement, observeSql, pidSql, taskStateSql, agreementStateSql} from './ex05_s02_sql.mjs';

export class StepTimeout extends Error {
  constructor(step, detail = '') {
    super('STEP_TIMEOUT:' + step + (detail ? ':' + detail : ''));
    this.name = 'StepTimeout';
    this.step = step;
  }
}

const summary = session => {
  const text = String(session.stderr ?? '').split('\n').find(line => /ERROR|FATAL|psql:/.test(line)) ?? '';
  return text.slice(0, 160);
};

export function createEngine({spawn, query, sleep, now, dbUrl, pollMs = 40}) {
  const byApp = new Map();
  const live = new Set();

  function open({scenarioNo, name, role, claims = null, deadlockMs = null, statementMs = 30000, script, hold = false}) {
    const app = `ex05-s02:${scenarioNo}:${name}`;
    const child = spawn(['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', dbUrl]);
    const session = {name, app, role, hold, pid: null, exited: false, result: null, stdout: '', stderr: '', child, ended: false, startedAt: now()};
    session.done = new Promise(resolve => {
      child.once('error', error => {
        session.stderr += 'SPAWN_ERROR:' + (error && error.code);
        session.exited = true;
        session.result = {code: null, signal: null, stdout: session.stdout, stderr: session.stderr};
        resolve(session.result);
      });
      child.once('close', (code, signal) => {
        session.exited = true;
        session.result = {code, signal, stdout: session.stdout, stderr: session.stderr};
        resolve(session.result);
      });
    });
    child.stdout.on('data', data => { session.stdout += data; });
    child.stderr.on('data', data => { session.stderr += data; });
    child.stdin.on('error', () => {});
    const head = sessionHead({app, role, claims, deadlockMs, statementMs});
    const body = script.join('\n') + '\n';
    if (hold) {
      child.stdin.write(head + body + readyStatement + '\n');
    } else {
      session.ended = true;
      child.stdin.end(head + body + 'commit;\n');
    }
    byApp.set(app, session);
    live.add(session);
    session.done.then(() => live.delete(session));
    return session;
  }

  async function waitReady(session, ms = 15000) {
    const deadline = now() + ms;
    for (;;) {
      const match = /READY\|(\d+)/.exec(session.stdout);
      if (match) {
        session.pid = Number(match[1]);
        const locked = /LOCKED\|(\d+)/.exec(session.stdout);
        if (locked && Number(locked[1]) === 0) throw new Error('GATE_LOCKED_NO_ROW:' + session.name);
        return session.pid;
      }
      if (session.exited) throw new Error(`GATE_EXITED_EARLY:${session.name}:${summary(session)}`);
      if (now() > deadline) throw new StepTimeout('gate-ready', session.name);
      await sleep(pollMs);
    }
  }

  async function waitPid(session, ms = 15000) {
    if (session.pid) return session.pid;
    const deadline = now() + ms;
    for (;;) {
      const text = String(await query(pidSql(session.app))).trim();
      if (/^[0-9]+$/.test(text)) {
        session.pid = Number(text);
        return session.pid;
      }
      if (session.exited) throw new Error(`SESSION_EXITED_EARLY:${session.name}:${summary(session)}`);
      if (now() > deadline) throw new StepTimeout('pid', session.name);
      await sleep(pollMs);
    }
  }

  async function observe() {
    const text = String(await query(observeSql())).trim();
    const entries = JSON.parse(text || '[]');
    const pidName = new Map([...live].filter(s => s.pid).map(s => [s.pid, s.name]));
    for (const session of byApp.values()) if (session.pid) pidName.set(session.pid, session.name);
    return entries.map(entry => ({
      ...entry,
      name: byApp.get(entry.application_name)?.name ?? entry.application_name,
      blocked_by_names: (entry.blocked_by ?? []).map(pid => pidName.get(pid) ?? 'pid:' + pid),
    }));
  }

  const compact = (entry, t0) => ({
    waiter: entry.name, blockedBy: entry.blocked_by_names, waitEventType: entry.wait_event_type, waitEvent: entry.wait_event,
    waitingOn: entry.waiting_on ?? [], query: entry.query_head ?? null, atMs: now() - t0,
  });

  /** Resolves with the observed edge when `waiter` waits on a lock held (or queued ahead) by `holder`. Throws when the waiter is gone or the step times out. */
  async function awaitBlocked(waiter, holder, {ms = 20000} = {}) {
    const t0 = now();
    if (!waiter.pid) await waitPid(waiter, ms);
    if (!holder.pid) await waitPid(holder, ms);
    const deadline = t0 + ms;
    for (;;) {
      if (waiter.exited) throw new Error(`SESSION_EXITED_EARLY:${waiter.name}:${summary(waiter)}`);
      const entries = await observe();
      const mine = entries.find(entry => entry.application_name === waiter.app);
      if (mine && mine.wait_event_type === 'Lock' && (mine.blocked_by ?? []).includes(holder.pid)) return compact(mine, t0);
      if (now() > deadline) throw new StepTimeout('blocked', `${waiter.name}<-${holder.name}`);
      await sleep(pollMs);
    }
  }

  /** Best-effort evidence of a wait cycle (the 40P01 DETAIL is the authoritative record): never throws on timeout. */
  async function awaitCycle(a, b, {ms = 15000} = {}) {
    const t0 = now();
    const deadline = t0 + ms;
    for (;;) {
      const entries = await observe();
      const ea = entries.find(entry => entry.application_name === a.app);
      const eb = entries.find(entry => entry.application_name === b.app);
      if (ea && eb && (ea.blocked_by ?? []).includes(b.pid) && (eb.blocked_by ?? []).includes(a.pid)) return {observed: true, edges: [compact(ea, t0), compact(eb, t0)]};
      if (a.exited || b.exited || now() > deadline) return {observed: false, aExited: a.exited, bExited: b.exited};
      await sleep(pollMs);
    }
  }

  function release(session, how) {
    if (!session.hold || session.ended) throw new Error('NOT_A_HELD_SESSION:' + session.name);
    if (how !== 'commit' && how !== 'rollback') throw new Error('BAD_RELEASE:' + how);
    session.ended = true;
    session.child.stdin.end(how + ';\n');
  }

  async function awaitExit(sessions, ms = 60000) {
    const t0 = now();
    const deadline = t0 + ms;
    for (;;) {
      if (sessions.every(session => session.exited)) return;
      if (now() > deadline) throw new StepTimeout('exit', sessions.filter(session => !session.exited).map(session => session.name).join(','));
      await sleep(pollMs);
    }
  }

  async function closeAll() {
    for (const session of [...live]) {
      try { session.child.kill('SIGKILL'); } catch { /* already gone */ }
    }
    const deadline = now() + 5000;
    while (live.size && now() < deadline) await sleep(pollMs);
    byApp.clear();
  }

  return {open, waitReady, waitPid, observe, awaitBlocked, awaitCycle, release, awaitExit, closeAll};
}

/**
 * One interleaving: gate -> first caller (parked behind the gate) -> second caller (parked behind the first caller or the gate, or free)
 * -> release -> optional cycle evidence -> exits -> final state. Returns the raw run record; the verdict is the catalog's job.
 */
export async function runScenario({engine, spec, ctx, scenarioNo, deadlockSettable = true, query, now, sleep}) {
  const t0 = now();
  const run = {id: spec.id, outcomes: {}, edges: [], statements: {}, steps: [], snapshot: null, cycle: null, final: null, error: null, deadlockSettable, cleanupError: null};
  const sessions = {};
  const step = text => run.steps.push({atMs: now() - t0, step: text});
  const launch = part => {
    const statement = STATEMENTS[part.stmt];
    if (!statement) throw new Error('UNKNOWN_STATEMENT:' + part.stmt);
    const sql = statement.build(ctx);
    const claims = statement.role === 'authenticated' ? ctx.owner.claims : null;
    const session = engine.open({scenarioNo, name: part.name, role: statement.role, claims, deadlockMs: deadlockSettable ? (part.deadlockMs ?? null) : null, script: [sql]});
    sessions[part.name] = session;
    run.statements[part.name] = sql;
    return session;
  };
  try {
    const gateBuilder = GATES[spec.gate.key];
    if (!gateBuilder) throw new Error('UNKNOWN_GATE:' + spec.gate.key);
    const gateLines = gateBuilder(ctx);
    sessions.H = engine.open({scenarioNo, name: 'H', role: 'postgres', script: gateLines, hold: true});
    run.statements.H = gateLines.join(' ');
    await engine.waitReady(sessions.H);
    step('gate holds ' + spec.gate.key);

    const first = launch(spec.first);
    run.edges.push(await engine.awaitBlocked(first, sessions.H));
    step(`${spec.first.name} is blocked behind the gate`);

    let second = null;
    if (spec.second) {
      second = launch(spec.second);
      if (spec.secondBlockedBy === 'free') {
        await engine.awaitExit([second]);
        run.edges.push({waiter: spec.second.name, blockedBy: [], note: 'NOT_BLOCKED_ANSWERED_WHILE_THE_GATE_WAS_HELD'});
        step(`${spec.second.name} answered while the gate was still held`);
      } else {
        const holder = spec.secondBlockedBy === 'gate' ? sessions.H : first;
        run.edges.push(await engine.awaitBlocked(second, holder));
        step(`${spec.second.name} is blocked behind ${spec.secondBlockedBy === 'gate' ? 'the gate' : spec.first.name}`);
      }
    }
    run.snapshot = (await engine.observe()).map(entry => ({name: entry.name, waitEvent: entry.wait_event, blockedBy: entry.blocked_by_names, waitingOn: entry.waiting_on ?? [], query: entry.query_head ?? null}));

    engine.release(sessions.H, spec.release ?? 'commit');
    step('gate released (' + (spec.release ?? 'commit') + ')');
    if (spec.expect.class === 'DEADLOCK' && second) {
      run.cycle = await engine.awaitCycle(first, second);
      step('cycle ' + (run.cycle.observed ? 'observed' : 'not observed by polling'));
    }
    await engine.awaitExit(Object.values(sessions));
    run.pids = Object.fromEntries(Object.entries(sessions).map(([name, session]) => [name, session.pid]));
    for (const [name, session] of Object.entries(sessions)) run.outcomes[name] = parseSession(session.result);
    const family = spec.fixture.family;
    run.final = JSON.parse(String(await query(family === 'task' ? taskStateSql(ctx) : agreementStateSql(ctx))).trim());
    step('final state read');
  } catch (error) {
    run.error = String(error && error.message ? error.message : error).slice(0, 600);
    step('ERROR ' + run.error);
    for (const [name, session] of Object.entries(sessions)) if (session.exited && !run.outcomes[name]) run.outcomes[name] = parseSession(session.result);
  } finally {
    await engine.closeAll();
    if (spec.cleanup) {
      try { await query(CLEANUPS[spec.cleanup](ctx)); } catch (error) { run.cleanupError = String(error && error.message ? error.message : error).slice(0, 300); }
    }
  }
  run.durationMs = now() - t0;
  return run;
}

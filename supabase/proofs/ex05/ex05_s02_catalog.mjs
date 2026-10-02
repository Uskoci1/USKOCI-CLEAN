// EX-05 S02: the catalog of interleavings, the verdict function and the report admission. ASCII only, LF only.
// Every interleaving is DATA: which lock a gate session holds, which two callers are parked behind it and in which queue order, what the
// pre-registered outcome is (derived from the live DEV bodies read on 2026-10-02, never from the run), and which final state is the single
// documented one. The proof can FAIL: a deadlock the pre-registration did not name, a SQLSTATE 40001, an outcome that is not the registered
// one, a wait that was not observed, a negative control that does not deadlock - each one is a problem line and a red run.
import {KINDS, errorKey} from './ex05_s02_sql.mjs';

export const UNIT = 'EX05_S02_RC02_MEDIA_CANCEL_LOCK_ORDER';
export const LABEL = 'EX-05 S02 / RC-02: lock-order proof on a DISPOSABLE CHAIN (source147 ... Voice B1 application), NOT DEV, NOT a device, NOT native acceptance. '
  + 'It shows what concurrent database sessions do on the chain function bodies that were compared (md5) with the DEV bodies read read-only on 2026-10-02. '
  + 'It applies nothing to DEV and changes no production function body; the scratch copies of the controls live in a schema the proof drops.';
export const NOT_PROVED = Object.freeze([
  'Behaviour on canonical DEV or any hosted project: only the disposable chain ran; DEV bodies are pinned by md5, DEV was never written.',
  'Behaviour over HTTP/PostgREST under load: the interleavings use direct database sessions with the role and JWT claims a request would set; the PT409 contract checks use real PostgREST.',
  'The closure erasure worker (relational redaction, Storage deletes) against an in-flight media cancel: only the closure key and the prepare step are interleaved.',
  'Storage objects, the Edge media function and the client: no Storage call, no Edge call, no device.',
  'Frequency in the field: a reproduced deadlock shows the cycle EXISTS and what the callers receive, not how often two devices hit it.',
  'A fix: no candidate is written or applied; the ordered scratch copy is a diagnostic control, not a proposal that has been reviewed.',
]);
export const FINDING_TEXT = Object.freeze({
  'RC02-F1': 'public.rpc_cancel_media_upload on a READY task photo locks the asset row first and the conversation row second (through rpc_remove_task_photo); rpc_remove_task_photo locks the conversation row first and the asset row second.',
  'RC02-F2': 'The same inversion against rpc_complete_media_upload_service retried for a READY asset (conversation row first, asset row second).',
});

const VICTIM_MS = 6000;
const OTHER_MS = 20000;
const REMOVED = Object.freeze({rows: 1, state: 'READY', selected: false, inRefs: false});
const STILL_IN_DRAFT = Object.freeze({rows: 1, state: 'READY', selected: true, inRefs: true});
const PREPARED = Object.freeze({$oneOf: ['NOT_READY', 'BLOCKED']});

const task = (id, fields) => ({group: 'TASK', kind: 'task', fixture: {family: 'task', upload: 'READY'}, release: 'commit', ...fields, id});
const agreement = (kind, id, fields) => ({group: 'AGREEMENT_' + kind.toUpperCase(), kind, fixture: {family: 'agreement', upload: 'READY'}, release: 'commit', ...fields, id: id + '_' + kind.toUpperCase()});

export function taskScenarios() {
  const cancel = extra => ({name: 'CANCEL', stmt: 'taskCancel', ...extra});
  return [
    task('T1A_CANCEL_READY_VS_REMOVE_REMOVE_FIRST_VICTIM_REMOVE', {
      title: 'Cancel of a READY task photo against a concurrent removal of the same photo; the removal queued first on the conversation row and is the deadlock victim',
      gate: {key: 'conversationRow'}, first: {name: 'REMOVE', stmt: 'taskRemove', deadlockMs: VICTIM_MS}, second: cancel({deadlockMs: OTHER_MS}), secondBlockedBy: 'first',
      finding: 'RC02-F1',
      expect: {class: 'DEADLOCK', victim: 'REMOVE', results: {CANCEL: {cancelled: true, previousState: 'READY', selected: false}}, final: REMOVED},
    }),
    task('T1B_CANCEL_READY_VS_REMOVE_REMOVE_FIRST_VICTIM_CANCEL', {
      title: 'The same cycle with the other victim: the cancel is aborted and the removal completes',
      gate: {key: 'conversationRow'}, first: {name: 'REMOVE', stmt: 'taskRemove', deadlockMs: OTHER_MS}, second: cancel({deadlockMs: VICTIM_MS}), secondBlockedBy: 'first',
      finding: 'RC02-F1',
      expect: {class: 'DEADLOCK', victim: 'CANCEL', results: {REMOVE: {ready: true, photos: []}}, final: REMOVED},
    }),
    task('T2A_CANCEL_READY_VS_COMPLETE_RETRY_COMPLETE_FIRST_VICTIM_COMPLETE', {
      title: 'Cancel of a READY task photo against a service retry of the completion of the same READY asset (conversation row, then asset row); the completion is the victim',
      gate: {key: 'conversationRow'}, first: {name: 'COMPLETE', stmt: 'taskComplete', deadlockMs: VICTIM_MS}, second: cancel({deadlockMs: OTHER_MS}), secondBlockedBy: 'first',
      finding: 'RC02-F2',
      expect: {class: 'DEADLOCK', victim: 'COMPLETE', results: {CANCEL: {cancelled: true, previousState: 'READY', selected: false}}, final: REMOVED},
    }),
    task('T2B_CANCEL_READY_VS_COMPLETE_RETRY_COMPLETE_FIRST_VICTIM_CANCEL', {
      title: 'The same cycle with the cancel as the victim: the completion retry returns the unchanged READY asset and the photo stays in the draft',
      gate: {key: 'conversationRow'}, first: {name: 'COMPLETE', stmt: 'taskComplete', deadlockMs: OTHER_MS}, second: cancel({deadlockMs: VICTIM_MS}), secondBlockedBy: 'first',
      finding: 'RC02-F2',
      expect: {class: 'DEADLOCK', victim: 'CANCEL', results: {COMPLETE: {state: 'READY', selected: true}}, final: STILL_IN_DRAFT},
    }),
    task('T3_CANCEL_FIRST_THEN_REMOVE_SERIALIZED', {
      title: 'Cancel queued first on the conversation row, removal behind it: no cycle, both succeed, one documented final state',
      gate: {key: 'conversationRow'}, first: cancel({}), second: {name: 'REMOVE', stmt: 'taskRemove'}, secondBlockedBy: 'first',
      expect: {class: 'SERIALIZED', results: {CANCEL: {previousState: 'READY'}, REMOVE: {ready: true, photos: []}}, final: REMOVED},
    }),
    task('T4_CANCEL_FIRST_THEN_COMPLETE_RETRY_SERIALIZED', {
      title: 'Cancel queued first, completion retry behind it: the retry sees the cancelled photo and returns it unselected',
      gate: {key: 'conversationRow'}, first: cancel({}), second: {name: 'COMPLETE', stmt: 'taskComplete'}, secondBlockedBy: 'first',
      expect: {class: 'SERIALIZED', results: {CANCEL: {previousState: 'READY'}, COMPLETE: {state: 'READY', selected: false}}, final: REMOVED},
    }),
    task('T5_SECOND_CANCEL_OF_A_READY_PHOTO_SERIALIZED_BY_THE_COMMAND_LOCK', {
      title: 'Two devices cancel the same READY photo: the second waits on the per-command advisory lock (taken before any row), then repeats the idempotent removal',
      gate: {key: 'conversationRow'}, first: cancel({}), second: {name: 'CANCEL2', stmt: 'taskCancel'}, secondBlockedBy: 'first',
      expect: {class: 'SERIALIZED', results: {CANCEL: {previousState: 'READY'}, CANCEL2: {previousState: 'READY', selected: false}}, final: REMOVED},
    }),
    task('T6_TWO_CANCELS_OF_AN_ABSENT_COMMAND_ONE_TOMBSTONE', {
      title: 'Two cancels of a command that never reached the server race for the tombstone: the command lock serializes them, exactly one row results',
      fixture: {family: 'task', upload: 'ABSENT'}, gate: {key: 'taskAdvisory'}, first: cancel({}), second: {name: 'CANCEL2', stmt: 'taskCancel'}, secondBlockedBy: 'gate',
      expect: {class: 'SERIALIZED', results: {CANCEL: {cancelled: true, previousState: null}, CANCEL2: {cancelled: true, previousState: null}}, final: {rows: 1, state: 'CANCELLED', tombstone: true}},
    }),
    task('T7A_CLAIM_THEN_CANCEL_OF_AN_ABSENT_COMMAND', {
      title: 'The delayed first send (claim) and the owner cancel of the same absent command: claim first, then the cancel deselects the admitted upload',
      fixture: {family: 'task', upload: 'ABSENT'}, gate: {key: 'taskAdvisory'}, first: {name: 'CLAIM', stmt: 'taskClaim'}, second: cancel({}), secondBlockedBy: 'gate',
      expect: {class: 'SERIALIZED', results: {CLAIM: {acquired: true}, CANCEL: {previousState: 'PROCESSING', selected: false}}, final: {rows: 1, state: 'PROCESSING', selected: false, tombstone: false}},
    }),
    task('T7B_CANCEL_THEN_CLAIM_OF_AN_ABSENT_COMMAND', {
      title: 'Cancel first: the tombstone is written and the delayed claim is refused with MEDIA_COMMAND_CANCELLED (55000), never 40001',
      fixture: {family: 'task', upload: 'ABSENT'}, gate: {key: 'taskAdvisory'}, first: cancel({}), second: {name: 'CLAIM', stmt: 'taskClaim'}, secondBlockedBy: 'gate',
      expect: {class: 'SERIALIZED', errors: {CLAIM: ['55000:MEDIA_COMMAND_CANCELLED']}, final: {rows: 1, state: 'CANCELLED', tombstone: true}},
    }),
    task('T8A_SETTLE_THEN_CANCEL_OF_A_DISPATCHING_UPLOAD', {
      title: 'Dispatch settlement and cancel of a DISPATCHING upload on one asset row: settle first, then the cancel deselects; no lost update of selected',
      fixture: {family: 'task', upload: 'DISPATCHING'}, gate: {key: 'assetRow'}, first: {name: 'SETTLE', stmt: 'taskSettle'}, second: cancel({}), secondBlockedBy: 'first',
      expect: {class: 'SERIALIZED', results: {SETTLE: true, CANCEL: {previousState: 'STAGED', selected: false}}, final: {rows: 1, state: 'STAGED', selected: false, dispatch: 'SETTLED/STORED'}},
    }),
    task('T8B_CANCEL_THEN_SETTLE_OF_A_DISPATCHING_UPLOAD', {
      title: 'Cancel first, then the settlement: the settlement keeps selected=false (its update reads the locked row, not a stale copy)',
      fixture: {family: 'task', upload: 'DISPATCHING'}, gate: {key: 'assetRow'}, first: cancel({}), second: {name: 'SETTLE', stmt: 'taskSettle'}, secondBlockedBy: 'first',
      expect: {class: 'SERIALIZED', results: {SETTLE: true, CANCEL: {previousState: 'STAGED', selected: false}}, final: {rows: 1, state: 'STAGED', selected: false, dispatch: 'SETTLED/STORED'}},
    }),
    task('T9_CANCEL_OF_A_NOT_READY_UPLOAD_DOES_NOT_WAIT_FOR_THE_CONVERSATION', {
      title: 'The inversion needs a READY photo: the cancel of a STAGED upload takes no conversation lock and answers while a completion is parked on the conversation row',
      fixture: {family: 'task', upload: 'SETTLED'}, gate: {key: 'conversationRow'}, first: {name: 'COMPLETE', stmt: 'taskComplete'}, second: cancel({}), secondBlockedBy: 'free',
      expect: {class: 'SERIALIZED', results: {CANCEL: {previousState: 'STAGED', selected: false}, COMPLETE: {state: 'READY', selected: false}}, final: {rows: 1, state: 'READY', selected: false, inRefs: false}},
    }),
    task('PC1_ORDERED_COPY_OF_CANCEL_VS_REMOVE_NO_DEADLOCK', {
      title: 'POSITIVE CONTROL (scratch copy, not a candidate): the cancel takes the conversation row first, the order of its siblings; the T1 interleaving no longer deadlocks',
      gate: {key: 'conversationRow'}, first: {name: 'REMOVE', stmt: 'taskRemove', deadlockMs: VICTIM_MS}, second: {name: 'CANCELCF', stmt: 'taskCancelConvFirst', deadlockMs: OTHER_MS}, secondBlockedBy: 'first',
      control: {type: 'POSITIVE', mutation: 'TASK_CANCEL_TAKES_THE_CONVERSATION_ROW_FIRST', sibling: 'T1A_CANCEL_READY_VS_REMOVE_REMOVE_FIRST_VICTIM_REMOVE', rename: {CANCELCF: 'CANCEL'}},
      expect: {class: 'SERIALIZED', results: {CANCELCF: {previousState: 'READY'}, REMOVE: {ready: true}}, final: REMOVED},
    }),
    task('CL1_CLOSURE_PREPARE_WAITS_FOR_A_PARKED_CANCEL', {
      title: 'Account closure of the media owner (prepare, exclusive closure key) waits for an in-flight cancel (shared closure key) and then proceeds: no cycle',
      fresh: 'owner', gate: {key: 'conversationRow'}, first: cancel({}), second: {name: 'PREPARE', stmt: 'prepareClosure'}, secondBlockedBy: 'first',
      expect: {class: 'SERIALIZED', results: {CANCEL: {previousState: 'READY'}}, final: {...REMOVED, closure: PREPARED}},
    }),
    task('CL2A_CANCEL_WAITS_FOR_THE_CLOSURE_KEY_THEN_PROCEEDS', {
      title: 'A cancel arriving while the closure key is held exclusively waits at its very first lock and proceeds after the holder rolls back',
      fresh: 'owner', gate: {key: 'closureKey'}, first: cancel({}), release: 'rollback',
      expect: {class: 'SERIALIZED', results: {CANCEL: {previousState: 'READY'}}, final: {...REMOVED, closure: null}},
    }),
    task('CL2B_CANCEL_REFUSED_ACCOUNT_CLOSING_AFTER_THE_KEY', {
      title: 'The same wait, but the holder commits a READY closure request: the cancel is refused with ACCOUNT_CLOSING (42501), nothing changed',
      fresh: 'owner', gate: {key: 'closureKeyRestrict'}, first: cancel({}), cleanup: 'closureRequest',
      expect: {class: 'SERIALIZED', errors: {CANCEL: ['42501:ACCOUNT_CLOSING']}, final: {...STILL_IN_DRAFT, closure: 'READY'}},
    }),
  ];
}

export function agreementScenarios(kind) {
  if (!KINDS[kind]) throw new Error('BAD_KIND');
  const cancel = extra => ({name: 'CANCEL', stmt: 'agrCancel', ...extra});
  const send = extra => ({name: 'SEND', stmt: 'agrSend', ...extra});
  const A = (id, fields) => agreement(kind, id, fields);
  const receipt = state => ({receipt: {state}});
  return [
    A('A1_SEND_FIRST_THEN_CANCEL', {
      title: 'The message send holds the per-account advisory lock and waits for the agreement row; the cancel arrives behind it: the send wins, the cancel is a no-op on the attached upload',
      gate: {key: 'agreementRow'}, first: send({}), second: cancel({}), secondBlockedBy: 'first',
      expect: {class: 'SERIALIZED', results: {CANCEL: receipt('READY')}, final: {rows: 1, state: 'READY', attached: true, cancelled: false, messages: 1}},
    }),
    A('A2_CANCEL_FIRST_THEN_SEND', {
      title: 'The cancel holds the per-account advisory lock and waits for the upload row; the send arrives behind it: the cancel wins and the send is refused MEDIA_NOT_EDITABLE (42501)',
      gate: {key: 'uploadRow'}, first: cancel({}), second: send({}), secondBlockedBy: 'first',
      expect: {class: 'SERIALIZED', results: {CANCEL: receipt('CANCELLED')}, errors: {SEND: ['42501:MEDIA_NOT_EDITABLE']}, final: {rows: 1, state: 'CANCELLED', attached: false, cancelled: true, messages: 0}},
    }),
    A('A3A_SETTLE_FIRST_THEN_CANCEL', {
      title: 'Dispatch settlement then cancel of a DISPATCHING upload: settled READY, then cancelled; one final state',
      fixture: {family: 'agreement', upload: 'DISPATCHING'}, gate: {key: 'uploadRow'}, first: {name: 'SETTLE', stmt: 'agrSettle'}, second: cancel({}), secondBlockedBy: 'first',
      expect: {class: 'SERIALIZED', results: {SETTLE: receipt('READY'), CANCEL: receipt('CANCELLED')}, final: {rows: 1, state: 'CANCELLED', dispatch: 'SETTLED/STORED', messages: 0}},
    }),
    A('A3B_CANCEL_FIRST_THEN_SETTLE', {
      title: 'Cancel then settlement: the settlement records the dispatch outcome and the upload stays CANCELLED, the same final state',
      fixture: {family: 'agreement', upload: 'DISPATCHING'}, gate: {key: 'uploadRow'}, first: cancel({}), second: {name: 'SETTLE', stmt: 'agrSettle'}, secondBlockedBy: 'first',
      expect: {class: 'SERIALIZED', results: {CANCEL: receipt('CANCELLED'), SETTLE: receipt('CANCELLED')}, final: {rows: 1, state: 'CANCELLED', dispatch: 'SETTLED/STORED', messages: 0}},
    }),
    A('A4_SECOND_CANCEL', {
      title: 'Two cancels of the same upload from two devices: the second waits on the per-account advisory lock and repeats the idempotent cancellation',
      gate: {key: 'uploadRow'}, first: cancel({}), second: {name: 'CANCEL2', stmt: 'agrCancel'}, secondBlockedBy: 'first',
      expect: {class: 'SERIALIZED', results: {CANCEL: receipt('CANCELLED'), CANCEL2: receipt('CANCELLED')}, final: {rows: 1, state: 'CANCELLED', cancelled: true, messages: 0}},
    }),
    A('A5A_CLAIM_THEN_CANCEL_OF_AN_ABSENT_COMMAND', {
      title: 'Claim and cancel of an absent command behind the per-account advisory lock: claim first (PROCESSING), then the cancel retires it',
      fixture: {family: 'agreement', upload: 'ABSENT'}, gate: {key: 'agreementAdvisory'}, first: {name: 'CLAIM', stmt: 'agrClaim'}, second: cancel({}), secondBlockedBy: 'gate',
      expect: {class: 'SERIALIZED', results: {CLAIM: {acquired: true}, CANCEL: receipt('CANCELLED')}, final: {rows: 1, state: 'CANCELLED'}},
    }),
    A('A5B_CANCEL_THEN_CLAIM_OF_AN_ABSENT_COMMAND', {
      title: 'Cancel first (tombstone), then the delayed claim: it is answered with the CANCELLED receipt, not acquired, no error',
      fixture: {family: 'agreement', upload: 'ABSENT'}, gate: {key: 'agreementAdvisory'}, first: cancel({}), second: {name: 'CLAIM', stmt: 'agrClaim'}, secondBlockedBy: 'gate',
      expect: {class: 'SERIALIZED', results: {CANCEL: receipt('CANCELLED'), CLAIM: {acquired: false, receipt: {state: 'CANCELLED'}}}, final: {rows: 1, state: 'CANCELLED'}},
    }),
    A('NC_A_INVERTED_CANCEL_VS_SEND', {
      title: 'NEGATIVE CONTROL (scratch copy): the upload service takes the upload row BEFORE the per-account advisory lock; the A1 interleaving must now deadlock, so a wrong order turns the run red',
      gate: {key: 'agreementRow'}, first: send({deadlockMs: VICTIM_MS}), second: {name: 'CANCELINV', stmt: 'agrCancelInverted', deadlockMs: OTHER_MS}, secondBlockedBy: 'first',
      control: {type: 'NEGATIVE', mutation: 'AGREEMENT_UPLOAD_SERVICE_TAKES_THE_UPLOAD_ROW_BEFORE_THE_ADVISORY_LOCK', sibling: 'A1_SEND_FIRST_THEN_CANCEL_' + kind.toUpperCase(), rename: {CANCELINV: 'CANCEL'}},
      expect: {class: 'DEADLOCK', victim: 'SEND', results: {CANCELINV: receipt('CANCELLED')}, final: {rows: 1, state: 'CANCELLED', attached: false, cancelled: true, messages: 0}},
    }),
    A('CL3_CLOSURE_PREPARE_WAITS_FOR_A_PARKED_SEND', {
      title: 'Account closure of the media owner (prepare) waits for an in-flight message send (shared closure keys of both parties) and then proceeds: no cycle',
      gate: {key: 'agreementRow'}, first: send({}), second: {name: 'PREPARE', stmt: 'prepareClosure'}, secondBlockedBy: 'first',
      expect: {class: 'SERIALIZED', final: {rows: 1, state: 'READY', attached: true, messages: 1, closure: PREPARED}},
    }),
  ];
}

export function buildCatalog({kinds = ['photo', 'voice']} = {}) {
  return [...taskScenarios(), ...kinds.flatMap(agreementScenarios)];
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Matching and the verdict.
// ---------------------------------------------------------------------------------------------------------------------------------
/** Partial structural match; returns the list of mismatches. {$oneOf:[...]} accepts any listed value. Arrays and scalars are compared exactly. */
export function matchPartial(actual, expected, path = '') {
  const here = path || '$';
  if (expected && typeof expected === 'object' && !Array.isArray(expected) && Object.keys(expected).length === 1 && Array.isArray(expected.$oneOf)) {
    return expected.$oneOf.some(value => value === actual || JSON.stringify(value) === JSON.stringify(actual)) ? [] : [`${here}: ${JSON.stringify(actual)} is none of ${JSON.stringify(expected.$oneOf)}`];
  }
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return [`${here}: expected an object, got ${JSON.stringify(actual)}`];
    return Object.entries(expected).flatMap(([key, value]) => matchPartial(actual[key], value, `${path}${path ? '.' : ''}${key}`));
  }
  return JSON.stringify(actual ?? null) === JSON.stringify(expected ?? null) ? [] : [`${here}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual ?? null)}`];
}

const firstResult = outcome => {
  const values = Object.values(outcome?.results ?? {});
  return values.length ? values[0] : undefined;
};

/** The verdict of one interleaving: every deviation from the pre-registered outcome is a problem line. */
export function judge(spec, run) {
  const problems = [];
  const expect = spec.expect;
  if (run.error) problems.push('SCENARIO_ERROR:' + run.error);
  if (run.cleanupError) problems.push('CLEANUP_ERROR:' + run.cleanupError);
  const gate = run.outcomes?.H;
  if (!gate || !gate.ok) problems.push('GATE_SESSION_FAILED:' + (gate ? `${gate.sqlstate}:${gate.message}` : 'no outcome'));
  const names = Object.keys(run.outcomes ?? {}).filter(name => name !== 'H');
  const expectedNames = [spec.first.name, ...(spec.second ? [spec.second.name] : [])];
  for (const name of expectedNames) if (!names.includes(name)) problems.push('NO_OUTCOME:' + name);
  const failed = names.filter(name => !run.outcomes[name].ok);
  const deadlocked = names.filter(name => run.outcomes[name].sqlstate === '40P01');
  const serialization = names.filter(name => run.outcomes[name].sqlstate === '40001');
  const timedOut = names.filter(name => run.outcomes[name].sqlstate === '57014');
  if (serialization.length) problems.push('SQLSTATE_40001_OBSERVED:' + serialization.join(','));
  if (timedOut.length) problems.push('STATEMENT_TIMEOUT:' + timedOut.join(','));

  const allowed = expect.errors ?? {};
  const unexpectedErrors = failed.filter(name => !deadlocked.includes(name) && !(allowed[name] ?? []).includes(errorKey(run.outcomes[name])));
  let observedClass;
  if (deadlocked.length) observedClass = 'DEADLOCK';
  else if (unexpectedErrors.length) observedClass = 'ERROR';
  else observedClass = 'SERIALIZED';
  for (const name of unexpectedErrors) if (!timedOut.includes(name) && !serialization.includes(name)) problems.push(`UNEXPECTED_ERROR:${name}:${errorKey(run.outcomes[name])}`);
  for (const [name, keys] of Object.entries(allowed)) {
    if (names.includes(name) && run.outcomes[name].ok) problems.push(`EXPECTED_ERROR_MISSING:${name}:${keys.join('|')}`);
  }
  if (observedClass !== expect.class) problems.push(`CLASS_MISMATCH:expected ${expect.class}, observed ${observedClass}`);

  let victim = null;
  if (expect.class === 'DEADLOCK') {
    if (deadlocked.length !== 1) problems.push(`EXPECTED_EXACTLY_ONE_VICTIM:observed ${deadlocked.length}`);
    victim = deadlocked[0] ?? null;
    const survivors = names.filter(name => !deadlocked.includes(name));
    for (const name of survivors) if (!run.outcomes[name].ok) problems.push('SURVIVOR_FAILED:' + name);
    if (victim) {
      const edges = run.outcomes[victim].edges ?? [];
      if (edges.length !== 2) problems.push('DEADLOCK_DETAIL_WITHOUT_TWO_EDGES');
      else if (!(edges[0].waiterPid === edges[1].holderPid && edges[1].waiterPid === edges[0].holderPid)) problems.push('DEADLOCK_EDGES_ARE_NOT_A_TWO_PROCESS_CYCLE');
      else if (run.pids && spec.second && run.pids[spec.first.name] && run.pids[spec.second.name]
        && [edges[0].waiterPid, edges[0].holderPid].sort().join() !== [run.pids[spec.first.name], run.pids[spec.second.name]].sort().join()) problems.push('DEADLOCK_CYCLE_IS_NOT_BETWEEN_THE_TWO_CALLERS');
    }
    if (run.deadlockSettable && expect.victim && victim && victim !== expect.victim) problems.push(`WRONG_VICTIM:expected ${expect.victim}, observed ${victim}`);
  } else if (deadlocked.length) {
    victim = deadlocked[0];
    problems.push('UNEXPECTED_DEADLOCK:' + deadlocked.join(','));
  }

  for (const [name, partial] of Object.entries(expect.results ?? {})) {
    const outcome = run.outcomes?.[name];
    if (!outcome || !outcome.ok) continue;
    for (const mismatch of matchPartial(firstResult(outcome), partial, 'result.' + name)) problems.push('RESULT_MISMATCH:' + mismatch);
  }
  if (run.final) for (const mismatch of matchPartial(run.final, expect.final, 'final')) problems.push('FINAL_STATE_MISMATCH:' + mismatch);
  else if (!run.error) problems.push('FINAL_STATE_NOT_READ');

  const wantEdges = (spec.second ? 2 : 1);
  if ((run.edges ?? []).length < wantEdges) problems.push(`WAITS_NOT_OBSERVED:${(run.edges ?? []).length} of ${wantEdges}`);
  if (spec.secondBlockedBy !== 'free') {
    for (const edge of run.edges ?? []) if (edge.note !== undefined || !(edge.blockedBy?.length)) problems.push('EDGE_WITHOUT_A_HOLDER:' + edge.waiter);
  }

  return {id: spec.id, observedClass, victim, expectedClass: expect.class, verdict: problems.length ? 'UNEXPECTED' : 'AS_EXPECTED', problems,
    errors: Object.fromEntries(failed.map(name => [name, errorKey(run.outcomes[name])]))};
}

/** The findings, derived from the verdicts of the pre-registered scenarios. */
export function buildFindings(catalog, verdicts) {
  const byId = new Map(verdicts.map(v => [v.id, v]));
  const findings = [];
  for (const id of ['RC02-F1', 'RC02-F2']) {
    const specs = catalog.filter(spec => spec.finding === id);
    const seen = specs.map(spec => byId.get(spec.id)).filter(Boolean);
    const reproduced = specs.length > 0 && seen.length === specs.length && seen.every(v => v.observedClass === 'DEADLOCK');
    const notReproduced = seen.some(v => v.observedClass === 'SERIALIZED');
    findings.push({id, status: specs.length === 0 ? 'NOT_RUN' : (reproduced ? 'REPRODUCED' : (notReproduced ? 'NOT_REPRODUCED' : 'INCONCLUSIVE')), text: FINDING_TEXT[id], scenarios: specs.map(spec => spec.id),
      verdicts: seen.map(v => ({id: v.id, observed: v.observedClass, victim: v.victim, verdict: v.verdict}))});
  }
  const agreement = catalog.filter(spec => spec.group.startsWith('AGREEMENT') && !spec.control && !spec.id.startsWith('CL3'));
  const seen = agreement.map(spec => byId.get(spec.id)).filter(Boolean);
  findings.push({id: 'AGREEMENT-PATH', status: agreement.length === 0 ? 'NOT_RUN' : (seen.length === agreement.length && seen.every(v => v.observedClass === 'SERIALIZED' && v.verdict === 'AS_EXPECTED') ? 'NO_INVERSION_OBSERVED' : 'SEE_VERDICTS'),
    text: 'Agreement photo and voice upload cancel/settle/claim against send: every operation takes the per-account advisory lock before any row.', scenarios: agreement.map(spec => spec.id)});
  return findings;
}

/** The run of a control, with its scratch-copy session renamed to the session of the real function, so it can be judged by the registration of its real sibling. */
export function renameRun(run, rename) {
  const name = value => rename[value] ?? value;
  const mapKeys = object => Object.fromEntries(Object.entries(object ?? {}).map(([key, value]) => [name(key), value]));
  return {...run, outcomes: mapKeys(run.outcomes), statements: mapKeys(run.statements), pids: run.pids ? mapKeys(run.pids) : run.pids,
    edges: (run.edges ?? []).map(edge => ({...edge, waiter: name(edge.waiter), blockedBy: (edge.blockedBy ?? []).map(name)}))};
}

/**
 * Controls: a negative control must deadlock (the harness can see a wrong order), a positive control must not (the order is the cause).
 * With the raw runs it is also judged by the registration of its REAL sibling (the scratch copy replaced by the real function): it must be red there,
 * i.e. the injected change flips the outcome the real function is registered to have. Without the runs only the class is checked.
 */
export function controlsSummary(catalog, verdicts, runs = null) {
  const byId = new Map(verdicts.map(v => [v.id, v]));
  return catalog.filter(spec => spec.control).map(spec => {
    const v = byId.get(spec.id);
    const detected = spec.control.type === 'NEGATIVE' ? v?.observedClass === 'DEADLOCK' : v?.observedClass === 'SERIALIZED';
    let flips = null;
    const run = runs?.get(spec.id);
    const sibling = catalog.find(candidate => candidate.id === spec.control.sibling);
    if (run && sibling) {
      const siblingVerdict = judge(sibling, renameRun(run, spec.control.rename ?? {}));
      flips = siblingVerdict.verdict === 'UNEXPECTED' && siblingVerdict.problems.some(problem => problem.startsWith('CLASS_MISMATCH'));
    }
    return {id: spec.id, type: spec.control.type, mutation: spec.control.mutation, sibling: spec.control.sibling ?? null, expected: spec.expect.class, observed: v?.observedClass ?? 'NOT_RUN',
      redUnderTheRealSiblingRegistration: flips, detected: Boolean(detected && v?.verdict === 'AS_EXPECTED' && flips !== false)};
  });
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Static validation of the catalog (offline tests) and the admission of a finished report.
// ---------------------------------------------------------------------------------------------------------------------------------
export function validateCatalog(catalog, {statements, gates}) {
  const problems = [];
  const ids = new Set();
  for (const spec of catalog) {
    if (ids.has(spec.id)) problems.push('DUPLICATE_ID:' + spec.id);
    ids.add(spec.id);
    if (!/^[A-Z0-9_]{8,120}$/.test(spec.id)) problems.push('BAD_ID:' + spec.id);
    if (!spec.title || spec.title.length < 40) problems.push('TITLE_TOO_SHORT:' + spec.id);
    if (!gates[spec.gate?.key]) problems.push('UNKNOWN_GATE:' + spec.id);
    const parts = [spec.first, ...(spec.second ? [spec.second] : [])];
    for (const part of parts) {
      if (!statements[part.stmt]) problems.push('UNKNOWN_STATEMENT:' + spec.id + ':' + part.stmt);
      if (!/^[A-Za-z0-9_-]{1,24}$/.test(part.name) || part.name === 'H') problems.push('BAD_SESSION_NAME:' + spec.id + ':' + part.name);
    }
    if (spec.second && spec.second.name === spec.first.name) problems.push('SAME_SESSION_NAME:' + spec.id);
    if (spec.second && !['first', 'gate', 'free'].includes(spec.secondBlockedBy)) problems.push('BAD_SECOND_BLOCKED_BY:' + spec.id);
    if (!spec.second && spec.secondBlockedBy) problems.push('SECOND_BLOCKED_BY_WITHOUT_SECOND:' + spec.id);
    if (!['commit', 'rollback'].includes(spec.release)) problems.push('BAD_RELEASE:' + spec.id);
    if (!['DEADLOCK', 'SERIALIZED'].includes(spec.expect?.class)) problems.push('BAD_EXPECTED_CLASS:' + spec.id);
    if (!spec.expect?.final) problems.push('NO_FINAL_STATE_EXPECTATION:' + spec.id);
    if (spec.expect?.class === 'DEADLOCK') {
      if (!spec.second || spec.secondBlockedBy !== 'first') problems.push('DEADLOCK_NEEDS_TWO_QUEUED_CALLERS:' + spec.id);
      if (!parts.some(part => part.name === spec.expect.victim)) problems.push('VICTIM_IS_NOT_A_SESSION:' + spec.id);
      const victim = parts.find(part => part.name === spec.expect.victim);
      const other = parts.find(part => part.name !== spec.expect.victim);
      if (victim && other && !(victim.deadlockMs && other.deadlockMs && victim.deadlockMs < other.deadlockMs)) problems.push('VICTIM_MUST_HAVE_THE_SHORTER_DEADLOCK_TIMEOUT:' + spec.id);
      if (!spec.finding && !spec.control) problems.push('DEADLOCK_WITHOUT_FINDING_OR_CONTROL:' + spec.id);
    }
    if (spec.expect?.class === 'SERIALIZED' && parts.some(part => part.deadlockMs && part.deadlockMs < OTHER_MS && !spec.control)) {
      problems.push('SERIALIZED_SCENARIO_SETS_A_VICTIM_TIMEOUT:' + spec.id);
    }
    if (spec.finding && spec.expect?.class !== 'DEADLOCK') problems.push('FINDING_WITHOUT_DEADLOCK:' + spec.id);
    if (spec.control && !['NEGATIVE', 'POSITIVE'].includes(spec.control.type)) problems.push('BAD_CONTROL_TYPE:' + spec.id);
    if (spec.control?.type === 'NEGATIVE' && spec.expect.class !== 'DEADLOCK') problems.push('NEGATIVE_CONTROL_MUST_DEADLOCK:' + spec.id);
    if (spec.control?.type === 'POSITIVE' && spec.expect.class !== 'SERIALIZED') problems.push('POSITIVE_CONTROL_MUST_NOT_DEADLOCK:' + spec.id);
    if (spec.fixture.family === 'task' && spec.kind !== 'task') problems.push('FIXTURE_KIND_MISMATCH:' + spec.id);
  }
  return problems;
}

/** Throws a list of problems when the report is not a complete, conclusive result of the proof. Mirrors what the CI summary shows. */
export function admitReport(report, {catalog, sourceSha, filter = []} = {}) {
  const problems = [];
  const need = (condition, text) => { if (!condition) problems.push(text); };
  need(report?.unit === UNIT, 'UNIT');
  need(typeof report?.label === 'string' && report.label.startsWith('EX-05 S02 / RC-02: lock-order proof on a DISPOSABLE CHAIN') && report.label.includes('NOT DEV'), 'LABEL');
  need(!sourceSha || report?.sourceSha === sourceSha, 'SOURCE_SHA');
  need(report?.result === 'PASS', 'RESULT_NOT_PASS');
  need(Array.isArray(report?.failures) && report.failures.length === 0, 'FAILURES_PRESENT');
  need(report?.devAccess === false && report?.providerCalls === 0 && report?.deviceProven === false, 'ACCESS_FLAGS');
  need(Array.isArray(report?.notProved) && report.notProved.length >= 5, 'NOT_PROVED_MISSING');
  need(report?.chainFidelity?.verdict === 'DEV_FAITHFUL', 'CHAIN_NOT_DEV_FAITHFUL');
  need(Array.isArray(report?.contract) && report.contract.length > 0 && report.contract.every(item => item.verdict === 'PASS' && item.observed?.code === 'PT409' && item.observed?.status === 409), 'PT409_CONTRACT');
  const wanted = (catalog ?? []).filter(spec => !filter.length || filter.includes(spec.id));
  const entries = new Map((report?.interleavings ?? []).map(item => [item.id, item]));
  for (const spec of wanted) {
    const entry = entries.get(spec.id);
    need(entry, 'MISSING_INTERLEAVING:' + spec.id);
    if (!entry) continue;
    need(entry.verdict === 'AS_EXPECTED', 'NOT_AS_EXPECTED:' + spec.id);
    need(entry.observedClass === spec.expect.class, 'CLASS:' + spec.id);
    need(Array.isArray(entry.edges) && entry.edges.length >= (spec.second ? 2 : 1), 'NO_OBSERVED_WAITS:' + spec.id);
    need(!Object.values(entry.errors ?? {}).some(key => String(key).startsWith('40001')), 'SQLSTATE_40001:' + spec.id);
    if (spec.expect.class === 'DEADLOCK') need(entry.deadlock?.edges?.length === 2, 'DEADLOCK_WITHOUT_EDGES:' + spec.id);
  }
  if (!filter.length) {
    need(Array.isArray(report?.controls) && report.controls.length === wanted.filter(spec => spec.control).length && report.controls.every(control => control.detected && control.redUnderTheRealSiblingRegistration === true), 'CONTROLS');
    need(report?.findings?.some(finding => finding.id === 'RC02-F1') && report.findings.some(finding => finding.id === 'AGREEMENT-PATH'), 'FINDINGS');
  }
  need((report?.scenarioErrors ?? []).length === 0, 'SCENARIO_ERRORS');
  if (problems.length) throw new Error('REPORT_NOT_ADMITTED:' + problems.join(' | '));
  return {interleavings: wanted.length, findings: (report.findings ?? []).map(finding => `${finding.id}:${finding.status}`)};
}

/** One line that says a report is NOT the full proof (a pin-gate-only run or a run filtered to some interleavings); null for a full run. */
export function partialNotice(report) {
  if (report?.pinGateOnly === true) return 'PARTIAL RUN (pin gate only): only the chain-fidelity phase ran; no interleaving, no control and no PT409 check ran, so this is NOT the proof.';
  const only = Array.isArray(report?.filter) ? report.filter : [];
  if (only.length) return `PARTIAL RUN (EX05_ONLY=${only.join(',')}): only these interleavings were required; the controls and the findings are not part of the admission of a filtered report, so this is NOT the full proof.`;
  return null;
}

/** The result as a reader sees it: a partial run never reads as a plain PASS. */
export const resultLabel = report => `${report?.result ?? 'UNKNOWN'}${partialNotice(report) === null ? '' : '_PARTIAL'}`;

export function renderMarkdown(report) {
  const lines = [];
  const partial = partialNotice(report);
  if (partial) {
    lines.push('**' + partial + '**');
    lines.push('');
  }
  lines.push('## ' + (report.label ?? 'EX-05 S02'));
  lines.push('');
  lines.push(`RESULT ${resultLabel(report)}. Source ${report.sourceSha ?? 'unknown'}. Chain ${report.chainFidelity?.verdict ?? 'unknown'} (${report.chainFidelity?.equal ?? '?'} of ${report.chainFidelity?.checked ?? '?'} pinned functions equal the DEV md5 after the B24 conversion of ${report.chainFidelity?.converted ?? '?'}).`);
  lines.push('');
  lines.push('### Findings (pre-registered; PASS means every outcome equals the registration, not that nothing was found)');
  for (const finding of report.findings ?? []) lines.push(`- ${finding.id}: ${finding.status}${finding.text ? ' - ' + finding.text : ''}`);
  lines.push('');
  lines.push('### Controls');
  for (const control of report.controls ?? []) lines.push(`- ${control.id} (${control.type}): expected ${control.expected}, observed ${control.observed}, ${control.detected ? 'detected' : 'NOT DETECTED'}; red under the registration of the real function (${control.sibling ?? '-'}): ${control.redUnderTheRealSiblingRegistration}`);
  lines.push('');
  lines.push('### Interleavings');
  lines.push('| id | expected | observed | victim | verdict |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const item of report.interleavings ?? []) lines.push(`| ${item.id} | ${item.expectedClass} | ${item.observedClass} | ${item.victim ?? '-'} | ${item.verdict}${item.problems?.length ? ' ' + item.problems.slice(0, 2).join('; ').slice(0, 160) : ''} |`);
  lines.push('');
  lines.push('### PT409 contract');
  for (const item of report.contract ?? []) lines.push(`- ${item.id}: ${item.verdict} (${item.observed?.status ?? '-'} ${item.observed?.code ?? '-'})`);
  if ((report.failures ?? []).length) {
    lines.push('');
    lines.push('### Failures');
    for (const failure of report.failures) lines.push('- ' + failure);
  }
  lines.push('');
  lines.push('### Not proved');
  for (const item of report.notProved ?? []) lines.push('- ' + item);
  return lines.join('\n') + '\n';
}

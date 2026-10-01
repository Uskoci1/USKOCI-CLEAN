// EX-06 S03/S04: the twelve function-body pins of the S01 DEV baseline (docs/.../ex06/EX06_S01_DEV_BEFORE_BASELINE_20261001.md, taken 2026-10-01 about 13:41Z
// on canonical DEV leqcwgzvjsxugfgzdmth) and the CHAIN-FIDELITY GATE that compares a disposable chain with them.
//
// What a pin is. md5 over prosrc with carriage returns removed (the convention of supabase/proofs/ex06/ex06_s01_baseline.readonly.sql), i.e. LF-normalised. A pin names ONE function
// body. The matcher and the wave also depend on helper functions, on private.marketplace_config rows, on triggers and on the writer RPCs the fixtures call; none of those is pinned.
// They are READ for information (dependencyQuery, configQuery) and recorded in the report so a later S01 can add them, and the label says so (evidenceLabel).
//
// A differing pin is a FINDING about the chain, never a failure of the harness: the gate only reports. The caller turns "any pin differs" into the evidence label 'FUNCTION BODIES != DEV'.
// Pure module: it takes a function that runs a SELECT and returns rows, so it is tested without a database (ex06_lib.test.mjs).

export const PIN_CONVENTION = "md5(replace(prosrc, E'\\r', '')): LF-normalised prosrc (S01 convention)";
export const PIN_SOURCE = 'EX06_S01_DEV_BEFORE_BASELINE_20261001.md (read-only, canonical DEV, ledger 219)';
export const LABEL_CAVEAT = 'helper functions, config rows and triggers not pinned';

// role: which part of the chain the function belongs to (a reader of a report sees at once whether a differing pin touches matching, dispatch, events or push).
// stage: where the pin is read. PROOF_POINT = right after stage 18 (the ex04d-proven source147 -> PKG-050 chain), where the corpus proof runs. AFTER_EXTENSION = after the
//   non-blocking extension stages that reach the post-B24 body of public.rpc_begin_push_send (A1, P4 push transport, pkg051a, B24 part 1 relaxed); read by the extension report.
// reach: EX04_CHAIN = the unchanged stages source147 -> PKG-050 already end on this body; EXTENSION_ONLY = no existing replay ends on it, only the extension stages can reach it.
// predecessors: earlier bodies of the same function that are recorded in the repository (receipts, evidence surfaces, candidate pre-image pins). They only EXPLAIN a difference.
// absentBefore: the package that creates the function (a chain that has not replayed it reports it as missing).
export const PINS = Object.freeze([
  {name: 'private.match_detail', nargs: 2, md5: '38c7894a8cf43a8f32bd5a30bc2cbd09', role: 'MATCH', stage: 'PROOF_POINT', reach: 'EX04_CHAIN',
    evidence: 'w02-live101-20260910/postflight.json; source147 CI surface (run 35446129464) and DEV surface 2026-09-19 carry the same md5; no later candidate redefines it',
    predecessors: []},
  {name: 'private.match_detail_for_calendar_interval', nargs: 4, md5: '781956cab666befab216b3ce2334ca1d', role: 'MATCH', stage: 'PROOF_POINT', reach: 'EX04_CHAIN',
    evidence: 'ex04d_proof.mjs asserts it strictly on the PKG-050 chain; pkg035a pre-image pin; source147 and DEV 2026-09-19 surfaces',
    predecessors: []},
  {name: 'private.match_detail_without_calendar', nargs: 2, md5: '9180606a038f3606b0906ab4aefdd0c1', role: 'MATCH', stage: 'PROOF_POINT', reach: 'EX04_CHAIN',
    evidence: '20260921_pkg031_application.receipt.json bodiesAfterOnDev; pkg035a pre-image pin',
    predecessors: [{md5: '02d7063424dbbe3df6cd97c0a64bd8b1', label: 'source147 / DEV 2026-09-19 body, the PKG-031b pre-image (PKG-031b not replayed)'}]},
  {name: 'private.dispatch_next_wave', nargs: 1, md5: '1fd8c51ef026ece24471e2f68250ecc5', role: 'DISPATCH', stage: 'PROOF_POINT', reach: 'EX04_CHAIN',
    evidence: '20260921_pkg027_application.receipt.json bodiesAfterOnDevEqualProofSurface',
    predecessors: [{md5: '5f434a47486f73d3c107aa92c3ab321c', label: 'source147 / DEV 2026-09-19 body, the PKG-027a pre-image (PKG-027a not replayed)'}]},
  {name: 'private.dispatch_tick', nargs: 2, md5: 'e568b033b9457736869fc5829ffc5511', role: 'DISPATCH', stage: 'PROOF_POINT', reach: 'EX04_CHAIN',
    evidence: '20260921_pkg027_application.receipt.json bodiesAfterOnDevEqualProofSurface',
    predecessors: [{md5: 'd3ef4a0b0b63bcfaffd84547a2ad863b', label: 'source147 / DEV 2026-09-19 body, the PKG-027a pre-image (PKG-027a not replayed)'}]},
  {name: 'private.dispatch_cheap_candidate_admitted', nargs: 2, md5: '0132fae38c75947179b4d389edc1e1f0', role: 'DISPATCH', stage: 'PROOF_POINT', reach: 'EX04_CHAIN',
    evidence: '20260921_pkg031_application.receipt.json bodiesAfterOnDev',
    predecessors: [{md5: '72a078453c9b28b6a23690bf9fff2473', label: 'after PKG-015b, the PKG-031b pre-image (PKG-031b not replayed)'},
      {md5: '44477b3f85999d7f75f28433f2e2cc70', label: 'source147 body (PKG-015b not replayed)'}]},
  {name: 'private.candidate_profile_ids', nargs: 2, md5: 'dca4ddc8080a52c8af83c33689c5568e', role: 'DISPATCH', stage: 'PROOF_POINT', reach: 'EX04_CHAIN',
    evidence: 'source147 CI surface (run 35446129464) and DEV surface 2026-09-19 carry the same md5; only the unapplied pkg023c candidate mentions it',
    predecessors: []},
  {name: 'private.emit_event', nargs: 12, md5: '67413effbbb3fa227397d355e0d4edfb', role: 'EVENT', stage: 'PROOF_POINT', reach: 'EX04_CHAIN',
    evidence: '20260921_pkg029_application.receipt.json bodiesAfterOnDevEqualProofSurface; pkg030_proof.mjs replay pin; chat_voice_b1_dev_application.sql pre-image pin',
    predecessors: [{md5: '8da91a4736e09b10872bd1240d6e0c8c', label: 'DEV 2026-09-21 body before PKG-027c (pkg027_proof.mjs pin)'},
      {md5: '15f77e4ba4aec29a0df69a50b17409d2', label: 'DEV body after PKG-027, before PKG-029a (pkg028_proof.mjs pin)'}]},
  {name: 'private.push_suppression', nargs: 1, md5: '0e0277608bf40f3cccc3575a77b1c23d', role: 'PUSH', stage: 'PROOF_POINT', reach: 'EX04_CHAIN',
    evidence: 'source147 CI surface (run 35446129464) and DEV surface 2026-09-19 carry the same md5; the A1 and P4 push candidates only call it',
    predecessors: []},
  {name: 'private.work_kinds_v5', nargs: 1, md5: '2113eb46ab7ea968b873e76d1de12377', role: 'MATCH', stage: 'PROOF_POINT', reach: 'EX04_CHAIN',
    evidence: '20260921_pkg031_application.receipt.json bodiesAfterOnDev; pkg032_proof.mjs strict replay pin',
    predecessors: [], absentBefore: 'PKG-031b'},
  {name: 'private.requeue_open_needs_for_worker_v5', nargs: 1, md5: '371bb38ea1d7180ca6222409f1a9a591', role: 'DISPATCH', stage: 'PROOF_POINT', reach: 'EX04_CHAIN',
    evidence: '20260921_pkg027_application.receipt.json bodiesAfterOnDevEqualProofSurface',
    predecessors: [], absentBefore: 'PKG-027a'},
  {name: 'public.rpc_begin_push_send', nargs: 2, md5: 'fc76b3444e312e589255cccb2b0749c0', role: 'PUSH', stage: 'AFTER_EXTENSION', reach: 'EXTENSION_ONLY',
    evidence: '20260930_b24_part1_application.receipt.json postflight (the post-B24 body). It is reached only by A1, the P4 push transport and B24 part 1; B24 part 1 needs private.platform_price_add_version '
      + '(one of its 54 targets), which only pkg051a creates, so the extension applies pkg051a right before it (relaxed pre-image mode). No existing replay does this '
      + '(b24-conflict-codes-proof.yml uses a stand-in; the voice B1 chain applies part 2 only)',
    predecessors: [{md5: 'b8e7537d453069c82bc1f7a7ee6fb10a', label: 'source147 body (A1 and P4 push transport not replayed)'},
      {md5: 'f946246b96985efefa26e2bd560cc897', label: 'A1 body (DEV ledger 209), the P4 push transport pre-image'},
      {md5: 'ea801be7205a8b07c7c94e20af3bd90e', label: 'P4 push transport body (DEV ledger 210), the B24 part 1 pre-image (B24 part 1 not applied)'}],
    // A difference that is only B24 part 1 is machine-checked: the body with the quoted '40001' turned into 'PT409' must equal the pin.
    derivations: [{id: 'B24_PART1_PT409', column: 'derived_b24_part1_pt409',
      description: "the chain body with the quoted '40001' replaced by 'PT409' (the only change of B24 part 1 in this function: one site)"}]},
]);
export const PROOF_POINT_PINS = Object.freeze(PINS.filter(pin => pin.stage === 'PROOF_POINT'));
export const EXTENSION_PINS = Object.freeze(PINS.filter(pin => pin.stage === 'AFTER_EXTENSION'));

// Informational only, never part of the 12 and never part of the evidence label: the certificate machinery. The chain certifies its own value, so closure_source_digest_v5 differs
// from DEV by design: a later DEV package (voice B1, ledger 215) changed it and the chain stops before voice B1, B24 part 2 and pkg045b-p0.
export const EXTRA_PINS = Object.freeze([
  {name: 'private.closure_source_digest_v5', nargs: 0, md5: '9fb4a72f3feef8e4557a96f4c9d7224e', role: 'CERTIFICATE', stage: 'PROOF_POINT', reach: 'NOT_REACHED_BY_CHAIN',
    evidence: 'S01 section 2 (new pin; changed by voice B1, ledger 215): differs by design, the chain stops before voice B1', predecessors: []},
  {name: 'private.closure_erasure_binding_v5', nargs: 0, md5: 'd6d7e7f6f108fff45a4df5126949fa04', role: 'CERTIFICATE', stage: 'PROOF_POINT', reach: 'EX04_CHAIN',
    evidence: 'S01 section 2; chat_voice_b1_dev_application.sql pre-image pin (voice B1 does not change it)', predecessors: []},
]);
/** The certificate digest canonical DEV carried at S01 (the chain is expected to differ: informational only). */
export const DEV_CERTIFICATE_DIGEST_AT_S01 = '58447d7730e909a0c0e60dd92ef77416af927471bd6f645988448e32c6e3cb46';

// Helper functions the matcher and the wave call but no pin covers: their bodies are recorded (md5, by name, every overload) for information.
export const DEPENDENCY_FUNCTIONS = Object.freeze(['private.schedule_fit', 'private.worker_dispatch_time_admitted', 'private.worker_available_periods', 'private.availability_is_future',
  'private.worker_calendar_conflict', 'private.lower_arr', 'private.haversine_km', 'private.effective_radius_km', 'private.identity_admitted', 'private.candidate_budget']);
// The private.marketplace_config rows the wave reads (wave sizes, targets, candidate budget) and the urgent policy: recorded as sha256 of the jsonb text, plus the effective wave sizes.
export const CONFIG_KEYS = Object.freeze(['dispatch_normal', 'dispatch_urgent', 'urgent_activation_policy']);

/** The SELECT that reads every overload of the given names (one row per overload). Run it as postgres on the chain. derived = also the PT409 derivation column. */
export function bodyQuery(names, {derived = false} = {}) {
  const unique = [...new Set(names)];
  const pairs = unique.map(name => {
    const [schema, proc] = name.split('.');
    return `('${schema}','${proc}')`;
  }).join(',');
  return `select n.nspname || '.' || p.proname as name, p.pronargs::integer as nargs, pg_get_function_identity_arguments(p.oid) as args,
  md5(replace(p.prosrc, E'\\r', '')) as md5${derived ? `,
  md5(replace(replace(p.prosrc, E'\\r', ''), '''40001''', '''PT409''')) as derived_b24_part1_pt409` : ''}
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where (n.nspname, p.proname) in (${pairs})
order by 1, 2, 3`;
}

/** The SELECT that reads every overload of the pinned names. */
export const pinQuery = (pins = PINS) => bodyQuery(pins.map(pin => pin.name), {derived: true});
export const dependencyQuery = () => bodyQuery(DEPENDENCY_FUNCTIONS);

/** The SELECT of the dispatch configuration rows: key, sha256 of the jsonb text, the wave sizes and the targets. */
export function configQuery() {
  return `select key, encode(extensions.digest(value::text, 'sha256'), 'hex') as sha256, value -> 'waveSizes' as wave_sizes, value ->> 'targetResponses' as target_responses,
  value ->> 'windowMinutes' as window_minutes
from private.marketplace_config where key in (${CONFIG_KEYS.map(key => `'${key}'`).join(', ')}) order by key`;
}

/** The SELECT of the catalog fingerprint: md5 of the body of every function and procedure in public and private, and md5 of the definition of every non-internal trigger. */
export function catalogQuery() {
  return `select 'function:' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as name, md5(replace(p.prosrc, E'\\r', '')) as md5
from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private') and p.prokind in ('f', 'p')
union all
select 'trigger:' || n.nspname || '.' || c.relname || '.' || t.tgname, md5(pg_get_triggerdef(t.oid))
from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public', 'private') and not t.tgisinternal
order by 1`;
}

/** {functions, triggers, lines} of a catalog read; `lines` is the sorted 'name:md5' list the fingerprint hashes (the caller hashes it). */
export function catalogLines(catalogRows) {
  if (!Array.isArray(catalogRows)) throw new Error('CATALOG_ROWS_NOT_AN_ARRAY');
  const lines = catalogRows.map(row => `${row.name}:${row.md5}`).sort();
  return {functions: catalogRows.filter(row => row.name.startsWith('function:')).length, triggers: catalogRows.filter(row => row.name.startsWith('trigger:')).length, lines};
}

/** What changed between two catalog reads: {added, removed, changed:[{name, before, after}]} by object name. Pure. */
export function diffCatalog(before, after) {
  const index = list => new Map(list.map(row => [row.name, row.md5]));
  const a = index(before), b = index(after), added = [], removed = [], changed = [];
  for (const [name, md5] of b) {
    if (!a.has(name)) added.push(name);
    else if (a.get(name) !== md5) changed.push({name, before: a.get(name), after: md5});
  }
  for (const name of a.keys()) if (!b.has(name)) removed.push(name);
  return {added: added.sort(), removed: removed.sort(), changed: changed.sort((x, y) => x.name.localeCompare(y.name))};
}

/** Pure: compare the rows of pinQuery with the pins. Returns exactly {equal, different, missing}. */
export function evaluatePins(rows, pins = PINS) {
  const equal = [], different = [], missing = [];
  for (const pin of pins) {
    const found = rows.filter(row => row.name === pin.name && Number(row.nargs) === pin.nargs);
    if (found.length === 0) {
      missing.push(pin.name);
      continue;
    }
    if (found.length > 1) {
      different.push({name: pin.name, expected: pin.md5, actual: 'AMBIGUOUS_OVERLOADS:' + found.length, role: pin.role, reach: pin.reach, explanation: 'more than one overload with ' + pin.nargs + ' arguments'});
      continue;
    }
    const row = found[0];
    if (row.md5 === pin.md5) {
      equal.push(pin.name);
      continue;
    }
    const entry = {name: pin.name, expected: pin.md5, actual: row.md5, role: pin.role, reach: pin.reach, explanation: null};
    const predecessor = (pin.predecessors ?? []).find(item => item.md5 === row.md5);
    if (predecessor) entry.explanation = 'KNOWN_PREDECESSOR: ' + predecessor.label;
    for (const derivation of pin.derivations ?? []) {
      if (row[derivation.column] === pin.md5) {
        entry.derivesToPin = derivation.id;
        entry.explanation = (entry.explanation ? entry.explanation + '; ' : '') + 'DERIVES_TO_PIN via ' + derivation.id + ': ' + derivation.description;
      }
    }
    different.push(entry);
  }
  return {equal, different, missing};
}

/** Reads the chain and evaluates the pins. `runRows(sql)` must return the rows of a SELECT as an array of objects (rt.rows). */
export async function pinGate(runRows, {pins = PINS} = {}) {
  const rows = await runRows(pinQuery(pins));
  if (!Array.isArray(rows)) throw new Error('PIN_GATE_ROWS_NOT_AN_ARRAY');
  return evaluatePins(rows, pins);
}

/**
 * Pure: the evidence label of a read. It names exactly what the pins cover (function bodies of the matcher, the dispatch and the event emit) and what they do not.
 * `covered` = how many pins this read covers (11 at the proof point, 12 once the extension pin is read too). Any pin that differs or is missing downgrades it; the exit code never depends on it.
 */
export function evidenceLabel(gate, covered = PROOF_POINT_PINS.length) {
  const bad = gate.different.length + gate.missing.length;
  if (bad === 0) {
    return covered === PINS.length
      ? `MATCH/DISPATCH/EVENT FUNCTION BODIES == DEV (${PINS.length} pins; ${LABEL_CAVEAT})`
      : `MATCH/DISPATCH/EVENT FUNCTION BODIES == DEV (${covered} of ${PINS.length} pins read at the proof point, all equal; the others are read after the extension; ${LABEL_CAVEAT})`;
  }
  return `MATCH/DISPATCH/EVENT FUNCTION BODIES != DEV (${bad} of ${covered} pins differ or are missing; ${LABEL_CAVEAT})`;
}

/** One report row per pin: name, role, reach, expected md5, actual md5, verdict (EQUAL / DIFFERENT / MISSING) and the explanation of a difference. */
export function pinRowsOf(gate, pins) {
  return pins.map(pin => {
    const different = gate.different.find(item => item.name === pin.name);
    const missing = gate.missing.includes(pin.name);
    return {name: pin.name, role: pin.role, reach: pin.reach, stage: pin.stage, expected: pin.md5, actual: missing ? 'MISSING' : different ? different.actual : pin.md5,
      verdict: missing ? 'MISSING' : different ? 'DIFFERENT' : 'EQUAL', explanation: missing ? (pin.absentBefore ? 'absent: created by ' + pin.absentBefore : 'function not found') : different?.explanation ?? ''};
  });
}

/** The actual md5 of every pinned function on the chain, by name: what a finding "ran against". */
export function bodyMd5Map(rows, pins = PINS) {
  const out = {};
  for (const pin of pins) {
    const found = rows.filter(row => row.name === pin.name && Number(row.nargs) === pin.nargs);
    out[pin.name] = found.length === 1 ? found[0].md5 : found.length === 0 ? 'MISSING' : 'AMBIGUOUS';
  }
  return out;
}

/** {name: [{nargs, md5}]} of the dependency functions of a dependencyQuery read (informational). */
export function dependencyBodies(rows) {
  const out = Object.fromEntries(DEPENDENCY_FUNCTIONS.map(name => [name, []]));
  for (const row of rows) if (row.name in out) out[row.name].push({nargs: Number(row.nargs), md5: row.md5});
  return out;
}

/** The pin table rows of the S01 document: lines that start with "| `" -> [{text, md5s}]. The test pairs every pin with its OWN row. */
export function s01TableRows(markdown) {
  return markdown.split(/\r?\n/).filter(line => line.startsWith('| `')).map(line => ({text: line, md5s: [...line.matchAll(/`([0-9a-f]{32})`/g)].map(match => match[1])}));
}

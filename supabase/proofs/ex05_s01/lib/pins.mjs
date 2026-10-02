// EX05-S01: the PIN GATE of the disposable chain (pure module: node:crypto only, no database, no network, no file read at import).
// The pins (supabase/proofs/ex05_s01/dev_pins.json) are the 2026-10-02 read-only DEV capture of the chat surface: 60 functions, md5 of the LF-normalised body and md5 of the
// metadata (the formulas of the D12 gate, so "equal" means the same thing in both). The chain is NOT DEV (see CHAIN_LACKS): the proof does not assume equality, it READS the chain
// for every pin through `chainReadSql`, classifies here, FAILS the run when a CORE function (one whose behaviour a proof of this package asserts) is missing or differs without an
// explanation, and only WARNS for an ADJACENT helper. Independently of the md5, B24 is checked as a property: every pinned function must be free of 40001 on the chain and carry
// PT409 exactly where DEV carries it (a converted function that silently reverted, or an unconverted one that slipped in, fails whatever its md5 says).
// "== DEV" is claimed for the pinned function BODIES and metadata only, never for the chain.
import {createHash} from 'node:crypto';

export const PINS_UNIT = 'EX05_S01_DEV_PINS';
export const isMd5 = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const SIGNATURE = /^(public|private)\.[a-z0-9_]+\([a-z0-9_.,\[\] ]*\)$/;

/** What the disposable chain does NOT carry compared with canonical DEV (ledger 221). The label of every verdict names it. */
export const CHAIN_LACKS = Object.freeze([
  'pkg051a (platform price list, ledger 202)',
  'PKG-045b P0 (needs column ACL and its certificate re-bind)',
  'P6 rollout v3 (discovery)',
  'EX-06a (flexible window, ledger 220) and D12 (written review comment, ledger 221, certificate re-bound to 0579191d)',
  'B24 Part 1 for every target function the chain does not carry (it converts the targets that exist; the others are listed by the derivation report)',
  'the certificate: the chain digest is chain-internal and is never equal to the DEV digest (it hashes database-local type and role oids)',
]);
export const CHAIN_LACKS_TOKEN = 'the chain lacks pkg051a, PKG-045b P0, P6 rollout v3, EX-06a and D12; B24 Part 1 is applied to the targets that exist on it; its certificate is chain-internal';

/** The order-independent fingerprint of a pin set (the DEV database computed the same value over its own rows). Plain code-unit order equals collate "C" for these ASCII signatures. */
export function combinedPinsMd5(rows) {
  const ordered = [...rows].sort((a, b) => (a.signature < b.signature ? -1 : a.signature > b.signature ? 1 : 0));
  const text = ordered.map(row => row.signature + ':' + row.bodyMd5 + ':' + row.metadataMd5 + ':' + (row.composite ? 'true' : 'false')).join(',');
  return createHash('md5').update(text).digest('hex');
}

/** The pin file (its text), validated: the unit, every row, uniqueness, and the combined md5 the DEV database computed (a mistyped md5 changes it). */
export function loadPins(jsonText) {
  const doc = JSON.parse(jsonText);
  if (doc.unit !== PINS_UNIT || !Array.isArray(doc.rows) || !isMd5(doc.combinedMd5)) throw new Error('PINS_FILE_SHAPE');
  const rows = doc.rows.map(row => ({signature: row.signature, group: row.group, bodyMd5: row.bodyMd5, metadataMd5: row.metadataMd5, composite: row.composite, pt409: row.pt409}));
  for (const row of rows) {
    if (typeof row.signature !== 'string' || !SIGNATURE.test(row.signature) || !['core', 'adjacent'].includes(row.group) || !isMd5(row.bodyMd5)
      || !isMd5(row.metadataMd5) || typeof row.composite !== 'boolean' || typeof row.pt409 !== 'boolean') throw new Error('PINS_ROW_INVALID ' + row.signature);
  }
  if (new Set(rows.map(row => row.signature)).size !== rows.length) throw new Error('PINS_DUPLICATE_SIGNATURE');
  if (combinedPinsMd5(rows) !== doc.combinedMd5) throw new Error('PINS_COMBINED_MD5_MISMATCH');
  return {meta: {capturedFrom: doc.capturedFrom, readOn: doc.readOn, ledgerCount: doc.ledgerCount, closureDigestPrefix: doc.closureDigestPrefix, combinedMd5: doc.combinedMd5}, rows};
}

/**
 * ONE read-only statement (no terminator): for every pin signature the chain's body md5 (LF-normalised), metadata md5 and whether the body mentions PT409 / 40001, with the SAME
 * formulas the DEV capture used. A function that does not exist reads `exists: false`.
 */
export function chainReadSql(rows) {
  for (const row of rows) if (!SIGNATURE.test(row.signature)) throw new Error('PINS_SIGNATURE_INVALID');
  const values = rows.map(row => "('" + row.signature + "')").join(',\n    ');
  return `select coalesce(jsonb_agg(jsonb_build_object('signature', s.signature, 'exists', p.oid is not null,
  'bodyMd5', md5(replace(p.prosrc, E'\\r\\n', E'\\n')),
  'metadataMd5', md5(((to_jsonb(p) - 'oid' - 'pronamespace' - 'proowner' - 'prolang' - 'proacl' - 'prosrc')
     || jsonb_build_object('namespace', n.nspname, 'owner', pg_get_userbyid(p.proowner), 'language', l.lanname, 'acl', p.proacl::text))::text),
  'hasPt409', coalesce(position('PT409' in p.prosrc) > 0, false),
  'has40001', coalesce(position('40001' in p.prosrc) > 0, false)) order by s.signature), '[]'::jsonb)
from (values
    ${values}
  ) s(signature)
  left join pg_proc p on p.oid = to_regprocedure(s.signature)
  left join pg_namespace n on n.oid = p.pronamespace
  left join pg_language l on l.oid = p.prolang`;
}

/** Classifies the chain's observations against the pins: {equal, different, missing, harness, core, adjacent}. */
export function classifyPins(rows, observations, explained = {}) {
  const observed = new Map(observations.map(item => [item.signature, item]));
  const gate = {equal: [], different: [], missing: [], harness: [], total: rows.length,
    core: {total: 0, equal: 0, different: [], missing: []}, adjacent: {total: 0, equal: 0, different: [], missing: []}};
  for (const row of rows) {
    const bucket = gate[row.group];
    bucket.total += 1;
    const seen = observed.get(row.signature);
    if (seen === undefined || (seen.exists === true && (!isMd5(seen.bodyMd5) || (!row.composite && !isMd5(seen.metadataMd5))))) {
      gate.harness.push({signature: row.signature, observed: seen === undefined ? 'NOT_READ' : 'MALFORMED'});
      continue;
    }
    if (seen.exists !== true) {
      const entry = {signature: row.signature, group: row.group};
      gate.missing.push(entry); bucket.missing.push(entry);
      continue;
    }
    const kinds = [];
    if (seen.bodyMd5 !== row.bodyMd5) kinds.push('body');
    if (!row.composite && seen.metadataMd5 !== row.metadataMd5) kinds.push('metadata');
    if (seen.has40001 === true || seen.hasPt409 !== row.pt409) kinds.push('conversion');
    if (kinds.length === 0) { gate.equal.push(row.signature); bucket.equal += 1; continue; }
    const entry = {signature: row.signature, group: row.group, kinds, devBodyMd5: row.bodyMd5, chainBodyMd5: seen.bodyMd5, devMetadataMd5: row.metadataMd5,
      chainMetadataMd5: seen.metadataMd5, devPt409: row.pt409, chainHasPt409: seen.hasPt409, chainHas40001: seen.has40001, explanation: explained[row.signature] ?? 'UNEXPLAINED'};
    gate.different.push(entry); bucket.different.push(entry);
  }
  return gate;
}

/** The verdict. FAILS: a malformed read, a missing core pin, a core difference without an explanation, and ANY conversion difference (B24 is never explained away). WARNS: adjacent items and explained differences. */
export function evaluatePinGate(gate) {
  const failures = [], warnings = [];
  for (const item of gate.harness) failures.push('PIN_GATE_HARNESS_BROKEN ' + item.signature + ' ' + item.observed);
  for (const item of gate.core.missing) failures.push('CORE_PIN_MISSING ' + item.signature);
  for (const item of gate.different) {
    const kinds = '(' + item.kinds.join('+') + ')';
    if (item.kinds.includes('conversion')) {
      failures.push((item.group === 'core' ? 'CORE_PIN_CONVERSION ' : 'ADJACENT_PIN_CONVERSION ') + item.signature + ' ' + kinds
        + ': dev pt409=' + item.devPt409 + ', chain pt409=' + item.chainHasPt409 + ', chain 40001=' + item.chainHas40001);
    } else if (item.group === 'core') {
      if (item.explanation === 'UNEXPLAINED') failures.push('CORE_PIN_UNEXPLAINED_DIFFERENCE ' + item.signature + ' ' + kinds);
      else warnings.push('CORE_PIN_EXPLAINED_DIFFERENCE ' + item.signature + ' ' + kinds + ': ' + item.explanation);
    } else warnings.push('ADJACENT_PIN_DIFFERENCE ' + item.signature + ' ' + kinds + (item.explanation === 'UNEXPLAINED' ? '' : ': ' + item.explanation));
  }
  for (const item of gate.adjacent.missing) warnings.push('ADJACENT_PIN_MISSING ' + item.signature);
  return {ok: failures.length === 0, failures, warnings};
}

/** EVERY difference of the gate, one line each (FAIL, WARN, DIFF, MISSING): the proof prints them BEFORE it asserts, so one run shows all of them. */
export function listAllPinDifferences(gate, evaluation = evaluatePinGate(gate)) {
  const lines = [...evaluation.failures.map(text => 'FAIL ' + text), ...evaluation.warnings.map(text => 'WARN ' + text)];
  for (const item of gate.different) {
    lines.push('DIFF [' + item.group + '] ' + item.signature + ' (' + item.kinds.join('+') + ') dev body ' + item.devBodyMd5 + ' chain body ' + item.chainBodyMd5
      + ' dev metadata ' + (item.devMetadataMd5 ?? '-') + ' chain metadata ' + (item.chainMetadataMd5 ?? '-'));
  }
  for (const item of gate.missing) lines.push('MISSING [' + item.group + '] ' + item.signature);
  return lines;
}

const describeGroup = group => group.equal + '/' + group.total + ' equal' + (group.different.length ? ' (differs: ' + group.different.map(item => item.signature.split('(')[0]).join(', ') + ')' : '')
  + (group.missing.length ? ' (missing: ' + group.missing.map(item => item.signature.split('(')[0]).join(', ') + ')' : '');

/** The SHORT label that prefixes every verdict: it names exactly what was compared. */
export function gateLabel(gate) {
  if (gate.harness.length) return 'EX05-S01 PIN GATE HARNESS BROKEN (' + gate.harness.length + ' malformed or unread observation(s))';
  if (gate.different.length === 0 && gate.missing.length === 0) {
    return 'EX05-S01 PINS == DEV (' + gate.equal.length + '/' + gate.total + ' pinned chat-surface functions equal in body and metadata, and free of 40001; the chain is NOT DEV)';
  }
  return 'EX05-S01 PINS: core ' + describeGroup(gate.core) + '; adjacent ' + describeGroup(gate.adjacent) + ': the verdicts hold for the CHAIN, not for DEV';
}

/** Markdown for the report. */
export function renderPinGateMarkdown(gate, evaluation = null) {
  const lines = ['## EX05-S01 pin gate', '', '**' + gateLabel(gate) + '**', '', 'The chain lacks: ' + CHAIN_LACKS.join('; ') + '.', ''];
  if (evaluation) lines.push('Gate verdict: ' + (evaluation.ok ? 'PASS' : 'FAIL (' + evaluation.failures.join('; ') + ')') + (evaluation.warnings.length ? '; warnings: ' + evaluation.warnings.join('; ') : '') + '.', '');
  lines.push('| signature | group | verdict | detail |', '| --- | --- | --- | --- |');
  for (const item of gate.different) lines.push('| ' + [item.signature, item.group, 'DIFFERENT (' + item.kinds.join('+') + ')', item.explanation].join(' | ') + ' |');
  for (const item of gate.missing) lines.push('| ' + [item.signature, item.group, 'MISSING', 'function absent on the chain'].join(' | ') + ' |');
  lines.push('| (' + gate.equal.length + ' pins) | - | equal | body and metadata equal the DEV readback |');
  return lines.join('\n') + '\n';
}

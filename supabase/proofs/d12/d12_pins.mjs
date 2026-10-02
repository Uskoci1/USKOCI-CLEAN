// D12 written comment: the PIN GATE of the disposable-chain proof. PURE module (node:crypto only): no database, no network, no file read at import.
// The pins are the 2026-10-01 read-only canonical DEV capture of supabase/proofs/d12/d12_pins.json (47 functions: md5 of the LF-normalised body and md5 of the metadata). The chain is NOT DEV
// (its OIDs, its ledger and a few DEV-only items differ), so the proof does NOT assume equality: it READS the chain's md5 for every pin through `chainReadSql`, classifies the result here, and
//   * FAILS the run when a CORE pin (a function the candidate rewrites, re-binds or promises to leave byte-identical, or that the closure seam stands on) is missing or differs,
//   * reports an ADJACENT difference (a helper the candidate leans on) and builds a CHAIN VARIANT of the candidate in which ONLY the md5 literals of the differing adjacent pins are replaced
//     (`buildChainVariant`): the generated candidate is never edited by hand, its structure is unchanged, and the replacement is counted and listed in the report.
// The label says exactly what was compared; "== DEV" is claimed for the pinned function BODIES and metadata only, never for the chain.
// ROUND 2 (BLOCKER): the body of private.retention_ai_source_ready() carries the CERTIFIED closure digest as its ONE 64-hex literal, and the digest of a chain is chain-internal (the proof asserts it is never the DEV one), so its RAW body md5 can
// never equal the DEV pin. That one body is therefore compared by its MASKED md5 (the certified literal replaced by a fixed placeholder, exactly as the generated preflight, the application, the revert and the postflight compare it); its metadata
// pin stays raw. No other pinned body carries a 64-hex literal (read-only DEV scan 2026-10-02: 46 of 47 bodies hold none), so no general exemption exists.
import {createHash} from 'node:crypto';
import {CHAIN_LACKS_TOKEN} from './d12_lib.mjs';

/** Where the DEV values come from: canonical DEV/ALPHA leqcwgzvjsxugfgzdmth, read-only SELECT on 2026-10-01 (ledger 219, closure certified = live = 58447d77, 88 certified functions). */
export const DEV_PINS_SOURCE = Object.freeze({project: 'leqcwgzvjsxugfgzdmth', readOn: '2026-10-01', ledgerCount: 219, closureDigestPrefix: '58447d77', evidence: 'supabase/proofs/d12/d12_pins.json'});
export const isMd5 = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);

/** The readiness function and the masked fingerprint of its body (the certified literal replaced by READINESS_PLACEHOLDER): the value the generator (READINESS_PLACEHOLDER_MD5), the preflight, the application, the revert and the postflight all use. */
export const READINESS_SIGNATURE = 'private.retention_ai_source_ready()';
export const READINESS_PLACEHOLDER = '__CERTIFIED_SOURCE__';
export const READINESS_MASKED_BODY_MD5 = 'bc85a1a744869abb6441e647b18b2195';
/** The JS twin of the SQL masking: md5(replace(replace(body, CRLF, LF), literal, placeholder)). */
export const maskedBodyMd5 = (body, literal) => createHash('md5').update(String(body).replace(/\r\n/g, '\n').split(literal).join(READINESS_PLACEHOLDER)).digest('hex');
/** How many times a literal occurs in a body (the application requires exactly one occurrence of the certified digest in the readiness body). */
export const literalCount = (body, literal) => String(body).split(literal).length - 1;

/** CORE: the seven rewritten or re-bound definitions, the review surface that must stay byte-identical, the export projection bodies and the closure seam the trigger and the executor stand on. */
export const CORE_SIGNATURES = Object.freeze([
  'private.closure_redaction_relations_v5()', 'private.closure_redaction_scope_v5(text)', 'private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)', 'private.retention_ai_source_ready()',
  'private.data_export_dataset_catalog()', 'private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)', 'private.data_export_policy_binding()',
  'public.rpc_submit_agreement_review(uuid,uuid,jsonb,jsonb,uuid)', 'public.rpc_get_my_agreement_review(uuid)', 'public.rpc_get_account_reputation(uuid)', 'public.rpc_get_public_profile(uuid)',
  'private.account_reputation(uuid)', 'private.review_receipt(private.agreement_reviews,boolean)', 'private.guard_review_immutable()', 'private.review_tag_catalog()', 'private.review_tags_valid(text[])',
  'private.closure_guard_owned_write()', 'private.closure_redaction_allowed_v5(oid,text,jsonb,jsonb)', 'private.closure_blockers_v5(uuid)', 'private.closure_erasure_binding_v5()',
  'private.closure_source_digest_v5()', 'private.closure_erasure_program_digest_v5()', 'private.closure_schema_digest_v5_139()', 'private.closure_assert_open(uuid,uuid)', 'private.closure_account_key(uuid)',
  'private.closure_account_restricted(uuid)', 'private.closure_erasure_assert_current_v5(private.closure_executions_v5)', 'public.rpc_start_account_closure_execution(uuid,uuid,integer,uuid,text)',
  'public.rpc_closure_api_guard()', 'public.rpc_redact_account_closure_step_service(uuid,uuid,uuid,uuid)', 'private.closure_erasure_refresh_steps_v5(private.closure_executions_v5)',
  'private.data_export_projection_sha_v5()', 'private.data_export_scalar_v5(jsonb,text)', 'private.data_export_array_v5(jsonb,text)', 'private.data_export_worker_candidate_v5(jsonb)', 'private.data_export_task_facts_v5(jsonb)',
  'private.audit_marketplace(uuid,text,text,uuid,integer,jsonb)', 'private.emit_event(uuid,text,text,text,uuid,integer,text,text,text,text,jsonb,timestamptz)',
  'private.safety_pair_blocked(uuid,uuid)', 'private.ru4b_public_floor_reason(text)',
]);
const CORE = new Set(CORE_SIGNATURES);
/**
 * A chain difference that has a DOCUMENTED, OBSERVED reason: {signature: 'why the chain differs'} (none today). Round-1 finding: the proof must apply EXACTLY the committed text or EXPLAIN every chain difference. A difference without an
 * explanation FAILS the run (core and adjacent alike); the run still continues with the chain variant so that one run reports everything it can, but its verdict is red until the reason is observed, written here and reviewed.
 */
export const EXPLAINED_CHAIN_DIFFERENCES = Object.freeze({});

/** The pin rows of d12_pins.json (the text of the file), validated: every row has a signature and a body md5, and every non-composite row a metadata md5. */
export function loadPins(jsonText) {
  const doc = JSON.parse(jsonText);
  if (doc.unit !== 'D12_PINS' || !Array.isArray(doc.rows)) throw new Error('D12_PINS_FILE_SHAPE');
  const rows = doc.rows.map(row => {
    const masked = row.signature === READINESS_SIGNATURE;
    // the readiness row keeps its RAW DEV body md5 (devRawBodyMd5: it carries the DEV digest, so it is never comparable) and is pinned by the MASKED md5
    return {signature: row.signature, bodyMd5: masked ? READINESS_MASKED_BODY_MD5 : row.bodyMd5, devRawBodyMd5: masked ? row.bodyMd5 : undefined, masked, metadataMd5: row.metadataMd5, composite: row.composite === true,
      group: CORE.has(row.signature) ? 'core' : 'adjacent'};
  });
  for (const row of rows) {
    if (typeof row.signature !== 'string' || !isMd5(row.bodyMd5)) throw new Error('D12_PIN_ROW_INVALID ' + row.signature);
    if (!row.composite && !isMd5(row.metadataMd5)) throw new Error('D12_PIN_METADATA_INVALID ' + row.signature);
    if (row.masked && !isMd5(row.devRawBodyMd5)) throw new Error('D12_PIN_ROW_INVALID ' + row.signature);
  }
  if (new Set(rows.map(row => row.signature)).size !== rows.length) throw new Error('D12_PIN_DUPLICATE');
  if (rows.filter(row => row.masked).length !== 1) throw new Error('D12_PIN_READINESS_ROW_MISSING');
  return rows;
}

const quoteDefault = value => "'" + String(value).replaceAll("'", "''") + "'";
/**
 * ONE read-only query: for every pin signature the chain's body md5 (LF-normalised) and metadata md5, with the SAME formulas as the generated preflight (so "equal" here means the application's own
 * pin check passes). A function that does not exist reads `exists: false`.
 */
export function chainReadSql(rows, quote = quoteDefault) {
  const values = rows.map(row => '(' + quote(row.signature) + ')').join(',\n    ');
  // the readiness body is compared MASKED (its one certified literal replaced by the placeholder), every other body raw; 'maskedLiteralCount' reports how often the certified literal occurs (the application demands exactly one)
  const certified = '(select c.sha256 from private.closure_source_v5 c where c.singleton)';
  return `select coalesce(jsonb_agg(jsonb_build_object('signature', s.signature, 'exists', p.oid is not null,
  'bodyMd5', case when s.signature = ${quote(READINESS_SIGNATURE)} then md5(replace(replace(p.prosrc, E'\\r\\n', E'\\n'), ${certified}, ${quote(READINESS_PLACEHOLDER)}))
    else md5(replace(p.prosrc, E'\\r\\n', E'\\n')) end,
  'maskedLiteralCount', case when s.signature = ${quote(READINESS_SIGNATURE)} then (length(p.prosrc) - length(replace(p.prosrc, ${certified}, ''))) / nullif(length(${certified}), 0) else null end,
  'metadataMd5', md5(((to_jsonb(p) - 'oid' - 'pronamespace' - 'proowner' - 'prolang' - 'proacl' - 'prosrc')
     || jsonb_build_object('namespace', n.nspname, 'owner', pg_get_userbyid(p.proowner), 'language', l.lanname, 'acl', p.proacl::text))::text)) order by s.signature), '[]'::jsonb)
from (values
    ${values}
  ) s(signature)
  left join pg_proc p on p.oid = to_regprocedure(s.signature)
  left join pg_namespace n on n.oid = p.pronamespace
  left join pg_language l on l.oid = p.prolang`;
}

/** Classifies the chain's observations against the pins: {equal, different, missing, core, adjacent, harness}. `observations`: [{signature, exists, bodyMd5, metadataMd5}]. */
export function classifyPins(rows, observations, explained = EXPLAINED_CHAIN_DIFFERENCES) {
  const observed = new Map(observations.map(item => [item.signature, item]));
  const gate = {equal: [], different: [], missing: [], harness: [], total: rows.length, core: {total: 0, equal: 0, different: [], missing: []}, adjacent: {total: 0, equal: 0, different: [], missing: []}};
  for (const row of rows) {
    const bucket = gate[row.group];
    bucket.total += 1;
    const seen = observed.get(row.signature);
    if (seen === undefined || (seen.exists === true && (!isMd5(seen.bodyMd5) || (!row.composite && !isMd5(seen.metadataMd5))))) { gate.harness.push({signature: row.signature, observed: seen === undefined ? 'NOT_READ' : 'MALFORMED'}); continue; }
    if (seen.exists !== true) { const entry = {signature: row.signature, group: row.group}; gate.missing.push(entry); bucket.missing.push(entry); continue; }
    const kinds = [];
    if (seen.bodyMd5 !== row.bodyMd5) kinds.push('body');
    if (!row.composite && seen.metadataMd5 !== row.metadataMd5) kinds.push('metadata');
    if (row.masked && Number(seen.maskedLiteralCount) !== 1) kinds.push('literal');   // the certified literal must occur exactly once (the application's own check)
    if (kinds.length === 0) { gate.equal.push(row.signature); bucket.equal += 1; continue; }
    const entry = {signature: row.signature, group: row.group, kinds, devBodyMd5: row.bodyMd5, chainBodyMd5: seen.bodyMd5, devMetadataMd5: row.metadataMd5, chainMetadataMd5: seen.metadataMd5,
      explanation: explained[row.signature] ?? 'UNEXPLAINED'};
    gate.different.push(entry); bucket.different.push(entry);
  }
  return gate;
}
/** The verdict: FAILS on a malformed read, a missing or different CORE pin without an explanation; an adjacent difference is reported (and the chain variant covers it). */
export function evaluatePinGate(gate) {
  const failures = [], warnings = [];
  for (const item of gate.harness) failures.push('PIN_GATE_HARNESS_BROKEN ' + item.signature + ' ' + item.observed);
  for (const item of gate.core.missing) failures.push('CORE_PIN_MISSING ' + item.signature);
  for (const item of gate.core.different) if (item.explanation === 'UNEXPLAINED') failures.push('CORE_PIN_UNEXPLAINED_DIFFERENCE ' + item.signature + ' (' + item.kinds.join('+') + ')');
  for (const item of gate.adjacent.missing) failures.push('ADJACENT_PIN_MISSING ' + item.signature + ' (the candidate leans on it: a chain without it cannot host the candidate)');
  for (const item of gate.adjacent.different) {
    if (item.explanation === 'UNEXPLAINED') failures.push('ADJACENT_PIN_UNEXPLAINED_DIFFERENCE ' + item.signature + ' (' + item.kinds.join('+') + '): the proof does not apply the committed bytes here; explain it in EXPLAINED_CHAIN_DIFFERENCES or fix the chain');
    else warnings.push('ADJACENT_PIN_EXPLAINED_DIFFERENCE ' + item.signature + ' (' + item.kinds.join('+') + '): ' + item.explanation);
  }
  return {ok: failures.length === 0, failures, warnings};
}
/**
 * EVERY difference of the gate, one line each, in one list (round-2 finding: one run must show all of them, never the first): the failures of evaluatePinGate followed by the warnings and the harness problems, with both md5 values.
 * The proof prints these lines BEFORE it asserts, so a truncated assertion message can never hide a difference; the complete table is also in the report (pinGate.different) and in the markdown.
 */
export function listAllPinDifferences(gate, evaluation = evaluatePinGate(gate)) {
  const lines = [...evaluation.failures.map(text => 'FAIL ' + text), ...evaluation.warnings.map(text => 'WARN ' + text)];
  for (const item of gate.different) lines.push('DIFF [' + item.group + '] ' + item.signature + ' (' + item.kinds.join('+') + ') dev body ' + item.devBodyMd5 + ' chain body ' + item.chainBodyMd5 + ' dev metadata ' + (item.devMetadataMd5 ?? '-') + ' chain metadata ' + (item.chainMetadataMd5 ?? '-'));
  for (const item of gate.missing) lines.push('MISSING [' + item.group + '] ' + item.signature);
  return lines;
}
const describeGroup = group => group.equal + '/' + group.total + ' equal' + (group.different.length ? ' (differs: ' + group.different.map(item => item.signature.split('(')[0]).join(', ') + ')' : '') + (group.missing.length ? ' (missing: ' + group.missing.map(item => item.signature.split('(')[0]).join(', ') + ')' : '');
/** True when the chain equals DEV in every pinned function: the proof then applies the COMMITTED bytes (no chain variant). */
export const appliesTheCommittedBytes = gate => gate.different.length === 0 && gate.missing.length === 0 && gate.harness.length === 0;
/** The SHORT label that prefixes every pass line. "== DEV" claims the pinned function bodies and metadata ONLY. */
export function gateLabelShort(gate) {
  if (gate.harness.length) return 'D12 PIN GATE HARNESS BROKEN (' + gate.harness.length + ' malformed observation(s))';
  if (gate.different.length === 0 && gate.missing.length === 0) return 'D12 PINS == DEV (' + gate.equal.length + '/' + gate.total + ' pinned functions equal in body and metadata; the chain is NOT DEV)';
  const bad = gate.core.different.length + gate.core.missing.length > 0;
  return 'D12 PINS: core ' + describeGroup(gate.core) + '; adjacent ' + describeGroup(gate.adjacent) + (bad ? ': A CORE PIN IS MISSING OR DIFFERS, THE PIN GATE FAILS THE RUN' : ': the verdicts hold for the CHAIN, not for DEV');
}
export function gateLabel(gate) {
  const short = gateLabelShort(gate);
  if (gate.harness.length) return short;
  return short + (gate.different.length === 0 && gate.missing.length === 0 ? ' [every pinned function equals the ' + DEV_PINS_SOURCE.readOn + ' DEV readback in body and metadata; nothing else is claimed: ' + CHAIN_LACKS_TOKEN + ']' : '; ' + CHAIN_LACKS_TOKEN);
}

/** How many times a 32-hex literal occurs in a text. */
export const occurrences = (text, literal) => String(text).split(literal).length - 1;
/**
 * The CHAIN VARIANT of a generated file: every occurrence of the DEV md5 of a differing ADJACENT pin (body or metadata) is replaced by the chain md5, and NOTHING else. Returns {text, applied}:
 * applied = [{signature, kind, devMd5, chainMd5, replaced}]. A core difference is never replaced (the gate fails the run); a replacement that finds the literal zero times is reported with replaced 0
 * (a pin that the file does not carry, e.g. a rewritten body in the postflight), and `requireIn` names the files in which every differing pin must be found.
 */
export function buildChainVariant(text, gate, {requireFound = false} = {}) {
  let out = String(text);
  const applied = [];
  for (const item of gate.adjacent.different) {
    for (const kind of item.kinds) {
      const dev = kind === 'body' ? item.devBodyMd5 : item.devMetadataMd5, chain = kind === 'body' ? item.chainBodyMd5 : item.chainMetadataMd5;
      const replaced = occurrences(out, dev);
      if (requireFound && replaced < 1) throw new Error('CHAIN_VARIANT_PIN_NOT_FOUND ' + item.signature + ' ' + kind + ' ' + dev);
      out = out.split(dev).join(chain);
      applied.push({signature: item.signature, kind, devMd5: dev, chainMd5: chain, replaced});
    }
  }
  return {text: out, applied};
}
/** Proves a variant differs from its source ONLY at the replaced literals: same length class, same text once the replacements are undone. */
export function variantDiffersOnlyAtPins(original, variant, applied) {
  let back = String(variant);
  for (const item of applied) back = back.split(item.chainMd5).join(item.devMd5);
  return back === String(original);
}

/** Markdown for the report. */
export function renderPinGateMarkdown(gate, evaluation = null) {
  const lines = ['## D12 pin gate', '', '**' + gateLabel(gate) + '**', '',
    'DEV values: ' + DEV_PINS_SOURCE.project + ', ledger ' + DEV_PINS_SOURCE.ledgerCount + ', read-only on ' + DEV_PINS_SOURCE.readOn + '. md5 of the body with CR removed; metadata md5 as the generated preflight computes it.', ''];
  if (evaluation) lines.push('Gate verdict: ' + (evaluation.ok ? 'PASS' : 'FAIL (' + evaluation.failures.join('; ') + ')') + (evaluation.warnings.length ? '; warnings: ' + evaluation.warnings.join('; ') : '') + '.', '');
  lines.push('| signature | group | verdict | detail |', '| --- | --- | --- | --- |');
  for (const item of gate.different) lines.push('| ' + [item.signature, item.group, 'DIFFERENT (' + item.kinds.join('+') + ')', item.explanation].join(' | ') + ' |');
  for (const item of gate.missing) lines.push('| ' + [item.signature, item.group, 'MISSING', 'function absent on the chain'].join(' | ') + ' |');
  lines.push('| (' + gate.equal.length + ' pins) | - | equal | body and metadata equal the DEV readback |');
  return lines.join('\n') + '\n';
}

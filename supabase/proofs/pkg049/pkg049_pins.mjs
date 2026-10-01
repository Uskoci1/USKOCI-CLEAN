// B09 / PKG-049 price-authority characterization: the live pins, the pin gate and the helper vocabulary.
// PURE module (node:crypto only): no database, no network. The proof reads the chain's md5 per function through `readMd5` and this file classifies the result.
// Round 2 (review R1): the gate is no longer a label only. A CORE pin (a function that carries or judges a price) that is missing, or that differs from DEV without an EXPLAINED reason,
// a changed helper vocabulary and a gap in the swallow list of a need_candidate_states_v5 overload FAIL the run (`evaluatePinGate`). Only the two documented PRE_B24 differences may
// differ, and they are labelled. The label separates the CORE price chain from the ADJACENT pins.
// Round 3 (review R2): rpc_read_task is pinned (adjacent); the label "PRICE-CHAIN BODIES == DEV" claims the pinned function bodies ONLY and the packages the chain lacks are named (CHAIN_LACKS);
// the helper raise statements are COUNTED and parsed in every layout, the swallow list is parsed from the handler (not searched as text); the in-proof B24 conversion is one transaction per
// function and tolerates only the four documented chain-drift guards (`classifyB24StageError`): any other failure is a hard failure, and a guard that fires on a body that WAS the known
// pre-image is a defect, not a drift (`b24StageDecision` says which).
import {createHash} from 'node:crypto';

/** Where the DEV values come from: canonical DEV/ALPHA leqcwgzvjsxugfgzdmth, read-only SELECT on 2026-10-01 (ledger 219, closure certified = live = 58447d77). */
export const DEV_PINS_SOURCE = Object.freeze({
  project: 'leqcwgzvjsxugfgzdmth',
  readOn: '2026-10-01',
  ledgerCount: 219,
  closureDigestPrefix: '58447d77',
  evidence: 'docs/implementation/product-v1-closure-20260926/finalization-20260927/b09/B09_PRICE_AUTHORITY_FINDING_20261001.md (sections 1, 7, 12; PF-2)',
});

/** md5 over the function body with carriage returns removed (the finding's PF-2 definition: md5(replace(prosrc, chr(13), ''))). */
export const md5Lf = text => createHash('md5').update(String(text).replace(/\r/g, '')).digest('hex');
export const isMd5 = value => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);

/**
 * The pinned functions. `group` core = carries or judges a price; adjacent = read for context (a difference there is reported, never decisive).
 * `knownChainMd5` = the body the DISPOSABLE chain is known to carry when it differs from DEV for a documented reason (so a difference can be EXPLAINED, not hidden).
 * `b24Sites` = the number of quoted '40001' sites B24 Part 1 converted to 'PT409' in that function (b24_nonretried_conflicts_part1.sql target table; ledger 214 receipt).
 */
export const PINS = Object.freeze([
  {id: 'submit', group: 'core', signature: 'public.rpc_submit_response(uuid,integer,uuid,integer,integer,timestamp with time zone,timestamp with time zone,text,text)',
    devMd5: 'c98e5bee7965b0d6ece9b477f94cede9', note: 'PKG-033a post-image; calls the helper at the price check'},
  {id: 'select', group: 'core', signature: 'public.rpc_select_response(uuid,integer,uuid,integer,text,text)',
    devMd5: '7cbb83905c1c983be4a7d92ff505411e', note: 'no price argument; re-asserts the helper against the CURRENT need; search_path = public, pg_temp'},
  {id: 'helper', group: 'core', signature: 'private.assert_application_price_v5(public.needs,integer,integer)',
    devMd5: 'bd7ef02925c03d99ff7fd549219214cb', note: 'the one price rule; IMMUTABLE, SECURITY INVOKER, ACL postgres only'},
  {id: 'stale_resolver', group: 'core',
    signature: 'public.rpc_resolve_stale_response_after_need_edit(uuid,integer,integer,text,text,integer,integer,timestamp with time zone,timestamp with time zone,text)',
    devMd5: '96cb9aac713739bbfa9a9d85df45d22f', knownChainMd5: 'd37c4f7cc639ed5522c70b5a084c3ea0', b24Sites: 2,
    knownChainReason: 'PRE_B24: the chain body still raises 40001 (B24 Part 1, ledger 214, is not replayed by any chain; the proof converts exactly this body in-proof)',
    note: 'KEEP re-asserts the stored price, UPDATE takes p_price_rsd; both go through the helper'},
  {id: 'ncs_1', group: 'core', signature: 'private.need_candidate_states_v5(uuid)',
    devMd5: '6d65e304f41f3e130228f58874757f0d', note: 'marks a candidate STALE on exactly the five helper messages'},
  {id: 'ncs_2', group: 'core', signature: 'private.need_candidate_states_v5(uuid,uuid[])',
    devMd5: '08c5c9656576d6c91b6d47e49089b244', note: 'exists only after the EX-04D candidate (ledger 219); same swallow list'},
  {id: 'propose', group: 'core', signature: 'public.rpc_propose_agreement_change_v2(uuid,integer,jsonb,text,text)',
    devMd5: 'cf577eafb406dac9c7ab17042f201749', note: 'Agreement change: the only client-priced path left (D3)'},
  {id: 'respond', group: 'core', signature: 'public.rpc_respond_agreement_change(uuid,boolean)',
    devMd5: 'a89309f3578c27ba1d9d9007a466c88e', note: 'the accept call carries no amount'},
  {id: 'selectable_count', group: 'adjacent', signature: 'public.selectable_application_count(public.needs)',
    devMd5: 'fe53442f8b661d6f33d22a54e2a468a8', note: 'computed column on needs; calls ncs(uuid)'},
  {id: 'read_task', group: 'adjacent', signature: 'public.rpc_read_task(uuid)',
    devMd5: '1e01db5140248f27ab374187f01fded3', note: 'pkg045a body, re-pinned by PKG-045b P0 (not altered); the proof reads the task and the computed count through it (P5, P6, P8 coupling). SECURITY INVOKER: on DEV it runs under the PKG-045b P0 column grants, on the chain under table-level SELECT'},
  {id: 'guard_need_write', group: 'adjacent', signature: 'private.guard_need_write()',
    devMd5: '314b93f7f89d3d52dbcf17a2a2552502', note: 'trigger function; price_basis is outside its material list'},
  {id: 'confirm_need_edit', group: 'adjacent', signature: 'public.rpc_confirm_need_edit(uuid,integer,text,jsonb)',
    devMd5: '450b6f8d932b1c58bcead22b6d29374b', knownChainMd5: 'dfa1a8096380772a9ac60283bebfaf3d', b24Sites: 2,
    knownChainReason: 'PRE_B24: the pre-image of B24 Part 1 (b24_nonretried_conflicts_part1.sql target table); the proof converts exactly this body in-proof',
    note: 'legacy owner edit command, no src caller'},
]);

/** The helper's refusal vocabulary: (message, SQLSTATE). Existing pairs must not change (finding I4); a new one breaks requester reads unless BOTH ncs overloads are patched (R3). */
export const HELPER_VOCABULARY = Object.freeze([
  Object.freeze({message: 'INVALID_PRICE', sqlstate: '22023'}),
  Object.freeze({message: 'FIXED_PRICE_NOT_READY', sqlstate: 'P0001'}),
  Object.freeze({message: 'FIXED_PRICE_MISMATCH', sqlstate: '22023'}),
  Object.freeze({message: 'TOTAL_PRICE_REQUIRES_ALL_SLOTS', sqlstate: '22023'}),
  Object.freeze({message: 'UNKNOWN_PRICE_BASIS', sqlstate: '22023'}),
]);
export const sqlstateOf = message => HELPER_VOCABULARY.find(item => item.message === message)?.sqlstate ?? null;

/** The number of `raise exception` statements the helper body holds (INVALID_PRICE, FIXED_PRICE_NOT_READY, FIXED_PRICE_MISMATCH x3 (null basis, PER_PERSON, TOTAL), TOTAL_PRICE_REQUIRES_ALL_SLOTS, UNKNOWN_PRICE_BASIS). */
export const HELPER_RAISE_COUNT = 7;
/** A body without its `--` line comments (a comment can name a message or a raise without being one). */
const withoutLineComments = text => String(text).replace(/--[^\n]*/g, '');
/**
 * Every `raise exception ...;` statement of a body: the text from `raise exception` to the terminating semicolon (quote- and parenthesis-aware, so `format('...;...', ...)` cannot end a
 * statement early). Statements are found whatever their layout; `--` comments are ignored.
 */
export function raiseStatements(prosrc) {
  const text = withoutLineComments(prosrc), out = [], pattern = /\braise\s+exception\b/gi;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    let index = match.index + match[0].length, depth = 0, quoted = false;
    for (; index < text.length; index++) {
      const character = text[index];
      if (quoted) { if (character === "'") { if (text[index + 1] === "'") index++; else quoted = false; } continue; }
      if (character === "'") quoted = true;
      else if (character === '(') depth++;
      else if (character === ')') depth--;
      else if (character === ';' && depth <= 0) break;
    }
    out.push(text.slice(match.index, index).trim());
    pattern.lastIndex = index;
  }
  return out;
}
/**
 * The (message, SQLSTATE) of one raise statement, in any of the layouts the repository uses: `using errcode='X', message='Y'`, `using message='Y', errcode='X'`, `using errcode='X',
 * detail=..., message='Y'` and `raise exception 'Y' using errcode='X'`. A missing half is null.
 */
export function parseRaise(statement) {
  const sqlstate = /\berrcode\s*=\s*'([0-9A-Za-z]{5})'/i.exec(statement)?.[1] ?? null;
  const message = /\bmessage\s*=\s*'([A-Za-z0-9_]+)'/i.exec(statement)?.[1] ?? /^raise\s+exception\s+'([A-Za-z0-9_]+)'/i.exec(statement)?.[1] ?? null;
  return {message, sqlstate};
}
/** Every raise statement of a body with its parsed pair; `unparsed` lists the statements whose message or SQLSTATE could not be read (a silent blind spot otherwise). */
export function extractRaises(prosrc) {
  const statements = raiseStatements(prosrc), parsed = statements.map(statement => ({statement, ...parseRaise(statement)}));
  return {count: statements.length, pairs: parsed.filter(item => item.message !== null && item.sqlstate !== null).map(({message, sqlstate}) => ({message, sqlstate})),
    unparsed: parsed.filter(item => item.message === null || item.sqlstate === null).map(item => item.statement.slice(0, 120))};
}
/** Every (SQLSTATE, message) pair the helper body raises (any layout, see `parseRaise`), sorted, unique. */
export function extractVocabulary(prosrc) {
  const found = new Map();
  for (const item of extractRaises(prosrc).pairs) found.set(item.message + '|' + item.sqlstate, item);
  return [...found.values()].sort((a, b) => a.message.localeCompare(b.message));
}
/** The structure of the helper's raises: exactly HELPER_RAISE_COUNT statements and every one parsed. Returns {count, expected, problems}: empty problems = as pinned. */
export function helperRaiseCheck(prosrc, expected = HELPER_RAISE_COUNT) {
  const raised = extractRaises(prosrc), problems = [];
  if (raised.count !== expected) problems.push('RAISE_COUNT_' + raised.count + '_PINNED_' + expected);
  for (const text of raised.unparsed) problems.push('RAISE_NOT_PARSED: ' + text);
  return {count: raised.count, expected, problems};
}
const keyOf = item => item.message + '|' + item.sqlstate;
/** `raiseCheck` (optional, from `helperRaiseCheck`): its problems make the comparison unequal, so a changed raise structure fails the gate like a changed pair. */
export function compareVocabulary(extracted, pinned = HELPER_VOCABULARY, raiseCheck = null) {
  const have = new Set(extracted.map(keyOf)), want = new Set(pinned.map(keyOf));
  const added = extracted.filter(item => !want.has(keyOf(item))), removed = pinned.filter(item => !have.has(keyOf(item))), raiseProblems = raiseCheck?.problems ?? [];
  return {equal: added.length === 0 && removed.length === 0 && raiseProblems.length === 0, added, removed, raiseProblems};
}
/** The exact exception handler a need_candidate_states_v5 body uses to turn a helper refusal into STALE: only these two SQLSTATEs, and only the pinned messages are swallowed. */
const SWALLOW_HANDLER = /exception\s+when\s+sqlstate\s+'22023'\s+or\s+sqlstate\s+'P0001'\s+then/gi;
const SWALLOW_LIST = /sqlerrm\s+not\s+in\s*\(([^)]*)\)/gi;
/** Parses the swallow handler of a need_candidate_states_v5 body: {handlers, lists, names} (names = the quoted items of the single `sqlerrm not in (...)`, or null when there is not exactly one). */
export function parseSwallowList(ncsProsrc) {
  const text = withoutLineComments(ncsProsrc), lists = [...text.matchAll(SWALLOW_LIST)];
  return {handlers: [...text.matchAll(SWALLOW_HANDLER)].length, lists: lists.length, names: lists.length === 1 ? [...lists[0][1].matchAll(/'([^']*)'/g)].map(match => match[1]) : null};
}
/**
 * The problems of a need_candidate_states_v5 swallow list (empty = the handler is the pinned one and the list names exactly the five helper messages): a helper message the list does not
 * name (it would be re-raised into requester reads) is reported by its name; an EXTRA name, a handler clause that is not found exactly once and a list that is not found exactly once
 * are reported too. A message that appears only in a comment or another string literal does NOT count.
 */
export function swallowListMissing(ncsProsrc, pinned = HELPER_VOCABULARY) {
  const parsed = parseSwallowList(ncsProsrc), problems = [];
  if (parsed.handlers !== 1) problems.push('HANDLER_CLAUSE_COUNT_' + parsed.handlers + "(expected exactly one `exception when sqlstate '22023' or sqlstate 'P0001'`)");
  if (parsed.names === null) { problems.push('SWALLOW_LIST_COUNT_' + parsed.lists + '(expected exactly one `sqlerrm not in (...)`)'); return problems; }
  for (const item of pinned) if (!parsed.names.includes(item.message)) problems.push(item.message);
  for (const name of parsed.names) if (!pinned.some(item => item.message === name)) problems.push('EXTRA:' + name);
  return problems;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// The pin gate. `observed` maps a pin id to the chain's md5 (a 32-hex string), or null/undefined when the function does not exist.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
const tally = () => ({total: 0, equal: [], different: [], missing: [], unexplained: 0});
/**
 * Returns {equal, different, missing, unexplained, harness, core, adjacent}: the flat lists cover every pin, `core` and `adjacent` repeat them per group (with `total`).
 * `harness` is non-empty only if an observation is malformed.
 */
export function classifyPins(observed, pins = PINS) {
  const result = {equal: [], different: [], missing: [], unexplained: 0, harness: [], core: tally(), adjacent: tally()};
  for (const pin of pins) {
    const group = pin.group === 'core' ? result.core : result.adjacent;
    group.total += 1;
    const chainMd5 = observed[pin.id];
    if (chainMd5 === null || chainMd5 === undefined) {
      const entry = {id: pin.id, group: pin.group, signature: pin.signature, devMd5: pin.devMd5};
      result.missing.push(entry); group.missing.push(entry); continue;
    }
    if (!isMd5(chainMd5)) { result.harness.push({id: pin.id, observed: String(chainMd5).slice(0, 80)}); continue; }
    if (chainMd5 === pin.devMd5) { result.equal.push(pin.id); group.equal.push(pin.id); continue; }
    const explained = pin.knownChainMd5 !== undefined && chainMd5 === pin.knownChainMd5;
    if (!explained) { result.unexplained += 1; group.unexplained += 1; }
    const entry = {id: pin.id, group: pin.group, signature: pin.signature, devMd5: pin.devMd5, chainMd5, explanation: explained ? pin.knownChainReason : 'UNEXPLAINED'};
    result.different.push(entry); group.different.push(entry);
  }
  return result;
}
const reasonTag = reason => String(reason).split(':')[0];
function describeGroup(group) {
  const parts = [...group.different.map(item => item.id + ' ' + (item.explanation === 'UNEXPLAINED' ? 'UNEXPLAINED' : reasonTag(item.explanation))), ...group.missing.map(item => item.id + ' MISSING')];
  return group.equal.length + '/' + group.total + ' equal' + (parts.length ? ' (' + parts.join(', ') + ')' : '');
}
/**
 * What the disposable chain does NOT carry of the DEV ledger 202-219 items (a statement of fact the label, every pass line, the report and the README repeat). The in-proof conversion of
 * two PRE_B24 bodies is the only B24 Part 1 content the chain gets.
 */
export const CHAIN_LACKS = Object.freeze(['pkg051a (platform price list)', 'A1/P0/P4/P5/B3a-c', 'PKG-045b P0 (needs column ACL and certificate re-bind: the chain still has table-level SELECT on public.needs)', 'P6 rollout v3',
  'B24 Part 1 (54 functions) except the two price-chain functions converted in-proof', 'B24 Part 2', 'Voice B1 (12 voice functions, certificate 58447d77)', 'EX-04A-C']);
/** The one-line form of CHAIN_LACKS that goes into every pass line. */
export const CHAIN_LACKS_TOKEN = 'the chain lacks pkg051a, A1/P0/P4/P5/B3a-c, PKG-045b P0, P6 rollout v3, B24 Part 1 (except 2 converted bodies), B24 Part 2, Voice B1, EX-04A-C; its certificate is chain-internal';
/**
 * The SHORT label (it prefixes every pass line and the report header). "PRICE-CHAIN BODIES == DEV (n/n pinned bodies; the chain is NOT DEV)" only when every pinned function body equals the
 * DEV readback: it claims those BODIES and nothing else (see CHAIN_LACKS). Otherwise the CORE price chain and the ADJACENT pins are told apart, e.g.
 * "CORE price chain 7/8 equal (stale_resolver PRE_B24); adjacent 3/4 equal (confirm_need_edit PRE_B24): the verdicts below hold for the CHAIN, not for DEV".
 */
export function chainLabelShort(gate) {
  if (gate.harness.length) return 'PIN GATE HARNESS BROKEN (' + gate.harness.length + ' malformed observation(s))';
  if (gate.different.length === 0 && gate.missing.length === 0) return 'PRICE-CHAIN BODIES == DEV (' + gate.equal.length + '/' + (gate.core.total + gate.adjacent.total) + ' pinned bodies; the chain is NOT DEV)';
  const coreBad = gate.core.unexplained + gate.core.missing.length > 0;
  return 'CORE price chain ' + describeGroup(gate.core) + '; adjacent ' + describeGroup(gate.adjacent)
    + (coreBad ? ': A CORE PIN IS MISSING OR DIFFERS WITHOUT AN EXPLANATION, THE PIN GATE FAILS THE RUN' : ': the verdicts below hold for the CHAIN, not for DEV');
}
/**
 * The label that goes first in every report. `b24Stage` (optional, a string from `summarizeB24Stages`) says whether the in-proof conversion produced the two DEV bodies: two of the
 * equal pins are then the proof's own product, not the chain's.
 */
export function chainLabel(gate, b24Stage = null) {
  const short = chainLabelShort(gate);
  if (gate.harness.length) return short;
  const stage = b24Stage === null || b24Stage === undefined ? '' : '; in-proof B24 conversion of the two PRE_B24 bodies: ' + b24Stage;
  if (gate.different.length === 0 && gate.missing.length === 0) return short + ' [every pinned price-chain function body is byte-equal to the ' + DEV_PINS_SOURCE.readOn + ' DEV readback' + stage + '; nothing else is claimed: ' + CHAIN_LACKS_TOKEN + ']';
  return short + stage;
}
/**
 * The gate verdict. FAILS (failures non-empty) when: an observation is malformed; a CORE pin is missing; a CORE pin differs without an explained reason; the helper vocabulary
 * differs from the pinned (message, SQLSTATE) pairs (or was not read); a need_candidate_states_v5 overload has a gap in its swallow list (or the swallow lists were not read).
 * An ADJACENT difference is a warning (it is context, not a price door). The two PRE_B24 differences are explained, so they pass.
 */
export function evaluatePinGate(gate, {vocabulary = null, swallow = null} = {}) {
  const failures = [], warnings = [];
  for (const item of gate.harness) failures.push('PIN_GATE_HARNESS_BROKEN ' + item.id + ' ' + item.observed);
  for (const item of gate.core.missing) failures.push('CORE_PIN_MISSING ' + item.id);
  for (const item of gate.core.different) if (item.explanation === 'UNEXPLAINED') failures.push('CORE_PIN_UNEXPLAINED_DIFFERENCE ' + item.id + ' chain=' + item.chainMd5 + ' dev=' + item.devMd5);
  for (const item of gate.adjacent.missing) warnings.push('ADJACENT_PIN_MISSING ' + item.id);
  for (const item of gate.adjacent.different) if (item.explanation === 'UNEXPLAINED') warnings.push('ADJACENT_PIN_UNEXPLAINED_DIFFERENCE ' + item.id + ' chain=' + item.chainMd5 + ' dev=' + item.devMd5);
  if (vocabulary === null || vocabulary === undefined) failures.push('HELPER_VOCABULARY_NOT_READ');
  else if (vocabulary.equal !== true) failures.push('HELPER_VOCABULARY_DIFFERS added=' + JSON.stringify(vocabulary.added ?? []) + ' removed=' + JSON.stringify(vocabulary.removed ?? []) + ' raise=' + JSON.stringify(vocabulary.raiseProblems ?? []));
  if (swallow === null || swallow === undefined) failures.push('SWALLOW_LISTS_NOT_READ');
  else for (const [key, missing] of Object.entries(swallow)) if (missing.length > 0) failures.push('SWALLOW_LIST_GAP ' + key + ': ' + missing.join(','));
  return {ok: failures.length === 0, failures, warnings};
}
/** Exit code for a standalone gate run: 2 when the harness is broken or the gate fails, otherwise 0. */
export const gateExitCode = (gate, evaluation = null) => gate.harness.length ? 2 : evaluation !== null && !evaluation.ok ? 2 : 0;

/** Reads every pin through `readMd5(signature)` (returns the md5 or null when absent) and classifies. A throwing reader is a harness failure, never a difference. */
export function runPinGate(readMd5, pins = PINS, b24Stage = null) {
  const observed = {};
  const harness = [];
  for (const pin of pins) {
    try { observed[pin.id] = readMd5(pin.signature); } catch (error) { harness.push({id: pin.id, observed: 'READ_FAILED:' + String(error?.message ?? error).slice(0, 120)}); observed[pin.id] = undefined; }
  }
  const gate = classifyPins(observed, pins.filter(pin => !harness.some(item => item.id === pin.id)));
  gate.harness.push(...harness);
  gate.observed = observed;
  gate.label = chainLabel(gate, b24Stage);
  gate.labelShort = chainLabelShort(gate);
  return gate;
}

/** The SQL a reader uses: the function's body md5 (CR removed) or the SQL null when the function does not exist. */
export const md5Sql = quote => signature => `select md5(replace(prosrc, chr(13), '')) from pg_proc where oid = to_regprocedure(${quote(signature)})`;

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// B24 (PostgREST 14 re-executes SQLSTATE 40001 without end). Part 1 of B24 (ledger 214) converts every quoted '40001' site of 54 functions to 'PT409', and nothing else.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
/** The number of quoted '40001' sites of a body, whether a 40001 remains outside the quoted form, and the body with every quoted site turned into 'PT409' (exactly B24's replace). */
export const countQuotedSites = body => String(body).split("'40001'").length - 1;
export const hasOtherCodeSites = body => String(body).split("'40001'").join('').includes('40001');
export const toPt409 = body => String(body).split("'40001'").join("'PT409'");
/** The expected DEV body md5 of a pre-B24 body: the md5 (CR removed) of the body with its quoted sites converted. Equals the DEV pin only for the two functions below (proved by the unit test from the repository sources). */
export const derivedPostB24Md5 = body => md5Lf(toPt409(body));

/** The two functions of the PRICE chain B24 Part 1 touches, in pin order: [{id, signature, preMd5 (= the chain body), devMd5 (= the DEV body after ledger 214), sites}]. */
export function b24PriceChainTargets(pins = PINS) {
  return pins.filter(pin => pin.knownChainMd5 !== undefined).map(pin => ({id: pin.id, signature: pin.signature, preMd5: pin.knownChainMd5, devMd5: pin.devMd5, sites: pin.b24Sites}));
}
const defaultQuote = value => "'" + String(value).replaceAll("'", "''") + "'";
/**
 * The in-proof stage (chain only): B24 Part 1's mechanics ($convert$: pg_get_functiondef, replace of the quoted '40001' by 'PT409', execute) restricted to the given price-chain
 * functions. The proof sends ONE function per call (one transaction each: the uncalled rpc_confirm_need_edit cannot veto the stale resolver conversion P4(h) needs).
 * Preconditions per function: md5 (CR removed) equals the known chain pre-image, exactly `sites` quoted '40001' and no other 40001, no 'PT409', and the
 * md5 the conversion WOULD produce (measured in SQL before anything is executed) equals the DEV md5. Postconditions: the body md5 equals the DEV md5 and the owner/ACL/security/
 * volatility/config/comment tuple is unchanged; the certificate is unchanged. Any failure aborts the transaction. Only the four chain-drift guards of `B24_TOLERATED_GUARDS` may be
 * tolerated by the caller (`classifyB24StageError`); every other failure (a SQL defect, a timeout, a certificate guard, a derivation or post-image mismatch) is a hard failure.
 */
export function b24PriceChainSql(quote = defaultQuote, targets = b24PriceChainTargets()) {
  const values = targets.map(target => `(${quote(target.signature)}, ${quote(target.preMd5)}, ${Number(target.sites)}, ${quote(target.devMd5)})`).join(',\n      ');
  return `begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local search_path = pg_catalog;
create function pg_temp.pkg049_attrs(p_oid oid) returns text language sql stable as $f$
  select md5(concat_ws('|', p.proowner::text, coalesce(p.proacl::text, ''), p.prosecdef::text, p.proisstrict::text, p.provolatile::text,
    p.proleakproof::text, p.proparallel::text, p.prolang::text, p.procost::text, p.prorows::text, p.prorettype::text, p.proargtypes::text,
    coalesce(p.proargnames::text, ''), coalesce(p.proargmodes::text, ''), coalesce(p.proallargtypes::text, ''), coalesce(p.proconfig::text, ''),
    p.prokind::text, coalesce(obj_description(p.oid, 'pg_proc'), '')))
  from pg_proc p where p.oid = p_oid
$f$;
do $pkg049_b24$
declare
  r record; v_oid oid; v_src text; v_def text; v_new text; v_n integer; v_attrs text; v_cert text;
begin
  v_cert := private.closure_source_digest_v5();
  if v_cert is distinct from (select sha256 from private.closure_source_v5 where singleton) or not private.retention_ai_source_ready() then
    raise exception 'PKG049_B24_CERTIFICATE_NOT_READY' using errcode = '55000';
  end if;
  for r in select * from (values
      ${values}) t(sig, pre_md5, sites, dev_md5) loop
    v_oid := to_regprocedure(r.sig);
    if v_oid is null then raise exception 'PKG049_B24_FUNCTION_ABSENT: %', r.sig using errcode = '55000'; end if;
    select prosrc into v_src from pg_proc where oid = v_oid;
    if md5(replace(v_src, chr(13), '')) is distinct from r.pre_md5 then raise exception 'PKG049_B24_PREIMAGE_DRIFT: %', r.sig using errcode = '55000'; end if;
    if position('PT409' in v_src) > 0 then raise exception 'PKG049_B24_ALREADY_PT409: %', r.sig using errcode = '55000'; end if;
    v_n := (length(v_src) - length(replace(v_src, '''40001''', ''))) / 7;
    if v_n <> r.sites or position('40001' in replace(v_src, '''40001''', '')) > 0 then
      raise exception 'PKG049_B24_SITE_COUNT_DRIFT: % expected % quoted sites, found %', r.sig, r.sites, v_n using errcode = '55000';
    end if;
    if md5(replace(replace(v_src, '''40001''', '''PT409'''), chr(13), '')) is distinct from r.dev_md5 then
      raise exception 'PKG049_B24_DERIVATION_MISMATCH: %', r.sig using errcode = '55000';
    end if;
    v_attrs := pg_temp.pkg049_attrs(v_oid);
    v_def := pg_get_functiondef(v_oid);
    v_new := replace(v_def, '''40001''', '''PT409''');
    if v_new = v_def then raise exception 'PKG049_B24_NOTHING_TO_CONVERT: %', r.sig using errcode = '55000'; end if;
    execute v_new;
    select prosrc into v_src from pg_proc where oid = to_regprocedure(r.sig);
    if md5(replace(v_src, chr(13), '')) is distinct from r.dev_md5 then raise exception 'PKG049_B24_POSTIMAGE_MISMATCH: %', r.sig using errcode = '55000'; end if;
    if pg_temp.pkg049_attrs(to_regprocedure(r.sig)) is distinct from v_attrs then raise exception 'PKG049_B24_ATTRIBUTES_CHANGED: %', r.sig using errcode = '55000'; end if;
  end loop;
  if private.closure_source_digest_v5() is distinct from v_cert
     or v_cert is distinct from (select sha256 from private.closure_source_v5 where singleton) or not private.retention_ai_source_ready() then
    raise exception 'PKG049_B24_CERTIFICATE_MOVED' using errcode = '55000';
  end if;
end
$pkg049_b24$;
drop function pg_temp.pkg049_attrs(oid);
commit;
`;
}

/**
 * The four documented CHAIN-DRIFT guards of the in-proof stage: the chain's function is absent, is not the known pre-image, already carries PT409 or has another number of quoted
 * sites. They say "the chain is not what the pins describe", which the pin gate reports as well; they are the only errors the stage may tolerate.
 */
export const B24_TOLERATED_GUARDS = Object.freeze(['PKG049_B24_PREIMAGE_DRIFT', 'PKG049_B24_SITE_COUNT_DRIFT', 'PKG049_B24_ALREADY_PT409', 'PKG049_B24_FUNCTION_ABSENT']);
/**
 * What the stage does for ONE target, from the md5 (CR removed) the chain carries now: a body that already equals the DEV body needs nothing (NOT_NEEDED); anything else is attempted (APPLY),
 * and `preImageMatched` says whether the body WAS the known pre-image (then none of the drift guards can legitimately fire).
 */
export function b24StageDecision(currentMd5, target) {
  if (currentMd5 === target.devMd5) return {action: 'NOT_NEEDED', preImageMatched: false};
  return {action: 'APPLY', preImageMatched: currentMd5 === target.preMd5};
}
/**
 * Whether a failed stage call may be tolerated: ONLY when the error is the psql line `ERROR:  <guard>:` of one of the four documented chain-drift guards (an `ERROR:` line, never a
 * quoted source line of a syntax error, a timeout, a certificate guard or a post-image mismatch) AND the body was not the known pre-image (a drift guard that fires on a body the caller
 * had just read as the pre-image is a defect of the harness or of the SQL, never a chain difference). Returns {tolerated, guard, reason}.
 */
export function classifyB24StageError(message, {preImageMatched = false} = {}) {
  const match = /\bERROR:\s+(PKG049_B24_[A-Z0-9_]+):/.exec(String(message ?? ''));
  const guard = match !== null && B24_TOLERATED_GUARDS.includes(match[1]) ? match[1] : null;
  if (guard === null) return {tolerated: false, guard: null, reason: match === null ? 'NOT_A_STAGE_GUARD' : 'GUARD_IS_NOT_A_DOCUMENTED_CHAIN_DRIFT: ' + match[1]};
  if (preImageMatched === true) return {tolerated: false, guard, reason: 'DRIFT_GUARD_ON_THE_KNOWN_PRE_IMAGE'};
  return {tolerated: true, guard, reason: 'CHAIN_DRIFT'};
}
/** One line for the report and the label: `stale_resolver APPLIED (d37c4f7c -> 96cb9aac); confirm_need_edit NOT NEEDED (...)`. `stages` = [{id, status}] in target order. */
export const summarizeB24Stages = stages => stages.map(stage => stage.id + ' ' + stage.status).join('; ');

/** The (function, quoted-40001 sites, pre-image md5) rows of the B24 Part 1 target table. Used read-only, to say whether Part 1 COULD apply on the chain. */
export function parseB24Part1Targets(sqlText) {
  const targets = [];
  const from = String(sqlText).indexOf('insert into b24_targets');
  if (from < 0) return targets;
  const until = String(sqlText).indexOf(';', from);
  for (const match of String(sqlText).slice(from, until).matchAll(/\('([a-z_]+\.[a-z0-9_]+)',\s*(\d+),\s*'([a-f0-9]{32})'\)/g)) targets.push({fn: match[1], sites: Number(match[2]), preMd5: match[3]});
  return targets;
}
/**
 * Whether B24 Part 1 could be applied to the chain AS IT IS (relaxed mode skips only the md5 pins and the closed name lists; it does NOT relax existence, uniqueness, the
 * quoted-site count or the "no PT409 yet" check). `observed` rows: {fn, overloads, sites, hasPt409} for every target function that exists on the chain.
 */
export function b24Applicability(targets, observed) {
  const byFn = new Map(observed.map(row => [row.fn, row]));
  const absentOnChain = [], notUnique = [], siteCountDrift = [], alreadyPt409 = [];
  for (const target of targets) {
    const row = byFn.get(target.fn);
    if (!row || Number(row.overloads) === 0) { absentOnChain.push(target.fn); continue; }
    if (Number(row.overloads) !== 1) { notUnique.push(target.fn); continue; }
    if (row.hasPt409 === true) alreadyPt409.push(target.fn);
    if (Number(row.sites) !== target.sites) siteCountDrift.push({fn: target.fn, expected: target.sites, found: Number(row.sites)});
  }
  return {absentOnChain, notUnique, siteCountDrift, alreadyPt409, wouldApplyHere: absentOnChain.length + notUnique.length + siteCountDrift.length + alreadyPt409.length === 0};
}

/** Markdown for the pin gate (the proof appends the rest of its report). */
export function renderPinGateMarkdown(gate, evaluation = null) {
  const lines = ['## Pin gate (price chain)', '', '**' + gate.label + '**', '',
    'DEV values: ' + DEV_PINS_SOURCE.project + ', ledger ' + DEV_PINS_SOURCE.ledgerCount + ', read-only on ' + DEV_PINS_SOURCE.readOn + '. md5 = md5(replace(prosrc, chr(13), \'\')).', ''];
  if (evaluation) lines.push('Gate verdict: ' + (evaluation.ok ? 'PASS' : 'FAIL (' + evaluation.failures.join('; ') + ')') + (evaluation.warnings.length ? '; warnings: ' + evaluation.warnings.join('; ') : '') + '.', '');
  lines.push('| id | group | verdict | DEV md5 | chain md5 | note |', '| --- | --- | --- | --- | --- | --- |');
  for (const pin of PINS) {
    const different = gate.different.find(item => item.id === pin.id), missing = gate.missing.find(item => item.id === pin.id);
    const verdict = gate.equal.includes(pin.id) ? 'equal' : different ? 'DIFFERENT' : missing ? 'MISSING' : 'unread';
    lines.push('| ' + [pin.id, pin.group, verdict, pin.devMd5, different?.chainMd5 ?? (gate.equal.includes(pin.id) ? pin.devMd5 : '-'), different ? different.explanation : (missing ? 'function absent on the chain' : '')].join(' | ') + ' |');
  }
  return lines.join('\n') + '\n';
}

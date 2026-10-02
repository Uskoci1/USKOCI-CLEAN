// EX-07 S06 (the displayed name of a safety target): the pure functions of the disposable-chain proof. No database, no network, no dependency: everything here is
// unit-tested offline by ex07_s06_lib.test.mjs (node --test), and the proof (ex07_s06_proof.mjs) imports the same functions.
export const TARGET = 'public.rpc_read_safety_target(uuid)';
/** The keys of the predecessor's result, sorted: nothing else is ever added to it except the name. */
export const OLD_KEYS = ['accountId', 'authoritative', 'blocked', 'profileId', 'revision', 'targetAccountId'];
export const NEW_KEYS = [...OLD_KEYS, 'displayName'].sort();
/** The marker the apply_migration guard looks for: it starts the application text (and the revert has its own). */
export const APPLY_MARKER = '-- EX-07 S06 safety target displayed name: DEV application candidate.';
export const REVERT_MARKER = '-- EX-07 S06 safety target displayed name: DEV revert candidate.';

/** nullif(btrim(name), ''): btrim removes SPACES only (not tabs or line feeds), exactly as the function and rpc_get_public_profile write it. */
export function shownName(name) {
  if (name === null || name === undefined) return null;
  const trimmed = String(name).replace(/^ +| +$/g, '');
  return trimmed === '' ? null : trimmed;
}

/** What the answer of the application must be, given the answer of the predecessor for the same call: null stays null, and a target gains exactly the key displayName. */
export function withName(before, name) {
  return before === null ? null : {...before, displayName: shownName(name)};
}

/** Every difference between two answers of the same call, [] when equal (order of keys ignored): [{path, before, after}]. */
export function answerDiff(a, b, path = '') {
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b) ? [] : [{path, before: a, after: b}];
  }
  const out = [];
  for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    if (!(key in a)) out.push({path: path + '/' + key, before: undefined, after: b[key]});
    else if (!(key in b)) out.push({path: path + '/' + key, before: a[key], after: undefined});
    else out.push(...answerDiff(a[key], b[key], path + '/' + key));
  }
  return out;
}

// ------------------------------------------------------------------ the candidate text
/** The pins the candidate enforces, [{signature, md5}], read from its own text (the proof asserts exactly these on the chain): the target first, then the neighbours. */
export function parsePins(text) {
  const start = text.indexOf('for pin in select * from (values'), end = text.indexOf(') p(signature, body_md5) loop', start);
  if (start < 0 || end < 0) throw new Error('CANDIDATE_PINS_NOT_FOUND');
  const found = [...text.slice(start, end).matchAll(/\('([^']+)',\s*'([0-9a-f]{32})'\)/g)].map(match => ({signature: match[1], md5: match[2]}));
  if (found.length < 2) throw new Error('CANDIDATE_PINS_NOT_PARSED');
  return found;
}
/** The pins of a flight file (preflight or postflight): the targets row first, then the neighbours (same shape, `values` rows of two literals). */
export function parseFlightPins(text) {
  const rows = block => [...block.matchAll(/\('([^']+)',\s*'([0-9a-f]{32})'\)/g)].map(match => ({signature: match[1], md5: match[2]}));
  const targets = text.slice(text.indexOf('targets(signature, body_md5) as (values'), text.indexOf('neighbours(signature, body_md5) as (values'));
  const neighbours = text.slice(text.indexOf('neighbours(signature, body_md5) as (values'), text.indexOf('problems as ('));
  return {targets: rows(targets), neighbours: rows(neighbours)};
}
/** The text between $name$ ... $name$ (the first such literal). */
export function dollarLiteral(text, name) {
  const open = `$${name}$`, start = text.indexOf(open);
  if (start < 0) throw new Error('DOLLAR_LITERAL_NOT_FOUND:' + name);
  const from = start + open.length, end = text.indexOf(open, from);
  if (end < 0) throw new Error('DOLLAR_LITERAL_NOT_CLOSED:' + name);
  return text.slice(from, end);
}
/** The candidate with one pin's md5 replaced by zeros (the drift refusal test). */
export function tamperPin(text, signature) {
  const escaped = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(\\('${escaped}',\\s*')[0-9a-f]{32}('\\))`);
  if (!pattern.test(text)) throw new Error('PIN_NOT_FOUND:' + signature);
  return text.replace(pattern, (whole, head, tail) => head + '0'.repeat(32) + tail);
}
/** Every errcode a text raises with: ['55000', ...]. */
export function errcodes(text) {
  return [...text.matchAll(/errcode\s*=\s*'([0-9A-Za-z]+)'/g)].map(match => match[1]);
}
/** What a generated SQL text must never be: not LF, tabs, non-ASCII, a unicode escape text, NUL, a retried serialization code or a second statement kind. [] when clean. */
export function textProblems(text, {marker} = {}) {
  const problems = [];
  if (text.includes('\r')) problems.push('CARRIAGE_RETURN');
  if (text.includes('\t')) problems.push('TAB');
  if ([...text].some(c => c.charCodeAt(0) > 127)) problems.push('NON_ASCII');
  if (/\\[uU][0-9A-Fa-f]{4}/.test(text)) problems.push('UNICODE_ESCAPE_TEXT');
  if (text.includes('\0')) problems.push('NUL');
  if (/errcode\s*=\s*'40001'/.test(text) || /sqlstate\s*'?40001/i.test(text)) problems.push('SERIALIZATION_FAILURE_CODE');
  if (text.replace(/\b[0-9a-f]{32,64}\b/g, '').includes('40001')) problems.push('SERIALIZATION_FAILURE_DIGITS');
  if (errcodes(text).some(code => code !== '55000')) problems.push('ERRCODE_OTHER_THAN_55000:' + [...new Set(errcodes(text).filter(code => code !== '55000'))].join(','));
  if (!text.endsWith('\n') || text.endsWith('\n\n')) problems.push('FINAL_LINE_FEED');
  if (marker && (!text.startsWith(marker) || text.split(marker).length !== 2)) problems.push('MARKER');
  return problems;
}

// ------------------------------------------------------------------ catalog and surface deltas
/** {added, removed, changed:[{name, before, after}]} between two [{name, md5}] lists. */
export function diffNamed(before, after) {
  const a = new Map(before.map(row => [row.name, row.md5])), b = new Map(after.map(row => [row.name, row.md5]));
  const added = [...b.keys()].filter(name => !a.has(name)).sort(), removed = [...a.keys()].filter(name => !b.has(name)).sort();
  const changed = [...b.keys()].filter(name => a.has(name) && a.get(name) !== b.get(name)).sort().map(name => ({name, before: a.get(name), after: b.get(name)}));
  return {added, removed, changed};
}
/**
 * The surface lines (function:signature:md5:definer=...:volatility=...:config=...:acl=...) that differ: {removed, added, names} and whether ONLY bodies changed (every removed line has exactly one
 * added line with the same name and the same metadata, so no attribute, ACL or definer moved).
 */
export function surfaceDelta(before, after) {
  const removed = before.filter(line => !after.includes(line)), added = after.filter(line => !before.includes(line));
  const name = line => line.split(':')[1];
  const metadata = line => line.split(':').slice(3).join(':');
  const onlyBodiesChanged = removed.length === added.length && removed.every(line => added.filter(other => name(other) === name(line) && metadata(other) === metadata(line)).length === 1)
    && new Set(removed.map(name)).size === removed.length;
  return {removed, added, onlyBodiesChanged, names: [...new Set([...removed, ...added].map(name))].sort()};
}

// ------------------------------------------------------------------ the SQL the proof sends besides the files
/** One statement sequence that makes the database role `authenticated` act as `accountId` for the statement that follows (the pre-request guard of PostgREST is bypassed on purpose: this is the function itself). */
export function asAccountSql(accountId, statement, q) {
  const claims = JSON.stringify({sub: accountId, role: 'authenticated'});
  return `begin; set local role authenticated; select set_config('request.jwt.claim.sub', ${q(accountId)}, true), set_config('request.jwt.claim.role', 'authenticated', true), set_config('request.jwt.claims', ${q(claims)}, true); ${statement}; commit;`;
}
/** The one line a statement printed last (psql -At prints the set_config row first). */
export function lastLine(output) {
  const lines = String(output).split('\n').map(line => line.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : '';
}

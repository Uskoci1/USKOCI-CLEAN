// EX-06 ex06b (S06: the alias registry, the classification version and the F2 stem fix): the PURE logic of the disposable-chain proof (ex06b_proof.mjs) and of its offline tests (ex06b_lib.test.mjs).
// No database, no network. Everything here is a SECOND, independent implementation of what the generator (build_ex06b.py) and the SQL say: the fold is typed letter by letter (not from code points), the
// classification is a JavaScript port, and the expectations that matter (the corpus v1.1 intent) are written by hand in s06/ex06_contract_corpus_v1_1.json, never computed from the candidate.
// The proof compares the REAL function on the chain with this model before and after the candidate; the offline tests compare this model with the committed files.
import {createHash} from 'node:crypto';

export const TARGET = 'private.work_kinds_v5(text[])';
export const OLD_MD5 = '2113eb46ab7ea968b873e76d1de12377';
export const CLASSIFICATION_VERSION = 'WK-1';
export const CLOSED_KINDS = Object.freeze(['SELIDBE_PREVOZ', 'FIZICKI_POSLOVI', 'MONTAZA_NAMESTAJA', 'SITNE_POPRAVKE', 'MOLERSKI_RADOVI', 'ELEKTRO', 'VODOINSTALATER', 'CISCENJE', 'PRANJE_PEGLANJE', 'BASTA_DVORISTE', 'DOSTAVA']);
// The two kinds whose OUTCOME as ordinary or regulated work is an open owner question (no case, alias or policy is written for them: the rows carry over unchanged and are exercised only by the generic
// loops that prove the unchanged stems). The corpus validator refuses a probe or a case that names them.
export const CONTESTED_KINDS = Object.freeze(['ELEKTRO', 'VODOINSTALATER']);
export const HEAD_KEY = 'work_kinds_head';
export const KIND_PREFIX = 'work_kind:';
export const HEAD_SCHEMA = 'WORK_KINDS_HEAD_V1';
export const KIND_SCHEMA = 'WORK_KIND_V1';
export const FOLD_VERSION = 'SR_LATIN_CYRILLIC_V1';
export const MIN_STEM_LENGTH = 4;
export const STEM_PATTERN = /^[a-z][a-z ]*[a-z]$/;
export const STEMS_ADDED = Object.freeze({MONTAZA_NAMESTAJA: ['ikee', 'ikei', 'ikeu', 'ikeom'], MOLERSKI_RADOVI: ['ofarb']});
export const STEMS_REMOVED = Object.freeze({MONTAZA_NAMESTAJA: ['sklapanj']});
export const SERVICE_CODE = 'SERVICE_NOT_IN_WORK_PROFILE';
export const EXCLUSION_CODE = 'PROFILE_EXCLUSION';

export const sha256 = text => createHash('sha256').update(text).digest('hex');
export const md5 = text => createHash('md5').update(text).digest('hex');
export const lf = text => text.replace(/\r\n/g, '\n');
export const corpusTextSha256 = text => sha256(lf(text));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sortedSet = list => [...new Set(list ?? [])].sort();

// ------------------------------------------------------------------ the corpus files the proof is pinned to
/** v1 is frozen and pinned (the same values as the S03 and ex06a proofs); v1.1 is the additive file of this package. */
export const CORPUS_V1_PIN = Object.freeze({path: 'supabase/proofs/ai/corpus/ex06_contract_corpus_v1.json', sha256: '00f43182f3b9923f868c3c2c8094b6b20c1b264b1a2bb6c72915d14fc1fdb08e', buildableCases: 37,
  idsSha256: '435e1544c87f50e604afd15fe82b60de9c465217277a4792df6acd10d5969c15'});
export const CORPUS_V11_PIN = Object.freeze({path: 'supabase/proofs/ex06/s06/ex06_contract_corpus_v1_1.json', sha256: '0d485700486399d5ca9da028dc7729f2d3e982af024456a9a30fc45522e85eed', cases: 8});
export const corpusIdsSha256 = ids => sha256(ids.join('\n'));

/** Problems with a corpus FILE and selection (path, LF-normalised sha256, buildable cases, id list): [] when it is exactly the pinned one. */
export function corpusV1PinProblems({path, text, ids}) {
  const problems = [];
  if (path !== CORPUS_V1_PIN.path) problems.push(`CORPUS_V1_PATH ${path}`);
  if (corpusTextSha256(text) !== CORPUS_V1_PIN.sha256) problems.push(`CORPUS_V1_SHA256 ${corpusTextSha256(text)}`);
  if (ids.length !== CORPUS_V1_PIN.buildableCases) problems.push(`CORPUS_V1_BUILDABLE_CASES ${ids.length}`);
  if (corpusIdsSha256(ids) !== CORPUS_V1_PIN.idsSha256) problems.push(`CORPUS_V1_ID_LIST ${corpusIdsSha256(ids)}`);
  return problems;
}
export function corpusV11PinProblems({path, text, pin = CORPUS_V11_PIN}) {
  const problems = [];
  if (path !== pin.path) problems.push(`CORPUS_V11_PATH ${path}`);
  if (corpusTextSha256(text) !== pin.sha256) problems.push(`CORPUS_V11_SHA256 ${corpusTextSha256(text)}`);
  return problems;
}

// ------------------------------------------------------------------ the generated texts
/** The text between $name$ ... $name$ (the first such literal). */
export function dollarLiteral(text, name) {
  const open = `$${name}$`, start = text.indexOf(open);
  if (start < 0) throw new Error('DOLLAR_LITERAL_NOT_FOUND:' + name);
  const from = start + open.length, end = text.indexOf(open, from);
  if (end < 0) throw new Error('DOLLAR_LITERAL_NOT_CLOSED:' + name);
  return text.slice(from, end);
}
/** The pins the candidate enforces, [{signature, md5}] (the target first), read from its own text: the proof asserts exactly these on the chain. */
export function parsePins(candidateText) {
  const start = candidateText.indexOf('for pin in select * from (values'), end = candidateText.indexOf(') p(signature, body_md5) loop', start);
  if (start < 0 || end < 0) throw new Error('CANDIDATE_PINS_NOT_FOUND');
  const found = [...candidateText.slice(start, end).matchAll(/\('([^']+)','([0-9a-f]{32})'\)/g)].map(match => ({signature: match[1], md5: match[2]}));
  if (found.length < 2) throw new Error('CANDIDATE_PINS_NOT_PARSED');
  return found;
}
/** The candidate with one pin's md5 replaced by zeros (the drift refusal test). */
export function tamperPin(candidateText, signature) {
  const needle = `('${signature}','`, at = candidateText.indexOf(needle);
  if (at < 0 || candidateText.indexOf(needle, at + 1) >= 0) throw new Error('PIN_NOT_FOUND_EXACTLY_ONCE:' + signature);
  const from = at + needle.length;
  if (!/^[0-9a-f]{32}'\)/.test(candidateText.slice(from, from + 34))) throw new Error('PIN_ROW_NOT_AS_EXPECTED:' + signature);
  return candidateText.slice(0, from) + '0'.repeat(32) + candidateText.slice(from + 32);
}
/** The candidate with a text replaced exactly once (a tamper test must change exactly one place; a missing or repeated anchor is an error of the test, never a silent no-op). */
export function replaceOnce(text, from, to) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`TAMPER_ANCHOR_OCCURS_${count}_TIMES: ${from.slice(0, 80)}`);
  return text.replace(from, () => to);
}
/** The transport rules of a generated SQL file: LF only, ASCII only, no tab, no backslash, no unicode escape text. [] when it obeys them. */
export function transportProblems(text, {allowBackslash = false} = {}) {
  const problems = [];
  if (text.includes('\r')) problems.push('CARRIAGE_RETURN');
  if (text.includes('\t')) problems.push('TAB');
  if ([...text].some(ch => ch.codePointAt(0) > 127)) problems.push('NON_ASCII');
  if (/\\u[0-9a-fA-F]{4}/.test(text)) problems.push('UNICODE_ESCAPE');
  if (!allowBackslash && text.includes('\\')) problems.push('BACKSLASH');
  return problems;
}

// ------------------------------------------------------------------ the registry (the rows of the candidate)
/** The twelve rows of the candidate: [{key, value}]. */
export function registryRowsOf(candidateText) {
  const rows = JSON.parse(dollarLiteral(candidateText, 'registry'));
  if (!Array.isArray(rows)) throw new Error('REGISTRY_NOT_AN_ARRAY');
  return rows;
}
/** The registry rows as the function reads them. */
export const registryModel = rows => new Map(rows.map(row => [row.key, row.value]));
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
/**
 * What the function's validity query demands, restated: the head row (schema, the closed kind list in order, the fold version) and, for every kind of the closed set, a row work_kind:<KIND>
 * with the kind schema, `kind` equal to the key suffix and `stems` an array. Extra rows with another suffix are IGNORED (no data row can add a kind). [] when valid.
 */
export function registryProblems(rows) {
  const problems = [], model = registryModel(rows);
  const head = model.get(HEAD_KEY);
  if (!isObject(head) || head.schema !== HEAD_SCHEMA || !eq(head.kinds, CLOSED_KINDS) || head.foldVersion !== FOLD_VERSION) problems.push('HEAD_ROW');
  for (const kind of CLOSED_KINDS) {
    const row = model.get(KIND_PREFIX + kind);
    if (!isObject(row) || row.schema !== KIND_SCHEMA || row.kind !== kind || !Array.isArray(row.stems)) problems.push('KIND_ROW ' + kind);
  }
  return problems;
}
/** The stem alphabet rule the postflight and the application enforce on the shipped rows: lower-case ASCII letters and inner spaces, at least four characters, strings only. */
export function stemProblems(rows) {
  const problems = [];
  for (const row of rows) {
    if (!row.key.startsWith(KIND_PREFIX)) continue;
    for (const stem of row.value?.stems ?? []) {
      if (typeof stem !== 'string' || !STEM_PATTERN.test(stem) || stem.length < MIN_STEM_LENGTH) problems.push(`${row.key}: ${JSON.stringify(stem)}`);
    }
  }
  return problems;
}
/** {KIND: [stems]} of the registry (only the closed kinds, in the closed order). */
export function stemsOf(rows) {
  const model = registryModel(rows);
  return Object.fromEntries(CLOSED_KINDS.map(kind => [kind, [...(model.get(KIND_PREFIX + kind)?.stems ?? [])]]));
}

// ------------------------------------------------------------------ the fold (typed letter by letter: an independent writing of the same table)
const LATIN_LETTERS = {'č': 'c', 'ć': 'c', 'š': 's', 'đ': 'd', 'ž': 'z', 'Č': 'c', 'Ć': 'c', 'Š': 's', 'Đ': 'd', 'Ž': 'z'};
const CYRILLIC_LETTERS = {
  'А': 'a', 'а': 'a', 'Б': 'b', 'б': 'b', 'В': 'v', 'в': 'v', 'Г': 'g', 'г': 'g', 'Д': 'd', 'д': 'd', 'Ђ': 'd', 'ђ': 'd', 'Е': 'e', 'е': 'e', 'Ж': 'z', 'ж': 'z', 'З': 'z', 'з': 'z',
  'И': 'i', 'и': 'i', 'Ј': 'j', 'ј': 'j', 'К': 'k', 'к': 'k', 'Л': 'l', 'л': 'l', 'М': 'm', 'м': 'm', 'Н': 'n', 'н': 'n', 'О': 'o', 'о': 'o', 'П': 'p', 'п': 'p', 'Р': 'r', 'р': 'r',
  'С': 's', 'с': 's', 'Т': 't', 'т': 't', 'Ћ': 'c', 'ћ': 'c', 'У': 'u', 'у': 'u', 'Ф': 'f', 'ф': 'f', 'Х': 'h', 'х': 'h', 'Ц': 'c', 'ц': 'c', 'Ч': 'c', 'ч': 'c', 'Ш': 's', 'ш': 's',
  'Љ': 'lj', 'љ': 'lj', 'Њ': 'nj', 'њ': 'nj', 'Џ': 'dz', 'џ': 'dz',
};
export const FOLD_LETTER_COUNT = Object.keys(LATIN_LETTERS).length + Object.keys(CYRILLIC_LETTERS).length;   // 10 + 60
/** btrim(spaces), the Serbian Latin diacritics and the Serbian Cyrillic alphabet to plain Latin letters (both cases), then lower case. The SQL does the digraph letters first and then one translate: same result. */
export function foldText(text) {
  let out = '';
  for (const ch of text.replace(/^ +| +$/g, '')) out += LATIN_LETTERS[ch] ?? CYRILLIC_LETTERS[ch] ?? ch;
  return out.toLowerCase();
}
export const hasCyrillic = text => /[Ѐ-ӿ]/.test(text);

// ------------------------------------------------------------------ the classification: the NEW function and the OLD one
export class RegistryInvalid extends Error {
  constructor(problems) {
    super('WORK_KINDS_REGISTRY_INVALID: ' + problems.join(', '));
    this.code = 'WORK_KINDS_REGISTRY_INVALID';
    this.problems = problems;
  }
}
/**
 * private.work_kinds_v5 after ex06b. values: an array of strings and nulls, or null. An empty or null array answers [] BEFORE the registry is read (so an invalid registry does not fail an empty call),
 * every other call validates the registry first (RegistryInvalid). A kind is named when one of its stems of at least four characters occurs INSIDE one folded value. Sorted, unique.
 */
export function kindsOf(values, rows) {
  if (values === null || values === undefined || values.length === 0) return [];
  const problems = registryProblems(rows);
  if (problems.length) throw new RegistryInvalid(problems);
  const folded = values.filter(value => value !== null).map(foldText);
  const stems = stemsOf(rows);
  return CLOSED_KINDS.filter(kind => stems[kind].some(stem => stem.length >= MIN_STEM_LENGTH && folded.some(text => text.includes(stem)))).sort();
}

/** The kinds and literal stems of the PKG-031b body, parsed from its regular expressions (labou?r is the two literals labor and labour). */
export function parseOldBody(bodyText) {
  const found = {};
  for (const match of bodyText.matchAll(/case when t ~ '\(([^']+)\)' then '([A-Z_]+)' end/g)) {
    const stems = [];
    for (const alternative of match[1].split('|')) stems.push(...(alternative === 'labou?r' ? ['labor', 'labour'] : [alternative]));
    if (!stems.every(stem => /^[a-z ]+$/.test(stem))) throw new Error('OLD_STEM_NOT_LITERAL: ' + match[1]);
    found[match[2]] = stems;
  }
  if (!eq(Object.keys(found), CLOSED_KINDS)) throw new Error('OLD_BODY_KIND_LIST: ' + Object.keys(found).join(','));
  return found;
}
/** private.work_kinds_v5 before ex06b (PKG-031b): lower, btrim, the ten Latin letters, then the stems as substrings of each value. oldStems = parseOldBody(...). */
export function oldKindsOf(values, oldStems) {
  const folded = (values ?? []).filter(value => value !== null).map(value => {
    let out = '';
    for (const ch of value.replace(/^ +| +$/g, '').toLowerCase()) out += LATIN_LETTERS[ch] ?? ch;
    return out;
  });
  return CLOSED_KINDS.filter(kind => oldStems[kind].some(stem => folded.some(text => text.includes(stem)))).sort();
}

/** The written deltas, derived from the stem tables: which probes may differ between the old and the new function (a Cyrillic letter, an added stem, a removed stem). */
export function explainedByDeltas(values, {oldStems, newStems}) {
  const texts = (values ?? []).filter(value => value !== null);
  if (texts.some(hasCyrillic)) return true;
  const folded = texts.map(foldText);
  const touched = [];
  for (const kind of CLOSED_KINDS) {
    for (const stem of newStems[kind]) if (!oldStems[kind].includes(stem)) touched.push(stem);
    for (const stem of oldStems[kind]) if (!newStems[kind].includes(stem)) touched.push(stem);
  }
  return touched.some(stem => folded.some(text => text.includes(stem)));
}

// ------------------------------------------------------------------ the probe set the proof sends to the real function (deterministic)
const LATIN_TO_CYRILLIC = {a: 'а', b: 'б', c: 'ц', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'х', i: 'и', j: 'ј', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', z: 'з', ' ': ' '};
/** The Cyrillic transliteration of a Latin stem (null when it has a letter Serbian Cyrillic does not use: w, x, y, q). The digraphs nj and lj become the single letters. */
export function toCyrillic(stem) {
  if ([...stem].some(ch => !(ch in LATIN_TO_CYRILLIC))) return null;
  return [...stem.replace(/nj/g, 'њ').replace(/lj/g, 'љ')].map(ch => LATIN_TO_CYRILLIC[ch] ?? ch).join('');
}
const WORDS_WITH_DIACRITICS = ['Čišćenje stana', 'ČIŠĆENJE', 'nameštaj', 'Montaža nameštaja', 'krečenje', 'Selidba i transport', 'prenošenje stvari', 'košenje trave', 'Održavanje', 'dostava paketa', 'Peglanje', 'Pranje veša',
  'bašta', 'dvorište', 'gletovanje zidova', 'majstor za sitne popravke', 'usisavanje', 'utovar i istovar', 'sklapanje IKEA nameštaja'];
/** A tiny seeded generator (mulberry32): the negative probes are the same on every run. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/**
 * The probes: [{id, tag, values}]. Every stem of the old and the new registry in plain, embedded, upper-case, Cyrillic and upper-case Cyrillic form; each stem split over two values; real words
 * with diacritics; combinations over several values; the edge arrays; and seeded random lower-case words (mostly negative). The order and the content are deterministic.
 */
export function buildProbes({oldStems, newStems, randomCount = 120}) {
  const probes = [];
  const add = (tag, values) => probes.push({id: probes.length + 1, tag, values});
  const allStems = [...new Set(CLOSED_KINDS.flatMap(kind => [...oldStems[kind], ...newStems[kind]]))];
  for (const stem of allStems) {
    add('stem', [stem]);
    add('embedded', [`pomoc oko ${stem}a u kuci`]);
    add('upper', [`XX ${stem.toUpperCase()} YY`]);
    add('padded', [`  ${stem}  `]);
    const cyr = toCyrillic(stem);
    if (cyr) { add('cyrillic', [cyr]); add('cyrillic-upper', [cyr.toUpperCase()]); add('cyrillic-sentence', [`Треба ми ${cyr} danas`]); }
    if (stem.length >= 6) add('split', [stem.slice(0, Math.floor(stem.length / 2)), stem.slice(Math.floor(stem.length / 2))]);
  }
  for (const word of WORDS_WITH_DIACRITICS) add('diacritic', [word]);
  const kinds = CLOSED_KINDS.map(kind => newStems[kind][0]);
  for (let i = 0; i < kinds.length; i++) add('multi', [kinds[i], kinds[(i + 3) % kinds.length], null, '']);
  add('multi', kinds.slice(0, 5));
  for (const values of [[], null, [null], [''], ['   '], [null, null], ['a', 'b']]) add('edge', values);
  const next = seeded(20261002), letters = 'abcdefghijklmnoprstuvz ';
  for (let i = 0; i < randomCount; i++) {
    let text = '';
    const length = 4 + Math.floor(next() * 14);
    for (let j = 0; j < length; j++) text += letters[Math.floor(next() * letters.length)];
    add('random', [text.trim() || 'qqqq']);
  }
  return probes;
}

/** Splits probe results into what is wrong: the NEW function against the new model, the OLD one against the old model, and every difference between old and new that no written delta explains. */
export function probeProblems({probes, results, oldStems, rows, state}) {
  const problems = [];
  for (const probe of probes) {
    const got = results.get(probe.id);
    const want = state === 'before' ? oldKindsOf(probe.values, oldStems) : kindsOf(probe.values, rows);
    if (!eq(got, want)) problems.push({id: probe.id, tag: probe.tag, values: probe.values, got, want});
  }
  return problems;
}
/** For ONE state pair: the probes whose old and new answers differ without a written delta (the "same behaviour for every Latin text" claim). [] when none. */
export function unexplainedDifferences({probes, before, after, oldStems, newStems}) {
  const problems = [];
  for (const probe of probes) {
    if (eq(before.get(probe.id), after.get(probe.id))) continue;
    if (!explainedByDeltas(probe.values, {oldStems, newStems})) problems.push({id: probe.id, tag: probe.tag, values: probe.values, before: before.get(probe.id), after: after.get(probe.id)});
  }
  return problems;
}
/** SELECT over the probes: one JSON array [{i, k}] (the real function applied to each). The values travel as a JSON literal. */
export function probeSql(probes, q) {
  const json = JSON.stringify(probes.map(probe => ({i: probe.id, v: probe.values})));
  return `select coalesce(jsonb_agg(jsonb_build_object('i', p.i, 'k', private.work_kinds_v5(p.v)) order by p.i), '[]'::jsonb) from jsonb_to_recordset(${q(json)}::jsonb) as p(i integer, v text[])`;
}
export const probeResults = rows => new Map(rows.map(row => [row.i, row.k]));

// ------------------------------------------------------------------ the corpus v1.1 (function-level probes, accepted consequences, product-path cases)
const PERSONAL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\+\d{8,}|\b0\d{2}[ /-]?\d{3}[ /-]?\d{3,4}\b|https?:\/\//;
const EXPECT_FIELDS = ['hardBlockers', 'dispatchBlockers', 'dispatchEligible', 'responseAllowed', 'delivery', 'event'];
const GATE_FIELDS = ['hardBlockers', 'dispatchBlockers', 'dispatchEligible', 'responseAllowed', 'delivery', 'event'];

/** The corpus v1.1 as parsed JSON, checked for shape: [] problems when it is a well-formed additive corpus (the semantics are checked by corpusSemanticProblems). */
export function corpusShapeProblems(corpus) {
  const problems = [];
  const need = (cond, text) => { if (!cond) problems.push(text); };
  need(corpus?.schema === 'EX06_CONTRACT_CORPUS_V1_1_ADDITIVE' && corpus.version === '1.1', 'HEADER');
  need(corpus?.synthetic === true && corpus.providerCalls === 0 && corpus.runAgainstProvider === false, 'SYNTHETIC_NO_PROVIDER');
  need(corpus?.extends?.sha256Lf === CORPUS_V1_PIN.sha256 && corpus.extends.corpus === CORPUS_V1_PIN.path, 'EXTENDS_THE_PINNED_V1');
  need(eq(corpus?.workKinds, CLOSED_KINDS), 'THE_ELEVEN_KINDS');
  need(corpus?.classificationVersion === CLASSIFICATION_VERSION, 'CLASSIFICATION_VERSION');
  for (const key of ['passRate', 'threshold', 'score']) need(!(key in (corpus ?? {})), 'NO_' + key.toUpperCase());
  const ids = new Set();
  for (const list of ['kindProbes', 'acceptedConsequences', 'cases']) need(Array.isArray(corpus?.[list]) && corpus[list].length > 0, 'LIST ' + list);
  for (const item of [...(corpus?.kindProbes ?? []), ...(corpus?.acceptedConsequences ?? []), ...(corpus?.cases ?? [])]) {
    need(typeof item.id === 'string' && !ids.has(item.id), 'DUPLICATE_ID ' + item.id);
    ids.add(item.id);
  }
  const text = JSON.stringify(corpus ?? {});
  need(!PERSONAL.test(text), 'PERSONAL_DATA_PATTERN');
  for (const probe of [...(corpus?.kindProbes ?? []), ...(corpus?.acceptedConsequences ?? [])]) {
    need(probe.values === null || (Array.isArray(probe.values) && probe.values.every(value => value === null || typeof value === 'string')), 'PROBE_VALUES ' + probe.id);
    need(Array.isArray(probe.expect) && probe.expect.every(kind => CLOSED_KINDS.includes(kind)), 'PROBE_EXPECT ' + probe.id);
    need(probe.before === undefined || (Array.isArray(probe.before) && probe.before.every(kind => CLOSED_KINDS.includes(kind))), 'PROBE_BEFORE ' + probe.id);
  }
  for (const item of corpus?.cases ?? []) {
    need(/^T-1\d\d$/.test(item.id), 'CASE_ID ' + item.id);
    need(isObject(item.expectedFacts) && Array.isArray(item.expectedKinds) && isObject(item.expectedEligibility) && isObject(item.referenceWorkers), 'CASE_SHAPE ' + item.id);
    for (const key of ['fit', 'unfit']) need(isObject(item.expectedEligibility?.[key]), `CASE_${key.toUpperCase()}_EXPECTATION ${item.id}`);
    for (const [label, spec] of Object.entries(item.referenceWorkers ?? {})) {
      need(/^[A-Za-z0-9_-]{1,28}$/.test(label) && isObject(spec) && isObject(spec.expect) && isObject(spec.profile) && Array.isArray(spec.profile.skills) && spec.profileFrom === 'fit', `WORKER_SHAPE ${item.id}/${label}`);
    }
  }
  return problems;
}

/** The kinds a text array names, restricted to what the stored task shows: category + required skills (the exclusion input) and the required skills alone (the service-match arm). */
const taskKindsInput = facts => [facts['need.category'], ...facts['need.required_skills']];
const lowerArr = list => (list ?? []).filter(value => value !== null).map(value => value.replace(/^ +| +$/g, '').toLowerCase());
const overlaps = (a, b) => a.some(value => b.includes(value));
/**
 * The mini model of the two gates the kind classification feeds (private.match_detail_without_calendar after PKG-031b): the service match (no required skill, or an exact lower-case overlap, or a kind
 * overlap) and the exclusion (exact overlap of exclusions with category + required skills, or a kind overlap). Returns what a worker whose OTHER gates are open is expected to show. kindsFn is
 * the old or the new classification.
 */
export function gateModel({facts, skills, exclusions = []}, kindsFn) {
  const required = facts['need.required_skills'];
  const service = required.length === 0 || overlaps(lowerArr(skills), lowerArr(required)) || overlaps(kindsFn(skills), kindsFn(required));
  const excluded = overlaps(lowerArr(exclusions), lowerArr(taskKindsInput(facts))) || overlaps(kindsFn(exclusions), kindsFn(taskKindsInput(facts)));
  const hard = excluded ? [EXCLUSION_CODE] : [], disp = service ? [] : [SERVICE_CODE];
  const eligible = hard.length === 0 && disp.length === 0;
  return {hardBlockers: hard, dispatchBlockers: disp, dispatchEligible: eligible, responseAllowed: hard.length === 0, delivery: eligible, event: eligible};
}

/**
 * The semantics of the corpus v1.1 against the two classifications: every probe's `expect` is the NEW model's answer and its `before` (default: the same) the OLD model's; every consequence flips
 * the way it says; every product-path worker's `expect` / `before` is what the gate model gives under the new / old classification; the derived fit and unfit workers behave as the harness derives
 * them; the added stems, the removed stem, Cyrillic, the unknown words and the edge arrays are all covered; and the contested kinds appear nowhere. [] when the corpus is sound.
 */
export function corpusSemanticProblems(corpus, {rows, oldStems}) {
  const problems = [];
  const oldKinds = values => oldKindsOf(values, oldStems), newKinds = values => kindsOf(values, rows);
  const say = text => problems.push(text);
  for (const probe of corpus.kindProbes) {
    if (!eq(newKinds(probe.values), probe.expect)) say(`PROBE_EXPECT_DISAGREES_WITH_THE_NEW_MODEL ${probe.id}: ${JSON.stringify(probe.values)} model ${JSON.stringify(newKinds(probe.values))} written ${JSON.stringify(probe.expect)}`);
    if (!eq(oldKinds(probe.values), probe.before ?? probe.expect)) say(`PROBE_BEFORE_DISAGREES_WITH_THE_OLD_MODEL ${probe.id}: ${JSON.stringify(probe.values)} model ${JSON.stringify(oldKinds(probe.values))} written ${JSON.stringify(probe.before ?? probe.expect)}`);
    if (probe.before !== undefined && eq(probe.before, probe.expect)) say('PROBE_BEFORE_EQUALS_EXPECT_SO_IT_IS_NOT_A_DELTA ' + probe.id);
    for (const kind of [...probe.expect, ...(probe.before ?? [])]) if (CONTESTED_KINDS.includes(kind)) say(`PROBE_NAMES_A_CONTESTED_KIND ${probe.id}: ${kind}`);
  }
  for (const item of corpus.acceptedConsequences) {
    if (!eq(newKinds(item.values), item.expect) || !eq(oldKinds(item.values), item.before)) say('CONSEQUENCE_DISAGREES_WITH_THE_MODELS ' + item.id);
    if (eq(item.before, item.expect) || typeof item.consequence !== 'string' || typeof item.remedy !== 'string') say('CONSEQUENCE_NEEDS_A_DELTA_A_CONSEQUENCE_AND_A_REMEDY ' + item.id);
  }
  // the added stems each have a probe that failed before and passes after; the removed stem has its F2 probe; Cyrillic, unknown words and the edge arrays are covered
  const flips = corpus.kindProbes.filter(probe => probe.before !== undefined);
  for (const [kind, stems] of Object.entries(STEMS_ADDED)) {
    for (const stem of stems) {
      if (!flips.some(probe => (probe.values ?? []).some(value => value !== null && foldText(value).includes(stem)) && probe.expect.includes(kind) && !probe.before.includes(kind))) say(`ADDED_STEM_WITHOUT_A_FAIL_BEFORE_PASS_AFTER_PROBE ${kind} ${stem}`);
    }
  }
  for (const [kind, stems] of Object.entries(STEMS_REMOVED)) {
    for (const stem of stems) if (!flips.some(probe => probe.before.includes(kind) && !probe.expect.includes(kind) && (probe.values ?? []).some(value => value !== null && foldText(value).includes(stem)))) say(`REMOVED_STEM_WITHOUT_AN_F2_PROBE ${kind} ${stem}`);
  }
  if (flips.filter(probe => (probe.values ?? []).some(value => value !== null && hasCyrillic(value)) && probe.before.length === 0 && probe.expect.length > 0).length < 6) say('FEW_CYRILLIC_FLIPS');
  if (new Set(flips.filter(probe => (probe.values ?? []).some(value => value !== null && hasCyrillic(value))).flatMap(probe => probe.expect)).size < 4) say('CYRILLIC_COVERS_FEWER_THAN_FOUR_KINDS');
  if (corpus.kindProbes.filter(probe => probe.expect.length === 0 && probe.before === undefined && (probe.values ?? []).some(value => value !== null && value.trim() !== '')).length < 3) say('FEW_UNKNOWN_WORD_PROBES');
  for (const edge of [null, [], [null], ['']]) if (!corpus.kindProbes.some(probe => eq(probe.values, edge))) say('MISSING_EDGE_PROBE ' + JSON.stringify(edge));
  // the product-path cases
  for (const item of corpus.cases) {
    const facts = item.expectedFacts;
    for (const key of ['need.title', 'need.description', 'need.category']) if (typeof facts[key] !== 'string' || facts[key].length < 3) say(`CASE_FACT ${item.id} ${key}`);
    if (!Array.isArray(facts['need.required_skills']) || facts['need.required_skills'].length === 0) say('CASE_NEEDS_REQUIRED_SKILLS ' + item.id);
    if (!eq(sortedSet(newKinds(taskKindsInput(facts))), item.expectedKinds)) say(`CASE_KINDS_DISAGREE_WITH_THE_NEW_MODEL ${item.id}: ${JSON.stringify(newKinds(taskKindsInput(facts)))} vs ${JSON.stringify(item.expectedKinds)}`);
    if (!eq(oldKinds(taskKindsInput(facts)), item.beforeKinds)) say(`CASE_BEFORE_KINDS_DISAGREE_WITH_THE_OLD_MODEL ${item.id}`);
    for (const kind of [...item.expectedKinds, ...item.beforeKinds]) if (CONTESTED_KINDS.includes(kind)) say(`CASE_NAMES_A_CONTESTED_KIND ${item.id}: ${kind}`);
    const required = facts['need.required_skills'];
    // the harness derives fit (the task's own skills) and unfit (an unrelated skill); their expectations are written in expectedEligibility
    const derived = {fit: {skills: [...required]}, unfit: {skills: ['nepovezano zanimanje']}};
    for (const [label, spec] of Object.entries(derived)) {
      const written = item.expectedEligibility[label];
      for (const [state, fn] of [['new', newKinds], ['old', oldKinds]]) {
        const model = gateModel({facts, skills: spec.skills}, fn);
        if (!eq(pick(model), pick(written))) say(`DERIVED_${label.toUpperCase()}_DISAGREES_WITH_THE_${state.toUpperCase()}_MODEL ${item.id}`);
      }
    }
    let named = false;
    for (const [label, spec] of Object.entries(item.referenceWorkers)) {
      const input = {facts, skills: spec.profile.skills, exclusions: spec.profile.bypass?.exclusions ?? []};
      const afterModel = gateModel(input, newKinds), beforeModel = gateModel(input, oldKinds);
      if (!eq(pick(afterModel), pick(spec.expect))) say(`WORKER_EXPECT_DISAGREES_WITH_THE_NEW_MODEL ${item.id}/${label}: model ${JSON.stringify(pick(afterModel))}`);
      if (!eq(pick(beforeModel), pick(spec.before ?? spec.expect))) say(`WORKER_BEFORE_DISAGREES_WITH_THE_OLD_MODEL ${item.id}/${label}: model ${JSON.stringify(pick(beforeModel))}`);
      if (spec.before !== undefined && eq(pick(spec.before), pick(spec.expect))) say(`WORKER_BEFORE_EQUALS_EXPECT ${item.id}/${label}`);
      if (spec.expect.dispatchEligible === false || spec.expect.responseAllowed === false) named = true;
      if ((spec.expect.dispatchEligible === false || spec.expect.responseAllowed === false) && spec.expect.hardBlockers.length + spec.expect.dispatchBlockers.length === 0) say(`NEGATIVE_WITHOUT_A_NAMED_CAUSE ${item.id}/${label}`);
      for (const skill of spec.profile.skills) if (skill.trim() === '') say(`WORKER_SKILL_EMPTY ${item.id}/${label}`);
    }
    if (!named) say(`CASE_WITHOUT_AN_EXTRA_NAMED_NEGATIVE ${item.id}`);
    // a FLIP case changes something between the old and the new classification; a STAYS case is a regression guard that must not
    const flipping = Object.values(item.referenceWorkers).some(spec => spec.before !== undefined) || !eq(item.expectedKinds, item.beforeKinds);
    if (item.purpose === 'FLIP' && !flipping) say('A_FLIP_CASE_THAT_FLIPS_NOTHING ' + item.id);
    if (item.purpose === 'STAYS' && flipping) say('A_STAYS_CASE_THAT_FLIPS ' + item.id);
    if (item.purpose !== 'FLIP' && item.purpose !== 'STAYS') say('CASE_PURPOSE ' + item.id);
  }
  return problems;
}
const pick = expectation => Object.fromEntries(Object.entries(expectation).filter(([key]) => GATE_FIELDS.includes(key)));

/**
 * What the S03 runner must report as FINDINGS on the predecessor for the v1.1 cases (`case|worker|field`, sorted): for every worker with a `before`, the fields of its written `expect` that differ
 * from `before`, and the hidden-kinds check of a case whose kinds differ before. The new function must report none of them.
 */
export function failBeforeFindings(corpus) {
  const keys = [];
  for (const item of corpus.cases) {
    for (const [label, spec] of Object.entries(item.referenceWorkers)) {
      if (spec.before === undefined) continue;
      for (const field of EXPECT_FIELDS) if (field in spec.expect && !eq(spec.expect[field], spec.before[field])) keys.push(`${item.id}|${label}|${field}`);
    }
    if (!eq(item.expectedKinds, item.beforeKinds)) keys.push(`${item.id}|-|hidden kinds of the stored task (category + required skills)`);
  }
  return keys.sort();
}

// ------------------------------------------------------------------ the product-path passes
/** What a corpus pass is compared on, from one entry of runner.runCase: the observed answer of every worker, the wave and the round rows. */
export function outcomeOf(entry) {
  const workers = {};
  for (const w of entry.workers ?? []) {
    const o = w.observed ?? {};
    workers[w.label] = {hardBlockers: sortedSet(o.hardBlockers), dispatchBlockers: sortedSet(o.dispatchBlockers), dispatchEligible: o.dispatchEligible ?? null, delivery: o.delivery ?? null,
      event: o.event ?? null, score: typeof o.score === 'number' ? o.score : null};
  }
  return {id: entry.id, refused: entry.status === 'PRODUCT_PATH_REFUSED', wave: entry.wave ? {status: entry.wave.status ?? null, inserted: entry.wave.inserted ?? null} : null,
    rounds: (entry.rounds ?? []).map(r => ({round_no: r.round_no, status: r.status, stop_reason: r.stop_reason ?? null})), workers};
}
/** Every difference between two passes ({caseId: outcome} each): [{caseId, worker (null = the case), field, before, after}]. Scores differ only beyond 1e-6. */
export function diffOutcomes(before, after, {tolerance = 1e-6} = {}) {
  const diffs = [], push = (caseId, worker, field, b, a) => diffs.push({caseId, worker, field, before: b, after: a});
  for (const caseId of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    const a = before[caseId], b = after[caseId];
    if (!a || !b) { push(caseId, null, 'PRESENT', Boolean(a), Boolean(b)); continue; }
    if (a.refused !== b.refused) push(caseId, null, 'refused', a.refused, b.refused);
    if (a.wave?.status !== b.wave?.status) push(caseId, null, 'wave.status', a.wave?.status ?? null, b.wave?.status ?? null);
    if (a.wave?.inserted !== b.wave?.inserted) push(caseId, null, 'wave.inserted', a.wave?.inserted ?? null, b.wave?.inserted ?? null);
    if (!eq(a.rounds, b.rounds)) push(caseId, null, 'rounds', a.rounds, b.rounds);
    for (const label of [...new Set([...Object.keys(a.workers), ...Object.keys(b.workers)])].sort()) {
      const x = a.workers[label], y = b.workers[label];
      if (!x || !y) { push(caseId, label, 'PRESENT', Boolean(x), Boolean(y)); continue; }
      for (const field of ['hardBlockers', 'dispatchBlockers', 'dispatchEligible', 'delivery', 'event']) if (!eq(x[field], y[field])) push(caseId, label, field, x[field], y[field]);
      const bothNumbers = typeof x.score === 'number' && typeof y.score === 'number';
      if (bothNumbers ? Math.abs(x.score - y.score) > tolerance : x.score !== y.score) push(caseId, label, 'score', x.score, y.score);
    }
  }
  return diffs;
}
/** Splits diffs into {matched, unintended, missing} against an allow-list (entries with before/after, or a scoreDelta). Each entry may be used once. */
export function checkFlips(diffs, allowed, {tolerance = 1e-6} = {}) {
  const used = new Set(), unintended = [], matched = [];
  const fits = (entry, diff) => entry.caseId === diff.caseId && entry.worker === diff.worker && entry.field === diff.field
    && (entry.scoreDelta !== undefined ? typeof diff.before === 'number' && typeof diff.after === 'number' && Math.abs(diff.after - diff.before - entry.scoreDelta) <= tolerance : eq(entry.before, diff.before) && eq(entry.after, diff.after));
  for (const diff of diffs) {
    const index = allowed.findIndex((entry, i) => !used.has(i) && fits(entry, diff));
    if (index < 0) unintended.push(diff);
    else { used.add(index); matched.push(diff); }
  }
  return {matched, unintended, missing: allowed.filter((_, i) => !used.has(i)).map(entry => ({caseId: entry.caseId, worker: entry.worker, field: entry.field}))};
}
const t31 = (field, before, after) => ({caseId: 'T-031', worker: 'does-not-fit', field, before, after});
/**
 * THE INTENDED FLIPS of the candidate on the real S02 corpus, written down BEFORE any run from the corpus text (T-031, "Sklapanje maketa": the task names NO kind, so the furniture assembler it declares
 * as DOES_NOT_FIT is not eligible) and from S03 finding F2, not from the after-state: the DOES_NOT_FIT worker of T-031 loses the service match (SERVICE_NOT_IN_WORK_PROFILE appears, he is no longer
 * eligible, delivered or notified, -30 points of the capability component) and the one wave inserts one delivery instead of two. Every other difference between the passes is UNINTENDED.
 */
export const V1_INTENDED_FLIPS = Object.freeze([
  t31('dispatchEligible', true, false), t31('dispatchBlockers', [], [SERVICE_CODE]), t31('delivery', true, false), t31('event', true, false),
  {caseId: 'T-031', worker: 'does-not-fit', field: 'score', scoreDelta: -30},
  {caseId: 'T-031', worker: null, field: 'wave.inserted', before: 2, after: 1},
]);
/** The findings (`case|worker|field`) of the S03 corpus that the candidate closes: F2 (the three keys of T-031). Nothing else may change. */
export const V1_FINDINGS_CLOSED = Object.freeze(['T-031|-|hidden kinds of the stored task (category + required skills)', 'T-031|does-not-fit|dispatchBlockers', 'T-031|does-not-fit|dispatchEligible']);
/** The full match_detail of every v1 worker: key `case|label` -> the change that is allowed (everything else must be identical). */
export const V1_DETAIL_EXPECTATIONS = Object.freeze({'T-031|does-not-fit': {service: 'LOST'}});

/** The full match_detail of every corpus worker, before against after, as problems: each pair equal except as `expectations` says. */
export function corpusDetailProblems(before, after, expectations = V1_DETAIL_EXPECTATIONS) {
  const problems = [];
  for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
    if (!before[key] || !after[key]) { problems.push(`${key}: DETAIL_MISSING (${before[key] ? 'after' : 'before'})`); continue; }
    for (const problem of matchDetailDelta(before[key], after[key], expectations[key] ?? {})) problems.push(`${key}: ${problem}`);
  }
  for (const key of Object.keys(expectations)) if (!before[key] && !after[key]) problems.push(`${key}: EXPECTED_DETAIL_NOT_READ`);
  return problems;
}
const withoutIds = detail => { const copy = {...detail}; delete copy.workerAccountId; delete copy.workerProfileId; return copy; };
const close = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 0.051;
/**
 * The whole difference between the predecessor's and the candidate's match_detail of ONE pair, as problems ([] = exactly the intended change). spec = {} means "identical". spec.service:
 * 'LOST' | 'GAINED' = the service match (30 points, the SERVICE_MATCH reason, the SERVICE_NOT_IN_WORK_PROFILE blocker); spec.exclusion: 'GAINED' = PROFILE_EXCLUSION appears (a hard gate: responseAllowed and
 * dispatchEligible turn false, nothing else moves). Every other field is identical, the eligibility follows the blockers.
 */
export function matchDetailDelta(before, after, spec = {}) {
  if (!before || !after) return ['DETAIL_MISSING'];
  const a = withoutIds(before), b = withoutIds(after);
  const service = spec.service ?? null, exclusion = spec.exclusion ?? null;
  if (service === null && exclusion === null) return eq(a, b) ? [] : ['UNINTENDED_CHANGE ' + Object.keys(a).filter(key => !eq(a[key], b[key])).join(',')];
  const problems = [];
  const rest = detail => { const copy = {...detail}; for (const key of ['hardBlockers', 'dispatchBlockers', 'dispatchEligible', 'responseAllowed', 'reasonCodes', 'score', 'scoreComponents']) delete copy[key]; return copy; };
  if (!eq(rest(a), rest(b))) problems.push('UNINTENDED_FIELD_CHANGED ' + Object.keys(rest(a)).filter(key => !eq(a[key], b[key])).join(','));
  for (const key of ['schedule', 'distanceToStart', 'resources', 'reliability', 'fairness']) if (!close(a.scoreComponents?.[key], b.scoreComponents?.[key])) problems.push('SCORE_COMPONENT_CHANGED ' + key);
  const hardBefore = sortedSet(a.hardBlockers), hardAfter = sortedSet(b.hardBlockers), dispBefore = sortedSet(a.dispatchBlockers), dispAfter = sortedSet(b.dispatchBlockers);
  const wantHard = exclusion === 'GAINED' ? sortedSet([...hardBefore, EXCLUSION_CODE]) : hardBefore;
  let wantDisp = dispBefore;
  if (service === 'LOST') wantDisp = sortedSet([...dispBefore, SERVICE_CODE]);
  if (service === 'GAINED') wantDisp = dispBefore.filter(code => code !== SERVICE_CODE);
  if (!eq(hardAfter, wantHard)) problems.push(`HARD_BLOCKERS ${JSON.stringify(hardBefore)} -> ${JSON.stringify(hardAfter)}`);
  if (!eq(dispAfter, wantDisp)) problems.push(`DISPATCH_BLOCKERS ${JSON.stringify(dispBefore)} -> ${JSON.stringify(dispAfter)}`);
  if (service === 'LOST' && dispBefore.includes(SERVICE_CODE)) problems.push('LOST_WITHOUT_THE_SERVICE_MATCH_BEFORE');
  if (service === 'GAINED' && !dispBefore.includes(SERVICE_CODE)) problems.push('GAINED_WITHOUT_THE_BLOCKER_BEFORE');
  if (exclusion === 'GAINED' && hardBefore.includes(EXCLUSION_CODE)) problems.push('EXCLUSION_GAINED_BUT_PRESENT_BEFORE');
  const reasonsBefore = sortedSet(a.reasonCodes);
  const wantReasons = service === 'LOST' ? reasonsBefore.filter(code => code !== 'SERVICE_MATCH') : service === 'GAINED' ? sortedSet([...reasonsBefore, 'SERVICE_MATCH']) : reasonsBefore;
  if (!eq(sortedSet(b.reasonCodes), wantReasons)) problems.push(`REASON_CODES ${JSON.stringify(reasonsBefore)} -> ${JSON.stringify(sortedSet(b.reasonCodes))}`);
  const capBefore = Number(a.scoreComponents?.capability), capAfter = Number(b.scoreComponents?.capability);
  const wantCap = service === 'LOST' ? 0 : service === 'GAINED' ? 30 : capBefore;
  if (!close(capAfter, wantCap)) problems.push(`CAPABILITY_COMPONENT ${capBefore} -> ${capAfter}`);
  if (service === 'LOST' && !close(capBefore, 30)) problems.push('LOST_FROM_A_CAPABILITY_OTHER_THAN_30');
  if (service === 'GAINED' && !close(capBefore, 0)) problems.push('GAINED_FROM_A_CAPABILITY_OTHER_THAN_0');
  const wantScore = Math.min(100, ['capability', 'schedule', 'distanceToStart', 'resources', 'reliability', 'fairness'].reduce((sum, key) => sum + Number(key === 'capability' ? wantCap : b.scoreComponents?.[key]), 0));
  if (!close(b.score, Math.round(wantScore * 10) / 10)) problems.push(`SCORE ${a.score} -> ${b.score} (wanted ${wantScore})`);
  const eligible = hardAfter.length === 0 && dispAfter.length === 0;
  if (b.dispatchEligible !== eligible) problems.push('DISPATCH_ELIGIBLE_NOT_FROM_BLOCKERS');
  if (b.responseAllowed !== (hardAfter.length === 0)) problems.push('RESPONSE_ALLOWED_NOT_FROM_HARD_BLOCKERS');
  return problems;
}
/** The detail expectation of every v1.1 worker: key `case|label` -> {service | exclusion} from its written before/expect (unchanged workers are absent, so they must be identical). */
export function v11DetailExpectations(corpus) {
  const out = {};
  for (const item of corpus.cases) {
    for (const [label, spec] of Object.entries(item.referenceWorkers)) {
      if (spec.before === undefined) continue;
      const change = {};
      const hard = spec.expect.hardBlockers.includes(EXCLUSION_CODE) && !spec.before.hardBlockers.includes(EXCLUSION_CODE);
      const lost = spec.expect.dispatchBlockers.includes(SERVICE_CODE) && !spec.before.dispatchBlockers.includes(SERVICE_CODE);
      const gained = !spec.expect.dispatchBlockers.includes(SERVICE_CODE) && spec.before.dispatchBlockers.includes(SERVICE_CODE);
      if (hard) change.exclusion = 'GAINED';
      if (lost) change.service = 'LOST';
      if (gained) change.service = 'GAINED';
      out[`${item.id}|${label}`] = change;
    }
  }
  return out;
}
/** A pass must have really covered its cases: the outcome count is the expected one, no case was refused by the product path, and no status is a refusal, an unasserted case or a harness error. [] when covered. */
const BAD_STATUSES = ['PRODUCT_PATH_REFUSED', 'UNASSERTED', 'HARNESS_ERROR', 'RUN'];
export function coverageProblems({outcomes, summary, expectedCases}) {
  const problems = [], keys = Object.keys(outcomes ?? {});
  if (keys.length !== expectedCases) problems.push(`CASES_COVERED ${keys.length} of ${expectedCases}`);
  for (const key of keys) if (outcomes[key].refused) problems.push(`PRODUCT_PATH_REFUSED ${key}`);
  for (const status of Object.keys(summary?.statuses ?? {})) if (BAD_STATUSES.includes(status)) problems.push(`STATUS ${status} x${summary.statuses[status]}`);
  const total = Object.values(summary?.statuses ?? {}).reduce((sum, n) => sum + n, 0);
  if (total !== expectedCases) problems.push(`STATUS_TOTAL ${total} of ${expectedCases}`);
  return problems;
}
/** Every worker of every case must have its full match_detail captured (the comparison of the details cannot silently drop a worker). */
export function detailCoverageProblems({outcomes, details}) {
  const want = Object.entries(outcomes).flatMap(([id, item]) => Object.keys(item.workers).map(label => `${id}|${label}`)).sort();
  const got = Object.keys(details).sort();
  return eq(want, got) ? [] : [`DETAILS_CAPTURED ${got.length} of ${want.length}: missing ${want.filter(key => !got.includes(key)).slice(0, 5).join(', ')}`];
}
/** {caseId: {starts_at, ends_at}} of the stored times of a pass, from its runner entries (readBack.need): the one clock-derived input of the full detail (liveStateDate). */
export function timesOf(entries) {
  const times = {};
  for (const entry of entries) if (entry.readBack?.need) times[entry.id] = {starts_at: entry.readBack.need.starts_at ?? null, ends_at: entry.readBack.need.ends_at ?? null};
  return times;
}
/** Every case of `other` must carry the same stored starts_at / ends_at (as instants) as in `reference`, and the same rebase. */
export function corpusTimeProblems(reference, other, {referenceRebase = null, otherRebase = null} = {}) {
  const problems = [], ms = value => (value === null || value === undefined ? null : Date.parse(value));
  if ((referenceRebase?.deltaMs ?? null) !== (otherRebase?.deltaMs ?? null)) problems.push(`CORPUS_REBASE_DIFFERS ${referenceRebase?.deltaMs ?? null} -> ${otherRebase?.deltaMs ?? null}`);
  for (const [id, times] of Object.entries(other)) {
    const ref = reference[id];
    if (!ref) { problems.push(`CORPUS_TIMES_CASE_NOT_IN_THE_REFERENCE ${id}`); continue; }
    for (const field of ['starts_at', 'ends_at']) if (ms(ref[field]) !== ms(times[field])) problems.push(`CORPUS_TIMES_DIFFER ${id} ${field}: ${ref[field]} -> ${times[field]}`);
  }
  return problems;
}

// ------------------------------------------------------------------ catalog, surface and data deltas
/** {added, removed, changed:[{name, before, after}]} between two [{name, md5}] lists. */
export function diffNamed(before, after) {
  const a = new Map(before.map(row => [row.name, row.md5])), b = new Map(after.map(row => [row.name, row.md5]));
  return {added: [...b.keys()].filter(name => !a.has(name)).sort(), removed: [...a.keys()].filter(name => !b.has(name)).sort(),
    changed: [...b.keys()].filter(name => a.has(name) && a.get(name) !== b.get(name)).sort().map(name => ({name, before: a.get(name), after: b.get(name)}))};
}
/**
 * The surface lines (function:signature:md5:definer=...:volatility=...:config=...:acl=...) that differ between two reads: {removed, added, names, onlyTheTarget}. The target's line must change in its md5 AND its
 * volatility (immutable i -> stable s) and in nothing else (the same definer flag, config and ACL), and no other line may move.
 */
export function surfaceDelta(before, after, {targetName = 'private.work_kinds_v5'} = {}) {
  const removed = before.filter(line => !after.includes(line)), added = after.filter(line => !before.includes(line));
  const name = line => line.split(':')[1];
  const parts = line => line.split(':');
  const names = [...new Set([...removed, ...added].map(name))].sort();
  let onlyTheTarget = removed.length === 1 && added.length === 1 && name(removed[0]).startsWith(targetName + '(') && name(added[0]) === name(removed[0]);
  if (onlyTheTarget) {
    const x = parts(removed[0]), y = parts(added[0]);
    // function:<sig>:<md5>:definer=..:volatility=..:config=..:acl=..
    const rest = list => list.filter((part, i) => i !== 2 && !part.startsWith('volatility='));   // everything but the md5 and the volatility: signature, definer flag, config, ACL
    const sameRest = x.length === 7 && y.length === 7 && eq(rest(x), rest(y));
    onlyTheTarget = sameRest && x[2] !== y[2] && x.some(part => part === 'volatility=i') && y.some(part => part === 'volatility=s');
  }
  return {removed, added, names, onlyTheTarget};
}
/** The fingerprint of the ROWS (not their timestamps) of a list [{key, value}]: what two applications of the same candidate must agree on. */
export const rowsFingerprint = rows => sha256([...rows].sort((x, y) => (x.key < y.key ? -1 : 1)).map(row => row.key + '\u001f' + JSON.stringify(row.value)).join('\u001e'));

// ------------------------------------------------------------------ the data edits the proof performs inside rolled-back transactions
/**
 * [{name, sql, expect}] (expect: {json: <the value the last SELECT prints>} | {error: <a text the error must contain>}). Every edit is a transaction that is ROLLED BACK; the proof checks the config
 * fingerprint after each one. The data is the alias: a stem added by an UPDATE is a classification change with no new function. The words 'qwxzaa' and the key NEW_UNAPPROVED_KIND are nonsense on purpose.
 */
export function dataEditPlan() {
  const call = values => `select to_jsonb(private.work_kinds_v5(array[${values.map(value => `'${value}'`).join(', ')}]::text[]))`;
  const setStems = (kind, stems) => `update private.marketplace_config set value = jsonb_set(value, '{stems}', '${JSON.stringify(stems)}'::jsonb) where key = '${KIND_PREFIX}${kind}'`;
  const setField = (key, field, json) => `update private.marketplace_config set value = jsonb_set(value, '{${field}}', '${json}'::jsonb) where key = '${key}'`;
  const refused = (name, edit) => ({name, sql: `begin; ${edit}; ${call(['ciscenje'])}; rollback;`, expect: {error: 'WORK_KINDS_REGISTRY_INVALID'}});
  return [
    {name: 'AN_ALIAS_IS_A_DATA_EDIT', sql: `begin; update private.marketplace_config set value = jsonb_set(value, '{stems}', value -> 'stems' || '"qwxzaa"'::jsonb) where key = '${KIND_PREFIX}BASTA_DVORISTE'; ${call(['about qwxzaa today'])}; rollback;`, expect: {json: ['BASTA_DVORISTE']}},
    {name: 'A_STEM_REMOVED_BY_A_DATA_EDIT_NO_LONGER_MATCHES', sql: `begin; ${setStems('MOLERSKI_RADOVI', ['moler'])}; ${call(['ofarba sobu'])}; rollback;`, expect: {json: []}},
    {name: 'A_STEM_REMOVED_BY_A_DATA_EDIT_LEAVES_THE_OTHERS', sql: `begin; ${setStems('MOLERSKI_RADOVI', ['moler'])}; ${call(['moler'])}; rollback;`, expect: {json: ['MOLERSKI_RADOVI']}},
    {name: 'A_TWELFTH_KIND_ROW_IS_IGNORED', sql: `begin; insert into private.marketplace_config(key, value) values ('${KIND_PREFIX}NEW_UNAPPROVED_KIND', '{"schema": "WORK_KIND_V1", "kind": "NEW_UNAPPROVED_KIND", "stems": ["qwxzaa"]}'::jsonb); ${call(['about qwxzaa today'])}; rollback;`, expect: {json: []}},
    {name: 'A_KEY_OF_THE_NAMESPACE_CANNOT_BE_INSERTED_TWICE', sql: `begin; insert into private.marketplace_config(key, value) values ('${KIND_PREFIX}CISCENJE', '{}'::jsonb); rollback;`, expect: {error: 'duplicate key value violates unique constraint'}},
    {name: 'THE_VERSION_IS_DATA_AND_THE_FUNCTION_DOES_NOT_READ_IT', sql: `begin; ${setField(HEAD_KEY, 'classificationVersion', '"WK-2"')}; ${call(['ciscenje'])}; rollback;`, expect: {json: ['CISCENJE']}},
    refused('A_MISSING_HEAD_ROW_IS_REFUSED_LOUDLY', `delete from private.marketplace_config where key = '${HEAD_KEY}'`),
    refused('A_MISSING_KIND_ROW_IS_REFUSED_LOUDLY', `delete from private.marketplace_config where key = '${KIND_PREFIX}DOSTAVA'`),
    refused('A_WRONG_HEAD_SCHEMA_IS_REFUSED_LOUDLY', setField(HEAD_KEY, 'schema', '"WORK_KINDS_HEAD_V2"')),
    refused('A_CHANGED_KIND_LIST_IN_THE_HEAD_IS_REFUSED_LOUDLY', `update private.marketplace_config set value = jsonb_set(value, '{kinds}', value -> 'kinds' || '"NEW_UNAPPROVED_KIND"'::jsonb) where key = '${HEAD_KEY}'`),
    refused('A_WRONG_FOLD_VERSION_IS_REFUSED_LOUDLY', setField(HEAD_KEY, 'foldVersion', '"SR_LATIN_V0"')),
    refused('STEMS_THAT_ARE_NOT_AN_ARRAY_ARE_REFUSED_LOUDLY', setField(KIND_PREFIX + 'CISCENJE', 'stems', '"ciscenje"')),
    refused('A_KIND_ROW_WHOSE_KIND_DIFFERS_FROM_ITS_KEY_IS_REFUSED_LOUDLY', setField(KIND_PREFIX + 'CISCENJE', 'kind', '"DOSTAVA"')),
    refused('A_KIND_ROW_WITH_THE_WRONG_SCHEMA_IS_REFUSED_LOUDLY', setField(KIND_PREFIX + 'CISCENJE', 'schema', '"WORK_KIND_V0"')),
    {name: 'AN_EMPTY_CALL_ANSWERS_BEFORE_THE_REGISTRY_IS_READ', sql: `begin; delete from private.marketplace_config where key = '${HEAD_KEY}'; select jsonb_build_array(to_jsonb(private.work_kinds_v5(array[]::text[])), to_jsonb(private.work_kinds_v5(null::text[]))); rollback;`, expect: {json: [[], []]}},
    {name: 'A_STEM_SHORTER_THAN_FOUR_CHARACTERS_IS_IGNORED', sql: `begin; ${setStems('CISCENJE', ['cis'])}; ${call(['cistoca cis'])}; rollback;`, expect: {json: []}},
  ];
}

// ------------------------------------------------------------------ the v1.1 product path: the flips the corpus itself writes
/**
 * The differences between the predecessor's pass and the candidate's pass of the corpus v1.1, as written in the corpus (never read from the after-state): for every worker with a `before` the fields of
 * outcomeOf that differ between `before` and `expect`, the score (+30 when the service match is gained, -30 when it is lost; a hard exclusion moves no component) and the number of deliveries of the wave.
 * The derived fit worker is eligible and delivered in both states; every other worker is counted by its written eligibility.
 */
export function v11IntendedFlips(corpus) {
  const flips = [];
  for (const item of corpus.cases) {
    let insertedBefore = 1, insertedAfter = 1;
    for (const [label, spec] of Object.entries(item.referenceWorkers)) {
      if (spec.before === undefined) {
        if (spec.expect.dispatchEligible) { insertedBefore += 1; insertedAfter += 1; }
        continue;
      }
      if (spec.before.dispatchEligible) insertedBefore += 1;
      if (spec.expect.dispatchEligible) insertedAfter += 1;
      for (const field of ['hardBlockers', 'dispatchBlockers', 'dispatchEligible', 'delivery', 'event']) {
        if (!eq(spec.before[field], spec.expect[field])) flips.push({caseId: item.id, worker: label, field, before: spec.before[field], after: spec.expect[field]});
      }
      const hadService = !spec.before.dispatchBlockers.includes(SERVICE_CODE), hasService = !spec.expect.dispatchBlockers.includes(SERVICE_CODE);
      if (hadService !== hasService) flips.push({caseId: item.id, worker: label, field: 'score', scoreDelta: hasService ? 30 : -30});
    }
    if (insertedBefore !== insertedAfter) flips.push({caseId: item.id, worker: null, field: 'wave.inserted', before: insertedBefore, after: insertedAfter});
  }
  return flips;
}

// D12 written comment with the star rating: PURE helpers of the disposable-chain proof (node:crypto only: no database, no network, no file read at import).
// Everything here is either (a) a JS MIRROR of a rule the SQL candidate states (the unit tests tie every mirror to the generated candidate text, so a drift fails offline),
// (b) the shape of an outcome the proof asserts (exact message + SQLSTATE + HTTP status, never "any error"), or (c) data (the validation matrix, the weakening plan, the surface-delta classifier).
// Nothing in this file has seen a database: the first CI run of d12_proof.mjs is the first observation of every SQL outcome named here.
import {createHash} from 'node:crypto';

export const COMMENT_MAX_CHARS = 500, COMMENT_MAX_OCTETS = 2000, COMMENT_JSON_MAX_OCTETS = 8192, PAGE_DEFAULT = 20, PAGE_MAX = 50;
export const TABLE = 'private.agreement_review_comments_v1';
export const TABLE_NAME = 'agreement_review_comments_v1';
export const SIG = Object.freeze({
  submitV2: 'public.rpc_submit_agreement_review_v2(uuid,uuid,jsonb,jsonb,uuid,jsonb)',
  contextV2: 'public.rpc_get_my_agreement_review_v2(uuid)',
  reader: 'public.rpc_list_review_comments_v1(uuid,integer,jsonb)',
  moderate: 'public.rpc_moderate_review_comment_service_v1(uuid,text,text,uuid)',
  input: 'private.review_comment_input_v1(jsonb)',
  guard: 'private.guard_review_comment_mutation()',
  legacySubmit: 'public.rpc_submit_agreement_review(uuid,uuid,jsonb,jsonb,uuid)',
  legacyContext: 'public.rpc_get_my_agreement_review(uuid)',
  reputation: 'public.rpc_get_account_reputation(uuid)',
  publicProfile: 'public.rpc_get_public_profile(uuid)',
  relations: 'private.closure_redaction_relations_v5()',
  scope: 'private.closure_redaction_scope_v5(text)',
  patch: 'private.closure_redaction_patch_v5(text,jsonb,uuid,uuid)',
  readiness: 'private.retention_ai_source_ready()',
  exportCatalog: 'private.data_export_dataset_catalog()',
  exportSnapshot: 'private.data_export_snapshot(uuid,uuid,jsonb,timestamptz)',
  exportBinding: 'private.data_export_policy_binding()',
});
export const NEW_FUNCTIONS = Object.freeze([SIG.guard, SIG.input, SIG.submitV2, SIG.contextV2, SIG.reader, SIG.moderate]);
export const CLIENT_FUNCTIONS = Object.freeze([SIG.submitV2, SIG.contextV2, SIG.reader]);
export const REWRITTEN_FUNCTIONS = Object.freeze([SIG.relations, SIG.scope, SIG.patch, SIG.exportCatalog, SIG.exportSnapshot, SIG.exportBinding]);
/** The retention class the comment table joins (round-1 finding): its description names the free text and sets no period. The unit tests tie both texts to the generated candidate. */
export const RETENTION_CLASS = 'AGREEMENT_REVIEWS';
export const RETENTION_DESCRIPTION_OLD = 'Immutable bilateral completed-Agreement reviews and their account-level reputation projection (private.agreement_reviews).';
export const RETENTION_DESCRIPTION_NEW = 'Immutable bilateral completed-Agreement reviews and their account-level reputation projection (private.agreement_reviews), plus the optional written comment of a review '
  + '(private.agreement_review_comments_v1): free text of the author, erased when the author account is closed; this description sets no retention period.';
export const CHANGED_FUNCTIONS = Object.freeze([...REWRITTEN_FUNCTIONS, SIG.readiness]);
export const TRIGGERS = Object.freeze(['agreement_review_comment_closure_guard_v1', 'agreement_review_comment_mutation_guard_v1']);
export const INDEXES = Object.freeze([TABLE_NAME + '_author_idx', TABLE_NAME + '_pkey', TABLE_NAME + '_target_idx']);
export const COLUMNS = Object.freeze(['review_id', 'author_account_id', 'target_account_id', 'comment', 'comment_sha256', 'created_at', 'hidden_at', 'hidden_reason_code']);
export const CONSTRAINTS = Object.freeze([TABLE_NAME + '_author_fkey', TABLE_NAME + '_hidden_check', TABLE_NAME + '_parties_check', TABLE_NAME + '_pkey', TABLE_NAME + '_review_fkey',
  TABLE_NAME + '_sha_check', TABLE_NAME + '_target_fkey', TABLE_NAME + '_text_chars_check', TABLE_NAME + '_text_length_check', TABLE_NAME + '_text_trim_check']);
/** The legacy review functions that must stay BYTE-IDENTICAL (their md5 is pinned from canonical DEV; the proof also compares before and after on the chain). */
export const LEGACY_FUNCTIONS = Object.freeze([SIG.legacySubmit, SIG.legacyContext, SIG.reputation, SIG.publicProfile, 'private.account_reputation(uuid)',
  'private.review_receipt(private.agreement_reviews,boolean)', 'private.guard_review_immutable()', 'private.review_tag_catalog()', 'private.review_tags_valid(text[])']);

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// text rules: the forbidden class and the "no comment" class are written ONCE, as code point ranges (the generator build_d12.py holds the same table: a unit test compares the strings)
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// THE CLOSED, EXPLICIT CLASSES (see build_d12.py for the reasoning; the unit tests compare both tables and the SQL expressions character for character). FORBIDDEN = controls, the line/paragraph separators, EVERY default-ignorable code point
// of Unicode 17.0 except the four allowed-inside groups, the annotation characters and the hieroglyph format controls; BLANK = an EXPLICIT white-space class plus the characters that render as nothing (a comment of only these is "no comment");
// STRIP = removed from the NFKC copy the contact floor reads; DIGIT_SETS = mapped to ASCII digits for the floor.
export const FORBIDDEN_RANGES = Object.freeze([[0x0001, 0x0009], [0x000B, 0x001F], [0x007F, 0x009F], [0x061C, 0x061C], [0x115F, 0x1160], [0x17B4, 0x17B5], [0x180B, 0x180F], [0x200B, 0x200B], [0x200E, 0x200F], [0x2028, 0x202E],
  [0x2060, 0x206F], [0x3164, 0x3164], [0xFEFF, 0xFEFF], [0xFFA0, 0xFFA0], [0xFFF0, 0xFFFB], [0x13430, 0x1343F], [0x1BCA0, 0x1BCA3], [0x1D173, 0x1D17A], [0xE0000, 0xE0FFF]]);
export const BLANK_RANGES = Object.freeze([[0x0009, 0x000D], [0x0020, 0x0020], [0x0085, 0x0085], [0x00A0, 0x00A0], [0x00AD, 0x00AD], [0x034F, 0x034F], [0x1680, 0x1680], [0x2000, 0x200A], [0x200C, 0x200D], [0x2028, 0x2029], [0x202F, 0x202F],
  [0x205F, 0x205F], [0x2800, 0x2800], [0x3000, 0x3000], [0xFE00, 0xFE0F]]);
export const STRIP_RANGES = Object.freeze([[0x00AD, 0x00AD], [0x034F, 0x034F], [0x200C, 0x200D], [0x2800, 0x2800], [0xFE00, 0xFE0F]]);
/** The Default_Ignorable_Code_Point property of Unicode 17.0 (DerivedCoreProperties.txt), as Node 24.18 / ICU 78.3 reads it; the unit tests re-read the property in the running Node and require it to be CLOSED by the classes here. */
export const UNICODE_VERSION_OF_RECORD = '17.0';
export const DEFAULT_IGNORABLE_RANGES = Object.freeze([[0x00AD, 0x00AD], [0x034F, 0x034F], [0x061C, 0x061C], [0x115F, 0x1160], [0x17B4, 0x17B5], [0x180B, 0x180F], [0x200B, 0x200F], [0x202A, 0x202E], [0x2060, 0x206F], [0x3164, 0x3164],
  [0xFE00, 0xFE0F], [0xFEFF, 0xFEFF], [0xFFA0, 0xFFA0], [0xFFF0, 0xFFF8], [0x1BCA0, 0x1BCA3], [0x1D173, 0x1D17A], [0xE0000, 0xE0FFF]]);
/** The default-ignorable groups that stay ALLOWED inside a sentence (soft hyphen, combining grapheme joiner, ZWNJ/ZWJ, the sixteen variation selectors) and mean "no comment" alone. */
export const ALLOWED_INSIDE_RANGES = Object.freeze([[0x00AD, 0x00AD], [0x034F, 0x034F], [0x200C, 0x200D], [0xFE00, 0xFE0F]]);
/** What FORBIDDEN holds beyond the default-ignorable set. */
export const FORBIDDEN_BEYOND_DEFAULT_IGNORABLE = Object.freeze([[0x0001, 0x0009], [0x000B, 0x001F], [0x007F, 0x009F], [0x2028, 0x2029], [0xFFF9, 0xFFFB], [0x13430, 0x1343F]]);
export const inRanges = (ranges, codePoint) => ranges.some(([lo, hi]) => codePoint >= lo && codePoint <= hi);
/**
 * FIRST CI RUN: the 66 Unicode NONCHARACTERS (U+FDD0..U+FDEF and U+FFFE/U+FFFF of each of the 17 planes). They are valid scalar values, they are not default-ignorable and the closed text class does NOT name them: they are a documented
 * residual (a font may draw a replacement glyph or nothing), ACCEPTED and returned byte for byte. The matrix derives their expectation from the class tables above, so deciding to forbid one later is a table edit that flips exactly these cases.
 */
export const NONCHARACTERS = Object.freeze([...Array.from({length: 32}, (_, index) => 0xFDD0 + index), ...Array.from({length: 17}, (_, plane) => [plane * 0x10000 + 0xFFFE, plane * 0x10000 + 0xFFFF]).flat()]);
export const DIGIT_SETS = Object.freeze([[0x0660, 0x0669], [0x06F0, 0x06F9]]);
/** The SQL text expression exactly as the generator writes it: a bracket expression built from chr() pieces (the generated SQL carries no escape text and no non-ASCII character). */
export const chrPiece = codePoint => 'chr(' + codePoint + ')';
export function pgClassExpr(opening, ranges, closing) {
  const pieces = ["'" + opening + "'"];
  for (const [lo, hi] of ranges) { pieces.push(chrPiece(lo)); if (hi !== lo) { pieces.push("'-'"); pieces.push(chrPiece(hi)); } }
  pieces.push("'" + closing + "'");
  return '(' + pieces.join(' || ') + ')';
}
export const FORBIDDEN_EXPR_PG = pgClassExpr('[', FORBIDDEN_RANGES, ']');
export const BLANK_EXPR_PG = pgClassExpr('^[', BLANK_RANGES, ']*$');
export const STRIP_EXPR_PG = pgClassExpr('[', STRIP_RANGES, ']');
export const DIGITS_FROM_EXPR_PG = DIGIT_SETS.flatMap(([lo, hi]) => Array.from({length: hi - lo + 1}, (_, index) => chrPiece(lo + index))).join(' || ');
export const DIGITS_TO_PG = '0123456789'.repeat(DIGIT_SETS.length);
/** The same classes for JavaScript (a code point escape inside a RegExp source: JS, never SQL). */
const jsClass = ranges => ranges.map(([lo, hi]) => '\\u{' + lo.toString(16) + '}' + (hi !== lo ? '-\\u{' + hi.toString(16) + '}' : '')).join('');
export const FORBIDDEN_RE = new RegExp('[' + jsClass(FORBIDDEN_RANGES) + ']', 'u');
/** The three class tables as one object; classifyCommentWith builds its regular expressions from the tables it is given (the default tables are the generated ones), so a test can mutate one table and watch the matrix flip. */
export const DEFAULT_TABLES = Object.freeze({forbidden: FORBIDDEN_RANGES, blank: BLANK_RANGES, strip: STRIP_RANGES});
const regexCache = new Map();
function regexesOf(tables) {
  const key = JSON.stringify(tables);
  if (!regexCache.has(key)) regexCache.set(key, {forbidden: new RegExp('[' + jsClass(tables.forbidden) + ']', 'u'), blank: new RegExp('^[' + jsClass(tables.blank) + ']*$', 'u'), strip: new RegExp('[' + jsClass(tables.strip) + ']', 'gu')});
  return regexCache.get(key);
}
/** The blank class is EXPLICIT (ASCII white space U+0009..U+000D and U+0020 are listed in BLANK_RANGES): the answer never depends on the database locale (round-2 finding: POSIX [[:space:]] also matches U+001C..U+001F in en_US.UTF-8). */
/** The NFKC copy the contact floor reads as well: invisible characters removed, Arabic-Indic and Persian digits mapped to ASCII. The stored text is always the original. */
export function normalizedForFloor(value, tables = DEFAULT_TABLES) {
  const stripped = String(value).normalize('NFKC').replace(regexesOf(tables).strip, '');
  return [...stripped].map(character => { const code = character.codePointAt(0); for (const [lo, hi] of DIGIT_SETS) if (code >= lo && code <= hi) return String(code - lo); return character; }).join('');
}
/** TRANSPORT SAFETY (round-1 blocker): the text of a unicode escape (a backslash, u, four hex digits) in a generated SQL file. A connector resolves it before Postgres sees it. */
export const findEscapeTexts = text => [...String(text).matchAll(/\\[uU][0-9A-Fa-f]{4}/g)].map(match => match[0]);
export const nonAsciiCharacters = text => [...new Set([...String(text)].filter(character => character.codePointAt(0) > 127))];
/** What a connector (execute_sql / apply_migration) does to an SQL text, as MEASURED read-only on 2026-10-01: it RESOLVES the escape text of every non-ASCII, non-surrogate code point; the escapes of U+0001..U+007F stay literal. */
export function simulateConnectorRoundTrip(text) {
  return String(text).replace(/\\u([0-9A-Fa-f]{4})/g, (whole, hex) => { const codePoint = parseInt(hex, 16); return codePoint >= 0x80 && !(codePoint >= 0xD800 && codePoint <= 0xDFFF) ? String.fromCodePoint(codePoint) : whole; });
}
export const codePoints = text => [...String(text)].length;
export const utf8Octets = text => Buffer.byteLength(String(text), 'utf8');
export const sha256Hex = text => createHash('sha256').update(Buffer.from(String(text), 'utf8')).digest('hex');
export const md5Hex = text => createHash('md5').update(String(text)).digest('hex');
export const md5Lf = text => md5Hex(String(text).replace(/\r/g, ''));
/** The trim of the SQL: btrim(v, E' \n') removes spaces and line feeds ONLY (a tab or an NBSP at the edge is not trimmed). */
const trimSpaceLf = text => text.replace(/^[ \n]+/, '').replace(/[ \n]+$/, '');

/**
 * private.ru4b_public_floor_reason (the Q&A contact floor, IMMUTABLE) AS IT IS LIVE ON DEV (md5 3462ec03, since PKG-029c / ledger 183; the migration 20260905060000 text, md5 51ae9296, is the OLD one):
 * the e-mail, link and @handle rules unchanged, and a PHONE rule that needs a run of 8+ digit-like characters that STARTS like a phone number (0, 00, + or 381), holds 8 to 13 digits and is not a date shape.
 * The unit tests tie the constants below to the PKG-029c candidate text.
 */
export const PHONE_RUN = /(\+?[0-9][0-9 ()/.\-]{6,}[0-9])/g, PHONE_START = /^(\+|00|0|381)/, PHONE_DATE_SHAPE = /^[0-9]{1,2}[./][0-9]{1,2}[./][0-9]{2,4}/, PHONE_DIGITS = [8, 13];
export function contactFloorReason(text) {
  const v = String(text ?? '').replace(/^ +/, '').replace(/ +$/, '');
  if (v === '') return 'EMPTY_CONTENT';
  if (/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i.test(v)) return 'EMAIL_NOT_PUBLIC';
  if (/(https?:\/\/|www\.)/i.test(v)) return 'OFF_PLATFORM_LINK_NOT_PUBLIC';
  if (/(^|[ \t\n\r\f\v])@[A-Z0-9_.]{2,}/i.test(v)) return 'SOCIAL_HANDLE_NOT_PUBLIC';
  for (const match of v.matchAll(PHONE_RUN)) {
    const digits = match[1].replace(/[^0-9]/g, '').length;
    if (PHONE_START.test(match[1].replace(/[^0-9+]/g, '')) && digits >= PHONE_DIGITS[0] && digits <= PHONE_DIGITS[1] && !PHONE_DATE_SHAPE.test(match[1])) return 'PHONE_NOT_PUBLIC';
  }
  return null;
}

/**
 * private.review_comment_input_v1(p_comment jsonb): the mirror. `value` is the JSON-decoded p_comment (null = SQL NULL or JSON null; a string; or any other JSON value).
 * Returns {outcome: 'ABSENT'|'ACCEPTED'|'REFUSED', ...}: ABSENT stores nothing; REFUSED carries {name, sqlstate}. Every outcome is locale-independent (the three characters that used to depend on the locale are listed explicitly).
 */
export function classifyComment(value) { return classifyCommentWith(value, DEFAULT_TABLES); }
export function classifyCommentWith(value, tables) {
  const regexes = regexesOf(tables);
  if (value === null || value === undefined) return {outcome: 'ABSENT'};
  if (typeof value !== 'string') return {outcome: 'REFUSED', name: 'REVIEW_COMMENT_INVALID', sqlstate: '22023'};
  // jsonb::text of the string: quotes and backslashes are escaped, control characters become \uXXXX or a short escape; every other character stays raw
  const jsonOctets = utf8Octets(JSON.stringify(value));
  if (jsonOctets > COMMENT_JSON_MAX_OCTETS) return {outcome: 'REFUSED', name: 'REVIEW_COMMENT_TOO_LONG', sqlstate: '22023'};
  if (trimSpaceLf(value) === '') return {outcome: 'ABSENT'};
  if (regexes.blank.test(value)) return {outcome: 'ABSENT'};
  if (codePoints(value) > COMMENT_MAX_CHARS || utf8Octets(value) > COMMENT_MAX_OCTETS) return {outcome: 'REFUSED', name: 'REVIEW_COMMENT_TOO_LONG', sqlstate: '22023'};
  if (value !== trimSpaceLf(value) || regexes.forbidden.test(value)) return {outcome: 'REFUSED', name: 'REVIEW_COMMENT_INVALID', sqlstate: '22023'};
  // the floor runs on the text as sent AND on the NFKC copy without invisible characters and with ASCII digits (the stored text stays the original)
  if (contactFloorReason(value) !== null || contactFloorReason(normalizedForFloor(value, tables)) !== null) return {outcome: 'REFUSED', name: 'REVIEW_COMMENT_CONTACT_NOT_PUBLIC', sqlstate: '22023'};
  return {outcome: 'ACCEPTED', value};
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// the validation matrix: ONE list, three consumers (the JS mirror, the SQL function through a temp function, and the unit tests that tie the two together)
// `group` KNOWN_RESIDUAL = behaviour the candidate has TODAY and that is NOT claimed to be safe (the proof pins it so that a change is seen, never so that it is blessed).
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
const refused = name => ({outcome: 'REFUSED', name, sqlstate: '22023'});
const INVALID = refused('REVIEW_COMMENT_INVALID'), TOO_LONG = refused('REVIEW_COMMENT_TOO_LONG'), CONTACT = refused('REVIEW_COMMENT_CONTACT_NOT_PUBLIC');
const ABSENT = {outcome: 'ABSENT'}, ACCEPTED = {outcome: 'ACCEPTED'};
const ch = cp => String.fromCodePoint(cp);
export function buildMatrix() {
  const cases = [];
  const add = (group, id, value, expect, note = '') => cases.push({group, id, value, expect, note});
  // absent: nothing is stored, nothing is refused
  add('ABSENT', 'json_null', null, ABSENT); cases.push({group: 'ABSENT', id: 'sql_null', value: null, sqlNull: true, expect: ABSENT, note: 'SQL NULL (the key is omitted by a client that typed nothing)'});
  add('ABSENT', 'empty', '', ABSENT); add('ABSENT', 'one_space', ' ', ABSENT); add('ABSENT', 'only_lf', '\n', ABSENT);
  add('ABSENT', 'spaces_and_lf', '  \n \n ', ABSENT); add('ABSENT', 'only_tab', '\t', ABSENT, 'a lone tab is white space: absent, not invalid'); add('ABSENT', 'only_nbsp', ch(0xA0), ABSENT);
  add('ABSENT', 'only_ideographic_space', ch(0x3000), ABSENT); add('ABSENT', 'only_em_space', ch(0x2003), ABSENT); add('ABSENT', 'only_zwj', ch(0x200D), ABSENT, 'joiners and variation selectors alone are no comment');
  add('ABSENT', 'only_zwnj_with_spaces', ' ' + ch(0x200C) + ' ', ABSENT); add('ABSENT', 'only_vs16', ch(0xFE0F), ABSENT);
  // round-1 finding F1 + invisible characters: U+0085, U+2028 and U+2029 are listed explicitly (no locale dependence); the characters that render as nothing but are tolerated inside a sentence mean "no comment" when alone
  add('ABSENT', 'only_nel', ch(0x85), ABSENT, 'listed explicitly: the answer never depends on the database locale'); add('ABSENT', 'only_line_separator', ch(0x2028), ABSENT); add('ABSENT', 'only_paragraph_separator', ch(0x2029), ABSENT);
  add('ABSENT', 'only_soft_hyphen', ch(0x00AD), ABSENT); add('ABSENT', 'only_combining_grapheme_joiner', ch(0x034F), ABSENT); add('ABSENT', 'only_braille_blank', ch(0x2800), ABSENT);
  add('ABSENT', 'only_invisible_mix', ch(0xAD) + ch(0x34F) + ch(0x2800) + ' ' + ch(0x200D), ABSENT);
  // round-2 finding (certificate #5): the blank class is EXPLICIT, so the ASCII white space is exactly U+0009..U+000D and U+0020 in every locale (a lone vertical tab, form feed or carriage return is "no comment")
  add('ABSENT', 'only_cr', '\r', ABSENT); add('ABSENT', 'only_vt', ch(0x0B), ABSENT); add('ABSENT', 'only_ff', ch(0x0C), ABSENT); add('ABSENT', 'ascii_white_space_mix', ' \t\r\n' + ch(0x0B) + ch(0x0C) + ' ', ABSENT);
  // round-2 finding (security #1): ALL sixteen variation selectors alone are "no comment" (the old class stopped at FE0E/FE0F, so VS1..VS14 alone were refused only by accident, as a misnamed contact refusal)
  add('ABSENT', 'only_vs1', ch(0xFE00), ABSENT); add('ABSENT', 'only_vs14', ch(0xFE0D), ABSENT); add('ABSENT', 'only_vs15', ch(0xFE0E), ABSENT);
  add('ABSENT', 'only_all_sixteen_variation_selectors', Array.from({length: 16}, (_, index) => ch(0xFE00 + index)).join(''), ABSENT);
  add('ABSENT', 'only_three_ordinary_spaces_around_zwj', '   ' + ch(0x200D) + '   ', ABSENT);
  // not a string
  for (const [id, value] of [['number', 5], ['float', 1.5], ['true', true], ['false', false], ['empty_array', []], ['array_of_text', ['a']], ['empty_object', {}], ['object_with_text', {comment: 'a'}]]) add('TYPE', id, value, INVALID);
  // length: code points after the legacy trim, octets as the second bound
  add('LENGTH', 'one_character', 'A', ACCEPTED); add('LENGTH', 'ascii_500', 'a'.repeat(500), ACCEPTED); add('LENGTH', 'ascii_501', 'a'.repeat(501), TOO_LONG);
  add('LENGTH', 'two_byte_500', ch(0x161).repeat(500), ACCEPTED); add('LENGTH', 'two_byte_501', ch(0x161).repeat(501), TOO_LONG);
  add('LENGTH', 'astral_500', ch(0x1F600).repeat(500), ACCEPTED, '500 code points of 4 octets = exactly the 2000 octet bound'); add('LENGTH', 'astral_501', ch(0x1F600).repeat(501), TOO_LONG);
  add('LENGTH', 'mixed_astral_last_500', 'a'.repeat(499) + ch(0x1F600), ACCEPTED); add('LENGTH', 'mixed_astral_last_501', 'a'.repeat(500) + ch(0x1F600), TOO_LONG);
  add('LENGTH', 'json_over_8192', 'a'.repeat(9000), TOO_LONG); add('LENGTH', 'long_with_control_char_is_too_long_first', 'a'.repeat(600) + '\u0001', TOO_LONG, 'the length check comes before the character check');
  // trim: the server REJECTS, it never trims (a client sends trimmed NFC text)
  add('TRIM', 'leading_space', ' a', INVALID); add('TRIM', 'trailing_space', 'a ', INVALID); add('TRIM', 'leading_lf', '\na', INVALID); add('TRIM', 'trailing_lf', 'a\n', INVALID);
  add('TRIM', 'inner_space', 'a b', ACCEPTED); add('TRIM', 'inner_lf', 'a\nb', ACCEPTED); add('TRIM', 'inner_blank_line', 'a\n\nb', ACCEPTED); add('TRIM', 'trailing_nbsp_is_not_trimmed', 'a' + ch(0xA0), ACCEPTED);
  // control characters (LF is the only one allowed)
  for (const [id, cp] of [['tab', 0x09], ['cr', 0x0D], ['soh', 0x01], ['bs', 0x08], ['vt', 0x0B], ['ff', 0x0C], ['us', 0x1F], ['del', 0x7F], ['nel', 0x85], ['c1_9f', 0x9F]]) add('CONTROL', 'inner_' + id, 'a' + ch(cp) + 'b', INVALID);
  add('CONTROL', 'crlf', 'a\r\nb', INVALID);
  // round-2 finding (certificate #5): U+001C..U+001F are NOT white space (POSIX [[:space:]] matched them in en_US.UTF-8 only): a comment made of one of them alone is INVALID in every locale, never "no comment"
  for (const [id, cp] of [['fs_u001c', 0x1C], ['gs_u001d', 0x1D], ['rs_u001e', 0x1E], ['us_u001f', 0x1F], ['soh_u0001', 0x01], ['del_u007f', 0x7F], ['c1_u009f', 0x9F]]) add('CONTROL', 'alone_' + id, ch(cp), INVALID, 'a control that is not ASCII white space is never a blank comment');
  // bidi and zero-width format characters
  for (const [id, cp] of [['alm', 0x061C], ['zwsp', 0x200B], ['lrm', 0x200E], ['rlm', 0x200F], ['line_sep', 0x2028], ['para_sep', 0x2029], ['lre', 0x202A], ['rle', 0x202B], ['pdf', 0x202C], ['lro', 0x202D],
    ['rlo', 0x202E], ['word_joiner', 0x2060], ['lri', 0x2066], ['rli', 0x2067], ['fsi', 0x2068], ['pdi', 0x2069], ['bom', 0xFEFF]]) add('BIDI_ZERO_WIDTH', 'inner_' + id, 'a' + ch(cp) + 'b', INVALID);
  // invisible filler and format characters that are REFUSED anywhere in the text, and also when they are the whole comment (a comment of only such a character must not be stored as an empty-looking comment)
  for (const [id, cp] of [['invisible_times_u2061', 0x2061], ['invisible_separator_u2063', 0x2063], ['invisible_plus_u2064', 0x2064], ['inhibit_swap_u206a', 0x206A], ['nominal_digit_shapes_u206f', 0x206F], ['hangul_filler_u3164', 0x3164],
    ['halfwidth_hangul_filler_uffa0', 0xFFA0], ['hangul_choseong_filler_u115f', 0x115F], ['hangul_jungseong_filler_u1160', 0x1160], ['khmer_inherent_u17b4', 0x17B4], ['khmer_inherent_u17b5', 0x17B5],
    ['mongolian_selector_u180b', 0x180B], ['mongolian_vowel_separator_u180e', 0x180E], ['mongolian_selector_u180f', 0x180F], ['annotation_anchor_ufff9', 0xFFF9], ['annotation_terminator_ufffb', 0xFFFB],
    ['tag_block_start_ue0000', 0xE0000], ['tag_latin_a_ue0041', 0xE0041], ['tag_cancel_ue007f', 0xE007F],
    // round-2 finding (security #1): the rest of the Default_Ignorable_Code_Point set (Unicode 17.0) and the two format-control blocks that render as nothing
    ['ideographic_variation_selector_ue0100', 0xE0100], ['ideographic_variation_selector_ue01ef', 0xE01EF], ['reserved_plane14_ue01f0', 0xE01F0], ['reserved_plane14_ue0fff', 0xE0FFF], ['reserved_u2065', 0x2065],
    ['reserved_ufff0', 0xFFF0], ['reserved_ufff8', 0xFFF8], ['shorthand_format_overlap_u1bca0', 0x1BCA0], ['shorthand_format_up_step_u1bca3', 0x1BCA3], ['musical_begin_beam_u1d173', 0x1D173], ['musical_end_phrase_u1d17a', 0x1D17A],
    ['hieroglyph_format_u13430', 0x13430], ['hieroglyph_format_u1343f', 0x1343F]]) {
    add('INVISIBLE_FORBIDDEN', 'inner_' + id, 'a' + ch(cp) + 'b', INVALID); add('INVISIBLE_FORBIDDEN', 'alone_' + id, ch(cp), INVALID, 'a comment of ONLY this character is refused, never stored as an empty-looking comment');
    // inside a phone number the character is refused as an invalid character (the forbidden check runs BEFORE the contact floor), so the number can no longer be hidden by it
    add('INVISIBLE_FORBIDDEN', 'phone_split_by_' + id, 'zovi 064' + ch(cp) + '1234567', INVALID, 'a phone number split by this character is refused (INVALID, before the contact floor reads it)');
  }
  add('INVISIBLE_FORBIDDEN', 'subdivision_flag_emoji_is_refused_because_it_is_made_of_tag_characters', ch(0x1F3F4) + [0xE0067, 0xE0062, 0xE0065, 0xE006E, 0xE0067, 0xE007F].map(ch).join(''), INVALID, 'a stated and accepted consequence of refusing the whole tag block');
  // characters that render as nothing but stay ALLOWED inside a sentence (a soft hyphen is ordinary typography)
  for (const [id, cp] of [['soft_hyphen', 0xAD], ['combining_grapheme_joiner', 0x034F], ['braille_blank', 0x2800], ['variation_selector_1', 0xFE00], ['variation_selector_14', 0xFE0D], ['variation_selector_15', 0xFE0E], ['variation_selector_16', 0xFE0F],
    ['zero_width_non_joiner', 0x200C], ['zero_width_joiner', 0x200D]]) add('INVISIBLE_ALLOWED', 'inside_' + id, 'a' + ch(cp) + 'b', ACCEPTED);
  // allowed: emoji sequences need the joiner and the variation selector; ordinary scripts
  add('ALLOWED', 'family_emoji_zwj', ch(0x1F468) + ch(0x200D) + ch(0x1F469) + ch(0x200D) + ch(0x1F467), ACCEPTED); add('ALLOWED', 'heart_vs16', ch(0x2764) + ch(0xFE0F), ACCEPTED);
  add('ALLOWED', 'zwnj_inside', 'a' + ch(0x200C) + 'b', ACCEPTED); add('ALLOWED', 'devanagari_zwj', ch(0x915) + ch(0x94D) + ch(0x200D) + ch(0x937), ACCEPTED);
  add('ALLOWED', 'serbian_latin', 'Odli' + ch(0x10D) + 'an majstor, sve u redu ' + ch(0x161) + ch(0x111) + ch(0x10D) + ch(0x107) + ch(0x17E), ACCEPTED);
  add('ALLOWED', 'serbian_cyrillic', ch(0x41E) + ch(0x434) + ch(0x43B) + ch(0x438) + ch(0x447) + ch(0x430) + ch(0x43D) + ' ' + ch(0x43C) + ch(0x430) + ch(0x458) + ch(0x441) + ch(0x442) + ch(0x43E) + ch(0x440), ACCEPTED);
  add('ALLOWED', 'price_without_long_digit_runs', 'Cena je bila 2500 din, radio je 3 sata', ACCEPTED); add('ALLOWED', 'short_digit_group', 'Ocena 10 000 din ok', ACCEPTED);
  // since PKG-029c a date shape, a price range and a long price are NOT phone numbers (they were refused by the migration-era floor)
  add('ALLOWED', 'date_with_trailing_dot', 'Zavr' + ch(0x161) + 'eno 12.03.2026.', ACCEPTED, 'a date shape is not a phone number (PKG-029c)'); add('ALLOWED', 'date_starting_with_zero', 'Dogovor od 01.10.2026 posle podne', ACCEPTED);
  add('ALLOWED', 'long_price_with_dots', 'Platio sam 1.500.000', ACCEPTED); add('ALLOWED', 'long_price_with_spaces', '1 000 000 din', ACCEPTED); add('ALLOWED', 'price_range', 'Cena 15000 - 20000 je ok', ACCEPTED);
  // the contact floor (private.ru4b_public_floor_reason): phone, e-mail, link, @handle
  for (const [id, text] of [['phone_spaced', '064 123 4567'], ['phone_international', 'zovi +381 64 123 4567'], ['phone_compact', 'broj 0641234567'], ['phone_slash_dash', '064/123-4567'],
    ['phone_brackets', '(011) 123 456'], ['phone_dotted', 'tel 064.123.4567'], ['phone_digit_wise_spaced', '0 6 4 1 2 3 4 5 6 7']]) add('CONTACT', id, text, CONTACT);
  const digitsAs = (base, digits) => [...digits].map(digit => ch(base + Number(digit))).join('');
  for (const [id, text] of [['phone_fullwidth_digits', 'zovi ' + digitsAs(0xFF10, '0641234567')], ['phone_arabic_indic_digits', 'zovi ' + digitsAs(0x0660, '0641234567')], ['phone_persian_digits', 'zovi ' + digitsAs(0x06F0, '0641234567')],
    ['phone_soft_hyphen_split', 'zovi 064' + ch(0xAD) + '1234567'], ['phone_combining_grapheme_joiner_split', 'zovi 064' + ch(0x34F) + '1234567'], ['phone_zwnj_split', 'zovi 064' + ch(0x200C) + '1234567'],
    ['phone_braille_blank_split', 'zovi 064' + ch(0x2800) + '1234567'], ['email_fullwidth_at', 'ime' + ch(0xFF20) + 'posta.rs'], ['handle_fullwidth_at', 'javi se ' + ch(0xFF20) + 'pera_m'],
    ['link_fullwidth_scheme', [...'https'].map(letter => ch(0xFF00 + letter.charCodeAt(0) - 0x20)).join('') + '://x.rs']]) add('CONTACT', id, text, CONTACT, 'round-1 security finding: the NFKC copy without invisible characters catches it');
  for (const [id, text] of [['email_plain', 'pisi na ime@posta.rs'], ['email_upper', 'IME@POSTA.RS'], ['email_plus', 'a.b+c@x.co']]) add('CONTACT', id, text, CONTACT);
  for (const [id, text] of [['link_https', 'vidi https://primer.rs/majstor'], ['link_http', 'http://x'], ['link_www', 'www.primer.rs'], ['link_www_upper', 'WWW.PRIMER.RS']]) add('CONTACT', id, text, CONTACT);
  for (const [id, text] of [['handle_inline', 'javi se @pera_m'], ['handle_start', '@pera.m'], ['handle_after_lf', 'ok\n@majstor']]) add('CONTACT', id, text, CONTACT);
  // KNOWN RESIDUAL 1: the floor misses anything that is not spelled the way it looks for (documented in the design, section 4e). Asserted as what happens TODAY, not as safe.
  for (const [id, text] of [['residual_spelled_digits', 'nula sest cetiri jedan dva tri cetiri pet sest sedam'], ['residual_digits_split_by_letters', '064x123x4567'],
    ['residual_obfuscated_email', 'ime(at)posta(dot)rs'], ['residual_bracket_at', 'ime [at] posta.rs'], ['residual_short_link', 'm.me/pera'], ['residual_social_name', 'facebook pera.m'],
    ['residual_instagram', 'ig: pera_m'], ['residual_bare_domain', 'vidi moj-sajt.rs'], ['residual_short_link_tme', 'javi se t.me/pera'], ['residual_at_dot_words', 'ime at posta tacka rs']]) add('KNOWN_RESIDUAL', id, text, ACCEPTED, 'a deterministic floor misses it: stored and shown');
  // KNOWN RESIDUAL 1b (round-2 finding, security #4): combining marks between digits (U+0332 measured as a pass on DEV) and digits of other numeral systems (Devanagari) are not read by the floor
  add('KNOWN_RESIDUAL', 'residual_phone_digits_split_by_combining_marks', 'zovi ' + [...'0641234567'].map(digit => digit + ch(0x0332)).join(''), ACCEPTED, 'combining low line after each digit: the NFKC copy keeps it, the phone run needs adjacent digits');
  add('KNOWN_RESIDUAL', 'residual_phone_devanagari_digits', 'zovi ' + [...'0641234567'].map(digit => ch(0x0966 + Number(digit))).join(''), ACCEPTED, 'only the ASCII, Arabic-Indic and Persian digits are read as digits');
  // KNOWN RESIDUAL 2: the live phone rule (PKG-029c) needs a start of 0, 00, + or 381 and 8 to 13 digits: a number written WITHOUT its leading 0 / country code, a too long one and a short one pass
  for (const [id, text] of [['residual_phone_without_the_leading_zero', 'zovi 64 123 4567'], ['residual_phone_nine_digits_no_prefix', 'zovi 641234567'], ['residual_phone_fourteen_digits', 'zovi +381 64 123 456 789 012'], ['residual_phone_seven_digits', 'zovi 0641234']])
    add('KNOWN_RESIDUAL', id, text, ACCEPTED, 'a phone-shaped run the live rule does not read as a phone number');
  // round-2 finding (security #1): EVERY forbidden range is exercised at its two ends and in the middle, inside text and alone, and its two neighbours are exercised as accepted (or refused when they belong to the next range);
  // the expectation comes from the tables, the INDEPENDENT oracle is the unit test over the Unicode property Default_Ignorable_Code_Point, and the proof runs every case on the real function and the table CHECK
  const hex = cp => cp.toString(16).toUpperCase().padStart(4, '0'), seenPoints = new Set(), seenNeighbours = new Set();
  for (const [lo, hi] of FORBIDDEN_RANGES) for (const cp of new Set([lo, hi, ...(hi - lo >= 2 ? [lo + Math.floor((hi - lo) / 2)] : [])])) {
    if (seenPoints.has(cp)) continue; seenPoints.add(cp);
    add('FORBIDDEN_RANGE_POINTS', 'range_inner_u' + hex(cp), 'a' + ch(cp) + 'b', INVALID, 'inside text: refused');
    add('FORBIDDEN_RANGE_POINTS', 'range_alone_u' + hex(cp), ch(cp), inRanges(BLANK_RANGES, cp) ? ABSENT : INVALID, inRanges(BLANK_RANGES, cp) ? 'white space alone is "no comment" (blank is tested first)' : 'alone: refused, never an empty-looking comment');
  }
  for (const [lo, hi] of FORBIDDEN_RANGES) for (const cp of [lo - 1, hi + 1]) {
    if (cp < 1 || seenNeighbours.has(cp)) continue; seenNeighbours.add(cp);
    add('FORBIDDEN_RANGE_NEIGHBOURS', 'neighbour_inner_u' + hex(cp), 'a' + ch(cp) + 'b', inRanges(FORBIDDEN_RANGES, cp) ? INVALID : ACCEPTED, 'the code point next to a forbidden range: forbidden only when it belongs to the table');
  }
  // first CI run (36949455489, first observation): U+DFFFF is the code point just below the plane-14 block of the forbidden class AND a Unicode noncharacter. The first run saw it come back from the proof's raw text transport as 'ab'
  // (the character missing) while the database kept it: the proof now carries every text as ASCII both ways and the noncharacters are explicit cases. The expectation is DERIVED from the class tables (a noncharacter is accepted unless a table names it),
  // never written by hand; the closed forbidden class is NOT widened here (a product rule already reviewed). Known consequence, pinned in KNOWN_RESIDUAL below: a noncharacter inside a phone number splits the digit run like any visible character.
  const verdictInner = cp => inRanges(FORBIDDEN_RANGES, cp) ? INVALID : ACCEPTED, verdictAlone = cp => inRanges(BLANK_RANGES, cp) ? ABSENT : inRanges(FORBIDDEN_RANGES, cp) ? INVALID : ACCEPTED;
  for (const cp of NONCHARACTERS) add('NONCHARACTERS', 'noncharacter_inner_u' + hex(cp), 'a' + ch(cp) + 'b', verdictInner(cp), 'a Unicode noncharacter inside a sentence: not named by the closed class, stored and returned verbatim');
  for (const cp of [0xFDD0, 0xFDEF, 0xFFFE, 0xFFFF, 0x1FFFE, 0xDFFFF, 0x10FFFE, 0x10FFFF]) add('NONCHARACTERS', 'noncharacter_alone_u' + hex(cp), ch(cp), verdictAlone(cp), 'a comment of ONE noncharacter: not white space, not forbidden: a one-character comment');
  add('NONCHARACTERS', 'noncharacter_all_fdd0_to_fdef_in_one_text', NONCHARACTERS.slice(0, 32).map(ch).join(''), [...NONCHARACTERS.slice(0, 32)].some(cp => inRanges(FORBIDDEN_RANGES, cp)) ? INVALID : ACCEPTED);
  add('NONCHARACTERS', 'noncharacter_all_plane_ends_in_one_text', NONCHARACTERS.slice(32).map(ch).join(''), NONCHARACTERS.slice(32).some(cp => inRanges(FORBIDDEN_RANGES, cp)) ? INVALID : ACCEPTED, 'U+FFFE, U+FFFF, U+1FFFE ... U+10FFFF: 34 characters of 3 or 4 octets');
  add('NONCHARACTERS', 'noncharacter_next_to_the_plane_14_block_and_its_first_member', ch(0xDFFFF) + 'a' + ch(0xE0000), [0xDFFFF, 0xE0000].some(cp => inRanges(FORBIDDEN_RANGES, cp)) ? INVALID : ACCEPTED, 'the noncharacter is fine, the plane-14 tag block next to it is still forbidden (the whole text is refused)');
  add('KNOWN_RESIDUAL', 'residual_phone_split_by_a_noncharacter', 'zovi 064' + ch(0xFFFF) + '1234567', verdictInner(0xFFFF), 'a noncharacter is visible (a replacement glyph or a box) and splits the digit run like any other character; only the invisible characters are removed from the floor copy');
  return cases;
}
/** Does an observed outcome satisfy an expectation? Every expectation is exact (nothing is locale dependent any more). */
export function outcomeMatches(observed, expect) {
  if (observed.outcome !== expect.outcome) return false;
  if (expect.outcome === 'REFUSED') return observed.name === expect.name && observed.sqlstate === expect.sqlstate;
  return true;
}
/** The JSON text of a case for jsonb: a lone surrogate or NUL is never produced by the matrix. */
export const caseJson = value => JSON.stringify(value === undefined ? null : value);

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// FIRST CI RUN: TEXT TRANSPORT BETWEEN THE PROOF AND THE DATABASE.
// CI run 36949455489 (the first run): the case 'a' + U+DFFFF + 'b' (a Unicode noncharacter) was ACCEPTED by the SQL function but the text the proof read back was 'ab'. Offline evidence (see README_D12_PROOF.md, "Round 3"): the
// function returns its input untouched; PostgreSQL 17.6 keeps the character through to_jsonb / jsonb_to_recordset / #>> (read-only on DEV); libpg_query's lexer keeps it in a quoted constant; the matrix payload and the output JSON round-trip
// through a child process and JSON.parse byte for byte. What no offline run can reach is the psql process on the runner (stdin read, client encoding, stdout write), so the proof no longer RELIES on it: every text that must arrive or
// come back byte-exact travels as ASCII only (base64 in, hex out, compared as hex, never decoded back for the verdict), and a transport check MEASURES the raw hops separately and names the hop that loses a character if one does.
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
export const utf8Hex = text => Buffer.from(String(text), 'utf8').toString('hex');
export const utf8Base64 = text => Buffer.from(String(text), 'utf8').toString('base64');
export const fromUtf8Hex = hex => Buffer.from(String(hex), 'hex').toString('utf8');
export const isAscii = text => /^[\x00-\x7F]*$/.test(String(text));
/** Refuses (throws) any script that is not pure ASCII: nothing between the proof and the server may then depend on a client encoding, a locale, a lexer or a stream. */
export function assertAscii(script, label) {
  const bad = [...String(script)].find(character => character.codePointAt(0) > 0x7F);
  if (bad !== undefined) throw new Error('TRANSPORT_NOT_ASCII ' + label + ': U+' + bad.codePointAt(0).toString(16).toUpperCase());
  return script;
}
export const sqlLiteral = value => "'" + String(value).replaceAll("'", "''") + "'";
/** The ASCII payload of a list of matrix items: the JSON text of each value as base64 of its UTF-8 octets (ids are ASCII identifiers). */
export const matrixPayload = cases => cases.map((item, ord) => ({id: item.id, ord, sql_null: item.sqlNull === true, b64: utf8Base64(caseJson(item.value))}));
/** The SHA-256 the database reports for the JSON text it decoded: the proof compares it with its own, so a text that did not arrive intact is named before any verdict is read. */
export const matrixInputDigest = item => sha256Hex(caseJson(item.value));
/**
 * The matrix script: the JSON text arrives as base64, is decoded in SQL, parsed as jsonb and handed to the function; the answer carries the value as the HEX of its UTF-8 octets and its character count, plus the SHA-256 of the decoded input.
 * Nothing in the script or in its answer is non-ASCII; the proof compares hex with hex.
 */
export function matrixScript(payload) {
  return assertAscii(`create function pg_temp.d12_try(p jsonb) returns jsonb language plpgsql as $f$
declare v text;
begin
  v := private.review_comment_input_v1(p);
  return jsonb_build_object('outcome', case when v is null then 'ABSENT' else 'ACCEPTED' end, 'value_hex', case when v is null then null else encode(convert_to(v, 'UTF8'), 'hex') end, 'value_chars', case when v is null then null else char_length(v) end);
exception when others then
  return jsonb_build_object('outcome', 'REFUSED', 'sqlstate', sqlstate, 'message', sqlerrm);
end $f$;
select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'in_sha256', encode(sha256(convert_to(c.json, 'UTF8')), 'hex'), 'result', pg_temp.d12_try(case when c.sql_null then null else c.json::jsonb end)) order by c.ord), '[]'::jsonb)
from (select x.id, x.ord, x.sql_null, convert_from(decode(x.b64, 'base64'), 'UTF8') as json from jsonb_to_recordset(${sqlLiteral(JSON.stringify(payload))}::jsonb) as x(id text, ord integer, sql_null boolean, b64 text)) c;`, 'matrixScript');
}
/** The second-wall script: the same ASCII payload, each text inserted directly into the comment table as the database owner inside a nested block that is always rolled back; the answer is ASCII (a constraint name or ACCEPTED). */
export function wallScript(payload, reviewId) {
  return assertAscii(`create function pg_temp.d12_wall(p text) returns text language plpgsql as $f$
declare cname text;
begin
  begin
    insert into private.agreement_review_comments_v1(review_id, author_account_id, target_account_id, comment, comment_sha256)
      select r.id, r.reviewer_account_id, r.target_account_id, p, repeat('a', 64) from private.agreement_reviews r where r.id = ${sqlLiteral(reviewId)};
    raise exception 'D12_WALL_ACCEPTED' using errcode = 'P0001';
  exception
    when check_violation then get stacked diagnostics cname = constraint_name; return 'CHECK:' || coalesce(cname, '?');
    when sqlstate 'P0001' then if sqlerrm = 'D12_WALL_ACCEPTED' then return 'ACCEPTED'; end if; raise;
  end;
end $f$;
select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'wall', pg_temp.d12_wall((c.json::jsonb) #>> '{}')) order by c.ord), '[]'::jsonb)
from (select x.id, x.ord, convert_from(decode(x.b64, 'base64'), 'UTF8') as json from jsonb_to_recordset(${sqlLiteral(JSON.stringify(payload))}::jsonb) as x(id text, ord integer, b64 text)) c;`, 'wallScript');
}
/** The transport canaries: every noncharacter inside a sentence, the code points around the plane-14 block, and ordinary controls (an astral emoji, a two-octet letter, a private-use character). */
export function transportCanaries() {
  const hex = codePoint => codePoint.toString(16).toUpperCase().padStart(4, '0');
  return [...NONCHARACTERS.map(codePoint => ({id: 'noncharacter_u' + hex(codePoint), value: 'a' + ch(codePoint) + 'b'})),
    ...[0xDFFFD, 0xE1000, 0x10FFFD, 0x1F600, 0x10D, 0xFFFD, 0xFFFC, 0xE000].map(codePoint => ({id: 'control_u' + hex(codePoint), value: 'a' + ch(codePoint) + 'b'})),
    {id: 'all_noncharacters_in_one_text', value: NONCHARACTERS.map(ch).join('')}];
}
/** Transport probe 1 (ASCII both ways, the one the proof relies on): base64 in, hex out. */
export function transportAsciiScript(items) {
  return assertAscii(`select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'hex', encode(convert_to(t.v, 'UTF8'), 'hex'), 'chars', char_length(t.v)) order by x.ord), '[]'::jsonb)
from jsonb_to_recordset(${sqlLiteral(JSON.stringify(items.map((item, ord) => ({id: item.id, ord, b64: utf8Base64(item.value)}))))}::jsonb) as x(id text, ord integer, b64 text), lateral (select convert_from(decode(x.b64, 'base64'), 'UTF8') as v) t;`, 'transportAsciiScript');
}
/** Transport probe 2 (RAW in, hex out): the texts are written into the script as characters, exactly as the proof used to send them; the answer is ASCII, so a loss here is a loss on the INPUT hop (proof -> stdin -> psql -> server). */
export const transportRawInScript = items => `select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'hex', encode(convert_to(x.t, 'UTF8'), 'hex'), 'chars', char_length(x.t)) order by x.ord), '[]'::jsonb)
from jsonb_to_recordset(${sqlLiteral(JSON.stringify(items.map((item, ord) => ({id: item.id, ord, t: item.value}))))}::jsonb) as x(id text, ord integer, t text);`;
/** Transport probe 3 (base64 in, RAW out): the answer carries the characters themselves, as the proof used to read them; a loss here is a loss on the OUTPUT hop (server -> psql -> stdout -> proof). */
export function transportRawOutScript(items) {
  return assertAscii(`select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 't', t.v) order by x.ord), '[]'::jsonb)
from jsonb_to_recordset(${sqlLiteral(JSON.stringify(items.map((item, ord) => ({id: item.id, ord, b64: utf8Base64(item.value)}))))}::jsonb) as x(id text, ord integer, b64 text), lateral (select convert_from(decode(x.b64, 'base64'), 'UTF8') as v) t;`, 'transportRawOutScript');
}
/** The verdict of the matrix on an accepted text: the returned octets (hex) and the character count must be exactly those of the text that was sent (the server rejects, it never normalises). `observed` is {valueHex, valueChars}. */
export const acceptedTextDiffers = (item, observed) => observed.valueHex !== utf8Hex(item.value) || observed.valueChars !== codePoints(item.value);
/** Where did a raw hop lose a character? Compares the observed per-case hex (or the observed strings) with the sent ones; returns the lost cases with the code points that went missing. */
export function lostCases(items, observedHexById) {
  const lost = [];
  for (const item of items) {
    const observed = observedHexById.get(item.id);
    if (observed === utf8Hex(item.value)) continue;
    const kept = new Set([...fromUtf8Hex(observed ?? '')].map(character => character.codePointAt(0)));
    lost.push({id: item.id, missing: [...new Set([...item.value].map(character => character.codePointAt(0)))].filter(codePoint => !kept.has(codePoint)).map(codePoint => 'U+' + codePoint.toString(16).toUpperCase().padStart(4, '0'))});
  }
  return lost;
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// the apply-time integrity guard (the Voice B1 method): a JS MIRROR of build_d12.py guard_text(); the unit tests compare it with the manifest the generator wrote.
// ROUND 2: the guard hashes the candidate WITHOUT its trailing line feeds (guardedSpan), so a typed text that lost its final line feed and a connector trailer comment (execute_sql appends a blank line and `-- source: POST /mcp`,
// `-- user: ...`, `-- date: ...`, measured read-only on 2026-10-01) do not change what the database checks; anything inside the candidate, or anything before the guard, is refused (D12_APPLY_TEXT_INTEGRITY).
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** The tail pattern the guard demands after the candidate: only line feeds and `--` comment lines (a PostgreSQL comment ends at a line feed OR a carriage return, so neither may occur inside one). */
export const GUARD_TAIL_PATTERN = '^(\\n|--[^\\n\\r]*)*$';
/** The regular expression of the DO block (PostgreSQL evaluates it with a DFA); kept for the equivalence test only. */
export const GUARD_TAIL_RE = /^(\n|--[^\n\r]*)*$/;
/** The same language without regular-expression backtracking: no carriage return, and every line (the text between line feeds) is empty or starts with two hyphens. */
export const guardTailOk = tail => !String(tail).includes('\r') && String(tail).split('\n').every(line => line === '' || line.startsWith('--'));
const guardWith = (start, tailStart, length, sha) => "do $d12_guard$ declare rest text:=substr(current_query()," + tailStart + "); begin if encode(sha256(convert_to(substr(current_query()," + start + "," + length + "),'UTF8')),'hex')<>'" + sha
  + "' or rest !~ '" + GUARD_TAIL_PATTERN + "' then raise exception 'D12_APPLY_TEXT_INTEGRITY' using errcode='55000'; end if; end $d12_guard$;\n";
/** The characters the guard hashes: the candidate without its trailing line feeds. */
export const guardedSpan = text => String(text).replace(/\n+$/, '');
export function guardText(text) {
  const span = guardedSpan(text), sha = sha256Hex(span), length = String(span.length).padStart(6, '0'), first = guardWith('000000', '000000', length, sha);
  const start = first.length + 1;
  return guardWith(String(start).padStart(6, '0'), String(start + span.length).padStart(6, '0'), length, sha);
}
/** What the guard carries: the start of the candidate, where its tail begins, the span length and the digest. */
export function guardArguments(guard) {
  const found = /declare rest text:=substr\(current_query\(\),(\d{6})\); begin if encode\(sha256\(convert_to\(substr\(current_query\(\),(\d{6}),(\d{6})\),'UTF8'\)\),'hex'\)<>'([0-9a-f]{64})' or rest !~ '([^']*)' then/.exec(guard);
  if (found === null) throw new Error('D12_GUARD_SHAPE');
  return {tailStart: Number(found[1]), start: Number(found[2]), length: Number(found[3]), digest: found[4], tailPattern: found[5]};
}
/** Would the guard accept this SENT text (the guard + the candidate, possibly retyped without its final line feed and/or followed by a connector trailer)? A JS twin of the DO block: the span hashes to the digest AND the rest is only line feeds and -- comment lines. */
export function guardAccepts(sent, guard) {
  const {start, tailStart, length, digest} = guardArguments(guard), text = String(sent);
  return sha256Hex(text.substr(start - 1, length)) === digest && guardTailOk(text.substr(tailStart - 1));
}
/** The trailer a connector (execute_sql) appends to every statement, as measured read-only on 2026-10-01 (the user and the date vary). */
export const CONNECTOR_TRAILER = '\n\n-- source: POST /mcp\n-- user: oauth:example\n-- date: 2026-10-02T00:00:00.000Z';
export const wrapWithGuard = text => guardText(text) + text;

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// the closure fixtures of P9, described as DATA (round-2 finding privacy #1): the expected number of rows each fixture leaves behind is DERIVED from what the fixture does, never written twice by hand.
// A fixture is two reviews (the closing account and its peer, each with a comment) plus the moderation actions applied before the closure. Every submit writes ONE star row, ONE comment row, ONE REVIEW_RECEIVED event and ONE
// AGREEMENT_REVIEW_SUBMITTED audit row; every moderation action that CHANGES a state writes ONE audit row (AGREEMENT_REVIEW_COMMENT_HIDDEN / _RESTORED, entity = the Agreement); the proof counts audit rows with LIKE 'AGREEMENT_REVIEW%'.
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
export const REVIEW_AUDIT_LIKE = 'AGREEMENT_REVIEW%';
export const AUDIT_EVENT_TYPES = Object.freeze({submit: 'AGREEMENT_REVIEW_SUBMITTED', hide: 'AGREEMENT_REVIEW_COMMENT_HIDDEN', restore: 'AGREEMENT_REVIEW_COMMENT_RESTORED'});
export function closureFixtureDescription(role) {
  if (role !== 'REQUESTER' && role !== 'WORKER') throw new Error('D12_CLOSURE_FIXTURE_ROLE ' + role);
  return {role, reviews: [{author: 'SUBJECT', rating: 5, comment: true}, {author: 'PEER', rating: 2, comment: true}],
    // the WORKER fixture's closing author has a comment that a moderator HID before the closure: the erasure must take the hidden text too
    moderation: role === 'WORKER' ? [{review: 'SUBJECT', action: 'HIDE', reasonCode: 'ABUSE_REPORT'}] : []};
}
export function expectedWritesOfClosureFixture(description) {
  const submitted = description.reviews.length, changes = description.moderation.length;   // a listed action always changes the state (a HIDE of a visible comment, a RESTORE of a hidden one)
  return {stars: submitted, comments: description.reviews.filter(review => review.comment).length, events: submitted, audits: submitted + changes};
}
export const subjectIsHidden = description => description.moderation.some(item => item.review === 'SUBJECT' && item.action === 'HIDE');

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// PostgREST outcome helpers (exact message + SQLSTATE + HTTP status)
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** The HTTP statuses PostgREST answers for a SQLSTATE (null: not asserted). 42501 is 403 (401 for an anonymous caller), a custom PTnnn is HTTP nnn, class 22 is 400, P0001 is 400, class 55 is 500. */
export function statusesFor(sqlstate, {anon = false} = {}) {
  if (sqlstate === '42501') return anon ? [401, 403] : [403];
  if (/^PT[0-9]{3}$/.test(sqlstate)) return [Number(sqlstate.slice(2))];
  if (sqlstate === 'P0001') return [400];
  if (/^P0/.test(sqlstate)) return [500];
  if (/^22/.test(sqlstate)) return [400];
  if (/^55/.test(sqlstate)) return [500];
  return null;
}
export const outcomeOf = response => ({status: response?.status ?? null, code: response?.error?.code ?? null, message: response?.error?.message ?? null, ok: !response?.error});
/** An EXACT refusal: the message and the SQLSTATE match, and (when `statuses` is given) the HTTP status is one of them. */
export function isRefusal(response, message, sqlstate, statuses = null) {
  const outcome = outcomeOf(response);
  return !outcome.ok && outcome.message === message && outcome.code === sqlstate && (statuses === null || statuses.includes(outcome.status));
}
/** Compares two outcomes (legacy vs v2): same message, same code, same status. */
export const sameOutcome = (a, b) => JSON.stringify(outcomeOf(a)) === JSON.stringify(outcomeOf(b));
/**
 * FIRST CI RUN (36949455489, ANON_IDENTICAL): the platform's own refusal quotes the CALLED function ("permission denied for function rpc_submit_agreement_review" versus "... rpc_submit_agreement_review_v2"), so two
 * functions can never answer with a byte-identical message. The comparison masks the called function's name (a whole identifier: the legacy name must not match inside the v2 name) and then requires the rest to be identical,
 * AND requires each message to name the function that was actually called (a refusal that names some other function fails).
 */
const identifierPattern = name => new RegExp('(?<![A-Za-z0-9_])' + String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_])', 'g');
export const namesFunction = (message, functionName) => typeof message === 'string' && identifierPattern(functionName).test(message);
export const maskFunctionName = (message, functionName) => (typeof message === 'string' ? message.replace(identifierPattern(functionName), '<FUNCTION>') : message);
export function sameOutcomeMaskingFunction(a, nameA, b, nameB) {
  const left = outcomeOf(a), right = outcomeOf(b);
  if (left.ok || right.ok || !namesFunction(left.message, nameA) || !namesFunction(right.message, nameB)) return false;
  return JSON.stringify({...left, message: maskFunctionName(left.message, nameA)}) === JSON.stringify({...right, message: maskFunctionName(right.message, nameB)});
}
/**
 * psql run with VERBOSITY=verbose prints `ERROR:  <SQLSTATE>: <message>` (then CONTEXT/LOCATION lines). Returns {sqlstate, message} or null.
 * The message is the FIRST line only: a multi-line message keeps its first line (the proof's names are single-line identifiers).
 */
export function parsePsqlError(stderr) {
  const match = /^ERROR:\s+([0-9A-Z]{5}):\s+(.*)$/m.exec(String(stderr ?? ''));
  return match === null ? null : {sqlstate: match[1], message: match[2].trim()};
}

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// the surface delta: the lines of pkg023_surface.sql before and after the application, classified
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
const functionNameOf = line => /^function:([a-z_]+\.[a-z0-9_]+)\(([^)]*)\):/.exec(line) === null ? null : (() => {
  const m = /^function:([a-z_]+\.[a-z0-9_]+)\(([^)]*)\):/.exec(line);
  return m[1] + '(' + m[2] + ')';
})();
/** Strips the schema qualifiers from the argument list of a signature the way pg_get_function_identity_arguments prints them (types only matter by position here: compare by name + argument count). */
const nameAndArity = signature => {
  const m = /^([a-z_]+\.[a-z0-9_]+)\((.*)\)$/.exec(signature);
  if (!m) return signature;
  const depth = m[2] === '' ? 0 : m[2].split(',').length;
  return m[1] + '/' + depth;
};
/**
 * removed / added: arrays of surface lines. Expected: exactly the changed functions (their line changes, md5 only), the new functions, and the new table with its columns, constraints, triggers and indexes.
 * Returns {ok, unexpectedRemoved, unexpectedAdded, changedFunctions, newFunctions, newTableLines}.
 */
export function classifySurfaceDelta(removed, added, {changed = CHANGED_FUNCTIONS, created = NEW_FUNCTIONS, table = TABLE, triggers = TRIGGERS, indexes = INDEXES} = {}) {
  const changedKeys = new Set(changed.map(nameAndArity)), createdKeys = new Set(created.map(nameAndArity));
  const identity = line => { const name = /^function:([a-z_]+\.[a-z0-9_]+)\((.*?)\):[0-9a-f]{32}:/.exec(line); return name === null ? null : name[1] + '/' + (name[2] === '' ? 0 : name[2].split(',').length); };
  const isTableLine = line => line.startsWith('table:' + table + ':') || line.startsWith('column:' + table + '.') || line.startsWith('constraint:' + table + '.') || triggers.some(name => line.startsWith('trigger:' + table + '.' + name + ':'))
    || indexes.some(name => line.startsWith('index:private.' + name + ':'));   // no policy line is expected: the table has none
  const unexpectedRemoved = [], unexpectedAdded = [], changedFunctions = [], newFunctions = [], newTableLines = [];
  for (const line of removed) { const key = identity(line); if (key !== null && changedKeys.has(key)) changedFunctions.push(key); else unexpectedRemoved.push(line); }
  for (const line of added) {
    const key = identity(line);
    if (key !== null && changedKeys.has(key)) continue;
    if (key !== null && createdKeys.has(key)) { newFunctions.push(key); continue; }
    if (isTableLine(line)) { newTableLines.push(line); continue; }
    unexpectedAdded.push(line);
  }
  const addedChanged = added.map(identity).filter(key => key !== null && changedKeys.has(key));
  const ok = unexpectedRemoved.length === 0 && unexpectedAdded.length === 0 && new Set(changedFunctions).size === changedKeys.size && new Set(addedChanged).size === changedKeys.size
    && new Set(newFunctions).size === createdKeys.size;
  return {ok, unexpectedRemoved, unexpectedAdded, changedFunctions: [...new Set(changedFunctions)].sort(), newFunctions: [...new Set(newFunctions)].sort(), newTableLines};
}
export const surfaceDiff = (before, after) => ({removed: before.filter(line => !after.includes(line)), added: after.filter(line => !before.includes(line))});

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// the weakening plan (runtime non-vacuity): each probe WEAKENS one rule on the disposable chain (an exact-once anchor edit of the live definition, restored byte for byte afterwards)
// and the proof reads the OBSERVED outcome of the predicate that rule guards: it must flip. A probe whose anchor does not match proves nothing and fails the run.
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** Exact-once replacement on a function definition. Returns {applied, reason, text}. */
export function applyEdits(definition, edits) {
  let text = String(definition);
  for (const edit of edits) {
    const count = text.split(edit.anchor).length - 1;
    if (count !== 1) return {applied: false, reason: 'ANCHOR_OCCURS_' + count + '_TIMES: ' + edit.anchor.slice(0, 90), text: String(definition)};
    text = text.replace(edit.anchor, () => edit.replacement);
  }
  return {applied: text !== String(definition), reason: text === String(definition) ? 'NOTHING_CHANGED' : 'APPLIED', text};
}
export const WEAKENINGS = Object.freeze([
  {id: 'W1_CONTACT_FLOOR_REMOVED', signature: SIG.input, predicate: 'CONTACT_FLOOR_REFUSES_A_PHONE', weakened: 'ACCEPTED_TEXT', guards: 'a phone number in a comment is refused (REVIEW_COMMENT_CONTACT_NOT_PUBLIC)',
    edits: [{anchor: "if private.ru4b_public_floor_reason(v) is not null or private.ru4b_public_floor_reason(n) is not null then raise exception 'REVIEW_COMMENT_CONTACT_NOT_PUBLIC' using errcode='22023'; end if;", replacement: 'null;'}]},
  {id: 'W12_NORMALISED_CONTACT_FLOOR_REMOVED', signature: SIG.input, predicate: 'NORMALISED_FLOOR_REFUSES_FULLWIDTH_DIGITS', weakened: 'ACCEPTED_TEXT', guards: 'a phone number written with full-width digits is refused (the floor also reads the NFKC copy without invisible characters)',
    edits: [{anchor: ' or private.ru4b_public_floor_reason(n) is not null', replacement: ''}]},
  {id: 'W13_DEFAULT_IGNORABLE_PLANE14_NARROWED_TO_THE_TAG_BLOCK', signature: SIG.input, predicate: 'FUNCTION_REFUSES_AN_IDEOGRAPHIC_VARIATION_SELECTOR', weakened: 'ACCEPTED_TEXT',
    guards: 'the forbidden class covers the whole default-ignorable plane-14 block (U+E0000..U+E0FFF), not only the tag block: an ideographic variation selector (U+E0100) is refused (round-2 finding security #1)',
    edits: [{anchor: "chr(917504) || '-' || chr(921599)", replacement: "chr(917504) || '-' || chr(917631)"}]},
  {id: 'W14_VARIATION_SELECTORS_NO_LONGER_BLANK', signature: SIG.input, predicate: 'A_LONE_VARIATION_SELECTOR_IS_NO_COMMENT', weakened: 'REFUSED:REVIEW_COMMENT_CONTACT_NOT_PUBLIC',
    guards: 'all sixteen variation selectors alone are "no comment" (nothing stored); without them in the blank class a lone selector would be refused as a misnamed contact refusal (round-2 finding security #1)',
    edits: [{anchor: "chr(12288) || chr(65024) || '-' || chr(65039) || ']*$'", replacement: "chr(12288) || ']*$'"}]},
  {id: 'W2_LENGTH_BOUND_REMOVED', signature: SIG.input, predicate: 'FUNCTION_REFUSES_501_CODE_POINTS', weakened: 'ACCEPTED_TEXT', guards: '501 code points are refused (REVIEW_COMMENT_TOO_LONG); the table CHECK still holds (defence in depth)',
    edits: [{anchor: "if char_length(v)>500 or octet_length(v)>2000 then raise exception 'REVIEW_COMMENT_TOO_LONG' using errcode='22023'; end if;", replacement: 'null;'}]},
  {id: 'W3_CONTROL_AND_BIDI_CHECK_WEAKENED', signature: SIG.input, predicate: 'FUNCTION_REFUSES_A_RIGHT_TO_LEFT_OVERRIDE', weakened: 'ACCEPTED_TEXT', guards: 'a bidi override or control character is refused (REVIEW_COMMENT_INVALID)',
    edits: [{anchor: "if v<>btrim(v,E' \\n') or v ~ (", replacement: "if v<>btrim(v,E' \\n') and v ~ ("}]},
  {id: 'W4_IMMUTABILITY_REMOVED', signature: SIG.guard, predicate: 'AN_ORDINARY_UPDATE_IS_REFUSED', weakened: 'UPDATE_SUCCEEDED', guards: 'an ordinary UPDATE or DELETE of a comment raises REVIEW_COMMENT_IMMUTABLE for every role',
    edits: [{anchor: "raise exception 'REVIEW_COMMENT_IMMUTABLE' using errcode='42501';", replacement: "if tg_op='DELETE' then return old; end if; return new;"}]},
  // The moderation door has THREE layers (the EXECUTE ACL, the service-role check in the function, the service-role check in the row trigger); each probe removes the outer ones and the OBSERVED message names the layer that answers.
  {id: 'W5A_MODERATION_ACL_OPENED', signature: SIG.moderate, predicate: 'AUTHENTICATED_IS_REFUSED_BY_THE_ACL', weakened: 'REFUSED_BY_THE_FUNCTION_CHECK', guards: 'authenticated has no EXECUTE on the moderation function',
    edits: [], sqlBefore: 'grant execute on function ' + SIG.moderate + ' to authenticated;', sqlAfter: 'revoke execute on function ' + SIG.moderate + ' from authenticated;'},
  {id: 'W5B_MODERATION_ACL_AND_FUNCTION_CHECK_REMOVED', signature: SIG.moderate, predicate: 'AUTHENTICATED_IS_REFUSED_BY_THE_ACL', weakened: 'REFUSED_BY_THE_ROW_TRIGGER', guards: 'the function itself demands the service role',
    edits: [{anchor: "if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;", replacement: 'null;'}],
    sqlBefore: 'grant execute on function ' + SIG.moderate + ' to authenticated;', sqlAfter: 'revoke execute on function ' + SIG.moderate + ' from authenticated;'},
  {id: 'W6_READER_BLOCK_GATE_REMOVED', signature: SIG.reader, predicate: 'A_BLOCKED_VIEWER_SEES_NOTHING', weakened: 'LIST_RETURNED', guards: 'a blocked pair reads as "nothing here" (no comment list, no error that reveals the block)',
    edits: [{anchor: 'if private.safety_pair_blocked(v_actor,v_profile.account_id) then return null; end if;', replacement: 'null;'}]},
  {id: 'W11_VIEWER_INDEPENDENT_BLOCK_GATE_REINTRODUCED', signature: SIG.reader, predicate: 'A_BLOCK_BETWEEN_AUTHOR_AND_SUBJECT_NEVER_CENSORS_A_THIRD_VIEWER', weakened: 'COMMENT_CENSORED_FOR_EVERYONE',
    guards: 'a block between the author and the reviewed person hides the comment from the person who blocked (the viewer), never for third viewers (round-1 blocker: either party could censor or re-publish the text for everybody)',
    edits: [{anchor: 'and not private.safety_pair_blocked(v_actor,c.author_account_id)', replacement: 'and not private.safety_pair_blocked(v_actor,c.author_account_id) and not private.safety_pair_blocked(c.author_account_id,c.target_account_id)'}]},
  {id: 'W7_READER_HIDDEN_FILTER_REMOVED', signature: SIG.reader, predicate: 'A_HIDDEN_COMMENT_IS_NOT_LISTED', weakened: 'HIDDEN_COMMENT_LISTED', guards: 'a comment hidden by moderation is not listed',
    edits: [{anchor: 'where c.target_account_id=v_profile.account_id and c.hidden_at is null', replacement: 'where c.target_account_id=v_profile.account_id'}]},
  {id: 'W8_COMPLETION_GATE_REMOVED', signature: SIG.submitV2, predicate: 'A_NOT_COMPLETED_AGREEMENT_IS_REFUSED', weakened: 'REVIEW_ACCEPTED', guards: 'a review (stars and comment) needs the Agreement AND its execution COMPLETED',
    edits: [{anchor: "if a.status<>'COMPLETED' or not exists(select 1 from public.agreement_execution where agreement_id=a.id and state='COMPLETED') then", replacement: 'if false then'}]},
  {id: 'W9_REQUEST_REUSE_CHECK_REMOVED', signature: SIG.submitV2, predicate: 'SAME_KEY_OTHER_COMMENT_IS_REFUSED', weakened: 'REPLAY_WITHOUT_ERROR', guards: 'the same request id with a different (or added) comment is REQUEST_ID_REUSED',
    edits: [{anchor: "if stored_sha is distinct from comment_sha then raise exception 'REQUEST_ID_REUSED' using errcode='22023'; end if;", replacement: 'null;'}]},
  {id: 'W10_PARTICIPANT_CHECK_REMOVED', signature: SIG.submitV2, predicate: 'AN_OUTSIDER_IS_REFUSED', weakened: 'REVIEW_ACCEPTED', guards: 'only a participant of the Agreement may review',
    edits: [{anchor: 'select * into a from public.agreements where id=p_agreement_id and u in(requester_account_id,worker_account_id) for share;', replacement: 'select * into a from public.agreements where id=p_agreement_id for share;'}]},
]);

// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
// labels: every pass line carries the SHORT label (the evidence is about the disposable chain, never about DEV)
// ------------------------------------------------------------------------------------------------------------------------------------------------------------------
export const CHAIN_LACKS = Object.freeze(['pkg051a (platform price list, ledger 202)', 'PKG-045b P0 (needs column ACL and its certificate re-bind: the chain keeps table-level SELECT on public.needs)', 'P6 rollout v3 (discovery)',
  'B24 Part 1 (54 functions; the chain carries B24 Part 2 in relaxed pre-image mode only)', 'every DEV-only ledger item that no replay stage of the workflow applies']);
export const CHAIN_LACKS_TOKEN = 'the chain lacks pkg051a, PKG-045b P0, P6 rollout v3 and B24 Part 1; its certificate is chain-internal (never equal to DEV 58447d77 byte for byte)';
export const passLine = (labelShort, name) => 'PASS [' + labelShort + '] ' + name;

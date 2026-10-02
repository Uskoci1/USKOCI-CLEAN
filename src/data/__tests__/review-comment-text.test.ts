import {
  REVIEW_COMMENT_BLANK_RANGES, REVIEW_COMMENT_FORBIDDEN_RANGES, REVIEW_COMMENT_MAX_CODE_POINTS, REVIEW_COMMENT_MESSAGES, prepareReviewComment,
  reviewCommentLength,
} from '../reviewCommentText';

/**
 * The client half of the D12 text rules (supabase/proofs/d12/README_D12_CANDIDATE.md, "Text rules"). It exists for fast
 * feedback only: the server is the authority and rejects, it never normalises. The client prepares the text (NFC, line
 * feeds, trim) and refuses what the server would refuse, so the person is told before the request, not after it.
 *
 * Every special character is written as a number and built with `String.fromCodePoint`: a source file with an escape text in
 * it (backslash, u, four digits) can be turned into the raw invisible character by a tool on the way to disk, and a test
 * table that nobody can read is not a test table.
 */
const ch = (...codes: number[]) => String.fromCodePoint(...codes);
const text = (value: string) => ({ kind: 'text', text: value });
const none = { kind: 'none' };
const invalid = { kind: 'invalid', code: 'REVIEW_COMMENT_INVALID' };
const tooLong = { kind: 'invalid', code: 'REVIEW_COMMENT_TOO_LONG' };

describe('an absent comment is no comment', () => {
  it.each<[string, unknown]>([
    ['undefined', undefined], ['null', null], ['an empty string', ''], ['spaces', '   '], ['line feeds', '\n\n'],
    ['a tab', '\t'], ['a no-break space', ch(0xA0)], ['a next-line character', ch(0x85)], ['an ideographic space', ch(0x3000)],
    ['a zero-width non-joiner alone', ch(0x200C)], ['a zero-width joiner alone', ch(0x200D)], ['an emoji variation selector alone', ch(0xFE0F)],
    ['the first variation selector alone', ch(0xFE00)], ['a soft hyphen between spaces', ` ${ch(0xAD)} `],
    ['a combining grapheme joiner alone', ch(0x34F)], ['the braille blank alone', ch(0x2800)], ['a line separator alone', ch(0x2028)],
    ['a paragraph separator alone', ch(0x2029)], ['a carriage return and a line feed', '\r\n'],
  ])('%s', (_name, value) => {
    expect(prepareReviewComment(value)).toEqual(none);
  });

  it.each([[123], [{}], [[]], [true]])('refuses a value that is not text: %p', value => {
    expect(prepareReviewComment(value)).toEqual(invalid);
  });
});

describe('the text is prepared the way the server expects it', () => {
  it('trims both ends and keeps what is inside', () => {
    expect(prepareReviewComment('  Sve pohvale.  ')).toEqual(text('Sve pohvale.'));
    expect(prepareReviewComment('\n Prvi red\n\nDrugi red  \n')).toEqual(text('Prvi red\n\nDrugi red'));
  });

  it('writes a line break the way the server allows it (LF), whatever the keyboard or the paste sent', () => {
    expect(prepareReviewComment('a\r\nb')).toEqual(text('a\nb'));
    expect(prepareReviewComment('a\rb')).toEqual(text('a\nb'));
  });

  it('composes the text to NFC, so a decomposed letter is one letter', () => {
    expect(prepareReviewComment(`e${ch(0x301)}`)).toEqual(text(ch(0xE9)));
    expect(prepareReviewComment(`c${ch(0x30C)}ak`)).toEqual(text(`${ch(0x10D)}ak`));
  });

  it('drops a white-space character an editor left at an end, a byte order mark included, and keeps one inside', () => {
    expect(prepareReviewComment(`abc${ch(0x2028)}`)).toEqual(text('abc'));
    expect(prepareReviewComment(`${ch(0xFEFF)}abc`)).toEqual(text('abc'));
    expect(prepareReviewComment(`a${ch(0xA0)}b`)).toEqual(text(`a${ch(0xA0)}b`));
  });

  it('does not judge contact details: the server floor is the authority and is not mirrored (its rules are never revealed)', () => {
    expect(prepareReviewComment('zovi me 0641234567')).toEqual(text('zovi me 0641234567'));
    expect(prepareReviewComment('moj@mejl.rs')).toEqual(text('moj@mejl.rs'));
  });
});

describe('the length is counted in code points, as the server counts it', () => {
  it('500 is the limit', () => {
    expect(REVIEW_COMMENT_MAX_CODE_POINTS).toBe(500);
    expect(prepareReviewComment('a'.repeat(500))).toEqual(text('a'.repeat(500)));
    expect(prepareReviewComment('a'.repeat(501))).toEqual(tooLong);
  });

  it('an emoji is one code point, though it is two UTF-16 units', () => {
    const grin = ch(0x1F600);
    expect(reviewCommentLength(`${grin}a`)).toBe(2);
    expect(prepareReviewComment(grin.repeat(500)).kind).toBe('text');
    expect(prepareReviewComment(grin.repeat(501))).toEqual(tooLong);
  });

  it('a mark that has no composed form counts as its own code point', () => {
    const marked = `x${ch(0x332)}`;
    expect(prepareReviewComment(marked.repeat(250)).kind).toBe('text');
    expect(prepareReviewComment(marked.repeat(251))).toEqual(tooLong);
  });

  it('the length is judged before the characters, as the server judges it', () => {
    expect(prepareReviewComment(`${'a'.repeat(500)}${ch(0x200B)}`)).toEqual(tooLong);
  });
});

describe('what the server refuses as invalid is refused here', () => {
  const forbidden: [string, number][] = [
    ['NUL', 0x0], ['SOH', 0x1], ['backspace', 0x8], ['a tab inside', 0x9], ['a vertical tab inside', 0xB], ['a form feed inside', 0xC],
    ['the last C0 control', 0x1F], ['DEL', 0x7F], ['a next-line character inside', 0x85], ['the last C1 control', 0x9F],
    ['a line separator inside', 0x2028], ['a paragraph separator inside', 0x2029], ['the Arabic letter mark', 0x61C],
    ['the Hangul choseong filler', 0x115F], ['the Hangul jungseong filler', 0x1160], ['the Khmer inherent vowel', 0x17B4],
    ['the Khmer inherent vowel aa', 0x17B5], ['a Mongolian free variation selector', 0x180B], ['the Mongolian vowel separator', 0x180E],
    ['the last Mongolian format character', 0x180F], ['a zero-width space', 0x200B], ['a left-to-right mark', 0x200E],
    ['a right-to-left mark', 0x200F], ['a left-to-right embedding', 0x202A], ['a right-to-left override', 0x202E],
    ['a word joiner', 0x2060], ['the reserved U+2065', 0x2065], ['the last character of the block U+2060..U+206F', 0x206F],
    ['the Hangul filler U+3164', 0x3164], ['the byte order mark inside', 0xFEFF], ['the half-width Hangul filler', 0xFFA0],
    ['the first reserved U+FFF0', 0xFFF0], ['the last reserved U+FFF8', 0xFFF8], ['an interlinear annotation anchor', 0xFFF9],
    ['an interlinear annotation terminator', 0xFFFB], ['a shorthand format letter', 0x1BCA0], ['the last shorthand format letter', 0x1BCA3],
    ['an Egyptian hieroglyph format control', 0x13430], ['the last Egyptian hieroglyph format control', 0x1343F],
    ['a musical format character', 0x1D173], ['the last musical format character', 0x1D17A], ['a tag character', 0xE0001],
    ['an ideographic variation selector', 0xE0100], ['the last plane-14 code point of the block', 0xE0FFF],
  ];

  it.each(forbidden)('%s', (_name, code) => {
    expect(prepareReviewComment(`a${ch(code)}b`)).toEqual(invalid);
  });

  it('a lone surrogate is refused (PostgreSQL would answer 22P02 before the function runs), a pair is fine', () => {
    const high = String.fromCharCode(0xD800), low = String.fromCharCode(0xDC00);
    expect(prepareReviewComment(`a${high}b`)).toEqual(invalid);
    expect(prepareReviewComment(`a${low}b`)).toEqual(invalid);
    expect(prepareReviewComment(high)).toEqual(invalid);
    expect(prepareReviewComment(`a${ch(0x1F600)}b`).kind).toBe('text');
  });

  it('a control character is refused even when it is all there is (the server refuses NUL before it looks for blanks)', () => {
    expect(prepareReviewComment(ch(0x0))).toEqual(invalid);
    expect(prepareReviewComment(ch(0x1C))).toEqual(invalid);
  });
});

describe('what the server tolerates inside a sentence is kept', () => {
  it.each<[string, number]>([
    ['a soft hyphen', 0xAD], ['a combining grapheme joiner', 0x34F], ['a zero-width non-joiner', 0x200C], ['a zero-width joiner', 0x200D],
    ['an emoji variation selector', 0xFE0F], ['the first variation selector', 0xFE00], ['the braille blank', 0x2800],
    ['a no-break space', 0xA0], ['a narrow no-break space', 0x202F], ['a line feed', 0xA],
  ])('%s', (_name, code) => {
    expect(prepareReviewComment(`a${ch(code)}b`)).toEqual(text(`a${ch(code)}b`));
  });

  it('keeps an emoji sequence joined', () => {
    const family = ch(0x1F468, 0x200D, 0x1F469, 0x200D, 0x1F467);
    expect(prepareReviewComment(`Ekipa ${family}`)).toEqual(text(`Ekipa ${family}`));
  });

  it.each<[string, number]>([
    ['just before the line separator', 0x2027], ['just after the block U+2060..U+206F', 0x2070], ['just after the Hangul filler U+3164', 0x3165],
    ['just after the half-width filler', 0xFFA1], ['the object replacement character', 0xFFFC], ['just before the shorthand letters', 0x1BC9F],
    ['just after the musical format characters', 0x1D17B], ['just before the hieroglyph controls', 0x1342F],
    ['just after the hieroglyph controls', 0x13440], ['just after the plane-14 block', 0xE1000], ['a Serbian letter', 0x161],
    ['the first printable ASCII character', 0x21],
  ])('does not over-refuse: %s', (_name, code) => {
    expect(prepareReviewComment(`a${ch(code)}b`)).toEqual(text(`a${ch(code)}b`));
  });
});

describe('the sentences the person reads', () => {
  it('say what happened and what to do, in the "ti" voice, without the word server', () => {
    for (const message of Object.values(REVIEW_COMMENT_MESSAGES)) {
      expect(message).toMatch(/[.!]$/);
      expect(message.toLowerCase()).not.toContain('server');
    }
    expect(REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_TOO_LONG).toContain('500');
  });

  it('refuse a contact detail by saying only that contact details are not shown publicly', () => {
    expect(REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_CONTACT_NOT_PUBLIC).toBe('Kontakt podaci se ne prikazuju javno. Ukloni ih iz komentara pa pošalji ponovo.');
    for (const word of ['telefon', 'mejl', 'pošta', 'veza', 'link', 'adres', 'cifr', 'broj', '@']) {
      expect(REVIEW_COMMENT_MESSAGES.REVIEW_COMMENT_CONTACT_NOT_PUBLIC.toLowerCase()).not.toContain(word);
    }
  });
});

describe('the length the counter shows is the length that will be sent', () => {
  it('counts code points of the text as it is sent: trimmed, composed, line breaks as one', () => {
    expect(reviewCommentLength('')).toBe(0);
    expect(reviewCommentLength('   ')).toBe(0);
    expect(reviewCommentLength('  abc  ')).toBe(3);
    expect(reviewCommentLength('a\r\nb')).toBe(3);
    expect(reviewCommentLength(`e${ch(0x301)}`)).toBe(1);
    expect(reviewCommentLength(`${ch(0x1F600)}${ch(0x1F600)}`)).toBe(2);
  });

  it('is the number the verdict uses: the verdict is "too long" exactly when the counter is over the limit', () => {
    for (const size of [499, 500, 501, 502]) {
      const text = 'x'.repeat(size);
      expect(prepareReviewComment(text).kind).toBe(reviewCommentLength(text) > REVIEW_COMMENT_MAX_CODE_POINTS ? 'invalid' : 'text');
    }
  });
});

/**
 * The two classes are the SERVER's. They are read from the generator of the server candidate, so a change on either side is a red
 * test here (the client would otherwise tell a person "fine" about a text the server refuses, or the other way round).
 */
describe('the classes are the server\'s own', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync } = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { join } = require('path') as typeof import('path');
  const generator = readFileSync(join(__dirname, '..', '..', '..', 'supabase', 'proofs', 'd12', 'build_d12.py'), 'utf8');
  const rangesOf = (name: string): [number, number][] => {
    const start = generator.indexOf(`\n${name} = [`);
    expect(start).toBeGreaterThan(0);
    const list = generator.slice(start, generator.indexOf(']', start));
    return [...list.matchAll(/\(0x([0-9A-Fa-f]+), 0x([0-9A-Fa-f]+)\)/g)].map(match => [parseInt(match[1], 16), parseInt(match[2], 16)]);
  };
  const expand = (ranges: readonly (readonly [number, number])[]) => new Set(ranges.flatMap(([from, to]) => Array.from({ length: to - from + 1 }, (_x, at) => from + at)));
  const sorted = (set: Set<number>) => [...set].sort((a, b) => a - b);

  it('finds the lists in the generator, so a renamed list cannot pass for an equal one', () => {
    expect(rangesOf('FORBIDDEN_RANGES').length).toBeGreaterThan(15);
    expect(rangesOf('BLANK_RANGES').length).toBeGreaterThan(10);
  });

  it('blank is the server\'s blank class, to the code point', () => {
    expect(sorted(expand(REVIEW_COMMENT_BLANK_RANGES))).toEqual(sorted(expand(rangesOf('BLANK_RANGES'))));
  });

  it('forbidden is the server\'s forbidden class plus the NUL that PostgreSQL cannot store, to the code point', () => {
    expect(sorted(expand(REVIEW_COMMENT_FORBIDDEN_RANGES))).toEqual(sorted(new Set([0, ...expand(rangesOf('FORBIDDEN_RANGES'))])));
  });

  it('every default-ignorable code point that this Node knows is forbidden or one of the four groups tolerated inside a sentence', () => {
    const ignorable = /\p{Default_Ignorable_Code_Point}/u;
    const forbidden = expand(REVIEW_COMMENT_FORBIDDEN_RANGES), tolerated = expand([[0xAD, 0xAD], [0x34F, 0x34F], [0x200C, 0x200D], [0xFE00, 0xFE0F]]);
    const outside: string[] = [];
    for (let code = 0; code <= 0x10FFFF; code++) {
      if (code >= 0xD800 && code <= 0xDFFF) continue;
      if (ignorable.test(String.fromCodePoint(code)) && !forbidden.has(code) && !tolerated.has(code)) outside.push(`U+${code.toString(16).toUpperCase()}`);
    }
    expect(outside).toEqual([]);
  });

  it('a tolerated character is never forbidden, and the blank class holds every tolerated one', () => {
    const forbidden = expand(REVIEW_COMMENT_FORBIDDEN_RANGES), blank = expand(REVIEW_COMMENT_BLANK_RANGES);
    for (const code of [0xAD, 0x34F, 0x200C, 0x200D, 0xFE00, 0xFE0F, 0x2800]) {
      expect([code, forbidden.has(code), blank.has(code)]).toEqual([code, false, true]);
    }
  });

  it('the two classes overlap only where the server lets them (white-space controls, U+0085, the two separators): a blank-only text is no comment before it is judged', () => {
    const overlap = sorted(new Set([...expand(REVIEW_COMMENT_FORBIDDEN_RANGES)].filter(code => expand(REVIEW_COMMENT_BLANK_RANGES).has(code))));
    expect(overlap).toEqual([0x09, 0x0B, 0x0C, 0x0D, 0x85, 0x2028, 0x2029]);
  });
});

describe('what a person is told is complete, in plain words', () => {
  it('has a sentence for every refusal and every outcome the comment client can produce, none of them a code', () => {
    expect(Object.keys(REVIEW_COMMENT_MESSAGES).sort()).toEqual([
      'AUTH_REQUIRED', 'REQUEST_ID_REUSED', 'REVIEW_ALREADY_SUBMITTED', 'REVIEW_COMMENT_CONTACT_NOT_PUBLIC', 'REVIEW_COMMENT_INVALID',
      'REVIEW_COMMENT_MISMATCH', 'REVIEW_COMMENT_TOO_LONG', 'REVIEW_COMMENT_UNAVAILABLE', 'REVIEW_NOT_ALLOWED', 'REVIEW_NOT_COMPLETED',
    ]);
    for (const message of Object.values(REVIEW_COMMENT_MESSAGES)) {
      expect(message).not.toMatch(/[A-Z]{3,}_[A-Z]/);
      expect(message.length).toBeGreaterThan(15);
    }
  });

  it('speaks to the person without a gendered past form (one voice, no grammatical gender)', () => {
    for (const [code, message] of Object.entries(REVIEW_COMMENT_MESSAGES)) {
      expect([code, /napisao|napisala|poslao|poslala|ocenio|ocenila|uneo|unela|uradio|uradila/i.test(message)]).toEqual([code, false]);
    }
  });
});

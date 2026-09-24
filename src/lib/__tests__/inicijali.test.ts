import { readFileSync } from 'fs';
import { join } from 'path';
import { inicijali } from '../inicijali';

/**
 * One way to turn a name into the letters beside a person (2026-09-24). The emulator showed the same person as "MI" on
 * one screen, "M" on the next and "MS" on a third, and a missing name drew letters that belong to nobody.
 */
it.each([
  ['Miloš Šljivić', 'MŠ'],
  ['Milos SLJIVIC', 'MS'],
  ['msljivic031', 'M'],
  ['  ana   marija  petrović ', 'AM'],
  ['đorđe', 'Đ'],
  ['Ana-Marija Petrović', 'AP'],
  ['Marko (Kombi)', 'MK'],
  ['Jovan - Jović', 'JJ'],
  ['9. brigada', '9B'],
  ['Émile Zola', 'ÉZ'],
])('%j → %j: the first grapheme of the first two words, in capitals', (name, expected) => {
  expect(inicijali(name)).toBe(expected);
});

it('keeps a letter with a combining accent as one grapheme', () => {
  // "E" + U+0301 is one letter on screen; splitting it would leave a floating accent.
  expect(inicijali('Émile Zola')).toBe('ÉZ');
});

it.each([null, undefined, '', '   ', '—', '( )', '🙂'])('no name (%j) gives null, never a placeholder', name => {
  expect(inicijali(name as string | null | undefined)).toBeNull();
});

it('never returns more than two graphemes', () => {
  expect(inicijali('Ana Marija Petrović Jović')).toBe('AM');
});

it('the data services no longer spell initials of their own', () => {
  // The four hand-made ways lived here; a name slice would bring invented letters back.
  for (const path of ['src/data/agreementClientService.ts', 'src/data/candidateClientService.ts', 'src/app/(app)/profil.tsx',
    'src/ui/workerProfile/WorkerProfilePresentation.tsx']) {
    const source = readFileSync(join(__dirname, '../../..', path), 'utf8');
    // The worker profile lost its hero on 2026-09-24 and draws no stand-in at all: it must not start drawing one of its own.
    if (path.endsWith('WorkerProfilePresentation.tsx')) expect([path, /<Avatar/.test(source)]).toEqual([path, false]);
    else expect([path, source]).toEqual([path, expect.stringContaining('inicijali')]);
    expect([path, /\.slice\(0,\s*2\)\.(?:map|toUpperCase)/.test(source)]).toEqual([path, false]);
    expect([path, /'(?:TI|DS|JA)'/.test(source)]).toEqual([path, false]);
  }
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { osoba } from '../plural';

/**
 * Five places spelled one rule.
 *
 * `plural.ts` existed, was documented, and already exported `osoba`. Five files carried their own
 * modulo arithmetic anyway: `needPeopleText` in the data module, `peopleText` in
 * AgreementPresentation, a third `peopleText` written differently in ApplicationSelectionPresentation,
 * and an inline copy inside the intake card's summary.
 *
 * Three of the five were correct, which is exactly why nobody noticed. The two in the fake source
 * were not: `n === 1 ? 'osoba' : 'osobe'` says "5 osobe".
 *
 * A rule spelled in five places is four chances to get it wrong the next time it is touched. This
 * asserts there is one place, and that the one place is still right.
 */
const SRC = join(__dirname, '..', '..', '..');
const CANONICAL = ['ui', 'system', 'plural.ts'].join('/');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(path);
  }
  return out;
}

/** The shape of the rule: last-two-digits arithmetic standing next to a counted Serbian noun. */
function spellsThePluralRule(source: string): boolean {
  const arithmetic = /%\s*100\b[\s\S]{0,40}(>=|<=|>|<)|%\s*10\b[\s\S]{0,40}(>=|<=|>|<)/.test(source);
  const nouns = /'osoba'|'osobe'|'zadatak'|'zadatka'|'zadataka'|'prijava'|'prijave'|'Dogovora'/.test(source);
  return arithmetic && nouns;
}

describe('the Serbian plural has one spelling', () => {
  const files = sources(SRC);

  it('looks at a real tree, so an empty sweep cannot pass for a clean one', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some(file => file.split(/[\\/]/).join('/').endsWith(CANONICAL))).toBe(true);
  });

  it('computes it in exactly one file', () => {
    const offenders = files
      .map(file => ({ file, path: file.split(/[\\/]/).join('/') }))
      .filter(({ path }) => !path.endsWith(CANONICAL))
      .filter(({ file }) => spellsThePluralRule(readFileSync(file, 'utf8')))
      .map(({ path }) => path.slice(path.indexOf('/src/') + 1));
    expect(offenders).toEqual([]);
  });

  it('and that one file is still right about every shape', () => {
    expect([1, 2, 5, 11, 12, 14, 21, 22, 25].map(osoba)).toEqual([
      '1 osoba', '2 osobe', '5 osoba', '11 osoba', '12 osoba', '14 osoba', '21 osoba', '22 osobe', '25 osoba',
    ]);
  });
});

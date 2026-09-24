import { foldTerm, hasTerm, toggleTerm } from '../workerProfileDraft';

/**
 * Quick picks are presentation only (2026-09-24): a picture inserts its catalog label as the same free text a person could
 * type, and removes every spelling of that term. The saved list and matching are unchanged.
 */
describe('quick-pick terms', () => {
  it('folds ASCII spaces and case the way the list compares them', () => {
    expect(foldTerm('  Kombi ')).toBe('kombi');
    expect(foldTerm('ČIŠĆENJE')).toBe('čišćenje');
  });

  it('finds a term in any spelling of its case', () => {
    expect(hasTerm(['kombi'], 'Kombi')).toBe(true);
    expect(hasTerm(['Kombi vozilo'], 'Kombi')).toBe(false);
  });

  it('adds the catalog label after the terms already there', () => {
    expect(toggleTerm(['Bušilica'], 'Merdevine')).toEqual(['Bušilica', 'Merdevine']);
  });

  it('removes every spelling of the term, and keeps the rest in order', () => {
    expect(toggleTerm(['Kombi', 'Automobil', 'KOMBI', ' kombi'], 'Kombi')).toEqual(['Automobil']);
  });

  it('never grows a full list past 50', () => {
    const full = Array.from({ length: 50 }, (_, i) => `Stavka ${i + 1}`);
    expect(toggleTerm(full, 'Kombi')).toEqual(full);
    expect(toggleTerm(full, 'Stavka 3')).toHaveLength(49);
  });
});

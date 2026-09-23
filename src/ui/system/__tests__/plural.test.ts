import { dogovora, plural, prijava, zadataka } from '../plural';

/**
 * "1 zadataka" was on the map legend: the app counted the way English does, with one plural. The
 * shape a Serbian noun takes is decided by the last two digits, and 11–14 are the exception that
 * a naive rule gets wrong.
 */
describe('counting in Serbian', () => {
  it.each([
    [1, '1 zadatak'], [2, '2 zadatka'], [3, '3 zadatka'], [4, '4 zadatka'], [5, '5 zadataka'],
    [11, '11 zadataka'], [12, '12 zadataka'], [13, '13 zadataka'], [14, '14 zadataka'],
    [21, '21 zadatak'], [22, '22 zadatka'], [25, '25 zadataka'],
    [101, '101 zadatak'], [111, '111 zadataka'], [112, '112 zadataka'], [124, '124 zadatka'],
    [0, '0 zadataka'],
  ])('%i', (count, expected) => expect(zadataka(count)).toBe(expected));

  it('takes the three words from the caller, because only the caller knows them', () => {
    expect(dogovora(1)).toBe('1 Dogovor');
    expect(dogovora(3)).toBe('3 Dogovora');
    expect(dogovora(13)).toBe('13 Dogovora');
    expect(prijava(1)).toBe('1 prijava');
    expect(prijava(2)).toBe('2 prijave');
    expect(prijava(5)).toBe('5 prijava');
    expect(plural(2, 'poruka', 'poruke', 'poruka')).toBe('2 poruke');
  });
});

describe('a price is for the people an application brings', () => {
  it('agrees the verb with the count as well as the noun', () => {
    const { dolaziOsoba } = require('../plural') as typeof import('../plural');
    expect([1, 2, 4, 5, 11, 12, 21, 22, 25].map(dolaziOsoba)).toEqual(['dolazi 1 osoba', 'dolaze 2 osobe', 'dolaze 4 osobe',
      'dolazi 5 osoba', 'dolazi 11 osoba', 'dolazi 12 osoba', 'dolazi 21 osoba', 'dolaze 22 osobe', 'dolazi 25 osoba']);
  });

  // The offer screen read "Ukupno za dolazi 1 osoba" (phone, 2026-09-23): after "za" the people take the accusative.
  it.each([[1, 'Ukupno za 1 osobu'], [2, 'Ukupno za 2 osobe'], [5, 'Ukupno za 5 osoba'], [11, 'Ukupno za 11 osoba'],
    [21, 'Ukupno za 21 osobu'], [22, 'Ukupno za 22 osobe']])('says the total is for %i in the accusative', (count, expected) => {
    const { osobuAkuz } = require('../plural') as typeof import('../plural');
    expect(`Ukupno za ${osobuAkuz(count)}`).toBe(expected);
  });
});

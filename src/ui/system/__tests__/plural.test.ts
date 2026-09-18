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
    expect(prijava(1)).toBe('1 Prijava');
    expect(prijava(2)).toBe('2 Prijave');
    expect(prijava(5)).toBe('5 Prijava');
    expect(plural(2, 'poruka', 'poruke', 'poruka')).toBe('2 poruke');
  });
});

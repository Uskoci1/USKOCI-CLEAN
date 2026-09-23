import { podrucjeTekst } from '../location';

// Seen on Moje prijave, 2026-09-23: an area stored as "\"Vračar, Beograd\"" was printed with its quotation marks.
describe('the approximate area as a person reads it', () => {
  it('drops a pair of wrapping quotes the interview wrote around a stored area', () => {
    expect(podrucjeTekst('"Vračar, Beograd"', null)).toBe('Vračar, Beograd');
    expect(podrucjeTekst('„Liman“', 'Novi Sad')).toBe('Liman, Novi Sad');
  });
  it('keeps quotes that are part of the text and never repeats a city the area already names', () => {
    expect(podrucjeTekst('Kod "Merkatora"', 'Novi Sad')).toBe('Kod "Merkatora", Novi Sad');
    expect(podrucjeTekst('"Vračar, Beograd"', 'Beograd')).toBe('Vračar, Beograd');
  });
  it('says so when nothing is known, including an empty pair of quotes', () => {
    expect(podrucjeTekst(null, undefined)).toBe('Lokacija nije navedena');
    expect(podrucjeTekst('""', '  ')).toBe('Lokacija nije navedena');
  });
});

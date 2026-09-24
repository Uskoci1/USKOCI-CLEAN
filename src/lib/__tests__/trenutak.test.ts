import { trenutak } from '../trenutak';
import { vreme } from '../vreme';

// The inbox groups its rows by day (step 11a, 2026-09-24): "Danas", "Juče", then the date, with the clock on each row.
// Both halves come from the one time format, so a day header and vreme() never disagree about a moment.
const zona = 'Europe/Belgrade';
const sada = new Date('2026-09-24T10:00:00Z'); // 12:00 in Belgrade

describe('trenutak', () => {
  it('names today and yesterday, and writes the clock to the minute', () => {
    expect(trenutak('2026-09-24T08:05:33Z', { zona, sada })).toEqual({ kljuc: '2026-09-24', dan: 'Danas', sat: '10:05' });
    expect(trenutak('2026-09-23T18:00:00Z', { zona, sada })).toEqual({ kljuc: '2026-09-23', dan: 'Juče', sat: '20:00' });
  });

  it('writes an earlier day of this year without the year, and a day of another year with it', () => {
    expect(trenutak('2026-09-22T12:05:00Z', { zona, sada })).toEqual({ kljuc: '2026-09-22', dan: '22. sep', sat: '14:05' });
    expect(trenutak('2025-01-05T12:00:00Z', { zona, sada })).toEqual({ kljuc: '2025-01-05', dan: '5. jan 2025', sat: '13:00' });
  });

  it('puts a moment on the civil day of the zone, around midnight', () => {
    // 23:59 and 00:01 in Belgrade are two different days, although both are 21:5x / 22:0x UTC on the 23rd.
    expect(trenutak('2026-09-23T21:59:00Z', { zona, sada })).toEqual({ kljuc: '2026-09-23', dan: 'Juče', sat: '23:59' });
    expect(trenutak('2026-09-23T22:01:00Z', { zona, sada })).toEqual({ kljuc: '2026-09-24', dan: 'Danas', sat: '00:01' });
    // Just after midnight "now", yesterday evening is "Juče", not "Danas".
    const posle = new Date('2026-09-23T22:30:00Z');
    expect(trenutak('2026-09-23T21:30:00Z', { zona, sada: posle })?.dan).toBe('Juče');
  });

  it('agrees with vreme() on the day and the clock', () => {
    for (const value of ['2026-09-22T12:05:00Z', '2025-01-05T12:00:00Z', '2026-03-01T06:30:00Z']) {
      const moment = trenutak(value, { zona, sada })!;
      expect(`${moment.dan} · ${moment.sat}`).toBe(vreme(value, { zona, sada }));
    }
  });

  it('reads in the phone zone when none is given (UTC in this runner)', () => {
    expect(trenutak('2026-09-24T08:05:00Z', { sada })).toEqual({ kljuc: '2026-09-24', dan: 'Danas', sat: '08:05' });
  });

  it('gives null for a missing or invalid moment, never a made-up day', () => {
    for (const value of [null, undefined, '', 'nije vreme', Number.NaN]) expect(trenutak(value as string, { zona, sada })).toBeNull();
    expect(trenutak('2026-09-24T08:05:00Z', { zona: 'Nije/Zona', sada })).toBeNull();
  });
});

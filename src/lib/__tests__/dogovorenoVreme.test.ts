import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dogovorenoVreme } from '../dogovorenoVreme';
import { raspon } from '../vreme';

/**
 * An agreed time has to read the same on both phones.
 *
 * It did not. `candidateClientService` pinned Europe/Belgrade when it showed the requester a
 * worker's proposed start. `applicationClientService` showed the worker their own proposal through
 * `toLocaleString` with no zone at all. Same instant, two screens, two answers on any phone set
 * outside Belgrade's offset — for the thing the two of them are agreeing about.
 *
 * WHY THIS WENT UNNOTICED, and why the exact values below matter: the machine this was written on
 * is Europe/Warsaw, which shares Belgrade's offset all year. A test that only compared the two code
 * paths to each other would have passed while the bug was live. These assertions name the instant
 * AND the string, so a run in UTC — which is what CI is — fails if the zone is ever dropped again:
 * 10:00Z would print as 10:00 instead of 12:00.
 */
// The owner's rule (2026-09-21, deep read 8.27): a phone set to another zone is told the time is Serbian.
// Jest runs in UTC (jest.config.cjs), so every agreed time here carries the note.
const NOTE = ' (po vremenu u Srbiji)';

// One time format (src/lib/vreme.ts): "24. sep · 12:00", the year only when it is not the current one. "Now" is fixed,
// so the year rule is deterministic.
beforeAll(() => { jest.useFakeTimers({ now: new Date('2026-09-23T12:00:00Z') }); });
afterAll(() => { jest.useRealTimers(); });

describe('a window, spelled once', () => {
  const zona = 'Europe/Belgrade';
  it('joins one day, names two days, and writes one time for a single minute', () => {
    expect(raspon('2026-09-24T10:00:00Z', '2026-09-24T17:00:00Z', { zona })).toBe('24. sep · 12:00–19:00');
    expect(raspon('2026-09-24T20:00:00Z', '2026-09-25T04:00:00Z', { zona })).toBe('24. sep · 22:00 – 25. sep · 06:00');
    expect(raspon('2026-09-24T10:00:00.000001Z', '2026-09-24T10:00:00.000009Z', { zona })).toBe('24. sep · 12:00');
  });
  it('names both offsets for the hour that repeats when clocks go back (review of 2026-09-23)', () => {
    // 25 Oct 2026: 00:30Z is 02:30 summer time, 01:30Z is 02:30 winter time. One hour, the same wall clock.
    expect(raspon('2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z', { zona })).toBe('25. okt · 02:30 (UTC+02:00)–02:30 (UTC+01:00)');
    expect(raspon('2026-10-25T00:30:00Z', '2026-10-25T01:45:00Z', { zona })).toBe('25. okt · 02:30 (UTC+02:00)–02:45 (UTC+01:00)');
  });
  it('an invalid end shows the valid one, and the fallback only when neither is valid', () => {
    expect(raspon('2026-09-24T10:00:00Z', 'ne-datum', { zona, inace: 'Po dogovoru' })).toBe('24. sep · 12:00');
    expect(raspon(null, undefined, { zona, inace: 'Po dogovoru' })).toBe('Po dogovoru');
  });
});

describe('a time that was agreed', () => {
  it('reads in the task market zone, whatever zone the phone is in', () => {
    // Summer: Belgrade is UTC+2.
    expect(dogovorenoVreme('2026-06-15T10:00:00Z')).toBe('15. jun · 12:00' + NOTE);
    // Winter: UTC+1. The same code must follow the change, not a fixed offset.
    expect(dogovorenoVreme('2026-01-15T10:00:00Z')).toBe('15. jan · 11:00' + NOTE);
    // Across midnight, where a dropped zone also moves the DAY, not just the hour.
    expect(dogovorenoVreme('2026-09-21T22:30:00Z')).toBe('22. sep · 00:30' + NOTE);
    // Another year is written out; seconds never are.
    expect(dogovorenoVreme('2027-01-05T09:00:59.999Z')).toBe('5. jan 2027 · 10:00' + NOTE);
  });

  it('agrees with an explicitly pinned reference on this machine too', () => {
    const iso = '2026-03-10T07:45:00Z';
    const day = new Date(iso).toLocaleDateString('sr-Latn-RS', { timeZone: 'Europe/Belgrade', day: 'numeric', month: 'short' });
    const clock = new Date(iso).toLocaleTimeString('sr-Latn-RS', { timeZone: 'Europe/Belgrade', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    expect(dogovorenoVreme(iso)).toBe(`${day} · ${clock}` + NOTE);
  });

  it('says nothing extra on a phone that is already in Serbian time', () => {
    const real = Intl.DateTimeFormat.prototype.resolvedOptions;
    const phone = jest.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockImplementation(function (this: Intl.DateTimeFormat) { return { ...real.call(this), timeZone: 'Europe/Belgrade' }; });
    try {
      expect(dogovorenoVreme('2026-06-15T10:00:00Z')).toBe('15. jun · 12:00');
    } finally { phone.mockRestore(); }
    expect(dogovorenoVreme('2026-06-15T10:00:00Z')).toBe('15. jun · 12:00' + NOTE);
  });

  it('says the caller words rather than inventing a time it does not have', () => {
    expect(dogovorenoVreme(null)).toBe('Po dogovoru');
    expect(dogovorenoVreme(undefined)).toBe('Po dogovoru');
    expect(dogovorenoVreme('')).toBe('Po dogovoru');
    expect(dogovorenoVreme('ne-datum')).toBe('Po dogovoru');
    expect(dogovorenoVreme(1750000000000)).toBe('Po dogovoru');
    // My applications already said "Fleksibilno" where no start was proposed, and keeps saying it.
    expect(dogovorenoVreme(null, 'Fleksibilno')).toBe('Fleksibilno');
  });

  it('is what both sides of an application actually call', () => {
    const read = (file: string) => readFileSync(join(__dirname, '..', '..', 'data', file), 'utf8');
    for (const file of ['applicationClientService.ts', 'candidateClientService.ts']) {
      const source = read(file);
      expect(source).toContain('dogovorenoVreme');
      // No local re-spelling of the same thing beside it.
      expect(source).not.toMatch(/new Date\([^)]*\)\.toLocaleString\('sr-Latn-RS'\)/);
    }
  });
});

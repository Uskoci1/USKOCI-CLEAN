import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dogovorenoVreme } from '../dogovorenoVreme';

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
describe('a time that was agreed', () => {
  it('reads in the task market zone, whatever zone the phone is in', () => {
    // Summer: Belgrade is UTC+2.
    expect(dogovorenoVreme('2026-06-15T10:00:00Z')).toBe('15.06. 12:00');
    // Winter: UTC+1. The same code must follow the change, not a fixed offset.
    expect(dogovorenoVreme('2026-01-15T10:00:00Z')).toBe('15.01. 11:00');
    // Across midnight, where a dropped zone also moves the DAY, not just the hour.
    expect(dogovorenoVreme('2026-09-21T22:30:00Z')).toBe('22.09. 00:30');
  });

  it('agrees with an explicitly pinned reference on this machine too', () => {
    const iso = '2026-03-10T07:45:00Z';
    const reference = new Date(iso).toLocaleString('sr-Latn-RS', {
      timeZone: 'Europe/Belgrade', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    expect(dogovorenoVreme(iso)).toBe(reference);
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

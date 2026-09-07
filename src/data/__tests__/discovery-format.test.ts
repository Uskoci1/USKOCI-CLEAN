/** @jest-environment node */
import { discoveryArea, discoverySchedule } from '../discoveryFormat';

describe('public task display without invented time or geography', () => {
  it('shows both bounds in the named Serbia timezone for a fixed window', () => {
    const value = discoverySchedule('FIXED_WINDOW', '2026-09-08T14:00:00Z', '2026-09-08T18:00:00Z');
    expect(value).toContain('16:00–20:00');
    expect(value.replace(/\s/g, '')).toContain('8.9.2026.');
    expect(value).toContain('(vreme u Srbiji)');
  });
  it('keeps both dates for an overnight window', () => {
    const value = discoverySchedule('FIXED_WINDOW', '2026-09-07T21:00:00Z', '2026-09-07T23:00:00Z');
    expect(value.replace(/\s/g, '')).toContain('7.9.2026.');
    expect(value.replace(/\s/g, '')).toContain('8.9.2026.');
    expect(value).toContain('23:00'); expect(value).toContain('01:00');
  });
  it('respects target-date winter and DST offsets rather than hardcoding an offset', () => {
    expect(discoverySchedule('FIXED_WINDOW', '2026-01-10T14:00:00Z', '2026-01-10T15:00:00Z')).toContain('15:00–16:00');
    expect(discoverySchedule('FIXED_WINDOW', '2026-03-29T00:30:00Z', '2026-03-29T01:30:00Z')).toContain('01:30–03:30');
  });
  it('shows the same instants independently of input offset and viewer process timezone', () => {
    const prior = process.env.TZ;
    try {
      process.env.TZ = 'America/Los_Angeles';
      const first = discoverySchedule('REMOTE_ANYTIME', '2026-09-08T16:00:00+02:00', '2026-09-08T20:00:00+02:00');
      process.env.TZ = 'Asia/Tokyo';
      expect(discoverySchedule('REMOTE_ANYTIME', '2026-09-08T14:00:00Z', '2026-09-08T18:00:00Z')).toBe(first);
      expect(first).toContain('16:00–20:00');
    } finally { if (prior === undefined) delete process.env.TZ; else process.env.TZ = prior; }
  });
  it.each([[null, null], ['2026-09-08T14:00:00Z', null], [null, '2026-09-08T18:00:00Z']])(
    'does not turn an incomplete fixed window into a flexible task: %s %s', (start, end) => {
      expect(discoverySchedule('FIXED_WINDOW', start, end)).toBe('Termin nije potpun');
    });
  it('does not display an impossible reversed interval', () => {
    expect(discoverySchedule('FIXED_WINDOW', '2026-09-08T18:00:00Z', '2026-09-08T14:00:00Z')).toBe('Termin nije ispravan');
  });
  it('preserves partial nonfixed bounds and explicit flexibility', () => {
    expect(discoverySchedule('FLEXIBLE', '2026-09-08T14:00:00Z', null)).toContain('Od');
    expect(discoverySchedule('FLEXIBLE', null, '2026-09-08T18:00:00Z')).toContain('Do');
    expect(discoverySchedule('FLEXIBLE', null, null)).toBe('Termin po dogovoru');
    expect(discoverySchedule('REMOTE_ANYTIME', null, null)).toBe('Vreme po dogovoru');
  });
  it.each(['TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'])('does not reinterpret an unanchored %s at midnight', kind => {
    const before = discoverySchedule(kind, null, null);
    const now = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2030-01-01T23:59:59Z'));
    try {
      expect(discoverySchedule(kind, null, null)).toBe(before);
      expect(before).toMatch(/nisu precizirani|nije preciziran/);
      expect(before).not.toMatch(/Danas|Sutra|2030/);
    } finally { now.mockRestore(); }
  });
  it.each([
    ['STATIONARY', 'Centar, Novi Sad'], ['POINT_TO_POINT', 'Polazište: Centar, Novi Sad'],
    ['MULTI_STOP', 'Prva stanica: Centar, Novi Sad'], ['AREA_BASED', 'Područje rada: Centar, Novi Sad'], ['REMOTE', 'Na daljinu'],
  ])('labels the existing %s public anchor without inventing a destination', (mode, expected) => {
    expect(discoveryArea(mode, ' Centar ', ' Novi Sad ')).toBe(expected);
  });
  it('avoids blank location rows and dangling commas', () => {
    expect(discoveryArea('STATIONARY', ' ', '')).toBe('Područje nije navedeno');
    expect(discoveryArea('POINT_TO_POINT', '', 'Novi Sad')).toBe('Polazište: Novi Sad');
    expect(discoveryArea('REMOTE', '', '')).toBe('Na daljinu');
  });
});

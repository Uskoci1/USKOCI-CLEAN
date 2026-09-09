import { calendarInstant } from '../calendarTime';

it.each([null, undefined, 123, {}, '', 'infinity', 'now', '2026-09-11',
  '2026-09-11T12:00:00', '2026-02-29T12:00:00Z', '2026-02-30T12:00:00Z',
  '1900-02-29T12:00:00Z', '0000-01-01T00:00:00Z', '2026-12-01T24:00:00Z',
  '2026-12-01T23:60:00Z', '2026-12-01T23:00:60Z', '2026-12-01T23:00:00+16:00',
  '2026-12-01T23:00:00.0000001Z'])('rejects a non-explicit or invalid calendar instant: %p', value => {
  expect(calendarInstant(value)).toBeNull();
});
it.each(['2000-02-29T12:00:00Z', '2024-02-29T12:00:00Z', '0001-01-01T00:00:00Z',
  '9999-12-31T23:59:59.999999Z'])('supports valid civil dates without the Date.UTC year-0..99 shortcut: %s', value => {
  expect(calendarInstant(value)).not.toBeNull();
});
it('compares equivalent offsets across midnight exactly', () => {
  expect(calendarInstant('2026-09-11T00:00:00.000001+02:00')).toBe(calendarInstant('2026-09-10T22:00:00.000001Z'));
  expect(calendarInstant('2026-09-10T20:00:00-02:00')).toBe(calendarInstant('2026-09-10T22:00:00Z'));
});
it('retains each of PostgreSQL six fractional digits', () => {
  const first=calendarInstant('2026-09-11T00:00:00.000001Z');
  const next=calendarInstant('2026-09-11T00:00:00.000002Z');
  expect(first).not.toBeNull();expect(next).not.toBeNull();
  expect(next! - first!).toBe(1n);
});

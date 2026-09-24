import { tacanTermin } from '../tacanTermin';

// The accepted exact window a Dogovor is placed by on the calendar (owner step 10, critique A15).
describe('tacanTermin', () => {
  it('keeps both ends exactly as stored when the start is before the end', () => {
    expect(tacanTermin('2026-09-24T10:00:00.123456+00:00', '2026-09-24T17:00:00Z'))
      .toEqual({ pocetak: '2026-09-24T10:00:00.123456+00:00', kraj: '2026-09-24T17:00:00Z' });
  });
  it('is null for a missing, unreadable, empty or backwards window', () => {
    expect(tacanTermin(null, '2026-09-24T17:00:00Z')).toBeNull();
    expect(tacanTermin('2026-09-24T10:00:00Z', undefined)).toBeNull();
    expect(tacanTermin('24. sep 10:00', '2026-09-24T17:00:00Z')).toBeNull();
    expect(tacanTermin('2026-09-24T10:00:00Z', '2026-09-24T10:00:00Z')).toBeNull();
    expect(tacanTermin('2026-09-24T17:00:00Z', '2026-09-24T10:00:00Z')).toBeNull();
    expect(tacanTermin('2026-02-30T10:00:00Z', '2026-03-01T10:00:00Z')).toBeNull();
  });
  it('compares at the microsecond', () => {
    expect(tacanTermin('2026-09-24T10:00:00.000001Z', '2026-09-24T10:00:00.000002Z')).not.toBeNull();
  });
});

import { civilClock, civilDay, dayHeading, scheduleZone, showScheduleZone, weekDates, weekLabel } from '../calendarPresentation';

// Fixed expectations for the civil forms Dostupnost shows (review of plan step 0, 2026-09-24). The screen tests build
// their expected text with these same functions, so a fault in them would pass there; it cannot pass here.
const now = new Date('2026-09-24T10:00:00Z');

describe('civilDay', () => {
  it('writes a day of the current year without the year', () => {
    expect(civilDay('2026-09-23', now)).toBe('23. sep');
  });
  it('adds the year only when it is not the current one', () => {
    expect(civilDay('2027-01-05', now)).toBe('5. jan 2027');
  });
  it('returns a value that is not a calendar date as it came', () => {
    expect(civilDay('2026-02-30', now)).toBe('2026-02-30');
    expect(civilDay('23.09.2026', now)).toBe('23.09.2026');
  });
});

describe('civilClock', () => {
  it('writes a stored clock to the minute', () => {
    expect(civilClock('09:00:00.123456')).toBe('09:00');
    expect(civilClock('16:00:00')).toBe('16:00');
    expect(civilClock('16:00')).toBe('16:00');
  });
  it('returns a value that is not a clock as it came', () => {
    expect(civilClock('9:00')).toBe('9:00');
  });
});

describe('scheduleZone', () => {
  it('names Serbian time in words, never the zone id', () => {
    expect(scheduleZone('Europe/Belgrade')).toBe('Po vremenu u Srbiji');
  });
  it('keeps any other zone by its name', () => {
    expect(scheduleZone('Asia/Kathmandu')).toBe('Vremenska zona: Asia/Kathmandu');
  });
});

// Owner step 10 (2026-09-24, critique A16/A19): the day's heading names its weekday, the week says its month once, and the
// schedule's zone is said only where it is not already Serbian time on both sides.
describe('dayHeading', () => {
  it('names the weekday before the day', () => {
    expect(dayHeading('2026-09-24', now)).toBe('Četvrtak, 24. sep');
    expect(dayHeading('2027-01-05', now)).toBe('Utorak, 5. jan 2027');
    expect(dayHeading('2026-09-27', now)).toBe('Nedelja, 27. sep');
  });
});

describe('weekLabel', () => {
  it('says the month once inside one month', () => {
    expect(weekLabel(weekDates('2026-09-24'), now)).toBe('21–27. sep');
  });
  it('names both months across two', () => {
    expect(weekLabel(weekDates('2026-09-30'), now)).toBe('28. sep – 4. okt');
  });
  it('adds the year only when it is not the current one, and both across the new year', () => {
    expect(weekLabel(weekDates('2027-03-10'), now)).toBe('8–14. mar 2027');
    expect(weekLabel(weekDates('2026-12-30'), now)).toBe('28. dec 2026 – 3. jan 2027');
  });
});

describe('showScheduleZone', () => {
  it('stays quiet only for a Serbian schedule on a phone in Serbian time', () => {
    expect(showScheduleZone('Europe/Belgrade', 'Europe/Belgrade')).toBe(false);
    expect(showScheduleZone('Europe/Belgrade', 'Europe/Vienna')).toBe(true);
    expect(showScheduleZone('Asia/Kathmandu', 'Europe/Belgrade')).toBe(true);
    expect(showScheduleZone('Europe/Belgrade', undefined)).toBe(true);
  });
});

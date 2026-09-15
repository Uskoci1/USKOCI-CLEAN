import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import { correctionFromText, factCorrectionValue, factReviewValue } from '../aiNeedV2Ui';
import { civilInstant } from '../../ui/calendar/calendarPresentation';

const startFact: AiNeedV2Fact = {
  id: 'pkg003-timezone-proof',
  key: 'need.starts_at',
  value: '2026-09-15T10:00:00Z',
  displayValue: 'model display must not control time parsing',
  valueType: 'TIMESTAMPTZ',
  privacyClass: 'PUBLIC',
  requiredForDraft: false,
  status: 'CONFIRMED',
  source: 'EXPLICIT_USER_ANSWER',
  evidence: null,
};

describe('PKG-003 deterministic named-zone task time', () => {
  it('resolves civil input in Europe/Belgrade instead of the runner/device timezone', () => {
    expect(correctionFromText(startFact, '2026-09-15 12:00')).toEqual({
      ok: true,
      value: '2026-09-15T10:00:00.000Z',
      displayValue: '2026-09-15 12:00',
    });
    expect(civilInstant('2026-09-15', '12:00', 'Europe/Belgrade')).toEqual({
      value: '2026-09-15T10:00:00.000Z',
      error: null,
    });
  });

  it.each([
    ['2026-02-30 12:00', 'impossible February date'],
    ['2026-13-01 12:00', 'impossible month'],
    ['2026-09-15 24:00', 'impossible hour'],
  ])('rejects %s (%s) without Date normalization', input => {
    expect(correctionFromText(startFact, input)).toMatchObject({ ok: false });
  });

  it('rejects the Europe/Belgrade spring DST gap', () => {
    const result = correctionFromText(startFact, '2026-03-29 02:30');
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.message).toContain('ne postoji');
  });

  it('rejects the Europe/Belgrade repeated autumn wall clock as ambiguous', () => {
    const result = correctionFromText(startFact, '2026-10-25 02:30');
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.message).toContain('ponavlja');
  });

  it('preserves explicit ISO offset and microseconds byte-for-byte', () => {
    const exact = '2026-09-15T12:00:45.123456+02:00';
    const fact = { ...startFact, value: exact };
    expect(correctionFromText(fact, exact)).toEqual({ ok: true, value: exact, displayValue: exact });
    expect(factCorrectionValue(fact)).toBe(exact);
    expect(factReviewValue(fact)).toContain('12:00:45.123456');
    expect(factReviewValue(fact)).toContain('vreme u Beogradu');
  });

  it.each([
    '2026-09-15T12:00',
    '09/15/2026 12:00',
    'September 15 2026 12:00',
  ])('rejects zone-less/free-form input %s', input => {
    expect(correctionFromText(startFact, input)).toMatchObject({ ok: false });
  });

  it('fails closed for an invalid named timezone', () => {
    const result = civilInstant('2026-09-15', '12:00', 'Not/A_Real_Zone');
    expect(result.value).toBeNull();
    expect(result.error).toContain('vremensku zonu');
  });
});

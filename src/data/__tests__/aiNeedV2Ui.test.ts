import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import { correctionFromText, factCorrectionValue, factReviewValue } from '../aiNeedV2Ui';

const priceModeFact: AiNeedV2Fact = {
  id: 'price-mode-proof',
  key: 'need.price_mode',
  value: 'OFFERS',
  displayValue: 'Ponude',
  valueType: 'ENUM',
  privacyClass: 'PUBLIC',
  requiredForDraft: true,
  status: 'CONFIRMED',
  source: 'EXPLICIT_USER_ANSWER',
  evidence: 'ponude',
};

describe('Need V2 price-mode retirement', () => {
  it('accepts only current MY_PRICE/OFFERS aliases', () => {
    expect(correctionFromText(priceModeFact, 'moja cena')).toEqual({
      ok: true,
      value: 'MY_PRICE',
      displayValue: 'moja cena',
    });
    expect(correctionFromText(priceModeFact, 'ponude')).toEqual({
      ok: true,
      value: 'OFFERS',
      displayValue: 'ponude',
    });
  });

  it('rejects retired FASTEST and former najbrže aliases', () => {
    expect(correctionFromText(priceModeFact, 'FASTEST')).toEqual({
      ok: false,
      message: 'Koristite: moja cena ili ponude.',
    });
    expect(correctionFromText(priceModeFact, 'najbrže')).toEqual({
      ok: false,
      message: 'Koristite: moja cena ili ponude.',
    });
  });
});

const typedFact = (patch: Partial<AiNeedV2Fact>): AiNeedV2Fact => ({ ...priceModeFact, ...patch, displayValue: 'Different model summary' });
describe('authoritative fact review and correction values', () => {
  it('shows the complete actual text instead of a different or shorter displayValue', () => {
    const value = 'Čćšžđ '.repeat(800), fact = typedFact({ key: 'need.description', valueType: 'TEXT', value });
    expect(factReviewValue(fact)).toBe(value); expect(factCorrectionValue(fact)).toBe(value);
    expect(factReviewValue(typedFact({ key: 'need.exact_address', privacyClass: 'PRIVATE', valueType: 'TEXT', value: 'Privatna 42' }))).toBe('Privatna 42');
  });
  it.each([['MY_PRICE', 'Moja cena'], ['OFFERS', 'Ponude']])('localizes %s and seeds a parseable current enum', (value, label) => {
    const fact = typedFact({ value });
    expect(factReviewValue(fact)).toBe(label); expect(correctionFromText(fact, factCorrectionValue(fact))).toMatchObject({ ok: true, value });
  });
  it('does not activate the retired price mode through its readable label', () => {
    const fact = typedFact({ value: 'FASTEST' }); expect(factReviewValue(fact)).toContain('raniji način');
    expect(correctionFromText(fact, factCorrectionValue(fact))).toMatchObject({ ok: false });
  });
  it.each(['FIXED_WINDOW', 'FLEXIBLE', 'REMOTE_ANYTIME', 'TODAY_FLEXIBLE', 'TOMORROW_FLEXIBLE', 'WEEK_FLEXIBLE'])('round-trips supported %s schedule wording', value => {
    const fact = typedFact({ key: 'need.schedule_kind', value });
    expect(correctionFromText(fact, factCorrectionValue(fact))).toMatchObject({ ok: true, value });
    expect(factReviewValue(fact)).not.toBe(fact.displayValue);
  });
  it.each([true, false])('renders and round-trips actual boolean %s', value => {
    const fact = typedFact({ key: 'need.verified_identity_required', valueType: 'BOOLEAN', value });
    expect(factReviewValue(fact)).toBe(value ? 'Da' : 'Ne');
    expect(correctionFromText(fact, factCorrectionValue(fact))).toMatchObject({ ok: true, value });
  });
  it('keeps number input parseable while showing the known RSD unit', () => {
    const fact = typedFact({ key: 'need.price_rsd', valueType: 'INTEGER', value: 500 });
    expect(factReviewValue(fact)).toBe('500 RSD'); expect(factCorrectionValue(fact)).toBe('500');
  });
  it('preserves comma, newline, quote, case, order and duplicate array items', () => {
    const value = ['Vozač, sa dozvolom', 'Drugi\nred', 'Alat "A"', 'Vozač, sa dozvolom'];
    const fact = typedFact({ key: 'need.required_skills', valueType: 'TEXT_ARRAY', value });
    for (const item of value) expect(factReviewValue(fact)).toContain(item);
    expect(correctionFromText(fact, factCorrectionValue(fact))).toMatchObject({ ok: true, value });
  });
  it('retains full maximum typed arrays independently from the bounded display summary', () => {
    const value = Array(50).fill('a'.repeat(500)), fact = typedFact({ key: 'need.required_tools', valueType: 'TEXT_ARRAY', value });
    const corrected = correctionFromText(fact, factCorrectionValue(fact));
    expect(corrected).toMatchObject({ ok: true, value });
    if (corrected.ok) expect(Array.from(corrected.displayValue)).toHaveLength(1000);
    expect(factReviewValue(fact).length).toBeGreaterThan(25000);
  });
  it('represents an empty list without inventing a capability or an invalid empty display', () => {
    const fact = typedFact({ key: 'need.required_vehicles', valueType: 'TEXT_ARRAY', value: [] });
    expect(factReviewValue(fact)).toBe('Nema navedenih stavki');
    expect(correctionFromText(fact, factCorrectionValue(fact))).toEqual({ ok: true, value: [], displayValue: 'Nema navedenih stavki' });
  });
  it.each(['[broken]', '[123]', '[""]'])('rejects malformed explicit list %s', value => {
    expect(correctionFromText(typedFact({ key: 'need.required_tools', valueType: 'TEXT_ARRAY' }), value)).toMatchObject({ ok: false });
  });
  it('formats the actual instant in an explicit zone and preserves every microsecond in correction', () => {
    const value = '2026-09-10T16:30:45.123456Z', fact = typedFact({ key: 'need.starts_at', valueType: 'TIMESTAMPTZ', value });
    expect(factReviewValue(fact)).toContain('18:30:45.123456'); expect(factReviewValue(fact)).toContain('2026');
    expect(factReviewValue(fact)).toContain('vreme u Beogradu'); expect(factCorrectionValue(fact)).toBe(value);
    expect(correctionFromText(fact, factCorrectionValue(fact))).toMatchObject({ ok: true, value });
  });
  it('rejects an impossible ISO date instead of silently normalizing it', () => {
    const value = '2026-02-30T16:30:00Z', fact = typedFact({ key: 'need.starts_at', valueType: 'TIMESTAMPTZ', value });
    expect(factReviewValue(fact)).toBe('Termin nije dostupan'); expect(factCorrectionValue(fact)).toBe('');
    expect(correctionFromText(fact, value)).toMatchObject({ ok: false });
  });
  it('shows every existing geography slot and routes structured corrections to the existing editor', () => {
    const value = { mode: 'MULTI_STOP', start: { label: 'Početak', city: 'Novi Sad', area: 'Liman' },
      waypoints: [{ city: 'Petrovaradin', area: 'Stanica A' }, { city: 'Beočin', area: 'Stanica B' }], end: { city: 'Sremska Kamenica' } };
    const fact = typedFact({ key: 'need.task_geography', valueType: 'OBJECT', value });
    const rendered = factReviewValue(fact);
    for (const fragment of ['Više stanica', 'Početak', 'Liman', 'Stanica 1: Petrovaradin', 'Stanica 2: Beočin', 'Odredište: Sremska Kamenica']) expect(rendered).toContain(fragment);
    expect(factCorrectionValue(fact)).toBe('');
  });
  it('shows private confirmed witness details without treating provider hints as attestation', () => {
    const value = { version: 1, binding: { taskCountryCode: 'RS', geography: { mode: 'STATIONARY', start: { city: 'Novi Sad' } }, exactAddress: 'Privatna 42' },
      points: [{ slot: 'start', latitudeE6: 45255123, longitudeE6: 19845123,
        origin: { kind: 'PROVIDER_CANDIDATE', providerHint: 'provider-secret-hint', candidateHint: 'candidate-secret-hint' }, address: 'Ulaz A', accessNotes: 'Drugi sprat' }] };
    const rendered = factReviewValue(typedFact({ key: 'need.resolved_location', valueType: 'OBJECT', privacyClass: 'PRIVATE', value }));
    for (const fragment of ['1 od 1', 'RS', 'Novi Sad', 'Privatna 42', '45.255123', '19.845123', 'Ulaz A', 'Drugi sprat']) expect(rendered).toContain(fragment);
    expect(rendered).not.toContain('secret-hint');
  });
});

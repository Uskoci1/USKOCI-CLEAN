import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import {
  NEED_FACT_V2_DEFINITIONS,
  NEED_FACT_V2_KEYS,
  REQUIRED_NEED_FACT_V2_KEYS,
} from '../../contracts/needFactsV2';
import {
  canEditFactInline,
  correctionFromText,
  sortFacts,
} from '../aiNeedV2Ui';

function fact(overrides: Partial<AiNeedV2Fact> = {}): AiNeedV2Fact {
  return {
    id: 'f1',
    key: 'need.title',
    value: 'Stari naslov',
    displayValue: 'Stari naslov',
    valueType: 'TEXT',
    privacyClass: 'PUBLIC',
    requiredForDraft: true,
    status: 'NEEDS_CONFIRMATION',
    source: 'AI_INFERENCE',
    evidence: 'treba mi pomoć',
    ...overrides,
  };
}

describe('RU-2 typed R02 → R07 contract', () => {
  it('keeps exactly the canonical 20 V2 fact keys and required draft keys', () => {
    expect(NEED_FACT_V2_KEYS).toHaveLength(20);
    expect(REQUIRED_NEED_FACT_V2_KEYS).toEqual(expect.arrayContaining([
      'need.title',
      'need.description',
      'need.category',
      'need.price_mode',
      'need.schedule_kind',
      'need.people_needed',
      'need.task_geography',
    ]));
    expect(NEED_FACT_V2_DEFINITIONS['need.exact_address'].privacyClass).toBe('PRIVATE');
    expect(NEED_FACT_V2_DEFINITIONS['need.access_notes'].privacyClass).toBe('PRIVATE');
  });

  it('parses integer, boolean and arrays into typed values', () => {
    expect(correctionFromText(fact({ key: 'need.people_needed', valueType: 'INTEGER' }), ' 3 ')).toEqual({
      ok: true,
      value: 3,
      displayValue: '3',
    });
    expect(correctionFromText(fact({ key: 'need.verified_identity_required', valueType: 'BOOLEAN' }), 'da')).toEqual({
      ok: true,
      value: true,
      displayValue: 'Da',
    });
    expect(correctionFromText(fact({ key: 'need.required_tools', valueType: 'TEXT_ARRAY' }), 'bušilica, merdevine')).toEqual({
      ok: true,
      value: ['bušilica', 'merdevine'],
      displayValue: 'bušilica, merdevine',
    });
  });

  it('maps human price/schedule wording to backend enums', () => {
    expect(correctionFromText(fact({ key: 'need.price_mode', valueType: 'ENUM' }), 'moja cena')).toEqual({
      ok: true,
      value: 'MY_PRICE',
      displayValue: 'moja cena',
    });
    expect(correctionFromText(fact({ key: 'need.schedule_kind', valueType: 'ENUM' }), 'sutra')).toEqual({
      ok: true,
      value: 'TOMORROW_FLEXIBLE',
      displayValue: 'sutra',
    });
  });

  it('does not allow raw inline editing of structured geography', () => {
    const geo = fact({ key: 'need.task_geography', valueType: 'OBJECT', displayValue: 'Novi Sad' });
    expect(canEditFactInline(geo)).toBe(false);
    expect(correctionFromText(geo, 'Beograd')).toEqual({
      ok: false,
      message: 'Lokaciju izmenite kroz razgovor da bi struktura ostala bezbedna.',
    });
  });

  it('orders review facts by canonical registry order', () => {
    const ordered = sortFacts([
      fact({ id: '3', key: 'need.people_needed' }),
      fact({ id: '1', key: 'need.title' }),
      fact({ id: '2', key: 'need.category' }),
    ]);
    expect(ordered.map((item) => item.key)).toEqual([
      'need.title',
      'need.category',
      'need.people_needed',
    ]);
  });
});

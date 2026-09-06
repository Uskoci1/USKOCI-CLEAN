import type { AiNeedV2Fact } from '../../contracts/aiNeedV2';
import { correctionFromText } from '../aiNeedV2Ui';

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

import { roundTextScale } from '../textScale';

describe('roundTextScale', () => {
  it('reads the Android float 1.2999999523 as the 1.3 step it is', () => {
    expect(roundTextScale(1.2999999523162842)).toBe(1.3);
    expect(roundTextScale(1.2999999523162842) >= 1.3).toBe(true);
  });
  it('keeps the other steps and falls back to 1 for a value that is not a scale', () => {
    expect(roundTextScale(1)).toBe(1);
    expect(roundTextScale(1.15)).toBe(1.15);
    expect(roundTextScale(2)).toBe(2);
    expect(roundTextScale(Number.NaN)).toBe(1);
    expect(roundTextScale(0)).toBe(1);
  });
});

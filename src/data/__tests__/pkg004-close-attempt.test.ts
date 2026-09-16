import { retainRemainingSearchCloseAttempt } from '../remainingSearchCloseAttempt';

const NEED = '10000000-0000-4000-8000-000000000001';
const OTHER = '20000000-0000-4000-8000-000000000002';

describe('PKG-004 retained close command identity', () => {
  it('mints one immutable command for a Need revision and reuses it until the caller clears it', () => {
    const mint = jest.fn(() => 'zatvori_1');
    const first = retainRemainingSearchCloseAttempt(null, NEED, 3, mint);
    expect(first).toEqual({ needId: NEED, revision: 3, clientRequestId: 'zatvori_1' });
    expect(Object.isFrozen(first)).toBe(true);
    expect(retainRemainingSearchCloseAttempt(first, NEED, 3, mint)).toBe(first);
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it('mints a new command only when the Need or its revision differs', () => {
    const mint = jest.fn().mockReturnValueOnce('zatvori_1').mockReturnValueOnce('zatvori_2').mockReturnValueOnce('zatvori_3');
    const first = retainRemainingSearchCloseAttempt(null, NEED, 3, mint);
    expect(retainRemainingSearchCloseAttempt(first, NEED, 4, mint).clientRequestId).toBe('zatvori_2');
    expect(retainRemainingSearchCloseAttempt(first, OTHER, 3, mint).clientRequestId).toBe('zatvori_3');
    expect(mint).toHaveBeenCalledTimes(3);
  });
});

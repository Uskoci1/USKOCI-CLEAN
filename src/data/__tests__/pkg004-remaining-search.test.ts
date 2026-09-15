jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  const maybeSingle = jest.fn();
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  return {
    supabaseKlijent: () => ({ rpc: mockRpc, from }),
    __testMocks: { mockRpc, maybeSingle, eq, select, from },
  };
});

import { ru4Production } from '../ru4Production';

const { mockRpc, maybeSingle } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock; maybeSingle: jest.Mock };
}).__testMocks;

const NEED = '10000000-0000-4000-8000-000000000001';
const OTHER = '20000000-0000-4000-8000-000000000002';
const CLOSED_AT = '2026-09-15T12:00:00.123456Z';
const validReceipt = () => ({
  needId: NEED,
  revision: 3,
  status: 'SELECTION',
  requiredSlots: 3,
  selectedSlots: 2,
  closedRemainingSlots: 1,
  affectedResponses: 2,
  remainingSearchClosed: true,
  closedAt: CLOSED_AT,
  idempotentReplay: false,
  authoritative: true,
});

describe('PKG-004 strict remaining-search boundary', () => {
  beforeEach(() => { jest.clearAllMocks(); mockRpc.mockReset(); maybeSingle.mockReset(); });

  it('accepts only the authoritative initial close receipt for the exact Need/revision', async () => {
    mockRpc.mockResolvedValue({ data: validReceipt(), error: null });
    await expect(ru4Production.closeRemainingSearch(NEED, 3, 'pkg004-close-12345678')).resolves.toEqual({
      ok: true,
      podatak: {
        needId: NEED,
        revision: 3,
        requiredSlots: 3,
        closedRemainingSlots: 1,
        remainingSearchClosed: true,
        closedAt: CLOSED_AT,
        idempotentReplay: false,
        authoritative: true,
      },
    });
    expect(mockRpc).toHaveBeenCalledWith('rpc_close_remaining_search', {
      p_need_id: NEED,
      p_expected_revision: 3,
      p_client_request_id: 'pkg004-close-12345678',
      p_reason: '',
    });
  });

  it('accepts the server already-closed replay shape without inventing a closed slot count', async () => {
    const replay = validReceipt();
    delete (replay as Partial<typeof replay>).closedRemainingSlots;
    replay.idempotentReplay = true;
    mockRpc.mockResolvedValue({ data: replay, error: null });
    await expect(ru4Production.closeRemainingSearch(NEED, 3, 'pkg004-close-replay')).resolves.toMatchObject({
      ok: true,
      podatak: { needId: NEED, revision: 3, remainingSearchClosed: true, closedRemainingSlots: null,
        idempotentReplay: true, authoritative: true },
    });
  });

  it.each([
    ['empty', null],
    ['foreign need', { ...validReceipt(), needId: OTHER }],
    ['wrong revision', { ...validReceipt(), revision: 4 }],
    ['missing authority', { ...validReceipt(), authoritative: undefined }],
    ['false authority', { ...validReceipt(), authoritative: false }],
    ['not closed', { ...validReceipt(), remainingSearchClosed: false }],
    ['invalid closed time', { ...validReceipt(), closedAt: 'yesterday' }],
    ['zero required slots', { ...validReceipt(), requiredSlots: 0 }],
    ['zero closed slots on first result', { ...validReceipt(), closedRemainingSlots: 0 }],
    ['missing closed slots on first result', (() => { const value = validReceipt(); delete (value as Partial<typeof value>).closedRemainingSlots; return value; })()],
    ['non boolean replay', { ...validReceipt(), idempotentReplay: 'false' }],
  ])('rejects malformed successful payload: %s', async (_label, data) => {
    mockRpc.mockResolvedValue({ data, error: null });
    await expect(ru4Production.closeRemainingSearch(NEED, 3, 'pkg004-close-invalid')).resolves.toMatchObject({
      ok: false,
      kod: 'REMAINING_SEARCH_CLOSE_INVALID_RESPONSE',
    });
  });

  it('treats only explicit null as open and a valid instant as closed', async () => {
    maybeSingle.mockResolvedValueOnce({ data: { remaining_search_closed_at: null }, error: null });
    await expect(ru4Production.remainingSearchState(NEED)).resolves.toEqual({ closed: false, closedAt: null });
    maybeSingle.mockResolvedValueOnce({ data: { remaining_search_closed_at: CLOSED_AT }, error: null });
    await expect(ru4Production.remainingSearchState(NEED)).resolves.toEqual({ closed: true, closedAt: CLOSED_AT });
  });

  it.each([
    ['missing row', null],
    ['missing field', {}],
    ['undefined field', { remaining_search_closed_at: undefined }],
    ['empty field', { remaining_search_closed_at: '' }],
    ['invalid field', { remaining_search_closed_at: 'invalid' }],
    ['number field', { remaining_search_closed_at: 1 }],
  ])('fails closed on unproven remaining-search readback: %s', async (_label, data) => {
    maybeSingle.mockResolvedValue({ data, error: null });
    await expect(ru4Production.remainingSearchState(NEED)).rejects.toThrow(/REMAINING_SEARCH_STATE_/);
  });

  it('fails closed on a readback transport error', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: '08006', message: 'offline internals' } });
    await expect(ru4Production.remainingSearchState(NEED)).rejects.toThrow('REMAINING_SEARCH_STATE_READ_FAILED');
  });
});

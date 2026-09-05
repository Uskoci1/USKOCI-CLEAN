/**
 * CDL-A04 — response-viewed command, pre-deletion equivalence proof.
 *
 * The existing active productionAuthorityOverrides implementation and the new
 * responseClientService are executed against the same mocked Supabase RPC.
 * Deletion is allowed only after this test and the full PRE-P4 gate are green.
 */

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();

  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

import { productionAuthorityOverrides } from '../productionAuthorityOverrides';
import { responseClientService } from '../responseClientService';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

async function capture(run: () => Promise<unknown>, rpcResult: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(rpcResult);

  const value = await run();
  return {
    value,
    calls: mockRpc.mock.calls.map((args) => [...args]),
  };
}

describe('CDL-A04 — response viewed equivalence before deletion', () => {
  it('preserves exact RPC name, params and success result', async () => {
    const oldOwner = await capture(
      () => productionAuthorityOverrides.oznaciPrijavuVidjenom!('response-1'),
      { data: null, error: null },
    );
    const newOwner = await capture(
      () => responseClientService.oznaciPrijavuVidjenom('response-1'),
      { data: null, error: null },
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.calls).toEqual([
      ['rpc_mark_response_viewed', { p_response_id: 'response-1' }],
    ]);
    expect(newOwner.value).toEqual({ ok: true, podatak: null });
  });

  it.each([
    [
      { data: null, error: { message: 'RESPONSE_FORBIDDEN', code: '42501' } },
      { ok: false, kod: 'RESPONSE_FORBIDDEN', poruka: 'RESPONSE_FORBIDDEN' },
    ],
    [
      { data: null, error: { code: '42501' } },
      {
        ok: false,
        kod: '42501',
        poruka: 'Prijava nije mogla da se označi kao pregledana.',
      },
    ],
    [
      { data: null, error: {} },
      {
        ok: false,
        kod: 'RESPONSE_VIEW_FAILED',
        poruka: 'Prijava nije mogla da se označi kao pregledana.',
      },
    ],
  ])('preserves active error mapping %#', async (rpcResult, expected) => {
    const oldOwner = await capture(
      () => productionAuthorityOverrides.oznaciPrijavuVidjenom!('response-2'),
      rpcResult,
    );
    const newOwner = await capture(
      () => responseClientService.oznaciPrijavuVidjenom('response-2'),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.calls).toEqual([
      ['rpc_mark_response_viewed', { p_response_id: 'response-2' }],
    ]);
    expect(newOwner.value).toEqual(expected);
  });
});

/**
 * CDL-A07 — Agreement completion mark, pre-deletion equivalence proof.
 *
 * Current active productionAuthorityOverrides and the canonical
 * agreementClientService are executed against the same mocked Supabase RPC.
 * No legacy owner may be deleted until this and the full PRE-P4 gate are green.
 */

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

import { agreementClientService } from '../agreementClientService';
import { productionAuthorityOverrides } from '../productionAuthorityOverrides';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

async function capture(run: () => Promise<unknown>, rpcResult: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(rpcResult);
  const value = await run();
  return { value, calls: mockRpc.mock.calls.map((args) => [...args]) };
}

describe('CDL-A07 — completion mark equivalence before deletion', () => {
  it('preserves exact rpc_mark_work_done params and server deadline result', async () => {
    const deadline = '2026-09-07T10:00:00.000Z';
    const rpcResult = { data: deadline, error: null };

    const oldOwner = await capture(
      () => productionAuthorityOverrides.oznaciZavrsetak!('agr-1'),
      rpcResult,
    );
    const newOwner = await capture(
      () => agreementClientService.oznaciZavrsetak('agr-1'),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.calls).toEqual([
      ['rpc_mark_work_done', { p_agreement_id: 'agr-1' }],
    ]);
    expect(newOwner.value).toEqual({
      ok: true,
      podatak: { rokPotvrdeIso: deadline },
    });
  });

  it.each([
    ['message wins', { message: 'NOT_WORKER', code: '42501' }, { ok: false, kod: 'NOT_WORKER', poruka: 'NOT_WORKER' }],
    ['code fallback', { code: '42501' }, { ok: false, kod: '42501', poruka: 'Završetak nije mogao da se označi.' }],
    ['full fallback', {}, { ok: false, kod: 'COMPLETION_FAILED', poruka: 'Završetak nije mogao da se označi.' }],
  ])('preserves active error mapping: %s', async (_label, error, expected) => {
    const oldOwner = await capture(
      () => productionAuthorityOverrides.oznaciZavrsetak!('agr-error'),
      { data: null, error },
    );
    const newOwner = await capture(
      () => agreementClientService.oznaciZavrsetak('agr-error'),
      { data: null, error },
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.value).toEqual(expected);
  });

  it('preserves fail-closed behavior when RPC returns no deadline and no error', async () => {
    const rpcResult = { data: null, error: null };
    const oldOwner = await capture(
      () => productionAuthorityOverrides.oznaciZavrsetak!('agr-no-data'),
      rpcResult,
    );
    const newOwner = await capture(
      () => agreementClientService.oznaciZavrsetak('agr-no-data'),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.value).toEqual({
      ok: false,
      kod: 'COMPLETION_FAILED',
      poruka: 'Završetak nije mogao da se označi.',
    });
  });
});

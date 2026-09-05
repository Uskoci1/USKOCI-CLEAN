/**
 * CDL-A08 — exact-location reveal, pre-deletion equivalence proof.
 *
 * Current active productionAuthorityOverrides and the canonical
 * contactClientService are executed against the same mocked Supabase RPC.
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

import { contactClientService } from '../contactClientService';
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

describe('CDL-A08 — exact-location equivalence before deletion', () => {
  it('preserves exact rpc_reveal_contact params and authoritative address', async () => {
    const rpcResult = { data: { exactAddress: 'Bulevar oslobođenja 1' }, error: null };

    const oldOwner = await capture(
      () => productionAuthorityOverrides.otkrijTacnuLokaciju!('agr-1'),
      rpcResult,
    );
    const newOwner = await capture(
      () => contactClientService.otkrijTacnuLokaciju('agr-1'),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.calls).toEqual([
      ['rpc_reveal_contact', {
        p_agreement_id: 'agr-1',
        p_channel: 'EXACT_LOCATION',
      }],
    ]);
    expect(newOwner.value).toEqual({
      ok: true,
      podatak: { adresa: 'Bulevar oslobođenja 1' },
    });
  });

  it.each([
    ['message wins', { message: 'NO_ACTIVE_GRANT', code: '42501' }, { ok: false, kod: 'NO_ACTIVE_GRANT', poruka: 'NO_ACTIVE_GRANT' }],
    ['code fallback', { code: '42501' }, { ok: false, kod: '42501', poruka: 'Tačna lokacija nije dostupna.' }],
    ['full fallback', {}, { ok: false, kod: 'LOCATION_REVEAL_FAILED', poruka: 'Tačna lokacija nije dostupna.' }],
  ])('preserves active error mapping: %s', async (_label, error, expected) => {
    const oldOwner = await capture(
      () => productionAuthorityOverrides.otkrijTacnuLokaciju!('agr-error'),
      { data: null, error },
    );
    const newOwner = await capture(
      () => contactClientService.otkrijTacnuLokaciju('agr-error'),
      { data: null, error },
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.value).toEqual(expected);
  });

  it.each([
    ['no data', null],
    ['missing address', {}],
    ['non-string address', { exactAddress: 123 }],
    ['blank address', { exactAddress: '   ' }],
  ])('preserves LOCATION_NOT_SET for %s', async (_label, data) => {
    const rpcResult = { data, error: null };
    const oldOwner = await capture(
      () => productionAuthorityOverrides.otkrijTacnuLokaciju!('agr-missing'),
      rpcResult,
    );
    const newOwner = await capture(
      () => contactClientService.otkrijTacnuLokaciju('agr-missing'),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.value).toEqual({
      ok: false,
      kod: 'LOCATION_NOT_SET',
      poruka: 'Tačna lokacija nije postavljena.',
    });
  });
});

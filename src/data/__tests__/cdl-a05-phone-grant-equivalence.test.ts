/**
 * CDL-A05 — PHONE grant/revoke, pre-deletion equivalence proof.
 *
 * Current active productionAuthorityOverrides and the new contactClientService
 * are executed against the same mocked Supabase RPC. Physical deletion is
 * allowed only after this test and the full PRE-P4 gate are green.
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

describe('CDL-A05 — phone grant equivalence before deletion', () => {
  it('podeliTelefon preserves exact RPC, PHONE channel, granted=true and success', async () => {
    const rpcResult = { data: null, error: null };
    const oldOwner = await capture(
      () => productionAuthorityOverrides.podeliTelefon!('agr-1'),
      rpcResult,
    );
    const newOwner = await capture(
      () => contactClientService.podeliTelefon('agr-1'),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.calls).toEqual([
      ['rpc_set_contact_grant', {
        p_agreement_id: 'agr-1',
        p_channel: 'PHONE',
        p_granted: true,
      }],
    ]);
    expect(newOwner.value).toEqual({ ok: true, podatak: null });
  });

  it('opoziviTelefon preserves exact RPC, PHONE channel, granted=false and success', async () => {
    const rpcResult = { data: null, error: null };
    const oldOwner = await capture(
      () => productionAuthorityOverrides.opoziviTelefon!('agr-2'),
      rpcResult,
    );
    const newOwner = await capture(
      () => contactClientService.opoziviTelefon('agr-2'),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.calls).toEqual([
      ['rpc_set_contact_grant', {
        p_agreement_id: 'agr-2',
        p_channel: 'PHONE',
        p_granted: false,
      }],
    ]);
    expect(newOwner.value).toEqual({ ok: true, podatak: null });
  });

  it.each([
    ['grant message', 'podeliTelefon', { message: 'GRANT_DENIED', code: '42501' }, { ok: false, kod: 'GRANT_DENIED', poruka: 'GRANT_DENIED' }],
    ['grant code', 'podeliTelefon', { code: '42501' }, { ok: false, kod: '42501', poruka: 'Broj telefona nije podeljen.' }],
    ['grant fallback', 'podeliTelefon', {}, { ok: false, kod: 'PHONE_GRANT_FAILED', poruka: 'Broj telefona nije podeljen.' }],
    ['revoke message', 'opoziviTelefon', { message: 'REVOKE_DENIED', code: '42501' }, { ok: false, kod: 'REVOKE_DENIED', poruka: 'REVOKE_DENIED' }],
    ['revoke code', 'opoziviTelefon', { code: '42501' }, { ok: false, kod: '42501', poruka: 'Deljenje telefona nije opozvano.' }],
    ['revoke fallback', 'opoziviTelefon', {}, { ok: false, kod: 'PHONE_REVOKE_FAILED', poruka: 'Deljenje telefona nije opozvano.' }],
  ])('preserves active error mapping: %s', async (_label, method, error, expected) => {
    const runOld = () => method === 'podeliTelefon'
      ? productionAuthorityOverrides.podeliTelefon!('agr-error')
      : productionAuthorityOverrides.opoziviTelefon!('agr-error');
    const runNew = () => method === 'podeliTelefon'
      ? contactClientService.podeliTelefon('agr-error')
      : contactClientService.opoziviTelefon('agr-error');

    const oldOwner = await capture(runOld, { data: null, error });
    const newOwner = await capture(runNew, { data: null, error });

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.value).toEqual(expected);
  });
});

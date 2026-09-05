/**
 * CDL-A06 — Agreement problem-report, pre-deletion equivalence proof.
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

describe('CDL-A06 — problem report equivalence before deletion', () => {
  it('trims narrative and preserves exact rpc_report_problem params/success', async () => {
    const rpcResult = { data: null, error: null };
    const oldOwner = await capture(
      () => productionAuthorityOverrides.prijaviProblem!('agr-1', '  Oštećen ormar.  '),
      rpcResult,
    );
    const newOwner = await capture(
      () => agreementClientService.prijaviProblem('agr-1', '  Oštećen ormar.  '),
      rpcResult,
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.calls).toEqual([
      ['rpc_report_problem', {
        p_agreement_id: 'agr-1',
        p_narrative: 'Oštećen ormar.',
      }],
    ]);
    expect(newOwner.value).toEqual({ ok: true, podatak: null });
  });

  it('rejects blank narrative before any RPC', async () => {
    const oldOwner = await capture(
      () => productionAuthorityOverrides.prijaviProblem!('agr-blank', '   '),
      { data: null, error: null },
    );
    const newOwner = await capture(
      () => agreementClientService.prijaviProblem('agr-blank', '   '),
      { data: null, error: null },
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.calls).toEqual([]);
    expect(newOwner.value).toEqual({
      ok: false,
      kod: 'NARRATIVE_REQUIRED',
      poruka: 'Opišite problem.',
    });
  });

  it.each([
    ['message wins', { message: 'PROBLEM_DENIED', code: '42501' }, { ok: false, kod: 'PROBLEM_DENIED', poruka: 'PROBLEM_DENIED' }],
    ['code fallback', { code: '42501' }, { ok: false, kod: '42501', poruka: 'Problem nije mogao da se sačuva.' }],
    ['full fallback', {}, { ok: false, kod: 'PROBLEM_REPORT_FAILED', poruka: 'Problem nije mogao da se sačuva.' }],
  ])('preserves active error mapping: %s', async (_label, error, expected) => {
    const oldOwner = await capture(
      () => productionAuthorityOverrides.prijaviProblem!('agr-error', 'Problem'),
      { data: null, error },
    );
    const newOwner = await capture(
      () => agreementClientService.prijaviProblem('agr-error', 'Problem'),
      { data: null, error },
    );

    expect(newOwner).toEqual(oldOwner);
    expect(newOwner.value).toEqual(expected);
  });
});

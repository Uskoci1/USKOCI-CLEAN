/**
 * CDL-A06 — canonical Agreement problem-report contract.
 *
 * Pre-deletion old-vs-new equivalence was proven by PRE-P4 run 33959818756.
 * After deletion these tests lock the canonical RPC/validation/error contract
 * and prove prijaviProblem has one physical production owner.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

import { agreementClientService } from '../agreementClientService';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

describe('CDL-A06 — canonical problem-report contract', () => {
  it('physically eliminates both lower-precedence problem-report owners', () => {
    const dataDir = join(__dirname, '..');
    const authoritySource = readFileSync(join(dataDir, 'productionAuthorityOverrides.ts'), 'utf8');
    const baselineSource = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');
    const canonicalSource = readFileSync(join(dataDir, 'agreementClientService.ts'), 'utf8');

    expect(authoritySource).not.toContain('prijaviProblem');
    expect(baselineSource).not.toContain('async prijaviProblem(');
    expect(baselineSource).not.toContain('p_description');
    expect(baselineSource).toContain("'prijaviProblem'");
    expect(canonicalSource).toContain('async prijaviProblem(');
    expect(canonicalSource).toContain("p_narrative: narrative");
  });

  it('trims narrative and preserves exact rpc_report_problem params/success', async () => {
    resetRpc({ data: null, error: null });

    const result = await agreementClientService.prijaviProblem('agr-1', '  Oštećen ormar.  ');

    expect(mockRpc.mock.calls).toEqual([
      ['rpc_report_problem', {
        p_agreement_id: 'agr-1',
        p_narrative: 'Oštećen ormar.',
      }],
    ]);
    expect(result).toEqual({ ok: true, podatak: null });
  });

  it('rejects blank narrative before any RPC', async () => {
    resetRpc({ data: null, error: null });

    const result = await agreementClientService.prijaviProblem('agr-blank', '   ');

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result).toEqual({
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
    resetRpc({ data: null, error });

    const result = await agreementClientService.prijaviProblem('agr-error', 'Problem');

    expect(result).toEqual(expected);
  });
});

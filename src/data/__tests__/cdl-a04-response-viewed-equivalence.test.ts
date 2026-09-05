/**
 * CDL-A04 — canonical response-viewed command contract.
 *
 * Pre-deletion old-vs-new equivalence was proven by PRE-P4 run 33956936388.
 * After deletion, these tests lock the canonical RPC/error contract and prove
 * the migrated command has one physical production owner.
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

import { responseClientService } from '../responseClientService';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

describe('CDL-A04 — canonical response viewed contract', () => {
  it('physically eliminates the transitional response-viewed owners', () => {
    const dataDir = join(__dirname, '..');
    const indexSource = readFileSync(join(dataDir, 'index.ts'), 'utf8');
    const authoritySource = readFileSync(join(dataDir, 'productionAuthorityOverrides.ts'), 'utf8');
    const baselineSource = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');

    expect(indexSource).toContain("import { responseClientService } from './responseClientService'");
    expect(indexSource).toContain('...responseClientService');
    expect(authoritySource).not.toContain('oznaciPrijavuVidjenom');
    expect(baselineSource).not.toContain('async oznaciPrijavuVidjenom(');
    expect(baselineSource).toContain("'oznaciPrijavuVidjenom'");
  });

  it('preserves exact RPC name, params and success result', async () => {
    resetRpc({ data: null, error: null });

    const result = await responseClientService.oznaciPrijavuVidjenom('response-1');

    expect(mockRpc.mock.calls).toEqual([
      ['rpc_mark_response_viewed', { p_response_id: 'response-1' }],
    ]);
    expect(result).toEqual({ ok: true, podatak: null });
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
    resetRpc(rpcResult);

    const result = await responseClientService.oznaciPrijavuVidjenom('response-2');

    expect(mockRpc.mock.calls).toEqual([
      ['rpc_mark_response_viewed', { p_response_id: 'response-2' }],
    ]);
    expect(result).toEqual(expected);
  });
});

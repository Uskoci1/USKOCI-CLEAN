/**
 * CDL-A08 — canonical exact-location reveal contract.
 *
 * Pre-deletion old-vs-new equivalence was proven by PRE-P4 run 33961961032.
 * After deletion these tests lock the canonical RPC/result/error contract and
 * prove otkrijTacnuLokaciju has one physical production owner.
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

import { contactClientService } from '../contactClientService';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

describe('CDL-A08 — canonical exact-location reveal contract', () => {
  it('physically eliminates both lower-precedence exact-location owners', () => {
    const dataDir = join(__dirname, '..');
    const authoritySource = readFileSync(join(dataDir, 'productionAuthorityOverrides.ts'), 'utf8');
    const baselineSource = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');
    const canonicalSource = readFileSync(join(dataDir, 'contactClientService.ts'), 'utf8');

    expect(authoritySource).not.toContain('otkrijTacnuLokaciju');
    expect(baselineSource).not.toContain('async otkrijTacnuLokaciju(');
    expect(baselineSource).not.toContain('rpc_r24_reveal_exact_location');
    expect(baselineSource).not.toContain('Preuzeto sa servera');
    expect(baselineSource).toContain("'otkrijTacnuLokaciju'");
    expect(canonicalSource).toContain('async otkrijTacnuLokaciju(');
    expect(canonicalSource).toContain("supabase.rpc('rpc_reveal_contact'");
    expect(canonicalSource).toContain("p_channel: 'EXACT_LOCATION'");
  });

  it('preserves exact rpc_reveal_contact params and authoritative address', async () => {
    resetRpc({ data: { exactAddress: 'Bulevar oslobođenja 1' }, error: null });

    const result = await contactClientService.otkrijTacnuLokaciju('agr-1');

    expect(mockRpc.mock.calls).toEqual([
      ['rpc_reveal_contact', {
        p_agreement_id: 'agr-1',
        p_channel: 'EXACT_LOCATION',
      }],
    ]);
    expect(result).toEqual({
      ok: true,
      podatak: { adresa: 'Bulevar oslobođenja 1' },
    });
  });

  it.each([
    ['message wins', { message: 'NO_ACTIVE_GRANT', code: '42501' }, { ok: false, kod: 'NO_ACTIVE_GRANT', poruka: 'NO_ACTIVE_GRANT' }],
    ['code fallback', { code: '42501' }, { ok: false, kod: '42501', poruka: 'Tačna lokacija nije dostupna.' }],
    ['full fallback', {}, { ok: false, kod: 'LOCATION_REVEAL_FAILED', poruka: 'Tačna lokacija nije dostupna.' }],
  ])('preserves active error mapping: %s', async (_label, error, expected) => {
    resetRpc({ data: null, error });

    const result = await contactClientService.otkrijTacnuLokaciju('agr-error');

    expect(result).toEqual(expected);
  });

  it.each([
    ['no data', null],
    ['missing address', {}],
    ['non-string address', { exactAddress: 123 }],
    ['blank address', { exactAddress: '   ' }],
  ])('preserves LOCATION_NOT_SET for %s', async (_label, data) => {
    resetRpc({ data, error: null });

    const result = await contactClientService.otkrijTacnuLokaciju('agr-missing');

    expect(result).toEqual({
      ok: false,
      kod: 'LOCATION_NOT_SET',
      poruka: 'Tačna lokacija nije postavljena.',
    });
  });
});

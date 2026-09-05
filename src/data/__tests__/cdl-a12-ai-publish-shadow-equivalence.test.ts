/**
 * CDL-A12 — legacy AI publish shadow elimination, pre-deletion proof.
 *
 * This locks the active fail-closed productionAuthorityOverrides owner and
 * proves the lower-precedence supabaseIzvor implementation still calls the
 * same RPC with a stale/incomplete parameter contract. The cleanup may remove
 * only that lower shadow and make the surviving owner structurally required.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('../supabaseClient', () => {
  const mockGetUser = jest.fn();
  const mockMaybeSingle = jest.fn();
  const mockEqKind = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
  const mockEqAccount = jest.fn(() => ({ eq: mockEqKind }));
  const mockSelect = jest.fn(() => ({ eq: mockEqAccount }));
  const mockFrom = jest.fn(() => ({ select: mockSelect }));
  const mockRpc = jest.fn();
  return {
    supabaseKlijent: () => ({
      auth: { getUser: mockGetUser },
      from: mockFrom,
      rpc: mockRpc,
    }),
    __testMocks: {
      mockGetUser,
      mockMaybeSingle,
      mockRpc,
    },
  };
});

import { productionAuthorityOverrides } from '../productionAuthorityOverrides';

const { mockGetUser, mockMaybeSingle, mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: {
    mockGetUser: jest.Mock;
    mockMaybeSingle: jest.Mock;
    mockRpc: jest.Mock;
  };
}).__testMocks;

describe('CDL-A12 — active legacy AI publish owner before shadow deletion', () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockMaybeSingle.mockReset();
    mockRpc.mockReset();
  });

  it('proves spread precedence and the stale lower publish shadow targeted by this slice', () => {
    const dataDir = join(__dirname, '..');
    const indexSource = readFileSync(join(dataDir, 'index.ts'), 'utf8');
    const baselineSource = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');
    const winnerSource = readFileSync(join(dataDir, 'productionAuthorityOverrides.ts'), 'utf8');

    expect(indexSource.indexOf('...productionAuthorityOverrides')).toBeGreaterThan(indexSource.indexOf('...supabaseIzvor'));

    expect(baselineSource).toContain('async objaviPotrebu(razgovorId: string)');
    expect(baselineSource).toContain("supabase.rpc('rpc_ai_publish_need', { p_conversation_id: razgovorId })");

    expect(winnerSource).toContain('async objaviPotrebu(razgovorId)');
    expect(winnerSource).toContain(".eq('kind', 'REQUESTER')");
    expect(winnerSource).toContain("supabase.rpc('rpc_ai_publish_need'");
    expect(winnerSource).toContain('p_profile_id: requesterProfile.id');
  });

  it('preserves auth + requester profile resolution and exact fail-closed RPC contract', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'acct-1' } }, error: null });
    mockMaybeSingle.mockResolvedValue({ data: { id: 'profile-1' }, error: null });
    mockRpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'PACKAGE_4_NOT_READY' } });

    const result = await productionAuthorityOverrides.objaviPotrebu!('conv-1');

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('rpc_ai_publish_need', {
      p_conversation_id: 'conv-1',
      p_profile_id: 'profile-1',
    });
    expect(result).toEqual({
      ok: false,
      kod: 'PACKAGE_4_NOT_READY',
      poruka: 'PACKAGE_4_NOT_READY',
    });
  });

  it('preserves fail-closed auth/profile boundaries before the RPC', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const unauth = await productionAuthorityOverrides.objaviPotrebu!('conv-1');
    expect(unauth).toEqual({ ok: false, kod: 'AUTH_REQUIRED', poruka: 'Prijavite se pre objave Potrebe.' });
    expect(mockRpc).not.toHaveBeenCalled();

    mockGetUser.mockResolvedValue({ data: { user: { id: 'acct-1' } }, error: null });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const noProfile = await productionAuthorityOverrides.objaviPotrebu!('conv-1');
    expect(noProfile).toEqual({
      ok: false,
      kod: 'REQUESTER_PROFILE_REQUIRED',
      poruka: 'Potreban je profil Naručioca pre objave.',
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });
});

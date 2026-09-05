/**
 * CDL-A11 — canonical AI conversation open/read contract after shadow deletion.
 *
 * Pre-deletion proof run 33966439120 was green while the stale NEW_NEED open
 * path and null conversation-read shadow still existed. The active
 * aiProductionOverrides runtime behavior remains unchanged.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return {
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

import { aiProductionOverrides } from '../aiProductionOverrides';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

describe('CDL-A11 — canonical AI conversation owner after shadow deletion', () => {
  beforeEach(() => mockRpc.mockReset());

  it('physically eliminates both lower production owners and preserves the winner', () => {
    const dataDir = join(__dirname, '..');
    const indexSource = readFileSync(join(dataDir, 'index.ts'), 'utf8');
    const baselineSource = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');
    const winnerSource = readFileSync(join(dataDir, 'aiProductionOverrides.ts'), 'utf8');

    expect(indexSource.indexOf('...aiProductionOverrides')).toBeGreaterThan(indexSource.indexOf('...supabaseIzvor'));

    expect(baselineSource).not.toContain('async otvoriRazgovor()');
    expect(baselineSource).not.toContain("p_purpose: 'NEW_NEED'");
    expect(baselineSource).not.toContain('async razgovor(razgovorId: string) { return null; }');
    expect(baselineSource).toContain("'otvoriRazgovor'");
    expect(baselineSource).toContain("'razgovor'");

    expect(winnerSource).toContain("type AiOverrides = Pick<Izvor, 'otvoriRazgovor' | 'razgovor'>;");
    expect(winnerSource).toContain('async otvoriRazgovor()');
    expect(winnerSource).toContain("p_purpose: 'NEED_INTAKE'");
    expect(winnerSource).toContain('async razgovor(razgovorId)');
    expect(winnerSource).toContain(".from('ai_conversations')");
    expect(winnerSource).toContain(".from('ai_structured_facts')");
    expect(winnerSource).toContain(".from('ai_messages')");
    expect(winnerSource).toContain('spremnoZaObjavu: false');
  });

  it('preserves the exact NEED_INTAKE open-conversation RPC contract', async () => {
    mockRpc.mockResolvedValue({ data: 'conv-1', error: null });

    const result = await aiProductionOverrides.otvoriRazgovor();

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('rpc_ai_open_conversation', {
      p_purpose: 'NEED_INTAKE',
    });
    expect(result).toEqual({ ok: true, podatak: { razgovorId: 'conv-1' } });
  });

  it('preserves fail-closed open-conversation error mapping', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'P0001', message: 'BAD_PURPOSE' } });

    const result = await aiProductionOverrides.otvoriRazgovor();

    expect(result).toEqual({ ok: false, kod: 'BAD_PURPOSE', poruka: 'BAD_PURPOSE' });
  });
});

/**
 * CDL-A10 — AI command shadow elimination, pre-deletion proof.
 *
 * This test locks the currently active aiCommandOverrides behavior and proves
 * that two lower-precedence production shadows still physically exist before
 * deletion. The cleanup may remove only those shadows; the active owner and
 * its Edge/RPC request, validation and error semantics must remain unchanged.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

jest.mock('../supabaseClient', () => {
  const mockInvoke = jest.fn();
  const mockRpc = jest.fn();
  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({
      functions: { invoke: mockInvoke },
      rpc: mockRpc,
    }),
    __testMocks: { mockInvoke, mockRpc },
  };
});

import { aiCommandOverrides } from '../aiCommandOverrides';

const { mockInvoke, mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: {
    mockInvoke: jest.Mock;
    mockRpc: jest.Mock;
  };
}).__testMocks;

function reset() {
  mockInvoke.mockReset();
  mockRpc.mockReset();
}

describe('CDL-A10 — active AI command owner before shadow deletion', () => {
  beforeEach(reset);

  it('proves spread precedence and the two lower production shadows that are being targeted', () => {
    const dataDir = join(__dirname, '..');
    const indexSource = readFileSync(join(dataDir, 'index.ts'), 'utf8');
    const baselineSource = readFileSync(join(dataDir, 'supabaseIzvor.ts'), 'utf8');
    const authoritySource = readFileSync(join(dataDir, 'productionAuthorityOverrides.ts'), 'utf8');
    const winnerSource = readFileSync(join(dataDir, 'aiCommandOverrides.ts'), 'utf8');

    expect(indexSource.indexOf('...aiCommandOverrides')).toBeGreaterThan(indexSource.indexOf('...supabaseIzvor'));
    expect(indexSource.indexOf('...aiCommandOverrides')).toBeGreaterThan(indexSource.indexOf('...productionAuthorityOverrides'));

    expect(baselineSource).toContain('async posaljiKorisnikovuPoruku(');
    expect(baselineSource).toContain('async ispraviCinjenicu(');
    expect(baselineSource).toContain('predlozeno: 0');
    expect(baselineSource).toContain("novaCinjenicaId: ''");

    expect(authoritySource).toContain('async posaljiKorisnikovuPoruku()');
    expect(authoritySource).toContain('async ispraviCinjenicu()');
    expect(authoritySource).toContain('AI_PROVIDER_NOT_CONFIGURED');
    expect(authoritySource).toContain('AI_FACT_REVISION_NOT_READY');

    expect(winnerSource).toContain('async posaljiKorisnikovuPoruku(razgovorId, telo)');
    expect(winnerSource).toContain("supabase.functions.invoke('uskoci-ai-interview'");
    expect(winnerSource).toContain('async ispraviCinjenicu(cinjenicaId, novaVrednost)');
    expect(winnerSource).toContain("supabase.rpc('rpc_ai_correct_fact'");
  });

  it('preserves message trim and exact Edge invocation', async () => {
    mockInvoke.mockResolvedValue({ data: { predlozeno: 2.9 }, error: null });

    const result = await aiCommandOverrides.posaljiKorisnikovuPoruku!('conv-1', '  Treba mi prevoz  ');

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('uskoci-ai-interview', {
      body: { conversationId: 'conv-1', text: 'Treba mi prevoz' },
    });
    expect(result).toEqual({ ok: true, podatak: { predlozeno: 2 } });
  });

  it('preserves fail-fast message validation before Edge', async () => {
    const blank = await aiCommandOverrides.posaljiKorisnikovuPoruku!('conv-1', '   ');
    expect(blank).toEqual({ ok: false, kod: 'MESSAGE_REQUIRED', poruka: 'Unesite poruku.' });
    expect(mockInvoke).not.toHaveBeenCalled();

    const tooLong = await aiCommandOverrides.posaljiKorisnikovuPoruku!('conv-1', 'x'.repeat(4001));
    expect(tooLong).toEqual({
      ok: false,
      kod: 'MESSAGE_TOO_LONG',
      poruka: 'Poruka može imati najviše 4000 znakova.',
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('preserves invalid Edge response as failure rather than fake success', async () => {
    mockInvoke.mockResolvedValue({ data: { predlozeno: '2' }, error: null });

    const result = await aiCommandOverrides.posaljiKorisnikovuPoruku!('conv-1', 'Poruka');

    expect(result).toEqual({
      ok: false,
      kod: 'AI_EDGE_INVALID_RESPONSE',
      poruka: 'AI server nije vratio ispravan rezultat.',
    });
  });

  it('preserves fact correction trim and exact RPC contract', async () => {
    mockRpc.mockResolvedValue({ data: 'fact-new-1', error: null });

    const result = await aiCommandOverrides.ispraviCinjenicu!('fact-old-1', '  Novi Sad  ');

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('rpc_ai_correct_fact', {
      p_fact_id: 'fact-old-1',
      p_value: 'Novi Sad',
    });
    expect(result).toEqual({ ok: true, podatak: { novaCinjenicaId: 'fact-new-1' } });
  });

  it('preserves fact correction validation and server failure mapping', async () => {
    const blank = await aiCommandOverrides.ispraviCinjenicu!('fact-1', '   ');
    expect(blank).toEqual({ ok: false, kod: 'FACT_VALUE_REQUIRED', poruka: 'Unesite vrednost.' });
    expect(mockRpc).not.toHaveBeenCalled();

    mockRpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'NOT_OWNER' } });
    const denied = await aiCommandOverrides.ispraviCinjenicu!('fact-1', 'Nova vrednost');
    expect(denied).toEqual({ ok: false, kod: '42501', poruka: 'NOT_OWNER' });
  });
});

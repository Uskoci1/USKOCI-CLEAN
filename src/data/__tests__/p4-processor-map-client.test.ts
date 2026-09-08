/**
 * P4 — processor map client contract. Readiness is server truth; a partial
 * or malformed map never reads as ready and no provider is invented.
 */

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

import { processorMapClientService } from '../processorMapClientService';

const { mockRpc } = (jest.requireMock('../supabaseClient') as { __testMocks: { mockRpc: jest.Mock } }).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

const provider = (providerCode: string, extra: Record<string, unknown> = {}) => ({
  providerCode, providerDisplayName: providerCode, legalEntityName: 'Entity', legalRole: 'PROCESSOR', purpose: 'purpose text',
  dataCategories: ['ACCOUNT'], processingRegions: 'EU', crossBorderTransfer: false, transferMechanism: 'n/a', dpaReference: 'ref',
  privacyNoticeUrl: 'https://example.invalid/privacy', retentionDeletionTerms: 'terms', subprocessorTerms: 'terms', legalBasisReference: 'basis', ...extra,
});

describe('P4 — readStatus', () => {
  it('reports an unpublished map as not ready with the server reason', async () => {
    resetRpc({ data: { ready: false, reason: 'PROCESSOR_MAP_NOT_PUBLISHED', technicalProviderCount: 4, requiredCurrentProviders: 3, runtimeProviderGateAdmitted: false }, error: null });
    const result = await processorMapClientService.readStatus();
    expect(mockRpc.mock.calls).toEqual([['rpc_get_processor_map_status']]);
    expect(result).toEqual({ ok: true, podatak: { ready: false, reason: 'PROCESSOR_MAP_NOT_PUBLISHED', missingProviders: [] } });
  });

  it('surfaces incomplete coverage with the missing providers', async () => {
    resetRpc({ data: { ready: false, reason: 'PROCESSOR_MAP_INCOMPLETE', missingProviders: ['EXPO_PUSH'] }, error: null });
    expect(await processorMapClientService.readStatus()).toEqual({ ok: true, podatak: { ready: false, reason: 'PROCESSOR_MAP_INCOMPLETE', missingProviders: ['EXPO_PUSH'] } });
  });

  it('maps a ready map and drops nothing the server published', async () => {
    resetRpc({ data: { ready: true, reason: null, mapVersion: 'v1', effectiveAt: '2026-09-08T00:00:00+00:00', providers: [provider('SUPABASE_PLATFORM'), provider('OPENAI_AI', { legalRole: 'SUBPROCESSOR' })] }, error: null });
    const result = await processorMapClientService.readStatus();
    expect(result.ok).toBe(true);
    if (!result.ok || !result.podatak.ready) return;
    expect(result.podatak.mapVersion).toBe('v1');
    expect(result.podatak.providers.map((p) => [p.providerCode, p.legalRole])).toEqual([['SUPABASE_PLATFORM', 'PROCESSOR'], ['OPENAI_AI', 'SUBPROCESSOR']]);
  });

  it('fails closed on a ready map with no valid provider or a non-https notice url', async () => {
    resetRpc({ data: { ready: true, mapVersion: 'v1', providers: [] }, error: null });
    expect(await processorMapClientService.readStatus()).toMatchObject({ ok: false, kod: 'PROCESSOR_MAP_INVALID_RESPONSE' });
    resetRpc({ data: { ready: true, mapVersion: 'v1', providers: [provider('X', { privacyNoticeUrl: 'http://insecure' })] }, error: null });
    expect(await processorMapClientService.readStatus()).toMatchObject({ ok: false, kod: 'PROCESSOR_MAP_INVALID_RESPONSE' });
  });

  it('translates AUTH_REQUIRED into product language', async () => {
    resetRpc({ data: null, error: { code: '28000', message: 'AUTH_REQUIRED' } });
    const result = await processorMapClientService.readStatus();
    expect(result).toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
    if (!result.ok) expect(result.poruka).toContain('Prijavite se');
  });
});

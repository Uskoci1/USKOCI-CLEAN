const mockRpc = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));

import { processorMapClientService } from '../processorMapClientService';

const provider = (overrides: Record<string, unknown> = {}) => ({
  providerCode: 'SUPABASE_PLATFORM',
  providerDisplayName: 'Supabase',
  legalEntityName: 'Supabase Inc.',
  legalRole: 'PROCESSOR',
  purpose: 'Primary cloud platform processing for the application.',
  dataCategories: ['account', 'marketplace'],
  processingRegions: 'EU / US',
  crossBorderTransfer: true,
  transferMechanism: 'SCC',
  dpaReference: 'DPA-1',
  privacyNoticeUrl: 'https://example.test/privacy',
  retentionDeletionTerms: 'Per published policy.',
  subprocessorTerms: 'Published subprocessors.',
  legalBasisReference: 'Contract / legitimate interest.',
  ...overrides,
});

const ready = (providers: unknown[], overrides: Record<string, unknown> = {}) => ({
  ready: true,
  reason: null,
  mapVersion: 'v1',
  effectiveAt: '2026-09-15T00:00:00Z',
  counselReference: 'reviewed-reference',
  technicalProviderCount: providers.length,
  requiredCurrentProviders: providers.length,
  coveredCurrentProviders: providers.length,
  providers,
  runtimeProviderGateAdmitted: false,
  ...overrides,
});

beforeEach(() => jest.resetAllMocks());

describe('PKG-002 processor map strict decoding', () => {
  it('rejects the original partial-map failure instead of silently dropping one malformed provider', async () => {
    mockRpc.mockResolvedValue({ data: ready([
      provider(),
      provider({ providerCode: 'GOOGLE_GEMINI_AI', legalEntityName: '' }),
    ]), error: null });
    const result = await processorMapClientService.readStatus();
    expect(result).toMatchObject({ ok: false, kod: 'PROCESSOR_MAP_INVALID_RESPONSE' });
  });

  it('rejects a non-boolean crossBorderTransfer instead of coercing it to false', async () => {
    mockRpc.mockResolvedValue({ data: ready([provider({ crossBorderTransfer: 'false' })]), error: null });
    const result = await processorMapClientService.readStatus();
    expect(result).toMatchObject({ ok: false, kod: 'PROCESSOR_MAP_INVALID_RESPONSE' });
  });

  it('rejects duplicate providers and inconsistent coverage counts', async () => {
    mockRpc.mockResolvedValueOnce({ data: ready([provider(), provider()]), error: null });
    await expect(processorMapClientService.readStatus()).resolves.toMatchObject({ ok: false, kod: 'PROCESSOR_MAP_INVALID_RESPONSE' });

    mockRpc.mockResolvedValueOnce({ data: ready([provider()], { requiredCurrentProviders: 2, coveredCurrentProviders: 1, technicalProviderCount: 2 }), error: null });
    await expect(processorMapClientService.readStatus()).resolves.toMatchObject({ ok: false, kod: 'PROCESSOR_MAP_INVALID_RESPONSE' });
  });

  it.each([true, false])('keeps a complete legitimate map valid when crossBorderTransfer=%s', async flag => {
    mockRpc.mockResolvedValue({ data: ready([provider({ crossBorderTransfer: flag })]), error: null });
    const result = await processorMapClientService.readStatus();
    expect(result).toEqual({ ok: true, podatak: {
      ready: true,
      mapVersion: 'v1',
      effectiveAt: '2026-09-15T00:00:00Z',
      providers: [provider({ crossBorderTransfer: flag })],
    } });
  });

  it('preserves an explicit server NOT_READY state as not ready rather than inventing a map', async () => {
    mockRpc.mockResolvedValue({ data: { ready: false, reason: 'PROCESSOR_MAP_INCOMPLETE', missingProviders: ['GOOGLE_GEMINI_AI'] }, error: null });
    await expect(processorMapClientService.readStatus()).resolves.toEqual({ ok: true, podatak: {
      ready: false, reason: 'PROCESSOR_MAP_INCOMPLETE', missingProviders: ['GOOGLE_GEMINI_AI'],
    } });
  });
});

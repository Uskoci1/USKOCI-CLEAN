/**
 * P1 — legal bundle client contract.
 *
 * Readiness is server truth. An unpublished bundle is `ready:false` and the
 * client never fabricates documents or acceptance. Acceptance carries one
 * stable request id; a replayed receipt is reported as such.
 */

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

import { legalClientService } from '../legalClientService';

const { mockRpc } = (jest.requireMock('../supabaseClient') as {
  __testMocks: { mockRpc: jest.Mock };
}).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

const SHA = 'a'.repeat(64);
const doc = (kind: 'TERMS' | 'PRIVACY') => ({
  kind, version: 'v1', sha256: SHA, url: `https://uskoci.example/${kind.toLowerCase()}`,
  publishedAt: '2026-09-08T00:00:00+00:00', effectiveAt: '2026-09-08T00:00:00+00:00',
});

describe('P1 — readBundle', () => {
  it('reports an unpublished bundle as not ready without inventing documents', async () => {
    resetRpc({ data: { ready: false, acceptedCurrentBundle: false, documents: [], reason: 'LEGAL_DOCUMENTS_NOT_PUBLISHED' }, error: null });
    const result = await legalClientService.readBundle();
    expect(mockRpc.mock.calls).toEqual([['rpc_get_legal_bundle']]);
    expect(result).toEqual({ ok: true, podatak: { ready: false, acceptedCurrentBundle: false, reason: 'LEGAL_DOCUMENTS_NOT_PUBLISHED', documents: [] } });
  });

  it('maps a ready bundle with both documents and the per-account acceptance flag', async () => {
    resetRpc({ data: { ready: true, acceptedCurrentBundle: true, reason: null, documents: [doc('TERMS'), doc('PRIVACY')] }, error: null });
    const result = await legalClientService.readBundle();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.podatak.ready).toBe(true);
    expect(result.podatak.acceptedCurrentBundle).toBe(true);
    expect(result.podatak.documents.map((d) => d.kind)).toEqual(['TERMS', 'PRIVACY']);
  });

  it('fails closed when a ready bundle lacks one document or carries a non-https url', async () => {
    resetRpc({ data: { ready: true, acceptedCurrentBundle: false, reason: null, documents: [doc('TERMS')] }, error: null });
    expect(await legalClientService.readBundle()).toMatchObject({ ok: false, kod: 'LEGAL_BUNDLE_INVALID_RESPONSE' });
    resetRpc({ data: { ready: true, acceptedCurrentBundle: false, reason: null, documents: [doc('TERMS'), { ...doc('PRIVACY'), url: 'http://insecure' }] }, error: null });
    expect(await legalClientService.readBundle()).toMatchObject({ ok: false, kod: 'LEGAL_BUNDLE_INVALID_RESPONSE' });
  });
});

describe('P1 — acceptBundle', () => {
  it('sends the stable request id and returns the exact receipt', async () => {
    resetRpc({ data: { accepted: true, idempotentReplay: false, acceptedAt: '2026-09-08T10:00:00+00:00', termsVersion: 'v1', termsSha256: SHA, privacyVersion: 'v1', privacySha256: SHA }, error: null });
    const result = await legalClientService.acceptBundle('legal-accept-abcdef0123456789');
    expect(mockRpc.mock.calls).toEqual([['rpc_accept_legal_bundle', { p_client_request_id: 'legal-accept-abcdef0123456789' }]]);
    expect(result).toMatchObject({ ok: true, podatak: { accepted: true, idempotentReplay: false, termsSha256: SHA, privacySha256: SHA } });
  });

  it('reports a replayed receipt and translates bundle drift into product language', async () => {
    resetRpc({ data: { accepted: true, idempotentReplay: true, acceptedAt: 'x', termsVersion: 'v1', termsSha256: SHA, privacyVersion: 'v1', privacySha256: SHA }, error: null });
    expect(await legalClientService.acceptBundle('legal-accept-abcdef0123456789')).toMatchObject({ ok: true, podatak: { idempotentReplay: true } });

    resetRpc({ data: null, error: { code: '22023', message: 'LEGAL_ACCEPTANCE_REQUEST_REUSED_FOR_DIFFERENT_BUNDLE' } });
    const drift = await legalClientService.acceptBundle('legal-accept-abcdef0123456789');
    expect(drift).toMatchObject({ ok: false, kod: 'LEGAL_ACCEPTANCE_REQUEST_REUSED_FOR_DIFFERENT_BUNDLE' });
    if (!drift.ok) {
      expect(drift.poruka).toContain('ažurirani');
      expect(drift.poruka).not.toContain('LEGAL_');
    }

    resetRpc({ data: null, error: { code: '55000', message: 'LEGAL_DOCUMENTS_NOT_PUBLISHED' } });
    const unpublished = await legalClientService.acceptBundle('legal-accept-abcdef0123456789');
    expect(unpublished).toMatchObject({ ok: false, kod: 'LEGAL_DOCUMENTS_NOT_PUBLISHED' });
  });
});

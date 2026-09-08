/**
 * P3 — retention schedule client contract. Readiness is server truth; a
 * partial or malformed schedule never reads as ready and no rule is invented.
 */

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

import { retentionPolicyClientService } from '../retentionPolicyClientService';

const { mockRpc } = (jest.requireMock('../supabaseClient') as { __testMocks: { mockRpc: jest.Mock } }).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

const rule = (dataClass: string, extra: Record<string, unknown> = {}) => ({
  dataClass, purpose: 'purpose text', retentionPeriod: '12 months', deletionTrigger: 'trigger', exceptionRule: 'none', legalBasis: 'basis', ...extra,
});

describe('P3 — readStatus', () => {
  it('reports an unpublished schedule as not ready with the server reason', async () => {
    resetRpc({ data: { ready: false, reason: 'RETENTION_POLICY_NOT_PUBLISHED', requiredDataClasses: 14, executionAdmitted: false }, error: null });
    const result = await retentionPolicyClientService.readStatus();
    expect(mockRpc.mock.calls).toEqual([['rpc_get_retention_policy_status']]);
    expect(result).toEqual({ ok: true, podatak: { ready: false, reason: 'RETENTION_POLICY_NOT_PUBLISHED', missingDataClasses: [] } });
  });

  it('surfaces incomplete coverage with the missing data classes', async () => {
    resetRpc({ data: { ready: false, reason: 'RETENTION_POLICY_INCOMPLETE', missingDataClasses: ['REVIEWS_REPUTATION'] }, error: null });
    expect(await retentionPolicyClientService.readStatus()).toEqual({ ok: true, podatak: { ready: false, reason: 'RETENTION_POLICY_INCOMPLETE', missingDataClasses: ['REVIEWS_REPUTATION'] } });
  });

  it('maps a ready schedule and keeps every published rule', async () => {
    resetRpc({ data: { ready: true, reason: null, policyVersion: 'v1', effectiveAt: '2026-09-08T00:00:00+00:00', rules: [rule('ACCOUNT_IDENTITY'), rule('AI_VOLATILE', { retentionPeriod: '30 days' })] }, error: null });
    const result = await retentionPolicyClientService.readStatus();
    expect(result.ok).toBe(true);
    if (!result.ok || !result.podatak.ready) return;
    expect(result.podatak.policyVersion).toBe('v1');
    expect(result.podatak.rules.map((r) => [r.dataClass, r.retentionPeriod])).toEqual([['ACCOUNT_IDENTITY', '12 months'], ['AI_VOLATILE', '30 days']]);
  });

  it('fails closed on a ready schedule without rules or with a rule lacking a period', async () => {
    resetRpc({ data: { ready: true, policyVersion: 'v1', rules: [] }, error: null });
    expect(await retentionPolicyClientService.readStatus()).toMatchObject({ ok: false, kod: 'RETENTION_POLICY_INVALID_RESPONSE' });
    resetRpc({ data: { ready: true, policyVersion: 'v1', rules: [rule('X', { retentionPeriod: '' })] }, error: null });
    expect(await retentionPolicyClientService.readStatus()).toMatchObject({ ok: false, kod: 'RETENTION_POLICY_INVALID_RESPONSE' });
  });

  it('translates AUTH_REQUIRED into product language', async () => {
    resetRpc({ data: null, error: { code: '28000', message: 'AUTH_REQUIRED' } });
    const result = await retentionPolicyClientService.readStatus();
    expect(result).toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
    if (!result.ok) expect(result.poruka).toContain('Prijavite se');
  });
});

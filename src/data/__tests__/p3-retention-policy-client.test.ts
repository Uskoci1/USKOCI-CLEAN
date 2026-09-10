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

let mockAccount: { user: { id: string } | null; accountRevision: number } = { user: { id: 'account-a' }, accountRevision: 1 };
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount }));
beforeEach(() => { mockAccount = { user: { id: 'account-a' }, accountRevision: 1 }; });
afterEach(() => jest.useRealTimers());

import { retentionPolicyClientService } from '../retentionPolicyClientService';

const { mockRpc } = (jest.requireMock('../supabaseClient') as { __testMocks: { mockRpc: jest.Mock } }).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

const rule = (dataClass: string, extra: Record<string, unknown> = {}) => ({
  dataClass, purpose: 'purpose text', retentionPeriod: '12 months', deletionTrigger: 'trigger', exceptionRule: 'none', legalBasis: 'basis', ...extra,
});
// Synthetic schedule metadata only; these values are not an approved policy.
const ready = (extra: Record<string, unknown> = {}) => ({
  ready: true, reason: null, policyVersion: 'fixture-v1', effectiveAt: '2026-09-08T00:00:00+00:00',
  counselReference: 'synthetic proof only', requiredDataClasses: 2, coveredDataClasses: 2, executionAdmitted: false,
  rules: [rule('ACCOUNT_IDENTITY'), rule('AI_VOLATILE', { retentionPeriod: '30 days' })], ...extra,
});
const incomplete = (extra: Record<string, unknown> = {}) => ({
  ready: false, reason: 'RETENTION_POLICY_INCOMPLETE', policyVersion: 'fixture-v1',
  requiredDataClasses: 14, coveredDataClasses: 13, executionAdmitted: false,
  missingDataClasses: ['REVIEWS_REPUTATION'], ...extra,
});
const execution = (admitted = false, extra: Record<string, unknown> = {}) => ({
  engineVersion: 'P3_AI_ABANDONED_UNBOUND_V1', executionAdmitted: admitted, policyVersion: admitted ? 'fixture-v1' : null,
  datasets: [{ dataset: 'AI_ABANDONED_UNBOUND', dataClass: 'AI_VOLATILE', action: 'DELETE', ready: admitted,
    reason: admitted ? null : 'POLICY_NOT_READY' }],
  unsupportedDataClasses: ['ACCOUNT_IDENTITY', 'MEDIA_OBJECTS'], storageCleanup: 'NOT_APPLICABLE', ...extra,
});

describe('P3 — readStatus', () => {
  it('reports an unpublished schedule as not ready with the server reason', async () => {
    resetRpc({ data: { ready: false, reason: 'RETENTION_POLICY_NOT_PUBLISHED', requiredDataClasses: 14, executionAdmitted: false }, error: null });
    const result = await retentionPolicyClientService.readStatus();
    expect(mockRpc.mock.calls).toEqual([['rpc_get_retention_policy_status', {}]]);
    expect(result).toEqual({ ok: true, podatak: { ready: false, reason: 'RETENTION_POLICY_NOT_PUBLISHED', missingDataClasses: [] } });
  });

  it('surfaces incomplete coverage with the missing data classes', async () => {
    resetRpc({ data: incomplete(), error: null });
    expect(await retentionPolicyClientService.readStatus()).toEqual({ ok: true, podatak: { ready: false, reason: 'RETENTION_POLICY_INCOMPLETE', missingDataClasses: ['REVIEWS_REPUTATION'] } });
  });

  it('maps a ready schedule and keeps every published rule', async () => {
    resetRpc({ data: ready(), error: null });
    const result = await retentionPolicyClientService.readStatus();
    expect(result.ok).toBe(true);
    if (!result.ok || !result.podatak.ready) return;
    expect(result.podatak.policyVersion).toBe('fixture-v1');
    expect(result.podatak.rules.map((r) => [r.dataClass, r.retentionPeriod])).toEqual([['ACCOUNT_IDENTITY', '12 months'], ['AI_VOLATILE', '30 days']]);
  });

  it('fails closed on a ready schedule without rules or with a rule lacking a period', async () => {
    resetRpc({ data: ready({ rules: [] }), error: null });
    expect(await retentionPolicyClientService.readStatus()).toMatchObject({ ok: false, kod: 'RETENTION_POLICY_INVALID_RESPONSE' });
    resetRpc({ data: ready({ rules: [rule('ACCOUNT_IDENTITY'), rule('AI_VOLATILE', { retentionPeriod: '' })] }), error: null });
    expect(await retentionPolicyClientService.readStatus()).toMatchObject({ ok: false, kod: 'RETENTION_POLICY_INVALID_RESPONSE' });
  });

  it('translates AUTH_REQUIRED into product language', async () => {
    resetRpc({ data: null, error: { code: '28000', message: 'AUTH_REQUIRED' } });
    const result = await retentionPolicyClientService.readStatus();
    expect(result).toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
    if (!result.ok) expect(result.poruka).toContain('Prijavite se');
  });
});

describe('P3 — complete schedule receipt', () => {
  it.each([
    { executionAdmitted: true }, { executionAdmitted: undefined }, { ready: 'true' }, { reason: 'UNKNOWN' },
    { policyVersion: '' }, { effectiveAt: 'tomorrow' }, { counselReference: null },
    { requiredDataClasses: -1 }, { requiredDataClasses: 2.5 }, { requiredDataClasses: '2' },
    { coveredDataClasses: 1 }, { coveredDataClasses: 3 },
    { rules: [rule('ACCOUNT_IDENTITY')] }, { rules: [rule('ACCOUNT_IDENTITY'), rule('ACCOUNT_IDENTITY')] },
    { rules: [rule('ACCOUNT_IDENTITY'), null] }, { rules: [rule('ACCOUNT_IDENTITY'), rule('bad class')] },
    ...['purpose', 'retentionPeriod', 'deletionTrigger', 'exceptionRule', 'legalBasis'].flatMap(field => [
      { rules: [rule('ACCOUNT_IDENTITY'), rule('AI_VOLATILE', { [field]: 123 })] },
      { rules: [rule('ACCOUNT_IDENTITY'), rule('AI_VOLATILE', { [field]: '' })] },
    ]),
    { rules: [rule('ACCOUNT_IDENTITY'), rule('AI_VOLATILE', { retentionPeriod: 'x'.repeat(501) })] },
  ])('rejects malformed or contradictory READY projection %j', async override => {
    resetRpc({ data: ready(override), error: null });
    expect(await retentionPolicyClientService.readStatus()).toMatchObject({ ok: false, kod: 'RETENTION_POLICY_INVALID_RESPONSE' });
  });

  it('retains optional published classes beyond required coverage', async () => {
    resetRpc({ data: ready({ rules: [...ready().rules, rule('OPTIONAL_CLASS')] }), error: null });
    const result = await retentionPolicyClientService.readStatus();
    expect(result.ok && result.podatak.ready && result.podatak.rules.length).toBe(3);
  });

  it.each([
    { reason: 'UNKNOWN' }, { missingDataClasses: [null] }, { missingDataClasses: ['bad'] },
    { missingDataClasses: [] }, { missingDataClasses: ['AI_VOLATILE', 'AI_VOLATILE'], coveredDataClasses: 12 },
    { coveredDataClasses: 14 }, { policyVersion: null }, { executionAdmitted: true },
  ])('does not repair incomplete receipt %j', async override => {
    resetRpc({ data: incomplete(override), error: null });
    expect(await retentionPolicyClientService.readStatus()).toMatchObject({ ok: false, kod: 'RETENTION_POLICY_INVALID_RESPONSE' });
  });
});

describe('P3 — separate narrow execution capability', () => {
  it.each([false, true])('maps adapter admission %s without granting full retention readiness', async admitted => {
    resetRpc({ data: execution(admitted), error: null });
    expect(await retentionPolicyClientService.readExecutionStatus()).toEqual({ ok: true, podatak: execution(admitted) });
    expect(mockRpc.mock.calls).toEqual([['rpc_get_retention_execution_status', {}]]);
  });
  it('keeps a source mismatch closed even with a policy version', async () => {
    const receipt = execution(false, { policyVersion: 'fixture-v1', datasets: [{ ...execution().datasets[0], reason: 'SOURCE_NOT_READY' }] });
    resetRpc({ data: receipt, error: null });
    expect(await retentionPolicyClientService.readExecutionStatus()).toEqual({ ok: true, podatak: receipt });
  });
  it('accepts an empty unsupported inventory without widening the one adapter', async () => {
    const receipt = execution(true, { unsupportedDataClasses: [] });
    resetRpc({ data: receipt, error: null });
    expect(await retentionPolicyClientService.readExecutionStatus()).toEqual({ ok: true, podatak: receipt });
  });
  it.each([
    { engineVersion: 'OTHER' }, { executionAdmitted: 'true' }, { policyVersion: null },
    { storageCleanup: 'COMPLETE' }, { unsupportedDataClasses: [null] }, { unsupportedDataClasses: ['MEDIA_OBJECTS', 'MEDIA_OBJECTS'] },
    { unsupportedDataClasses: ['AI_VOLATILE'] },
    { datasets: [] }, { datasets: [...execution(true).datasets, ...execution(true).datasets] },
    ...[{ ready: false }, { reason: 'POLICY_NOT_READY' }, { dataset: 'ALL_AI' }, { action: 'ANONYMIZE' }, { dataClass: 'MEDIA_OBJECTS' }]
      .map(override => ({ datasets: [{ ...execution(true).datasets[0], ...override }] })),
  ])('rejects contradictory or broader capability %j', async override => {
    resetRpc({ data: execution(true, override), error: null });
    expect(await retentionPolicyClientService.readExecutionStatus()).toMatchObject({ ok: false, kod: 'RETENTION_EXECUTION_INVALID_RESPONSE' });
  });
});

describe.each([
  ['schedule', () => retentionPolicyClientService.readStatus(), ready, 'RETENTION_POLICY_READ_FAILED'],
  ['execution', () => retentionPolicyClientService.readExecutionStatus(), execution, 'RETENTION_EXECUTION_READ_FAILED'],
] as const)('P3 — %s authenticated receipt lifecycle', (_name, read, fixture, fallback) => {
  it('does not call RPC without a current account', async () => {
    resetRpc({ data: fixture(), error: null }); mockAccount.user = null;
    expect(await read()).toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it('retires an account switch and return to the same account', async () => {
    let resolve!: (value: unknown) => void;
    resetRpc(null); mockRpc.mockReturnValue(new Promise(r => { resolve = r; }));
    const pending = read();
    mockAccount = { user: { id: 'account-a' }, accountRevision: 3 };
    resolve({ data: fixture(), error: null });
    expect(await pending).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  });
  it('bounds a stalled read and ignores the late receipt', async () => {
    jest.useFakeTimers();
    let resolve!: (value: unknown) => void;
    resetRpc(null); mockRpc.mockReturnValue(new Promise(r => { resolve = r; }));
    const pending = read();
    await jest.advanceTimersByTimeAsync(15_001);
    expect(await pending).toMatchObject({ ok: false, kod: fallback });
    resolve({ data: fixture(), error: null });
    await Promise.resolve();
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
  it('does not expose unknown backend error details or accept data with an error', async () => {
    resetRpc({ data: fixture(), error: { message: 'private backend diagnostic', code: 'private-code' } });
    const result = await read();
    expect(result).toMatchObject({ ok: false, kod: fallback });
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it('converts thrown transport failure to a safe read failure', async () => {
    resetRpc(null); mockRpc.mockRejectedValue(new Error('private transport diagnostic'));
    expect(await read()).toMatchObject({ ok: false, kod: fallback });
  });
});

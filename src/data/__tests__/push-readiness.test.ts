jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: mockRpc }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
import { pushReadinessClientService as service } from '../pushReadinessClientService';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let mockSession: { user: { id: string } | null; accountRevision: number };
const mockRpc = jest.fn();
const none = () => ({ state: 'UNKNOWN', reason: 'NO_RUNTIME_OBSERVATION', checkedAt: '2026-09-12T13:00:00Z', observedAt: null,
  lastSuccessAt: null, freshnessSeconds: 300, overdueWindowSeconds: 900, fresh: false, senderVersion: null,
  senderDeployment: 'UNKNOWN', senderConfiguration: 'UNKNOWN', expiredLease: false, overdueBacklog: false, evidenceScope: 'TRANSPORT_ONLY', authoritative: true });
const healthy = () => ({ ...none(), state: 'OPERATIONAL', reason: 'HEALTHY_TRANSPORT_TICK', observedAt: '2026-09-12T12:59:00Z',
  lastSuccessAt: '2026-09-12T12:59:00Z', fresh: true, senderVersion: 'PRE_V3_PUSH_READINESS_V1', senderDeployment: 'RUNTIME_OBSERVED', senderConfiguration: 'ENABLED' });
beforeEach(() => { mockSession = { user: { id: A }, accountRevision: 1 }; mockRpc.mockReset(); });
it.each([none(), healthy(), { ...healthy(), state: 'NOT_READY', reason: 'DEPLOYMENT_DISABLED', senderConfiguration: 'DISABLED' },
  { ...healthy(), state: 'DEGRADED', reason: 'EXPIRED_LEASE', expiredLease: true },
  { ...healthy(), state: 'DEGRADED', reason: 'OVERDUE_BACKLOG', overdueBacklog: true },
  { ...healthy(), state: 'DEGRADED', reason: 'LAST_TICK_UNHEALTHY' },
  { ...healthy(), state: 'UNKNOWN', reason: 'SUCCESSFUL_TICK_NOT_OBSERVED', lastSuccessAt: null },
  { ...healthy(), state: 'UNKNOWN', reason: 'STALE_RUNTIME_OBSERVATION', fresh: false, observedAt: '2026-09-12T12:55:00Z', lastSuccessAt: null, senderDeployment: 'UNKNOWN', senderConfiguration: 'UNKNOWN' }
])('accepts truthful bounded state %j', async value => {
  mockRpc.mockResolvedValue({ data: { ...value, providerToken: 'PRIVATE' }, error: null });
  expect(await service.read()).toEqual({ ok: true, podatak: value });
});
it.each([{ state: 'DELIVERED' }, { state: 'UNKNOWN' }, { reason: 'provider error private' }, { senderConfiguration: 'UNKNOWN' },
  { senderDeployment: 'DEPLOYED' }, { observedAt: null }, { observedAt: 'tomorrow' }, { freshnessSeconds: 999 }, { fresh: false },
  { senderVersion: null }, { lastSuccessAt: null }, { lastSuccessAt: '2026-09-12T14:00:00Z' }, { checkedAt: '2026-09-12T12:00:00Z' },
  { expiredLease: true }, { overdueBacklog: true }, { evidenceScope: 'PHYSICAL_DEVICE' }, { authoritative: false }, { state: 'NOT_READY' }
])('rejects fabricated or contradictory readiness %j', async patch => {
  mockRpc.mockResolvedValue({ data: { ...healthy(), ...patch }, error: null });
  expect(await service.read()).toMatchObject({ ok: false, kod: 'PUSH_READINESS_INVALID_RESPONSE' });
});
it('does not manufacture operational from a missing observation', async () => {
  mockRpc.mockResolvedValue({ data: { ...none(), state: 'OPERATIONAL' }, error: null }); expect((await service.read()).ok).toBe(false);
});
it('does not leak backend errors or convert errors to operational', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'provider PRIVATE_SECRET' } });
  const r = await service.read(); expect(r).toMatchObject({ ok: false, kod: 'PUSH_READINESS_UNAVAILABLE' }); expect(JSON.stringify(r)).not.toContain('PRIVATE_SECRET');
});
it('fences an account change during a global health read', async () => {
  let resolve!: (v: unknown) => void; mockRpc.mockImplementation(() => new Promise(r => { resolve = r; }));
  const pending = service.read(); mockSession = { user: { id: A }, accountRevision: 3 };
  resolve({ data: healthy(), error: null }); expect(await pending).toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});

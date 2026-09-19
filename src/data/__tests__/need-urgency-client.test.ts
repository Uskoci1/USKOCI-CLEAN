const aid = '11111111-1111-4111-8111-111111111111', nid = '22222222-2222-4222-8222-222222222222';
let mockAccount: string | null = aid, mockRevision = 0;
const mockRpc = jest.fn();
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => ({ user: mockAccount ? { id: mockAccount } : null, accountRevision: mockRevision }) }));
import { decodeNeedUrgency, readNeedUrgencies } from '../needUrgencyClientService';
import { displaysUrgent } from '../../lib/needUrgency';
const active = () => ({ needId: nid, level: 'HITNO', activatedAt: '2026-09-13T10:00:00Z', expiresAt: '2026-09-13T11:00:00Z',
  policyVersion: 1, reasonCodes: ['URGENT_ACTIVE'], authoritative: true });
beforeEach(() => { jest.clearAllMocks(); mockAccount = aid; mockRevision = 0; });
it('uses the existing authority once per flagged visible ID and never derives urgency from raw flags', async () => {
  mockRpc.mockResolvedValue({ data: active(), error: null });
  const result = await readNeedUrgencies([{ id: nid, urgent: true }, { id: nid, urgent: true }, { id: aid, urgent: false }, { id: aid }, { id: 'bad', urgent: true }]);
  expect([...result]).toEqual([[nid, { level: 'HITNO', expiresAt: active().expiresAt }]]);
  expect(mockRpc).toHaveBeenCalledTimes(1); expect(mockRpc).toHaveBeenCalledWith('fn_need_urgency', { p_need_id: nid });
});
it.each([{ needId: aid }, { authoritative: false }, { expiresAt: null }, { activatedAt: '2026-09-13T12:00:00Z' }, { level: 'urgent' }])('rejects wrong or unobserved authority %#', patch => {
  expect(decodeNeedUrgency({ ...active(), ...patch }, nid)).toBeNull();
});
it('honors the existing server expiry without adding a new duration or reviving an expired raw flag', () => {
  const urgency = decodeNeedUrgency(active(), nid)!;
  expect(displaysUrgent(urgency, Date.parse('2026-09-13T10:59:59Z'))).toBe(true);
  expect(displaysUrgent(urgency, Date.parse(active().expiresAt))).toBe(false);
  expect(displaysUrgent(undefined)).toBe(false);
  const normal = decodeNeedUrgency({ ...active(), level: 'NORMAL', activatedAt: null, expiresAt: null }, nid)!;
  expect(displaysUrgent(normal, Date.parse('2026-09-13T10:01:00Z'))).toBe(false);
});
it('keeps an unavailable projection unknown and neither hides the parent Need nor retries', async () => {
  mockRpc.mockResolvedValue({ data: null, error: { message: 'private transport details' } });
  expect((await readNeedUrgencies([{ id: nid, urgent: true }])).size).toBe(0);
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
it('does not use a late urgency receipt across a same-account session change', async () => {
  let resolve!: (v: unknown) => void;
  mockRpc.mockReturnValue(new Promise(r => { resolve = r; }));
  const result = readNeedUrgencies([{ id: nid, urgent: true }]); mockRevision++;
  resolve({ data: active(), error: null }); expect((await result).size).toBe(0);
});
it('performs no urgency calls when signed out or when no row has the existing raw flag', async () => {
  mockAccount = null; expect((await readNeedUrgencies([{ id: nid, urgent: true }])).size).toBe(0);
  mockAccount = aid; expect((await readNeedUrgencies([{ id: nid, urgent: false }])).size).toBe(0);
  expect(mockRpc).not.toHaveBeenCalled();
});
it('bounds parallel reads and stops queued urgency work on failure while leaving the Need list usable', async () => {
  const resolves: ((v: unknown) => void)[] = [];
  mockRpc.mockImplementation(() => new Promise(resolve => resolves.push(resolve)));
  const rows = Array.from({ length: 9 }, (_, index) => ({ id: `22222222-2222-4222-8222-${String(index).padStart(12, '0')}`, urgent: true }));
  const result = readNeedUrgencies(rows); expect(mockRpc).toHaveBeenCalledTimes(4);
  resolves.forEach(resolve => resolve({ data: null, error: { message: 'unavailable' } }));
  expect((await result).size).toBe(0); expect(mockRpc).toHaveBeenCalledTimes(4);
});

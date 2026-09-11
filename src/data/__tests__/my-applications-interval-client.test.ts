import { readExistingApplicationInterval } from '../myApplicationsClientService';
import type { MojaPrijavaProjekcija } from '../../contracts/projections';
const mockSingle = jest.fn(), mockEq = jest.fn(), mockSelect = jest.fn(), mockFrom = jest.fn();
const mockBuilder = { select: mockSelect, eq: mockEq, maybeSingle: mockSingle };
const owner = '10000000-0000-4000-8000-000000000010', need = '10000000-0000-4000-8000-000000000001', application = '10000000-0000-4000-8000-000000000002';
let mockAccount: { user: { id: string } | null; accountRevision: number } = { user: { id: owner }, accountRevision: 1 };
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ from: mockFrom }) }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount }));
const projection = () => ({ prijavaId: application, potrebaId: need, prijavaVerzija: 2, prijavaRevizija: 3, potrebaRevizija: 4 } as MojaPrijavaProjekcija);
const raw = () => ({ id: application, need_id: need, worker_account_id: owner, current_version: 2, submitted_against_need_revision: 3,
  status: 'STALE_REVIEW_REQUIRED', proposed_start_at: '2026-09-20T10:00:00.123456Z', proposed_end_at: '2026-09-20T11:00:00.654321Z', needs: { id: need, revision: 4 } });
beforeEach(() => {
  jest.clearAllMocks(); mockAccount = { user: { id: owner }, accountRevision: 1 }; mockFrom.mockReturnValue(mockBuilder); mockSelect.mockReturnValue(mockBuilder); mockEq.mockReturnValue(mockBuilder);
  mockSingle.mockResolvedValue({ data: raw(), error: null });
});
afterEach(() => jest.useRealTimers());
it('uses the existing owner response policy and exact current Need/version filters, retaining microseconds', async () => {
  await expect(readExistingApplicationInterval(projection())).resolves.toEqual({ ok: true, podatak: { start: raw().proposed_start_at, end: raw().proposed_end_at } });
  expect(mockFrom).toHaveBeenCalledWith('marketplace_responses');
  expect(mockEq.mock.calls).toEqual([['id', application], ['need_id', need], ['worker_account_id', owner], ['current_version', 2], ['needs.revision', 4]]);
  expect(mockSelect.mock.calls[0][0]).not.toMatch(/account_profiles|exact_lat|contact|phone/);
});
it.each([
  ['other owner', { worker_account_id: 'other-account' }], ['other response', { id: need }], ['other Need', { need_id: application }],
  ['changed version', { current_version: 3 }], ['changed submitted revision', { submitted_against_need_revision: 4 }],
  ['changed Need revision', { needs: { id: need, revision: 5 } }], ['wrong joined Need', { needs: { id: application, revision: 4 } }],
  ['missing joined Need', { needs: null }], ['already selected', { status: 'SELECTED' }], ['missing start', { proposed_start_at: undefined }],
  ['missing end', { proposed_end_at: undefined }], ['invalid start', { proposed_start_at: 'not a date' }],
  ['reversed interval', { proposed_end_at: '2026-09-20T09:00:00Z' }],
])('fails closed on %s instead of substituting an empty interval', async (_name, patch) => {
  mockSingle.mockResolvedValue({ data: { ...raw(), ...patch }, error: null }); await expect(readExistingApplicationInterval(projection())).resolves.toMatchObject({ ok: false, kod: 'APPLICATION_INTERVAL_CHANGED' });
});
it('preserves an explicitly stored null interval', async () => {
  mockSingle.mockResolvedValue({ data: { ...raw(), proposed_start_at: null, proposed_end_at: null }, error: null });
  await expect(readExistingApplicationInterval(projection())).resolves.toEqual({ ok: true, podatak: { start: null, end: null } });
});
it('does not expose backend error text or infer null from an inaccessible row', async () => {
  mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'private SQL account detail' } });
  const result = await readExistingApplicationInterval(projection()); expect(result.ok).toBe(false); expect(JSON.stringify(result)).not.toContain('private SQL');
  mockSingle.mockResolvedValueOnce({ data: null, error: null }); await expect(readExistingApplicationInterval(projection())).resolves.toMatchObject({ ok: false });
});
it('rejects a late A→B→A response by account incarnation', async () => {
  let resolve!: (result: any) => void; mockSingle.mockReturnValueOnce(new Promise(r => { resolve = r; })); const read = readExistingApplicationInterval(projection());
  mockAccount = { user: { id: owner }, accountRevision: 3 }; resolve({ data: raw(), error: null });
  await expect(read).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
it('requires an authenticated owner before querying', async () => {
  mockAccount = { user: null, accountRevision: 2 }; await expect(readExistingApplicationInterval(projection())).resolves.toMatchObject({ ok: false }); expect(mockFrom).not.toHaveBeenCalled();
});
it('bounds a hanging owner read without making a fallback interval', async () => {
  jest.useFakeTimers(); mockSingle.mockReturnValueOnce(new Promise(() => {})); const read = readExistingApplicationInterval(projection());
  jest.advanceTimersByTime(15001); await expect(read).resolves.toMatchObject({ ok: false, kod: 'APPLICATION_INTERVAL_UNAVAILABLE' });
});

import { entryIntentClientService } from '../entryIntentClientService';
const mockPrepare = jest.fn();
let mockSession = { user: null as { id: string } | null, accountRevision: 0 };
jest.mock('../../store/povratniCilj', () => ({ povratniCilj: { prepare: (...args: unknown[]) => mockPrepare(...args) } }));
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); mockSession = { user: null, accountRevision: 0 }; });
afterEach(() => jest.useRealTimers());
it.each(['REQUESTER', 'WORKER'] as const)('prepares %s as guest intent without granting an authenticated role', async intent => {
  mockPrepare.mockImplementation(async (input, current) => { expect(current()).toBe(true); return input; });
  await entryIntentClientService.prepare(intent);
  expect(mockPrepare.mock.calls[0][0]).toEqual({ intent, returnTarget: { kind: 'NONE' } });
  expect(mockSession).toEqual({ user: null, accountRevision: 0 });
  expect(jest.getTimerCount()).toBe(0);
});
it('releases the caller after hung storage and permanently invalidates a late write', async () => {
  let resolve!: (value: unknown) => void;
  mockPrepare.mockReturnValue(new Promise(done => { resolve = done; }));
  const pending = entryIntentClientService.prepare('REQUESTER');
  const rejected = expect(pending).rejects.toThrow('ENTRY_INTENT_STORAGE_TIMEOUT');
  const current = mockPrepare.mock.calls[0][1]; expect(current()).toBe(true);
  await jest.advanceTimersByTimeAsync(5000); await rejected;
  expect(current()).toBe(false); resolve({ intent: 'REQUESTER' });
  await Promise.resolve(); expect(current()).toBe(false);
});
it('rejects guest→account→guest ABA ownership when storage returns', async () => {
  mockPrepare.mockImplementation(async (_input, current) => {
    mockSession = { user: { id: 'A' }, accountRevision: 1 };
    mockSession = { user: null, accountRevision: 2 };
    expect(current()).toBe(false); return null;
  });
  await expect(entryIntentClientService.prepare('WORKER')).rejects.toThrow('AUTH_ACCOUNT_CHANGED');
});
it('retains a real storage failure and clears its timer so a new attempt can succeed', async () => {
  mockPrepare.mockRejectedValueOnce(new Error('storage full')).mockResolvedValueOnce({});
  await expect(entryIntentClientService.prepare('WORKER')).rejects.toThrow('storage full');
  expect(jest.getTimerCount()).toBe(0);
  await expect(entryIntentClientService.prepare('WORKER')).resolves.toBeUndefined();
});

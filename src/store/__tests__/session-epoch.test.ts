import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import type { AuthReturnTargetRecordV2 } from '../povratniCilj';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

let mockRecords: Record<string, string> = {};
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockRemoveItem = jest.fn();
const mockGetSession = jest.fn();
let mockAuthCallback: (event: AuthChangeEvent, session: Session | null) => unknown;
const mockOnAuthStateChange = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (key: string) => mockGetItem(key),
  setItem: (key: string, value: string) => mockSetItem(key, value),
  removeItem: (key: string) => mockRemoveItem(key),
}));
jest.mock('../../data', () => ({ izvor: {} }));
jest.mock('../../data/supabaseClient', () => ({
  supabaseKlijent: () => ({ auth: { getSession: mockGetSession, onAuthStateChange: mockOnAuthStateChange } }),
}));

let store: typeof import('../sesija');
let targets: typeof import('../povratniCilj');
let restore: ReturnType<typeof deferred<{ data: { session: Session | null }; error: Error | null }>>;
const session = (id: string, token = id): Session => ({
  access_token: 'access-' + token, refresh_token: 'refresh-' + token, expires_in: 3600, token_type: 'bearer',
  user: { id, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-09-07T00:00:00Z' },
});
async function flush() { for (let step = 0; step < 15; step += 1) await Promise.resolve(); }
async function runDeferredWork() { await jest.runOnlyPendingTimersAsync(); await flush(); }
function emit(event: AuthChangeEvent, value: Session | null) { return mockAuthCallback(event, value); }

beforeEach(() => {
  jest.resetModules(); jest.useFakeTimers(); jest.clearAllMocks();
  mockRecords = {};
  mockGetItem.mockImplementation(async (key: string) => mockRecords[key] ?? null);
  mockSetItem.mockImplementation(async (key: string, value: string) => { mockRecords[key] = value; });
  mockRemoveItem.mockImplementation(async (key: string) => { delete mockRecords[key]; });
  restore = deferred(); mockGetSession.mockReturnValue(restore.promise);
  mockOnAuthStateChange.mockImplementation(callback => {
    mockAuthCallback = callback;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  targets = require('../povratniCilj');
  store = require('../sesija');
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

describe('actual session store ownership', () => {
  it('increments account revision for every identity transition, including batched A→B→A, but not token refresh', () => {
    store.inicijalizujSesiju();
    expect(store.sesijaSada().accountRevision).toBe(0);
    emit('INITIAL_SESSION', null);
    expect(store.sesijaSada().accountRevision).toBe(0);
    emit('SIGNED_IN', session('account-a'));
    expect(store.sesijaSada().accountRevision).toBe(1);
    emit('TOKEN_REFRESHED', session('account-a', 'refreshed'));
    expect(store.sesijaSada().accountRevision).toBe(1);
    emit('SIGNED_IN', session('account-b'));
    emit('SIGNED_IN', session('account-a', 'new-login'));
    expect(store.sesijaSada().accountRevision).toBe(3);
    emit('SIGNED_OUT', null);
    expect(store.sesijaSada().accountRevision).toBe(4);
    emit('SIGNED_OUT', null);
    expect(store.sesijaSada().accountRevision).toBe(4);
  });

  it.each(['SIGNED_OUT', 'SIGNED_IN'] as const)('ignores old restore success after newer %s', async event => {
    store.inicijalizujSesiju();
    emit(event, event === 'SIGNED_IN' ? session('account-b') : null);
    restore.resolve({ data: { session: session('account-a') }, error: null });
    await runDeferredWork();
    expect(store.sesijaSada().isLoaded).toBe(true);
    expect(store.sesijaSada().user?.id ?? null).toBe(event === 'SIGNED_IN' ? 'account-b' : null);
  });

  it.each(['SIGNED_OUT', 'SIGNED_IN'] as const)('ignores old restore rejection after newer %s', async event => {
    store.inicijalizujSesiju();
    emit(event, event === 'SIGNED_IN' ? session('account-b') : null);
    restore.reject(new Error('late offline restore'));
    await runDeferredWork();
    expect(store.sesijaSada().isLoaded).toBe(true);
    expect(store.sesijaSada().user?.id ?? null).toBe(event === 'SIGNED_IN' ? 'account-b' : null);
  });

  it.each(['reject', 'error-result'] as const)('recovers loading after current restore %s and accepts a later sign-in', async failure => {
    store.inicijalizujSesiju();
    if (failure === 'reject') restore.reject(new Error('offline'));
    else restore.resolve({ data: { session: null }, error: new Error('offline') });
    await runDeferredWork();
    expect(store.sesijaSada()).toMatchObject({ isLoaded: true, session: null, user: null });
    emit('SIGNED_IN', session('account-b'));
    await runDeferredWork();
    expect(store.sesijaSada().user?.id).toBe('account-b');
  });

  it('registers one synchronous callback and preserves a real pending Worker target', async () => {
    await targets.povratniCilj.prepare({ intent: 'WORKER', returnTarget: { kind: 'NEED', needId: 'need-1' } });
    store.inicijalizujSesiju(); store.inicijalizujSesiju();
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1);
    const returned = emit('SIGNED_IN', session('account-a'));
    expect(returned).toBeUndefined();
    await runDeferredWork();
    expect(store.sesijaSada().returnTargetRevision).toBe(1);
    expect(await targets.povratniCilj.consumeCompleted('account-a')).toMatchObject({
      completedByUserId: 'account-a', intent: { intent: 'WORKER', returnTarget: { kind: 'NEED', needId: 'need-1' } },
    });
  });

  // Owner decision 1 (2026-09-19): these used to read the app's global mode as the witness that A's
  // choice had not leaked into B. The mode is gone; the witness is the return target itself, which
  // is what actually carries a person somewhere.
  it('does not let A complete a target after B signs in during its snapshot', async () => {
    await targets.povratniCilj.prepare({ intent: 'WORKER' });
    const pending = await targets.povratniCilj.snapshot();
    const snapshot = deferred<AuthReturnTargetRecordV2 | null>();
    jest.spyOn(targets.povratniCilj, 'snapshot').mockReturnValueOnce(snapshot.promise);
    const complete = jest.spyOn(targets.povratniCilj, 'markCompleted');
    store.inicijalizujSesiju();
    emit('SIGNED_IN', session('account-a'));
    await runDeferredWork();
    emit('SIGNED_IN', session('account-b'));
    snapshot.resolve(pending);
    await runDeferredWork();
    expect(store.sesijaSada().user?.id).toBe('account-b');
    expect(complete.mock.calls.some(([account]) => account === 'account-a')).toBe(false);
    expect(store.sesijaSada().returnTargetRevision).toBe(0);
    expect(await targets.povratniCilj.snapshot()).toBeNull();
  });

  it('does not hand the completion of A to the session of B when it resolves late', async () => {
    await targets.povratniCilj.prepare({ intent: 'WORKER' });
    const pending = await targets.povratniCilj.snapshot();
    const completion = deferred<AuthReturnTargetRecordV2 | null>();
    jest.spyOn(targets.povratniCilj, 'markCompleted').mockReturnValueOnce(completion.promise);
    store.inicijalizujSesiju();
    emit('SIGNED_IN', session('account-a'));
    await runDeferredWork();
    emit('SIGNED_IN', session('account-b'));
    completion.resolve({ ...pending!, status: 'COMPLETED', completedByUserId: 'account-a' });
    await runDeferredWork();
    expect(store.sesijaSada().returnTargetRevision).toBe(0);
    expect(store.sesijaSada().user?.id).toBe('account-b');
  });

  it('logout invalidates the pending target of A, and a late snapshot from before it cannot complete it for the new login', async () => {
    await targets.povratniCilj.prepare({ intent: 'WORKER' });
    const pending = await targets.povratniCilj.snapshot();
    const snapshot = deferred<AuthReturnTargetRecordV2 | null>();
    jest.spyOn(targets.povratniCilj, 'snapshot').mockReturnValueOnce(snapshot.promise);
    store.inicijalizujSesiju();
    emit('SIGNED_IN', session('account-a'));
    await runDeferredWork();
    emit('SIGNED_OUT', null);
    emit('SIGNED_IN', session('account-a', 'new-login'));
    snapshot.resolve(pending);
    await runDeferredWork();
    expect(await targets.povratniCilj.snapshot()).toBeNull();
    expect(await targets.povratniCilj.consumeCompleted('account-a')).toBeNull();
  });

  it('keeps Auth usable and a failed pending intent retryable after local storage failure', async () => {
    await targets.povratniCilj.prepare({ intent: 'WORKER' });
    jest.spyOn(targets.povratniCilj, 'snapshot').mockRejectedValueOnce(new Error('storage unavailable'));
    store.inicijalizujSesiju();
    emit('SIGNED_IN', session('account-a'));
    await runDeferredWork();
    expect(store.sesijaSada()).toMatchObject({ isLoaded: true, user: { id: 'account-a' } });
    expect(store.sesijaSada().returnTargetRevision).toBe(0);
    emit('SIGNED_IN', session('account-a'));
    await runDeferredWork();
    expect(store.sesijaSada().returnTargetRevision).toBe(1);
  });

  it('never adopts A pending target for B when previous-account cleanup fails', async () => {
    store.inicijalizujSesiju();
    emit('SIGNED_IN', session('account-a'));
    await runDeferredWork();
    await targets.povratniCilj.prepare({ intent: 'WORKER', returnTarget: { kind: 'NEED', needId: 'a-private-need' } });
    mockRemoveItem.mockRejectedValue(new Error('storage remove failed'));
    emit('SIGNED_IN', session('account-b'));
    await runDeferredWork();
    emit('TOKEN_REFRESHED', session('account-b', 'refreshed'));
    await runDeferredWork();
    expect(store.sesijaSada()).toMatchObject({ isLoaded: true, user: { id: 'account-b' } });
    expect(store.sesijaSada().returnTargetRevision).toBe(0);
    expect((await targets.povratniCilj.snapshot())?.status).toBe('PENDING');
    expect(await targets.povratniCilj.consumeCompleted('account-b')).toBeNull();
  });

  it('retries failed account cleanup after storage recovers while preserving a freshly prepared B target', async () => {
    store.inicijalizujSesiju();
    emit('SIGNED_IN', session('account-a'));
    await runDeferredWork();
    await targets.povratniCilj.prepare({ intent: 'WORKER', returnTarget: { kind: 'NEED', needId: 'a-need' } });
    mockRemoveItem.mockRejectedValueOnce(new Error('storage remove failed'));
    emit('SIGNED_IN', session('account-b'));
    await runDeferredWork();
    await targets.povratniCilj.prepare({ intent: 'WORKER', returnTarget: { kind: 'NEED', needId: 'b-need' } });
    emit('SIGNED_IN', session('account-b'));
    await runDeferredWork();
    expect(await targets.povratniCilj.consumeCompleted('account-b')).toMatchObject({
      completedByUserId: 'account-b', intent: { returnTarget: { kind: 'NEED', needId: 'b-need' } },
    });
  });

  it('retries failed cleanup without adopting the old target when no fresh B prepare exists', async () => {
    store.inicijalizujSesiju();
    emit('SIGNED_IN', session('account-a'));
    await runDeferredWork();
    await targets.povratniCilj.prepare({ intent: 'WORKER', returnTarget: { kind: 'NEED', needId: 'a-need' } });
    mockRemoveItem.mockRejectedValueOnce(new Error('storage remove failed'));
    emit('SIGNED_IN', session('account-b'));
    await runDeferredWork();
    emit('SIGNED_IN', session('account-b'));
    await runDeferredWork();
    expect(store.sesijaSada().returnTargetRevision).toBe(0);
    expect(await targets.povratniCilj.snapshot()).toBeNull();
  });
});

// Owner decision 1 (2026-09-19). A restored session used to stay hidden, for up to 1.5 s, until a
// per-account UI mode had been read from storage, and an explicit choice before signing in overwrote
// that stored mode. There is no mode: the session is revealed when it is accepted, and a record an
// older build left in storage is neither read nor rewritten.
it('reveals a restored session as soon as it is accepted; an old stored app mode is not waited for', async () => {
  mockRecords['uskoci:account-intent:v1:account-a'] = JSON.stringify({ version: 1, accountId: 'account-a', role: 'uskocer' });
  store.inicijalizujSesiju(); emit('INITIAL_SESSION', session('account-a'));
  expect(store.sesijaSada()).toMatchObject({ isLoaded: true, user: { id: 'account-a' } });
  expect('intentReady' in store.sesijaSada()).toBe(false);
});
it('an explicit choice before signing in is carried as a destination and leaves any old stored app mode untouched', async () => {
  const stored = JSON.stringify({ version: 1, accountId: 'account-a', role: 'uskocer' });
  mockRecords['uskoci:account-intent:v1:account-a'] = stored;
  await targets.povratniCilj.prepare({ intent: 'REQUESTER' });
  store.inicijalizujSesiju(); emit('SIGNED_IN', session('account-a')); await runDeferredWork();
  expect(store.sesijaSada().returnTargetRevision).toBe(1);
  expect(await targets.povratniCilj.consumeCompleted('account-a')).toMatchObject({ completedByUserId: 'account-a', intent: { intent: 'REQUESTER' } });
  expect(mockRecords['uskoci:account-intent:v1:account-a']).toBe(stored);
});

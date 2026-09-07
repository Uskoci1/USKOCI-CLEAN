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
let roles: typeof import('../uloga');
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
  roles = require('../uloga');
  store = require('../sesija');
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

describe('actual session store ownership', () => {
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
    expect(roles.ulogaSada()).toBe('uskocer');
    expect(store.sesijaSada().returnTargetRevision).toBe(1);
    expect(await targets.povratniCilj.consumeCompleted('account-a')).toMatchObject({
      completedByUserId: 'account-a', intent: { intent: 'WORKER', returnTarget: { kind: 'NEED', needId: 'need-1' } },
    });
  });

  it('does not let A set intent or complete a target after B signs in during its snapshot', async () => {
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
    expect(roles.ulogaSada()).toBe('narucilac');
    expect(await targets.povratniCilj.snapshot()).toBeNull();
  });

  it('does not apply A intent after its completion resolves during B session', async () => {
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
    expect(roles.ulogaSada()).toBe('narucilac');
    expect(store.sesijaSada().user?.id).toBe('account-b');
  });

  it('logout immediately resets role and invalidates A work even if the same account signs in again', async () => {
    await targets.povratniCilj.prepare({ intent: 'WORKER' });
    const pending = await targets.povratniCilj.snapshot();
    const snapshot = deferred<AuthReturnTargetRecordV2 | null>();
    jest.spyOn(targets.povratniCilj, 'snapshot').mockReturnValueOnce(snapshot.promise);
    store.inicijalizujSesiju();
    emit('SIGNED_IN', session('account-a'));
    await runDeferredWork();
    roles.postaviUlogu('uskocer');
    emit('SIGNED_OUT', null);
    expect(roles.ulogaSada()).toBe('narucilac');
    emit('SIGNED_IN', session('account-a', 'new-login'));
    snapshot.resolve(pending);
    await runDeferredWork();
    expect(roles.ulogaSada()).toBe('narucilac');
    expect(await targets.povratniCilj.snapshot()).toBeNull();
  });

  it('keeps Auth usable and a failed pending intent retryable after local storage failure', async () => {
    await targets.povratniCilj.prepare({ intent: 'WORKER' });
    jest.spyOn(targets.povratniCilj, 'snapshot').mockRejectedValueOnce(new Error('storage unavailable'));
    store.inicijalizujSesiju();
    emit('SIGNED_IN', session('account-a'));
    await runDeferredWork();
    expect(store.sesijaSada()).toMatchObject({ isLoaded: true, user: { id: 'account-a' } });
    expect(roles.ulogaSada()).toBe('narucilac');
    emit('SIGNED_IN', session('account-a'));
    await runDeferredWork();
    expect(roles.ulogaSada()).toBe('uskocer');
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
    expect(roles.ulogaSada()).toBe('narucilac');
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
    expect(roles.ulogaSada()).toBe('uskocer');
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
    expect(roles.ulogaSada()).toBe('narucilac');
    expect(await targets.povratniCilj.snapshot()).toBeNull();
  });
});

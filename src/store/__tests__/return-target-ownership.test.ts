import { AuthReturnTargetStore, AUTH_RETURN_TARGET_KEY } from '../povratniCilj';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => {
  let records: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => records[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => { records[key] = value; }),
    removeItem: jest.fn(async (key: string) => { delete records[key]; }),
    clear: jest.fn(async () => { records = {}; }),
  };
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function flush() { for (let step = 0; step < 10; step += 1) await Promise.resolve(); }
let store: AuthReturnTargetStore;
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  store = new AuthReturnTargetStore();
});

describe('serialized return-target ownership', () => {
  it('does not overwrite a newer prepared target with an old pending snapshot', async () => {
    const first = await store.prepare({ intent: 'WORKER', returnTarget: { kind: 'NEED', needId: 'old-need' } });
    const fresh = await store.prepare({ intent: 'REQUESTER', returnTarget: { kind: 'REQUESTER_DRAFT', draftKey: 'new-draft' } });
    const completed = await store.markCompleted('account-a', first.intent, { isCurrent: () => true, pendingRevision: first.recordRevision });
    expect(completed).toBeNull();
    expect(await store.snapshot()).toEqual(fresh);
  });

  it('checks ownership after the completion read before writing', async () => {
    const pending = await store.prepare({ intent: 'WORKER' });
    const read = deferred<string | null>();
    jest.mocked(AsyncStorage.getItem).mockReturnValueOnce(read.promise);
    let current = true;
    const writeCount = jest.mocked(AsyncStorage.setItem).mock.calls.length;
    const complete = store.markCompleted('account-a', pending.intent, {
      isCurrent: () => current, pendingRevision: pending.recordRevision,
    });
    await flush();
    current = false;
    read.resolve(JSON.stringify(pending));
    expect(await complete).toBeNull();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(writeCount);
    expect(await store.snapshot()).toEqual(pending);
  });

  it('does not confuse a replaced target with a reused revision after clear', async () => {
    const old = await store.prepare({ intent: 'WORKER', returnTarget: { kind: 'NEED', needId: 'old-need' } });
    await store.clear();
    const fresh = await store.prepare({ intent: 'WORKER', returnTarget: { kind: 'NEED', needId: 'new-need' } });
    expect(fresh.recordRevision).toBe(old.recordRevision);
    expect(await store.markCompleted('account-a', old.intent, {
      isCurrent: () => true, pendingRevision: old.recordRevision,
    })).toBeNull();
    expect(await store.snapshot()).toEqual(fresh);
  });

  it('rolls back an in-flight stale completion before the next account prepares a target', async () => {
    const pending = await store.prepare({ intent: 'WORKER' });
    const write = deferred<void>();
    const originalSet = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
    jest.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key, value) => {
      await originalSet(key, value);
      await write.promise;
    });
    let current = true;
    const completion = store.markCompleted('account-a', pending.intent, {
      isCurrent: () => current, pendingRevision: pending.recordRevision,
    });
    await flush();
    current = false;
    const next = store.prepare({ intent: 'REQUESTER', returnTarget: { kind: 'NEED', needId: 'b-need' } });
    write.resolve();
    expect(await completion).toBeNull();
    const newTarget = await next;
    expect(await store.snapshot()).toEqual(newTarget);
    expect(newTarget.intent.returnTarget).toEqual({ kind: 'NEED', needId: 'b-need' });
    expect(newTarget.status).toBe('PENDING');
  });

  it('does not remove a target when its waiting consumer no longer owns the session', async () => {
    await store.markCompleted('account-b', { intent: 'REQUESTER', returnTarget: { kind: 'NEED', needId: 'b-need' } });
    const raw = await AsyncStorage.getItem(AUTH_RETURN_TARGET_KEY);
    const read = deferred<string | null>();
    jest.mocked(AsyncStorage.getItem).mockReturnValueOnce(read.promise);
    let current = true;
    const consume = store.consumeCompleted('account-a', () => current);
    await flush();
    current = false;
    read.resolve(raw);
    expect(await consume).toBeNull();
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    expect((await store.snapshot())?.completedByUserId).toBe('account-b');
  });

  it('restores a consumed record when ownership is lost during removal, allowing the current consumer to recover', async () => {
    const completed = await store.markCompleted('account-a', {
      intent: 'REQUESTER', returnTarget: { kind: 'REQUESTER_DRAFT', draftKey: 'draft-1' },
    });
    const removal = deferred<void>();
    const originalRemove = jest.mocked(AsyncStorage.removeItem).getMockImplementation()!;
    jest.mocked(AsyncStorage.removeItem).mockImplementationOnce(async key => {
      await originalRemove(key);
      await removal.promise;
    });
    let current = true;
    const oldConsumer = store.consumeCompleted('account-a', () => current);
    await flush();
    current = false;
    const currentConsumer = store.consumeCompleted('account-a', () => true);
    removal.resolve();
    expect(await oldConsumer).toBeNull();
    expect(await currentConsumer).toEqual(completed);
    expect(await store.snapshot()).toBeNull();
  });

  it('a failed later prepare cannot preserve the old account target across cleanup retry', async () => {
    await store.prepare({ intent: 'WORKER', returnTarget: { kind: 'NEED', needId: 'a-need' } });
    const cleanup = store.captureSessionCleanup();
    jest.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('remove failed'));
    await expect(cleanup()).rejects.toThrow('remove failed');
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('prepare failed'));
    await expect(store.prepare({ intent: 'WORKER', returnTarget: { kind: 'NEED', needId: 'b-need' } })).rejects.toThrow('prepare failed');
    await cleanup();
    expect(await store.snapshot()).toBeNull();
  });

  it('cleans an earlier prepare even when its storage write finishes after the account boundary', async () => {
    const write = deferred<void>();
    const originalSet = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
    jest.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key, value) => {
      await write.promise;
      await originalSet(key, value);
    });
    const earlier = store.prepare({ intent: 'WORKER', returnTarget: { kind: 'NEED', needId: 'a-need' } });
    const cleanup = store.captureSessionCleanup();
    const reset = cleanup();
    write.resolve();
    await earlier; await reset;
    expect(await store.snapshot()).toBeNull();
  });
});

it('does not persist a guest intent after its account boundary changes during write', async () => {
  const original = await store.prepare({ intent: 'REQUESTER' });
  const write = deferred<void>(); const realSet = jest.mocked(AsyncStorage.setItem).getMockImplementation()!;
  jest.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key, value) => { await realSet(key, value); await write.promise; });
  let current = true;
  const result = store.prepare({ intent: 'WORKER' }, () => current);
  await flush(); current = false; write.resolve();
  expect(await result).toBeNull();
  expect(await store.snapshot()).toEqual(original);
});
it('does not start intent storage for an already stale guest command', async () => {
  expect(await store.prepare({ intent: 'WORKER' }, () => false)).toBeNull();
  expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

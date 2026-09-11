import { ACCOUNT_INTENT_KEY, createAccountIntentPreference } from '../accountIntentPreference';
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (value: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const record = (accountId: string, role: string) => JSON.stringify({ version: 1, accountId, role });
let values: Record<string, string>, storage: { getItem: jest.Mock; setItem: jest.Mock };
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
beforeEach(() => { jest.useFakeTimers(); values = {};
  storage = { getItem: jest.fn(async key => values[key] ?? null),
    setItem: jest.fn(async (key, value) => { values[key] = value; }) }; });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

it('restores the actual account choice in a new runtime without a server role mutation', async () => {
  const first = createAccountIntentPreference(storage); await first.bind('a'); first.select('uskocer'); await flush();
  expect(values[ACCOUNT_INTENT_KEY + 'a']).toBe(record('a', 'uskocer'));
  const restarted = createAccountIntentPreference(storage); await restarted.bind('a');
  expect(restarted.current()).toBe('uskocer');
});
it('logout resets presentation without overwriting the saved preference', async () => {
  const model = createAccountIntentPreference(storage); await model.bind('a'); model.select('uskocer'); await flush();
  await model.bind(null); expect(model.current()).toBe('narucilac'); await flush();
  expect(values[ACCOUNT_INTENT_KEY + 'a']).toBe(record('a', 'uskocer'));
  await model.bind('a'); expect(model.current()).toBe('uskocer');
});
it('keeps two account preferences isolated and refresh binding does not reread', async () => {
  const model = createAccountIntentPreference(storage); await model.bind('a'); model.select('uskocer'); await flush();
  await model.bind('b'); expect(model.current()).toBe('narucilac'); model.select('narucilac'); await flush();
  await model.bind('a'); expect(model.current()).toBe('uskocer');
  const reads = storage.getItem.mock.calls.length; await model.bind('a'); expect(storage.getItem).toHaveBeenCalledTimes(reads);
});
it('an explicit default selection wins against an older delayed worker preference', async () => {
  const held = deferred<string | null>(); storage.getItem.mockReturnValueOnce(held.promise);
  const model = createAccountIntentPreference(storage); const ready = model.bind('a'); await flush();
  model.select('narucilac'); await ready; held.resolve(record('a', 'uskocer')); await flush();
  expect(model.current()).toBe('narucilac');
});
it('rejects an old account incarnation restore even after A to B to A', async () => {
  const held = deferred<string | null>(); storage.getItem.mockReturnValueOnce(held.promise);
  const model = createAccountIntentPreference(storage); void model.bind('a'); await flush();
  await model.bind('b'); await model.bind('a'); held.resolve(record('a', 'uskocer')); await flush();
  expect(model.current()).toBe('narucilac');
});
it.each(['not JSON', '[]', record('b', 'uskocer'), record('a', 'ADMIN'),
  JSON.stringify({ version: 2, accountId: 'a', role: 'uskocer' })])('ignores malformed or foreign preference %s', async raw => {
  storage.getItem.mockResolvedValueOnce(raw); const model = createAccountIntentPreference(storage);
  await model.bind('a'); expect(model.current()).toBe('narucilac');
});
it('bounds a stuck read and never applies its late result', async () => {
  const held = deferred<string | null>(); storage.getItem.mockReturnValueOnce(held.promise);
  const model = createAccountIntentPreference(storage); const ready = model.bind('a'); await flush();
  await jest.advanceTimersByTimeAsync(1500); await ready;
  held.resolve(record('a', 'uskocer')); await flush(); expect(model.current()).toBe('narucilac');
});
it('serializes actual writes so a slow old choice cannot win over a newer choice', async () => {
  const held = deferred<void>(); storage.setItem.mockImplementationOnce(async (key, value) => { await held.promise; values[key] = value; });
  const model = createAccountIntentPreference(storage); await model.bind('a');
  model.select('uskocer'); model.select('narucilac'); await flush();
  expect(storage.setItem).toHaveBeenCalledTimes(1); held.resolve(); await flush();
  expect(storage.setItem).toHaveBeenCalledTimes(2); expect(values[ACCOUNT_INTENT_KEY + 'a']).toBe(record('a', 'narucilac'));
});
it('storage failure keeps the local switch usable and allows the next save', async () => {
  storage.getItem.mockRejectedValueOnce(new Error('private storage detail'));
  const model = createAccountIntentPreference(storage); await model.bind('a');
  storage.setItem.mockRejectedValueOnce(new Error('write unavailable'));
  model.select('uskocer'); await flush(); expect(model.current()).toBe('uskocer');
  model.select('narucilac'); await flush(); expect(values[ACCOUNT_INTENT_KEY + 'a']).toBe(record('a', 'narucilac'));
});
it('a stuck write for A does not block B and emits only changed visible roles', async () => {
  const model = createAccountIntentPreference(storage); await model.bind('a'); const listener = jest.fn(); model.subscribe(listener);
  storage.setItem.mockReturnValueOnce(new Promise(() => {})); model.select('uskocer'); await flush();
  await model.bind('b'); model.select('uskocer'); await flush();
  expect(values[ACCOUNT_INTENT_KEY + 'b']).toBe(record('b', 'uskocer')); expect(listener).toHaveBeenCalledTimes(3);
});

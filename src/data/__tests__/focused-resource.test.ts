import { createFocusedResource } from '../focusedResource';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('focused account reads', () => {
  it('distinguishes an empty result from a failed read and recovers with retry', async () => {
    const load = jest.fn<Promise<string[]>, []>().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
    const model = createFocusedResource(load, () => true);
    model.start(); await flush();
    expect(model.snapshot()).toEqual({ data: null, loading: false, error: true , refreshing: false });
    await model.refresh();
    expect(model.snapshot()).toEqual({ data: [], loading: false, error: false , refreshing: false });
  });
  it('latest retry wins even when the older request finishes last', async () => {
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    const load = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const model = createFocusedResource<string[]>(load, () => true);
    model.start(); const retry = model.refresh();
    second.resolve(['new']); await retry;
    first.resolve(['old']); await flush();
    expect(model.snapshot().data).toEqual(['new']);
  });
  it('does not publish a response or start a retry after account/intent changes', async () => {
    const request = deferred<string[]>();
    let current = true;
    const load = jest.fn(() => request.promise);
    const model = createFocusedResource(load, () => current);
    const listener = jest.fn(); model.subscribe(listener);
    model.start(); current = false; listener.mockClear();
    request.resolve(['private old account']); await flush(); await model.refresh();
    expect(listener).not.toHaveBeenCalled(); expect(load).toHaveBeenCalledTimes(1);
    expect(model.snapshot().data).toBeNull();
  });
  it('invalidates both success and rejection after blur, then rereads on focus', async () => {
    const first = deferred<string[]>();
    const load = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(['current']);
    const model = createFocusedResource<string[]>(load, () => true);
    model.start(); model.stop(); first.reject(new Error('late')); await flush();
    expect(model.snapshot().error).toBe(false);
    model.start(); await flush(); expect(model.snapshot().data).toEqual(['current']);
  });
});


it('keeps what is on screen during a refresh the person asked for, and still retires it on blur', async () => {
  // Pulling a list down used to delete every card, the count and the create button and replace them
  // with skeletons. The authority rule is unchanged: only `stop()` clears, because only a change of
  // account or intent means the previous read is no longer this person's truth.
  let resolve!: (value: string) => void;
  const load = jest.fn()
    .mockResolvedValueOnce('first')
    .mockImplementationOnce(() => new Promise<string>(keep => { resolve = keep; }));
  const resource = createFocusedResource(load, () => true);
  resource.start();
  await flush();
  expect(resource.snapshot()).toEqual({ data: 'first', loading: false, error: false, refreshing: false });

  void resource.refresh(true);
  expect(resource.snapshot()).toEqual({ data: 'first', loading: false, error: false, refreshing: true });

  resolve('second');
  await flush();
  expect(resource.snapshot()).toEqual({ data: 'second', loading: false, error: false, refreshing: false });

  // Leaving the screen retires the read and stops the spinner, and leaves the answer on screen.
  resource.stop();
  expect(resource.snapshot()).toEqual({ data: 'second', loading: false, error: false, refreshing: false });
});

it('clears a successful snapshot when the app leaves the foreground and refuses hidden refreshes', async () => {
  // Android photographs the screen for the recents switcher; that photograph must not be private
  // data. Leaving the app forgets, and the next focus reads it again.
  const load = jest.fn().mockResolvedValue(['private data']);
  const model = createFocusedResource<string[]>(load, () => true);
  model.start(); await flush(); expect(model.snapshot().data).toEqual(['private data']);
  model.forget(); expect(model.snapshot()).toEqual({ data: null, loading: true, error: false , refreshing: false });
  await model.refresh(); expect(load).toHaveBeenCalledTimes(1);
  model.start(); await flush(); expect(load).toHaveBeenCalledTimes(2);
});

it('shows what a screen had when you come back to it, with nothing flashing in between', async () => {
  // Zadaci → Dogovori → Zadaci used to cost two round trips and two screens of skeletons, for data
  // that was seconds old.
  const load = jest.fn().mockResolvedValueOnce(['prvi']).mockResolvedValueOnce(['prvi', 'drugi']);
  const model = createFocusedResource<string[]>(load, () => true);
  model.start(); await flush();
  model.stop();
  model.start();
  expect(model.snapshot()).toEqual({ data: ['prvi'], loading: false, error: false, refreshing: false });
  await flush();
  expect(model.snapshot().data).toEqual(['prvi', 'drugi']);
  expect(load).toHaveBeenCalledTimes(2);
});

it('keeps the screen when a re-read nobody asked for fails, instead of turning it into an error', async () => {
  const load = jest.fn().mockResolvedValueOnce(['prvi']).mockRejectedValueOnce(new Error('offline'));
  const model = createFocusedResource<string[]>(load, () => true);
  model.start(); await flush();
  model.stop(); model.start(); await flush();
  expect(model.snapshot()).toEqual({ data: ['prvi'], loading: false, error: false, refreshing: false });
});

it('loads as if for the first time when the screen has been away long enough', async () => {
  const now = jest.spyOn(Date, 'now');
  const load = jest.fn().mockResolvedValue(['prvi']);
  const model = createFocusedResource<string[]>(load, () => true);
  now.mockReturnValue(1_000_000);
  model.start(); await flush();
  model.stop();
  now.mockReturnValue(1_000_000 + 5 * 60_000 + 1);
  model.start();
  expect(model.snapshot()).toEqual({ data: null, loading: true, error: false, refreshing: false });
  now.mockRestore();
});

it('never shows one account the screen that belonged to another', async () => {
  let current = true;
  const load = jest.fn().mockResolvedValue(['private data']);
  const model = createFocusedResource<string[]>(load, () => current);
  model.start(); await flush(); expect(model.snapshot().data).toEqual(['private data']);
  model.stop();
  current = false;
  model.start();
  expect(model.snapshot()).toEqual({ data: null, loading: true, error: false, refreshing: false });
  expect(load).toHaveBeenCalledTimes(1);
});

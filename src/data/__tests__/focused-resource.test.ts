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
    expect(model.snapshot()).toEqual({ data: null, loading: false, error: true });
    await model.refresh();
    expect(model.snapshot()).toEqual({ data: [], loading: false, error: false });
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


it('clears a successful snapshot when its owner leaves the foreground and refuses hidden refreshes', async () => {
  const load = jest.fn().mockResolvedValue(['private data']);
  const model = createFocusedResource<string[]>(load, () => true);
  model.start(); await flush(); expect(model.snapshot().data).toEqual(['private data']);
  model.stop(); expect(model.snapshot()).toEqual({ data: null, loading: true, error: false });
  await model.refresh(); expect(load).toHaveBeenCalledTimes(1);
  model.start(); await flush(); expect(load).toHaveBeenCalledTimes(2);
});

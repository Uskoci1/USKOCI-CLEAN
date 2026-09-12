/** Conservative allocation only; synthetic transport never calls a provider. */
import { reserveAiTestBudget } from '../../../../supabase/functions/_shared/aiTestBudget';

const input = { supabaseUrl: 'https://synthetic.supabase.co', serviceRoleKey: 'SYNTHETIC_ONLY',
  accountId: '00000001-1111-4111-8111-111111111111', operationId: '00000002-1111-4111-8111-111111111111', kind: 'STT' as const };
const receipt = { admitted: true, reservationId: '00000003-1111-4111-8111-111111111111', replay: false, code: 'AI_TEST_RESERVED' };
const response = () => new Response(JSON.stringify(receipt));
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };

describe('provider budget deadline fences', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => { globalThis.fetch = originalFetch; jest.clearAllTimers(); jest.useRealTimers(); });

  it('does not dispatch with a previously cancelled caller', async () => {
    const controller = new AbortController(); controller.abort();
    globalThis.fetch = jest.fn();
    await expect(reserveAiTestBudget({ ...input, signal: controller.signal })).rejects.toThrow('AI_TEST_BUDGET_UNAVAILABLE');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects a successful response arriving after the deadline even if transport ignores abort', async () => {
    const transport = deferred<Response>();
    globalThis.fetch = jest.fn(() => transport.promise);
    const pending = reserveAiTestBudget(input);
    const assertion = expect(pending).rejects.toThrow('AI_TEST_BUDGET_UNAVAILABLE');
    jest.advanceTimersByTime(5001); transport.resolve(response());
    await assertion;
    expect((globalThis.fetch as jest.Mock).mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('rejects a late body after headers arrived within the deadline', async () => {
    const body = deferred<ReadableStreamReadResult<Uint8Array>>();
    const cancel = jest.fn(async () => undefined);
    globalThis.fetch = jest.fn(async () => ({ ok: true, body: { getReader: () => ({ read: () => body.promise, cancel }) } } as unknown as Response));
    const pending = reserveAiTestBudget(input);
    const assertion = expect(pending).rejects.toThrow('AI_TEST_BUDGET_UNAVAILABLE');
    await Promise.resolve(); jest.advanceTimersByTime(5001);
    body.resolve({ done: false, value: new TextEncoder().encode(JSON.stringify(receipt)) });
    await assertion; expect(cancel).toHaveBeenCalled();
  });

  it('rejects caller cancellation while a noncompliant body transport is pending', async () => {
    const body = deferred<ReadableStreamReadResult<Uint8Array>>(), controller = new AbortController();
    globalThis.fetch = jest.fn(async () => ({ ok: true, body: { getReader: () => ({ read: () => body.promise, cancel: async () => undefined }) } } as unknown as Response));
    const pending = reserveAiTestBudget({ ...input, signal: controller.signal });
    const assertion = expect(pending).rejects.toThrow('AI_TEST_BUDGET_UNAVAILABLE');
    await Promise.resolve(); controller.abort(); body.resolve({ done: true, value: undefined });
    await assertion;
  });

  it('returns an on-time validated reservation and releases its transport signal', async () => {
    globalThis.fetch = jest.fn(async () => response());
    await expect(reserveAiTestBudget(input)).resolves.toEqual(receipt);
    expect((globalThis.fetch as jest.Mock).mock.calls[0][1].signal.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});

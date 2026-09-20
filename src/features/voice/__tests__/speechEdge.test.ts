/** Actual deployed entrypoint with synthetic Auth/PostgREST/WebSocket, no live calls. */
type Handler = (request: Request) => Promise<Response>;
const id = (n: number) => `${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
const account = id(1), conversation = id(2), operation = id(3), reservation = id(4);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

class FakeSocket {
  readyState = 1; bufferedAmount = 0;
  onopen: unknown = null; onmessage: unknown = null; onerror: unknown = null; onclose: unknown = null;
  send = jest.fn(); close = jest.fn();
  constructor(public url = '') {}
}

describe('speech Edge authenticated budget admission', () => {
  const originalFetch = globalThis.fetch, originalWebSocket = globalThis.WebSocket;
  const originalDeno = (globalThis as any).Deno;
  const originalEdgeRuntime = (globalThis as any).EdgeRuntime;
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    globalThis.fetch = originalFetch; globalThis.WebSocket = originalWebSocket; (globalThis as any).Deno = originalDeno;
    (globalThis as any).EdgeRuntime = originalEdgeRuntime;
    jest.clearAllTimers(); jest.useRealTimers();
  });
  function fixture(options: { paid?: string; controlledSpeech?: string; auth?: number; owner?: string; purpose?: string; budget?: object; worker?: object; workerStatus?: number } = {}) {
    let handler!: Handler;
    const calls: string[] = [], providerSockets: FakeSocket[] = [];
    const env: Record<string,string> = { SUPABASE_URL: 'https://owned.supabase.co', SUPABASE_ANON_KEY: 'SYNTHETIC_PUBLIC',
      SUPABASE_SERVICE_ROLE_KEY: 'SYNTHETIC_SERVICE', GEMINI_API_KEY: 'SYNTHETIC_GOOGLE_KEY',
      USKOCI_GEMINI_PAID_TEST_ENABLED: options.paid ?? 'true', USKOCI_SPEECH_CONTROLLED_TEST_ENABLED: options.controlledSpeech ?? 'true' };
    globalThis.fetch = jest.fn(async (input, init) => {
      const url = String(input); calls.push(url);
      if (url.endsWith('/auth/v1/user')) return json({ id: account }, options.auth ?? 200);
      if (url.includes('/ai_conversations?')) return json([{ id: conversation, account_id: options.owner ?? account, status: 'OPEN', purpose: options.purpose ?? 'NEED_INTAKE' }]);
      if (url.endsWith('/rpc_read_worker_ai_context_service')) {
        expect(JSON.parse(init!.body as string)).toEqual({ p_account_id: account, p_conversation_id: conversation });
        return json(options.worker ?? { schemaVersion: 'WORKER_PROFILE_V1', accountId: account, conversationId: conversation,
          status: 'OPEN', stale: false, safety: 'ALLOW' }, options.workerStatus ?? 200);
      }
      if (url.endsWith('/rpc_ai_test_budget_reserve_service')) {
        expect(JSON.parse(init!.body as string)).toEqual({ p_account_id: account, p_operation_id: operation, p_kind: 'STT', p_max_cost_microusd: 200000 });
        return json(options.budget ?? { admitted: true, reservationId: reservation, replay: false, code: 'AI_TEST_RESERVED' });
      }
      throw new Error('Unexpected synthetic route');
    });
    globalThis.WebSocket = class extends FakeSocket { constructor(url: string) { super(url); providerSockets.push(this); } } as unknown as typeof WebSocket;
    const upgrade = jest.fn(() => ({ socket: new FakeSocket(), response: new Response('SYNTHETIC_UPGRADE') }));
    const waitUntil = jest.fn();
    (globalThis as any).EdgeRuntime = { waitUntil };
    (globalThis as any).Deno = { env: { get: (name: string) => env[name] }, serve: (next: Handler) => { handler = next; }, upgradeWebSocket: upgrade };
    jest.isolateModules(() => { require('../../../../supabase/functions/uskoci-speech-session/index'); });
    const invoke = (patch: { auth?: string; query?: string; method?: string } = {}) => handler(new Request(
      `https://owned.supabase.co/functions/v1/uskoci-speech-session?${patch.query ?? `conversationId=${conversation}&operationId=${operation}`}`,
      { method: patch.method ?? 'GET', headers: { Upgrade: 'websocket', Authorization: patch.auth ?? 'Bearer SYNTHETIC_USER' } }));
    return { calls, providerSockets, upgrade, invoke, waitUntil };
  }

  it('authenticates ownership then reserves before creating exactly one provider connection', async () => {
    const h = fixture(); const response = await h.invoke(); expect(response.status).toBe(200);
    expect(h.calls).toHaveLength(3); expect(h.calls[0]).toMatch(/auth\/v1\/user$/);
    expect(h.calls[2]).toMatch(/rpc_ai_test_budget_reserve_service$/);
    expect(h.providerSockets).toHaveLength(1);
    const providerUrl = new URL(h.providerSockets[0].url);
    expect(providerUrl.origin).toBe('wss://generativelanguage.googleapis.com');
    expect(providerUrl.pathname).toBe('/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent');
    expect(providerUrl.username).toBe(''); expect(providerUrl.password).toBe('');
    expect(await response.text()).not.toContain('SYNTHETIC_GOOGLE_KEY');
  });

  it('retains the Edge worker after the HTTP upgrade until the client actually closes', async () => {
    const h = fixture(); await h.invoke();
    expect(h.waitUntil).toHaveBeenCalledTimes(1);
    let settled = false;
    const lifetime = h.waitUntil.mock.calls[0][0] as Promise<void>;
    void lifetime.then(() => { settled = true; });
    await Promise.resolve(); expect(settled).toBe(false);
    const socket = h.upgrade.mock.results[0].value.socket;
    (socket.onclose as (event: CloseEvent) => void)({} as CloseEvent);
    await lifetime; expect(settled).toBe(true);
    expect(h.providerSockets[0].close).toHaveBeenCalled();
  });

  it('serves approved owned PROFILE contexts without granting a profile writer', async () => {
    const h = fixture({ purpose: 'PROFILE' }); expect((await h.invoke()).status).toBe(200);
    expect(h.calls.filter(url => url.includes('/rpc_'))).toHaveLength(2);
    expect(h.calls.findIndex(url => url.endsWith('/rpc_read_worker_ai_context_service'))).toBeLessThan(h.calls.findIndex(url => url.endsWith('/rpc_ai_test_budget_reserve_service')));
  });

  it.each([{ auth: '' }, { auth: 'Bearer token extra' }, { query: `conversationId=${conversation}&operationId=${operation}&model=evil` }])('rejects malformed request without provider spending %j', async patch => {
    const h = fixture(); expect((await h.invoke(patch)).status).toBeGreaterThanOrEqual(400);
    expect(h.calls).toHaveLength(0); expect(h.providerSockets).toHaveLength(0);
  });

  it.each([{ auth: 401 }, { owner: id(9) }, { purpose: 'APPLICATION' }, { paid: 'false' }, { controlledSpeech: 'false' }])('rejects auth/ownership/config boundary %j', async options => {
    const h = fixture(options); expect((await h.invoke()).status).toBeGreaterThanOrEqual(400);
    expect(h.calls.some(url => url.endsWith('/rpc_ai_test_budget_reserve_service'))).toBe(false);
    expect(h.providerSockets).toHaveLength(0); expect(h.upgrade).not.toHaveBeenCalled();
  });

  it.each([{ workerStatus: 404 }, { worker: { schemaVersion: 'NEED_V2' } },
    ...[{ stale: true }, { safety: 'BLOCK' }, { safety: 'REVIEW' }, { accountId: id(9) }, { conversationId: id(9) }]
      .map(patch => ({ worker: { schemaVersion: 'WORKER_PROFILE_V1', accountId: account, conversationId: conversation,
        status: 'OPEN', stale: false, safety: 'ALLOW', ...patch } }))])('rejects a generic/stale/unsafe/unowned PROFILE before spending %j', async options => {
    const h = fixture({ purpose: 'PROFILE', ...options });
    expect((await h.invoke()).status).toBeGreaterThanOrEqual(400);
    expect(h.calls.some(url => url.endsWith('/rpc_ai_test_budget_reserve_service'))).toBe(false);
    expect(h.providerSockets).toHaveLength(0);
  });

  it('discards late Auth transport success without reserving or opening Google', async () => {
    const h = fixture();
    let complete!: (response: Response) => void;
    globalThis.fetch = jest.fn(() => new Promise<Response>(resolve => { complete = resolve; }));
    const pending = h.invoke();
    jest.advanceTimersByTime(5001); complete(json({ id: account }));
    expect((await pending).status).toBe(503);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1); expect(h.providerSockets).toHaveLength(0);
  });

  it.each(['AI_TEST_OPERATION_REPLAY', 'AI_TEST_BUDGET_NOT_READY', 'AI_TEST_ACCOUNT_NOT_ADMITTED', 'AI_TEST_BUDGET_EXHAUSTED'])('never spends after %s', async code => {
    const h = fixture({ budget: { admitted: false, reservationId: code === 'AI_TEST_OPERATION_REPLAY' ? reservation : null,
      replay: code === 'AI_TEST_OPERATION_REPLAY', code } });
    const response = await h.invoke(); expect(response.status).toBe(409); expect(await response.json()).toEqual({ code });
    expect(h.providerSockets).toHaveLength(0); expect(h.upgrade).not.toHaveBeenCalled();
  });
});

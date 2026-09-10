// Actual TypeScript Edge handler; every env/fetch value is synthetic.
// This verifies the adapter and auth transport, not a live geocoder or deployment.
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const entry = resolve(root, 'supabase/functions/uskoci-location-search/index.ts');
const source = ts.transpileModule(readFileSync(entry, 'utf8'), {
  fileName: entry, reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
assert.deepEqual(source.diagnostics?.filter(item => item.category === ts.DiagnosticCategory.Error), []);
const userId = '11111111-1111-4111-8111-111111111111';
const defaultMarket = { countryCode: 'RS', productStatus: 'BUILDING', defaultCurrencyCode: 'RSD', defaultLanguageTag: 'sr-Latn-RS', defaultTimezone: 'Europe/Belgrade' };
const defaultPlace = { place_id: 123456, display_name: 'SYNTHETIC_PRIVATE_PLACE', lat: '44.123456', lon: '20.654321', address: { country_code: 'rs' },
  licence: 'PROVIDER_PRIVATE_EXTRA', osm_type: 'node', boundingbox: ['PRIVATE_BOUNDING_BOX'] };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
function fixture(options = {}) {
  const calls = [], logs = [], envReads = [], timers = new Map();
  const env = { SUPABASE_URL: 'https://database.test.invalid', SUPABASE_ANON_KEY: 'SYNTHETIC_ANON_KEY',
    SUPABASE_SERVICE_ROLE_KEY: 'SYNTHETIC_SERVICE_KEY_MUST_NEVER_BE_READ',
    GEOCODER_ENDPOINT: 'https://geocoder.test.invalid/nominatim/search', GEOCODER_PROVIDER_HINT: 'synthetic-provider',
    GEOCODER_USER_AGENT: 'USKOCI-Synthetic/1 (test.invalid)', GEOCODER_BEARER_TOKEN: 'SYNTHETIC_PROVIDER_SECRET', ...options.env };
  let handler, timerId = 0;
  const context = vm.createContext({ exports: {}, Request, Response, Headers, URL, URLSearchParams, TextDecoder, AbortController, Intl,
    setTimeout: (fn, ms) => { assert.equal(ms, 7000); const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    console: { log: (...args) => logs.push(args), error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
    Deno: { env: { get: key => { envReads.push(key); return env[key]; } }, serve: fn => { handler = fn; } },
    fetch: async (url, init = {}) => {
      const path = new URL(url).pathname;
      const kind = path === '/auth/v1/user' ? 'auth' : path === '/rest/v1/rpc/rpc_list_location_markets' ? 'markets' : path === '/nominatim/search' ? 'provider' : null;
      assert.ok(kind, 'unexpected route: no writer or provider fallback is allowed');
      calls.push({ kind, url: String(url), ...init, headers: Object.fromEntries(new Headers(init.headers)) });
      if (options[kind]) return options[kind](calls.at(-1));
      if (kind === 'auth') return json({ id: userId, role: 'authenticated', email: 'PRIVATE_USER_EMAIL', user_metadata: { private: 'PRIVATE_USER_METADATA' } });
      if (kind === 'markets') return json('marketRows' in options ? options.marketRows : [defaultMarket]);
      return json('places' in options ? options.places : [defaultPlace]);
    },
  });
  new vm.Script(source.outputText, { filename: entry }).runInContext(context);
  assert.equal(typeof handler, 'function');
  const invoke = (overrides = {}) => {
    const { body = { text: '  SYNTHETIC_PRIVATE_QUERY &countrycodes=xx  ', countryCode: 'RS' }, ...requestOverrides } = overrides;
    const request = new Request('https://edge.test.invalid/uskoci-location-search', { method: 'POST',
      headers: { Authorization: 'Bearer SYNTHETIC_USER_SESSION', 'Content-Type': 'application/json' },
      body: typeof body === 'string' || body instanceof ReadableStream ? body : JSON.stringify(body), ...requestOverrides });
    return handler(request);
  };
  return { calls, logs, envReads, timers, invoke, expire: () => { for (const fn of timers.values()) fn(); },
    handle: request => handler(request) };
}
async function assertRejected(f, status, code, request) {
  const response = await f.invoke(request);
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { code });
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(f.logs, []);
  assert.equal(f.timers.size, 0);
  return response;
}
const providerCalls = f => f.calls.filter(call => call.kind === 'provider');
async function reached(f, kind) {
  for (let i = 0; i < 100 && !f.calls.some(call => call.kind === kind); i++) await Promise.resolve();
  assert.ok(f.calls.some(call => call.kind === kind), `did not reach ${kind}`);
}

test('authenticated Nominatim GET emits only the client envelope, with separated credentials and no writes', async () => {
  const f = fixture(), result = await f.invoke();
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.deepEqual(body, { candidates: [{ label: defaultPlace.display_name, countryCode: 'RS',
    position: { latitude: 44.123456, longitude: 20.654321 }, providerHint: 'synthetic-provider', candidateId: '123456' }] });
  assert.deepEqual(f.calls.map(call => call.kind), ['auth', 'markets', 'provider']);
  for (const call of f.calls.slice(0, 2)) {
    assert.equal(call.headers.authorization, 'Bearer SYNTHETIC_USER_SESSION');
    assert.equal(call.headers.apikey, 'SYNTHETIC_ANON_KEY');
    assert.ok(!JSON.stringify(call).includes('SYNTHETIC_PRIVATE_QUERY'));
    assert.ok(!JSON.stringify(call).includes('SYNTHETIC_PROVIDER_SECRET'));
  }
  assert.equal(f.calls[0].method, 'GET'); assert.equal(f.calls[1].method, 'POST'); assert.equal(f.calls[1].body, '{}');
  const provider = providerCalls(f)[0];
  assert.equal(provider.method, 'GET'); assert.equal(provider.body, undefined);
  assert.deepEqual(Object.fromEntries(new URL(provider.url).searchParams), { format: 'jsonv2', addressdetails: '1', countrycodes: 'rs', limit: '10', q: 'SYNTHETIC_PRIVATE_QUERY &countrycodes=xx' });
  assert.deepEqual(provider.headers, { accept: 'application/json', authorization: 'Bearer SYNTHETIC_PROVIDER_SECRET', 'user-agent': 'USKOCI-Synthetic/1 (test.invalid)' });
  for (const call of f.calls) {
    assert.equal(call.redirect, 'error'); assert.equal(call.cache, 'no-store'); assert.equal(call.credentials, 'omit');
    assert.equal(call.referrerPolicy, 'no-referrer'); assert.ok(call.signal instanceof AbortSignal);
  }
  for (const marker of ['SYNTHETIC_USER_SESSION', 'SYNTHETIC_ANON_KEY', 'PRIVATE_USER_', 'PROVIDER_PRIVATE_EXTRA', 'PRIVATE_BOUNDING_BOX', 'SYNTHETIC_PROVIDER_SECRET']) assert.ok(!JSON.stringify(body).includes(marker));
  assert.ok(!f.envReads.includes('SUPABASE_SERVICE_ROLE_KEY'));
  assert.deepEqual(f.logs, []); assert.equal(f.timers.size, 0);
});

test('preflight is anonymous; unsupported methods and missing/malformed bearer never fetch', async () => {
  const f = fixture();
  assert.equal((await f.handle(new Request('https://edge.test.invalid', { method: 'OPTIONS' }))).status, 200);
  assert.equal((await f.handle(new Request('https://edge.test.invalid', { method: 'GET' }))).status, 405);
  for (const authorization of ['', 'Basic synthetic', 'Bearer ', 'Bearer two tokens']) {
    await assertRejected(f, 401, 'AUTH_REQUIRED', { headers: { Authorization: authorization, 'Content-Type': 'application/json' } });
  }
  assert.deepEqual(f.calls, []);
});

test('required input, exact keys, country and Unicode limits reject before any transport', async () => {
  const invalid = [null, [], {}, { text: 'x' }, { countryCode: 'RS' }, { text: '', countryCode: 'RS' },
    { text: 'x', countryCode: 'rs' }, { text: 'x', countryCode: 'RS,GB' }, { text: 'x\n', countryCode: 'RS' },
    { text: '😀'.repeat(1001), countryCode: 'RS' },
    { text: 'x', countryCode: 'RS', endpoint: 'https://attacker.test.invalid/search' },
    { text: 'x', countryCode: 'RS', accountId: userId }, { text: 'x', countryCode: 'RS', scopeKey: 'PRIVATE_SCOPE' }];
  for (const body of invalid) {
    const f = fixture(); await assertRejected(f, 400, 'INVALID_QUERY', { body }); assert.deepEqual(f.calls, []);
  }
  const f = fixture(); await assertRejected(f, 400, 'INVALID_QUERY', { body: '{broken' }); assert.deepEqual(f.calls, []);
  await assertRejected(f, 400, 'INVALID_QUERY', { headers: { Authorization: 'Bearer SYNTHETIC_USER_SESSION', 'Content-Type': 'text/plain' } });
});

test('1000 Unicode characters and actual numeric zero coordinates remain valid without invented coordinates', async () => {
  const f = fixture({ places: [{ ...defaultPlace, lat: '0', lon: '-0', place_id: '9007199254740993123' }] });
  const result = await f.invoke({ body: { text: '😀'.repeat(1000), countryCode: 'RS' } });
  assert.equal(result.status, 200);
  const [candidate] = (await result.json()).candidates;
  assert.deepEqual(candidate.position, { latitude: 0, longitude: 0 });
  assert.equal(candidate.candidateId, '9007199254740993123');
});

test('expired tokens, service/anon identities and missing users cannot call markets or a geocoder', async () => {
  for (const auth of [() => json({ error: 'PRIVATE_AUTH_BODY' }, 401), () => json({ error: 'PRIVATE_AUTH_BODY' }, 403),
    () => json({ id: userId, role: 'service_role' }), () => json({ id: userId, role: 'anon' }), () => json({}), () => json({ id: 'bad', role: 'authenticated' })]) {
    const f = fixture({ auth }); await assertRejected(f, 401, 'AUTH_REQUIRED'); assert.deepEqual(f.calls.map(call => call.kind), ['auth']);
  }
});

test('Auth outages and malformed responses fail closed without private error leakage', async () => {
  for (const auth of [() => json({ secret: 'PRIVATE_AUTH_BODY' }, 500), () => new Response('PRIVATE_AUTH_BODY'),
    () => { throw new Error('PRIVATE_AUTH_BODY SYNTHETIC_USER_SESSION'); }]) {
    const f = fixture({ auth }); await assertRejected(f, 502, 'UNAVAILABLE'); assert.equal(f.calls.length, 1);
  }
});

test('missing Supabase configuration makes no network call', async () => {
  const f = fixture({ env: { SUPABASE_ANON_KEY: undefined } });
  await assertRejected(f, 503, 'SERVER_CONFIG_ERROR'); assert.deepEqual(f.calls, []);
});

test('registered BUILDING and LIVE are queryable, unknown/WAITLIST/COMING countries are not', async () => {
  for (const productStatus of ['BUILDING', 'LIVE']) {
    const f = fixture({ marketRows: [{ ...defaultMarket, productStatus }], places: [] });
    assert.equal((await f.invoke()).status, 200); assert.equal(providerCalls(f).length, 1);
  }
  for (const marketRows of [[], [{ ...defaultMarket, countryCode: 'GB' }], ...['WAITLIST', 'COMING'].map(productStatus => [{ ...defaultMarket, productStatus }])]) {
    const f = fixture({ marketRows }); await assertRejected(f, 403, 'COUNTRY_NOT_AVAILABLE'); assert.equal(providerCalls(f).length, 0);
  }
});

test('market RPC auth denial, error or corrupt authority never falls back to RS or cached authorization', async () => {
  for (const status of [401, 403]) {
    const f = fixture({ markets: () => json({ private: 'PRIVATE_RPC_BODY' }, status) });
    await assertRejected(f, 401, 'AUTH_REQUIRED'); assert.equal(providerCalls(f).length, 0);
  }
  for (const marketRows of [null, {}, [defaultMarket, defaultMarket], [{ ...defaultMarket, productStatus: 'ALLOW' }],
    [{ ...defaultMarket, defaultTimezone: 'invalid/timezone' }], [{ ...defaultMarket, countryCode: 'rs' }], [{ ...defaultMarket, extra: true }],
    [{ countryCode: 'RS', productStatus: 'BUILDING' }]]) {
    const f = fixture({ marketRows }); await assertRejected(f, 502, 'UNAVAILABLE'); assert.equal(providerCalls(f).length, 0);
  }
  let authCalls = 0;
  const f = fixture({ auth: () => ++authCalls === 1 ? json({ id: userId, role: 'authenticated' }) : json({}, 401) });
  assert.equal((await f.invoke()).status, 200); await assertRejected(f, 401, 'AUTH_REQUIRED'); assert.equal(providerCalls(f).length, 1);
});

test('absent/invalid provider configuration remains explicitly blocked, with no fallback', async () => {
  const endpoints = [undefined, 'http://geocoder.test.invalid/search', 'https://nominatim.openstreetmap.org/search',
    'https://NOMINATIM.OPENSTREETMAP.ORG./search', 'https://sub.nominatim.openstreetmap.org/search',
    'https://127.0.0.1/search', 'https://2130706433/search', 'https://[::1]/search', 'https://10.0.0.1/search',
    'https://localhost/search', 'https://geocoder.local/search', 'https://geocoder.internal/search',
    'https://secret@geocoder.test.invalid/search', 'https://geocoder.test.invalid/search?q=secret',
    'https://geocoder.test.invalid/search#secret', 'https://geocoder.test.invalid/reverse'];
  for (const GEOCODER_ENDPOINT of endpoints) {
    const f = fixture({ env: { GEOCODER_ENDPOINT } }); await assertRejected(f, 503, 'PROVIDER_ACTIVATION_BLOCKED'); assert.equal(providerCalls(f).length, 0);
  }
  for (const env of [{ GEOCODER_PROVIDER_HINT: undefined }, { GEOCODER_PROVIDER_HINT: 'bad hint' },
    { GEOCODER_USER_AGENT: undefined }, { GEOCODER_USER_AGENT: 'bad\nagent' }, { GEOCODER_BEARER_TOKEN: '' }, { GEOCODER_BEARER_TOKEN: 'bad token' }]) {
    const f = fixture({ env }); await assertRejected(f, 503, 'PROVIDER_ACTIVATION_BLOCKED'); assert.equal(providerCalls(f).length, 0);
  }
});

test('optional provider credential does not default to a Supabase or caller token', async () => {
  const f = fixture({ env: { GEOCODER_BEARER_TOKEN: undefined }, places: [] });
  const result = await f.invoke(); assert.equal(result.status, 200); assert.deepEqual(await result.json(), { candidates: [] });
  assert.equal(providerCalls(f)[0].headers.authorization, undefined);
});

test('corrupt JSONv2 results reject the entire response, including a preceding valid candidate', async () => {
  const corrupt = [{ lat: undefined }, { lat: 44 }, { lon: null }, { lat: '' }, { lat: ' 44 ' }, { lat: '0x10' },
    { lat: '1e2' }, { lat: 'NaN' }, { lat: 'Infinity' }, { lat: '90.000001' }, { lon: '-180.000001' },
    { display_name: '' }, { display_name: 'bad\nlabel' }, { display_name: '😀'.repeat(1001) },
    { address: {} }, { address: { country_code: 'RS' } }, { address: { country_code: 'gb' } },
    { place_id: undefined }, { place_id: '001' }, { place_id: 0 }, { place_id: 9007199254740992 }, { place_id: 'x' }];
  for (const change of corrupt) {
    const f = fixture({ places: [defaultPlace, { ...defaultPlace, place_id: 2, ...change }] });
    await assertRejected(f, 502, 'UNAVAILABLE'); assert.equal(providerCalls(f).length, 1);
  }
  for (const places of [{ candidates: [] }, null, [defaultPlace, defaultPlace], Array.from({ length: 11 }, (_, i) => ({ ...defaultPlace, place_id: i + 1 }))]) {
    const f = fixture({ places }); await assertRejected(f, 502, 'UNAVAILABLE');
  }
});

test('upstream errors, redirects and non-JSON payloads are sanitized without retry', async () => {
  for (const provider of [() => json({ private: 'PRIVATE_PROVIDER_BODY' }, 429), () => json({}, 500),
    () => new Response('PRIVATE_PROVIDER_BODY SYNTHETIC_PROVIDER_SECRET'),
    () => { throw new Error('PRIVATE_PROVIDER_BODY SYNTHETIC_PRIVATE_QUERY'); },
    () => { const result = json([defaultPlace]); Object.defineProperty(result, 'redirected', { value: true }); return result; }]) {
    const f = fixture({ provider }); await assertRejected(f, 502, 'UNAVAILABLE'); assert.equal(providerCalls(f).length, 1);
  }
});

test('declared and streamed body byte limits reject without trusting Content-Length', async () => {
  const f = fixture();
  await assertRejected(f, 400, 'INVALID_QUERY', { body: ' '.repeat(8193) }); assert.equal(f.calls.length, 0);
  await assertRejected(f, 400, 'INVALID_QUERY', { headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json', 'Content-Length': '999999' } });
  for (const kind of ['auth', 'markets', 'provider']) for (const declared of [true, false]) {
    const g = fixture({ [kind]: () => new Response(' '.repeat(declared ? 1 : 131073), { headers: declared ? { 'Content-Length': '131073' } : {} }) });
    await assertRejected(g, 502, 'UNAVAILABLE');
    assert.equal(g.calls.at(-1).kind, kind);
  }
});

test('one bounded deadline covers Auth, market and provider transports even if fetch ignores abort', async () => {
  for (const kind of ['auth', 'markets', 'provider']) {
    let release;
    const f = fixture({ [kind]: () => new Promise(resolve => { release = resolve; }) });
    const pending = f.invoke(); await reached(f, kind); f.expire();
    const result = await pending; assert.equal(result.status, 504); assert.deepEqual(await result.json(), { code: 'UNAVAILABLE' });
    const callCount = f.calls.length; release(json(kind === 'auth' ? { id: userId, role: 'authenticated' } : kind === 'markets' ? [defaultMarket] : [defaultPlace]));
    for (let i = 0; i < 10; i++) await Promise.resolve();
    assert.equal(f.calls.length, callCount); assert.deepEqual(f.logs, []); assert.equal(f.timers.size, 0);
  }
});

test('deadline interrupts response body streaming, and caller cancellation cancels the provider request', async () => {
  let bodyCancelled = false;
  const f = fixture({ provider: () => new Response(new ReadableStream({ pull() {}, cancel() { bodyCancelled = true; } })) });
  const pending = f.invoke(); await reached(f, 'provider');
  for (let i = 0; i < 10; i++) await Promise.resolve();
  f.expire(); assert.equal((await pending).status, 504); assert.equal(bodyCancelled, true);
  const controller = new AbortController(), g = fixture({ provider: () => new Promise(() => {}) });
  const cancelled = g.invoke({ signal: controller.signal }); await reached(g, 'provider'); controller.abort();
  const result = await cancelled; assert.equal(result.status, 499); assert.deepEqual(await result.json(), { code: 'CANCELLED' });
  assert.equal(providerCalls(g)[0].signal.aborted, true); assert.deepEqual(g.logs, []); assert.equal(g.timers.size, 0);
});

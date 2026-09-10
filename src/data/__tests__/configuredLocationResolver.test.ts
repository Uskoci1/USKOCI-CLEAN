import { createConfiguredLocationResolver, type ConfiguredLocationResolverConfig, type LocationResolverFetch } from '../configuredLocationResolver';

// Synthetic transport only: these tests make no geocoder/provider request.
const config = { endpoint: 'https://approved-proxy.test.invalid/functions/v1/location-candidates', providerHint: 'approved-geocoder' };
const input = { text: ' Synthetic submitted address 12 ', countryCode: ' rs ', scopeKey: 'account-incarnation-A/start/input-1' };
const candidate = { label: 'Synthetic candidate label', countryCode: 'RS', position: { latitude: 44.123456, longitude: 20.654321 },
  providerHint: config.providerHint, candidateId: 'synthetic-place-1' };
const response = (body: unknown = { candidates: [candidate] }, ok = true, redirected = false) => ({ ok, redirected, json: async () => body });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

it('preserves a 429 limit without reading provider error text or retrying', async () => {
  const json = jest.fn(), fetcher = jest.fn().mockResolvedValue({ ok: false, status: 429, redirected: false, json });
  await expect(createConfiguredLocationResolver(config, fetcher).search(input)).resolves.toEqual({ status: 'RATE_LIMITED' });
  expect(json).not.toHaveBeenCalled();expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([undefined, { ...config, endpoint: '' }, { ...config, endpoint: 'http://approved-proxy.test.invalid/search' },
  { ...config, endpoint: 'https://token:secret@approved-proxy.test.invalid/search' },
  { ...config, endpoint: 'https://approved-proxy.test.invalid/search?key=secret' },
  { ...config, endpoint: 'https://approved-proxy.test.invalid/search#secret' },
  { ...config, endpoint: 'https://nominatim.openstreetmap.org/search' }, { ...config, providerHint: 'provider secret' },
])('keeps missing/unsafe provider configuration blocked without network: %p', async settings => {
  const fetcher = jest.fn();
  await expect(createConfiguredLocationResolver(settings, fetcher).search(input)).resolves.toEqual({ status: 'PROVIDER_ACTIVATION_BLOCKED' });
  expect(fetcher).not.toHaveBeenCalled();
});

it('sends only the submitted text and normalized country to the approved proxy, then returns unconfirmed candidates', async () => {
  const fetcher = jest.fn().mockResolvedValue(response());
  const result = await createConfiguredLocationResolver(config, fetcher).search(input);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe(config.endpoint);
  expect(init).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer' });
  expect(init.signal).toBeInstanceOf(AbortSignal);
  expect(init.headers).toEqual({ 'Content-Type': 'application/json', Accept: 'application/json' });
  expect(JSON.parse(init.body)).toEqual({ countryCode: 'RS', text: input.text.trim() });
  expect(JSON.stringify(init)).not.toContain(input.scopeKey);
  expect(result).toEqual({ status: 'PROPOSALS', requiresConfirmation: true, candidates: [{
    label: candidate.label, countryCode: 'RS', position: candidate.position,
    origin: { kind: 'PROVIDER_CANDIDATE', providerHint: config.providerHint, candidateHint: candidate.candidateId },
  }] });
  expect(JSON.stringify(result)).not.toContain(input.text.trim());
  expect(JSON.stringify(result)).not.toMatch(/exactAddress|publicPlace|confirmed":true/);
});

it.each([null, undefined])('preserves an absent provider ID as null, without deriving it from the address: %p', async candidateId => {
  const fetcher = jest.fn().mockResolvedValue(response({ candidates: [{ ...candidate, candidateId }] }));
  await expect(createConfiguredLocationResolver(config, fetcher).search(input)).resolves.toMatchObject({
    status: 'PROPOSALS', candidates: [{ origin: { candidateHint: null } }],
  });
});

it('preserves an empty result and actual zero coordinates without inserting a default pin', async () => {
  const fetcher = jest.fn().mockResolvedValueOnce(response({ candidates: [] }))
    .mockResolvedValueOnce(response({ candidates: [{ ...candidate, position: { latitude: 0, longitude: 0 } }] }));
  const resolver = createConfiguredLocationResolver(config, fetcher);
  await expect(resolver.search(input)).resolves.toEqual({ status: 'PROPOSALS', candidates: [], requiresConfirmation: true });
  await expect(resolver.search(input)).resolves.toMatchObject({ status: 'PROPOSALS', candidates: [{ position: { latitude: 0, longitude: 0 } }] });
});

it.each([null, {}, { ...input, text: '' }, { ...input, text: 'a'.repeat(1001) }, { ...input, text: 'private\u0000address' },
  { ...input, countryCode: '' }, { ...input, countryCode: 'Serbia' }, { ...input, scopeKey: '' },
  { ...input, accessNotes: 'PRIVATE_ACCESS_NOTES' }, { ...input, accountId: 'ACCOUNT_MUST_NOT_BE_SENT' },
])('rejects incomplete queries or extra private metadata before transport: %p', async raw => {
  const fetcher = jest.fn();
  await expect(createConfiguredLocationResolver(config, fetcher).search(raw)).resolves.toEqual({ status: 'INVALID_QUERY' });
  expect(fetcher).not.toHaveBeenCalled();
});

it.each([
  { ...candidate, countryCode: 'BA' }, { ...candidate, countryCode: 'rs' }, { ...candidate, providerHint: 'different-provider' },
  { ...candidate, providerHint: undefined }, { ...candidate, candidateId: 123 }, { ...candidate, candidateId: '' },
  { ...candidate, candidateId: 'a'.repeat(161) }, { ...candidate, label: '' }, { ...candidate, label: null },
  { ...candidate, position: { latitude: '44.123456', longitude: 20 } },
  { ...candidate, position: { latitude: NaN, longitude: 20 } }, { ...candidate, position: { latitude: Infinity, longitude: 20 } },
  { ...candidate, position: { latitude: 90.000001, longitude: 20 } }, { ...candidate, position: { latitude: -90.000001, longitude: 20 } },
  { ...candidate, position: { latitude: 44, longitude: 180.000001 } }, { ...candidate, position: { latitude: 44, longitude: -180.000001 } },
  { ...candidate, position: { latitude: 44 } }, { ...candidate, position: null },
  { ...candidate, position: { ...candidate.position, accuracy: 1 } }, { ...candidate, privateToken: 'PRIVATE_PROVIDER_TOKEN' },
])('refuses unbound/malformed candidate data without partial success: %p', async malformed => {
  const fetcher = jest.fn().mockResolvedValue(response({ candidates: [{ ...candidate, candidateId: 'valid-sibling' }, malformed] }));
  await expect(createConfiguredLocationResolver(config, fetcher).search(input)).resolves.toEqual({ status: 'UNAVAILABLE' });
});

it.each([[], {}, null, { candidates: {} }, { candidates: [candidate], providerDump: 'PRIVATE_RAW_RESPONSE' },
  { candidates: Array.from({ length: 21 }, () => candidate) }, { candidates: [candidate, { ...candidate, label: 'Different candidate' }] },
])('rejects unbounded/raw envelopes and ambiguous duplicate provider IDs: %p', async body => {
  const fetcher = jest.fn().mockResolvedValue(response(body));
  await expect(createConfiguredLocationResolver(config, fetcher).search(input)).resolves.toEqual({ status: 'UNAVAILABLE' });
});

it('accepts the twenty-result boundary and finite extreme coordinates', async () => {
  const fetcher = jest.fn().mockResolvedValue(response({ candidates: Array.from({ length: 20 }, (_, id) => ({
    ...candidate, candidateId: `candidate-${id}`, position: { latitude: id % 2 ? 90 : -90, longitude: id % 2 ? 180 : -180 },
  })) }));
  const result = await createConfiguredLocationResolver(config, fetcher).search(input);
  expect(result.status).toBe('PROPOSALS');
  if (result.status === 'PROPOSALS') expect(result.candidates).toHaveLength(20);
});

it('reads fresh user tokens per lookup without putting them in URLs, bodies or candidates', async () => {
  const getAccessToken = jest.fn().mockResolvedValueOnce('SYNTHETIC_SESSION_A').mockResolvedValueOnce('SYNTHETIC_SESSION_B');
  const fetcher = jest.fn().mockResolvedValue(response());
  const resolver = createConfiguredLocationResolver({ ...config, getAccessToken }, fetcher);
  const first = await resolver.search(input), second = await resolver.search({ ...input, scopeKey: 'account-B/start/input-1' });
  expect(getAccessToken).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.map(([, init]) => init.headers.Authorization)).toEqual(['Bearer SYNTHETIC_SESSION_A', 'Bearer SYNTHETIC_SESSION_B']);
  expect(JSON.stringify([first, second])).not.toContain('SYNTHETIC_SESSION');
  for (const [url, init] of fetcher.mock.calls) expect(`${url}${init.body}`).not.toContain('SYNTHETIC_SESSION');
});

it.each([null, '', 'SYNTHETIC\r\nINJECTED_HEADER'])('does not fall back to anonymous when configured token resolution fails: %p', async token => {
  const fetcher = jest.fn();
  await expect(createConfiguredLocationResolver({ ...config, getAccessToken: async () => token }, fetcher).search(input))
    .resolves.toEqual({ status: 'UNAVAILABLE' });
  expect(fetcher).not.toHaveBeenCalled();
});

it.each(['http', 'redirect', 'network', 'json', 'token'])('sanitizes %s failures and never retries or changes providers', async failure => {
  const error = new Error('PRIVATE_PROVIDER_REPLY SECRET_TOKEN PRIVATE_SUBMITTED_ADDRESS');
  const settings: ConfiguredLocationResolverConfig = failure === 'token' ? { ...config, getAccessToken: async () => { throw error; } } : config;
  const fetcher = jest.fn(async () => {
    if (failure === 'network') throw error;
    return { ...response(undefined, failure !== 'http', failure === 'redirect'), json: async () => { if (failure === 'json') throw error; return { candidates: [] }; } };
  });
  const logs = jest.spyOn(console, 'error').mockImplementation(() => {});
  await expect(createConfiguredLocationResolver(settings, fetcher).search(input)).resolves.toEqual({ status: 'UNAVAILABLE' });
  expect(fetcher).toHaveBeenCalledTimes(failure === 'token' ? 0 : 1);expect(logs).not.toHaveBeenCalled();
});

it('does not start transport for an already aborted request', async () => {
  const controller = new AbortController(); controller.abort(); const fetcher = jest.fn();
  await expect(createConfiguredLocationResolver(config, fetcher).search(input, controller.signal)).resolves.toEqual({ status: 'CANCELLED' });
  expect(fetcher).not.toHaveBeenCalled();
});

it('cancels a hung transport promptly even when AbortSignal is ignored', async () => {
  const pending = deferred<Awaited<ReturnType<LocationResolverFetch>>>();
  const fetcher = jest.fn(() => pending.promise), controller = new AbortController();
  const promise = createConfiguredLocationResolver(config, fetcher).search(input, controller.signal);
  controller.abort(); await expect(promise).resolves.toEqual({ status: 'CANCELLED' });
  expect(fetcher.mock.calls).toHaveLength(1);
  pending.resolve(response());
});

it('cancel invalidates pending token lookup so a late token cannot send the previous address', async () => {
  const token = deferred<string | null>(), fetcher = jest.fn();
  const resolver = createConfiguredLocationResolver({ ...config, getAccessToken: () => token.promise }, fetcher);
  const pending = resolver.search(input);resolver.cancel();
  await expect(pending).resolves.toEqual({ status: 'CANCELLED' });
  token.resolve('SYNTHETIC_LATE_TOKEN');await Promise.resolve();await Promise.resolve();
  expect(fetcher).not.toHaveBeenCalled();
});

it('a later A-B-A scope owns the only usable response while older transports ignore cancellation', async () => {
  const a = deferred<Awaited<ReturnType<LocationResolverFetch>>>(), b = deferred<Awaited<ReturnType<LocationResolverFetch>>>();
  const latest = deferred<Awaited<ReturnType<LocationResolverFetch>>>();
  const fetcher = jest.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise).mockReturnValueOnce(latest.promise);
  const resolver = createConfiguredLocationResolver(config, fetcher);
  const first = resolver.search(input), second = resolver.search({ ...input, scopeKey: 'account-B/end/input-1' }), third = resolver.search(input);
  a.resolve(response());b.resolve(response());
  await expect(first).resolves.toEqual({ status: 'CANCELLED' });await expect(second).resolves.toEqual({ status: 'CANCELLED' });
  latest.resolve(response({ candidates: [{ ...candidate, label: 'Latest candidate' }] }));
  await expect(third).resolves.toMatchObject({ status: 'PROPOSALS', candidates: [{ label: 'Latest candidate' }] });
  expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);
});

it('an invalid new input cancels the old search without sending another request', async () => {
  const fetcher = jest.fn(() => new Promise<Awaited<ReturnType<LocationResolverFetch>>>(() => {}));
  const resolver = createConfiguredLocationResolver(config, fetcher), pending = resolver.search(input);
  await expect(resolver.search({ ...input, text: '' })).resolves.toEqual({ status: 'INVALID_QUERY' });
  await expect(pending).resolves.toEqual({ status: 'CANCELLED' });expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(['transport', 'body', 'token'])('bounds a noncooperative %s to ten seconds without retry', async step => {
  jest.useFakeTimers();
  const never = new Promise<never>(() => {});
  const fetcher = jest.fn(() => step === 'transport' ? never : Promise.resolve({ ...response(), json: () => never }));
  const settings = step === 'token' ? { ...config, getAccessToken: () => never } : config;
  const pending = createConfiguredLocationResolver(settings, fetcher).search(input);
  await jest.advanceTimersByTimeAsync(10_001);
  await expect(pending).resolves.toEqual({ status: 'UNAVAILABLE' });expect(fetcher).toHaveBeenCalledTimes(step === 'token' ? 0 : 1);
  expect(jest.getTimerCount()).toBe(0);
});

it('blur cancellation also rejects a late response body and permits a fresh retry', async () => {
  const body = deferred<unknown>();
  const fetcher = jest.fn().mockResolvedValueOnce({ ...response(), json: () => body.promise }).mockResolvedValueOnce(response());
  const resolver = createConfiguredLocationResolver(config, fetcher), first = resolver.search(input);
  await Promise.resolve();resolver.cancel();body.resolve({ candidates: [candidate] });
  await expect(first).resolves.toEqual({ status: 'CANCELLED' });
  await expect(resolver.search(input)).resolves.toMatchObject({ status: 'PROPOSALS' });
});


it('reverse sends only an explicit point and country, preserving cancellation across lookup kinds', async () => {
  const pending=deferred<ReturnType<typeof response>>();const fetcher=jest.fn().mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response());
  const resolver=createConfiguredLocationResolver(config,fetcher);
  const reverse=resolver.reverse({position:{latitude:45.255,longitude:19.845},countryCode:'RS',scopeKey:'private-scope'});
  await Promise.resolve();
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({mode:'reverse',countryCode:'RS',position:{latitude:45.255,longitude:19.845}});
  const forward=resolver.search(input);pending.resolve(response());
  await expect(reverse).resolves.toEqual({status:'CANCELLED'});await expect(forward).resolves.toMatchObject({status:'PROPOSALS'});
});

it('reverse rejects extra fields, invalid coordinates and multiple results',async()=>{
  const fetcher=jest.fn().mockResolvedValue(response({candidates:[candidate,{...candidate,candidateId:'second'}]}));
  const resolver=createConfiguredLocationResolver(config,fetcher), valid={position:{latitude:0,longitude:0},countryCode:'RS',scopeKey:'scope'};
  for(const raw of [{...valid,text:'private'},{...valid,position:{latitude:'0',longitude:0}},{...valid,position:{latitude:91,longitude:0}}])
    await expect(resolver.reverse(raw)).resolves.toEqual({status:'INVALID_QUERY'});
  expect(fetcher).not.toHaveBeenCalled();await expect(resolver.reverse(valid)).resolves.toEqual({status:'UNAVAILABLE'});
});

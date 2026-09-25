/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FunctionsClient } from '@supabase/functions-js';
import { mediaClientService } from '../mediaClientService';

const OWNER = '11111111-1111-4111-8111-111111111111';
const ASSET = '33333333-3333-4333-8333-333333333333';
const PROFILE = '55555555-5555-4555-8555-555555555555';
let mockSession = { user: { id: OWNER }, accountRevision: 1 };
const mockFetch = jest.fn(), mockGetSession = jest.fn();
const mockClient = { auth: { getSession: mockGetSession }, functions: new FunctionsClient('https://media-test.invalid/functions/v1', { customFetch: mockFetch }) };
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => mockClient }));

// A genuine checked-in JPEG, not a stub Blob that skips the installed SDK parser.
const jpeg = readFileSync(resolve(__dirname, '../../../assets/brand/entry-v49/worker.jpg'));
const originalFetch = global.fetch;
const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
beforeEach(() => {
  mockSession = { user: { id: OWNER }, accountRevision: 1 };
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://media-test.invalid';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_SYNTHETIC_TEST_ONLY';
  mockFetch.mockReset(); mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: OWNER }, access_token: 'SYNTHETIC_TEST_ONLY' } }, error: null });
  mockFetch.mockImplementation(async () => new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } }));
  global.fetch = mockFetch;
});
afterEach(() => {
  jest.useRealTimers();
  global.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey;
});

it('demonstrates that the installed Functions SDK consumes JPEG as lossy text', async () => {
  const result = await mockClient.functions.invoke('uskoci-media', { body: { assetId: ASSET }, headers: { 'x-media-operation': 'read' } });
  expect(result.error).toBeNull();
  expect(typeof result.data).toBe('string');
  expect(result.response?.bodyUsed).toBe(true);
  expect(Buffer.from(result.data, 'utf8').equals(jpeg)).toBe(false);
});

it('returns exactly the original JPEG bytes through the real media service read', async () => {
  const result = await mediaClientService.readMedia(ASSET, { profileId: PROFILE });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('JPEG_READ_REJECTED');
  expect(result.podatak.assetId).toBe(ASSET);
  expect(result.podatak.contentType).toBe('image/jpeg');
  expect(Buffer.from(result.podatak.bytes).equals(jpeg)).toBe(true);
  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [url, init] = mockFetch.mock.calls[0];
  expect(url).toBe('https://media-test.invalid/functions/v1/uskoci-media');
  expect(JSON.parse(init.body)).toEqual({ assetId: ASSET, profileId: PROFILE });
  expect(init.headers).toMatchObject({ 'x-media-operation': 'read', 'Content-Type': 'application/json', Accept: 'image/jpeg',
    apikey: 'sb_publishable_SYNTHETIC_TEST_ONLY', Authorization: 'Bearer SYNTHETIC_TEST_ONLY' });
  expect(init).toMatchObject({ credentials: 'omit', redirect: 'error', cache: 'no-store' });
});

it('keeps Agreement and canonical message authority in the exact binary request', async () => {
  await mediaClientService.readMedia(ASSET, { agreementId: PROFILE, messageId: OWNER });
  expect(mockFetch.mock.calls[0][1].headers['x-media-operation']).toBe('agreement-read');
  expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ assetId: ASSET, agreementId: PROFILE, messageId: OWNER });
});

it.each(['application/json', 'image/png', 'text/html', 'application/octet-stream'])('rejects %s instead of accepting a disguised image', async type => {
  mockFetch.mockResolvedValue(new Response(jpeg, { headers: { 'Content-Type': type } }));
  await expect(mediaClientService.readMedia(ASSET, { profileId: PROFILE })).resolves.toMatchObject({ ok: false, kod: 'MEDIA_INVALID_RESPONSE' });
});

it.each([0, 5_242_881])('checks actual body length %s even when the advertised length is small', async length => {
  mockFetch.mockResolvedValue(new Response(new Uint8Array(length), { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '1' } }));
  await expect(mediaClientService.readMedia(ASSET, { profileId: PROFILE })).resolves.toMatchObject({ ok: false, kod: 'MEDIA_INVALID_RESPONSE' });
});

it('rejects an oversized declared image before reading its body', async () => {
  const response = new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': '5242881' } });
  const read = jest.spyOn(response, 'arrayBuffer'); mockFetch.mockResolvedValue(response);
  await expect(mediaClientService.readMedia(ASSET)).resolves.toMatchObject({ ok: false, kod: 'MEDIA_INVALID_RESPONSE' });
  expect(read).not.toHaveBeenCalled();
});

it.each([401, 403, 404, 500])('does not surface provider/body details from HTTP %s', async status => {
  mockFetch.mockResolvedValue(new Response('PRIVATE_SERVER_DETAIL', { status }));
  const result = await mediaClientService.readMedia(ASSET);
  expect(result).toMatchObject({ ok: false, kod: 'MEDIA_UNAVAILABLE' });
  expect(JSON.stringify(result)).not.toContain('PRIVATE');
});

it('rejects a missing or different SDK user before making the binary request', async () => {
  for (const session of [null, { user: { id: PROFILE }, access_token: 'SYNTHETIC_OTHER' }]) {
    mockGetSession.mockResolvedValue({ data: { session }, error: null });
    await expect(mediaClientService.readMedia(ASSET)).resolves.toMatchObject({ ok: false });
  }
  expect(mockFetch).not.toHaveBeenCalled();
});

it('retires an account round trip while awaiting the SDK session before any network call', async () => {
  mockGetSession.mockImplementation(async () => {
    mockSession = { user: { id: OWNER }, accountRevision: 3 };
    return { data: { session: { user: { id: OWNER }, access_token: 'SYNTHETIC_TEST_ONLY' } }, error: null };
  });
  await expect(mediaClientService.readMedia(ASSET)).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
  expect(mockFetch).not.toHaveBeenCalled();
});

it('discards valid bytes if the account incarnation changed during body reading', async () => {
  const response = new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } });
  const original = response.arrayBuffer.bind(response);
  jest.spyOn(response, 'arrayBuffer').mockImplementation(async () => {
    const bytes = await original(); mockSession.accountRevision = 3; return bytes;
  });
  mockFetch.mockResolvedValue(response);
  await expect(mediaClientService.readMedia(ASSET)).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});

it('propagates parent cancellation and never yields late bytes even if fetch ignores abort', async () => {
  const controller = new AbortController(); let release!: (response: Response) => void;
  mockFetch.mockImplementation(() => new Promise<Response>(resolve => { release = resolve; }));
  const pending = mediaClientService.readMedia(ASSET, {}, { signal: controller.signal });
  await Promise.resolve(); await Promise.resolve();
  expect(mockFetch).toHaveBeenCalledTimes(1);
  const transportSignal = mockFetch.mock.calls[0][1].signal;
  controller.abort();
  await expect(pending).resolves.toMatchObject({ ok: false, kod: 'MEDIA_UNAVAILABLE' });
  expect(transportSignal.aborted).toBe(true);
  release(new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg' } }));
  await Promise.resolve();
});

it('bounds a stalled session and prevents a late session from starting a request after timeout', async () => {
  jest.useFakeTimers(); let release!: (auth: unknown) => void;
  mockGetSession.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const pending = mediaClientService.readMedia(ASSET);
  await jest.advanceTimersByTimeAsync(15_000);
  await expect(pending).resolves.toMatchObject({ ok: false, kod: 'MEDIA_UNAVAILABLE' });
  release({ data: { session: { user: { id: OWNER }, access_token: 'SYNTHETIC_TEST_ONLY' } }, error: null });
  await Promise.resolve(); await Promise.resolve();
  expect(mockFetch).not.toHaveBeenCalled();
  await expect(mediaClientService.readMedia(ASSET)).resolves.toMatchObject({ ok: true });
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

it('does not request a redirected response or treat relay failure as image success', async () => {
  const response = new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg', 'x-relay-error': 'true' } });
  mockFetch.mockResolvedValue(response);
  await expect(mediaClientService.readMedia(ASSET)).resolves.toMatchObject({ ok: false, kod: 'MEDIA_UNAVAILABLE' });
});

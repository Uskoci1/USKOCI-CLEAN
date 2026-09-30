/** @jest-environment node */
// Voice messages B2-a (2026-09-30): the authenticated binary read of ONE voice message - exact request, exact audio type, bounded size, current session only.
import { readVoiceBinary, VOICE_MAX_BYTES } from '../voiceBinaryRead';

const OWNER = '11111111-1111-4111-8111-111111111111';
const AGREEMENT = '22222222-2222-4222-8222-222222222222';
const ASSET = '33333333-3333-4333-8333-333333333333';
const MESSAGE = '55555555-5555-4555-8555-555555555555';
let mockSession = { user: { id: OWNER }, accountRevision: 1 };
const mockFetch = jest.fn(), mockGetSession = jest.fn();
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockSession }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({ auth: { getSession: mockGetSession } }) }));

const audio = new Uint8Array(Array.from({ length: 512 }, (_, i) => (i * 7) % 251));
const account = { accountId: OWNER, accountRevision: 1 };
const body = { agreementId: AGREEMENT, assetId: ASSET, messageId: MESSAGE };
const originalFetch = global.fetch, originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL, originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
beforeEach(() => {
  mockSession = { user: { id: OWNER }, accountRevision: 1 };
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://media-test.invalid';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_SYNTHETIC_TEST_ONLY';
  mockFetch.mockReset(); mockGetSession.mockReset();
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: OWNER }, access_token: 'SYNTHETIC_TEST_ONLY' } }, error: null });
  mockFetch.mockImplementation(async () => new Response(audio, { headers: { 'Content-Type': 'audio/mp4' } }));
  global.fetch = mockFetch;
});
afterEach(() => {
  jest.useRealTimers(); global.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey;
});

it('returns exactly the recorded bytes through one exact POST', async () => {
  const result = await readVoiceBinary({ account, body });
  expect(result.error).toBeNull();
  expect(Buffer.from(result.data!.bytes).equals(Buffer.from(audio))).toBe(true); expect(result.data!.contentType).toBe('audio/mp4');
  expect(mockFetch).toHaveBeenCalledTimes(1);
  const [url, init] = mockFetch.mock.calls[0];
  expect(url).toBe('https://media-test.invalid/functions/v1/uskoci-media'); expect(JSON.parse(init.body)).toEqual(body);
  expect(init.headers).toEqual({ 'Content-Type': 'application/json', Accept: 'audio/mp4', apikey: 'sb_publishable_SYNTHETIC_TEST_ONLY',
    Authorization: 'Bearer SYNTHETIC_TEST_ONLY', 'x-media-operation': 'agreement-voice-read' });
  expect(init).toMatchObject({ method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store' });
});
it.each(['application/json', 'audio/mpeg', 'image/jpeg', 'text/html', 'application/octet-stream'])('rejects %s instead of accepting a disguised recording', async type => {
  mockFetch.mockResolvedValue(new Response(audio, { headers: { 'Content-Type': type } }));
  expect(await readVoiceBinary({ account, body })).toEqual({ data: null, error: null });
});
it('accepts a media type with parameters and refuses an empty, oversize or mis-declared body', async () => {
  mockFetch.mockResolvedValue(new Response(audio, { headers: { 'Content-Type': 'Audio/MP4; charset=binary' } }));
  expect((await readVoiceBinary({ account, body })).data?.bytes.byteLength).toBe(512);
  mockFetch.mockResolvedValue(new Response(new Uint8Array(0), { headers: { 'Content-Type': 'audio/mp4' } }));
  expect(await readVoiceBinary({ account, body })).toEqual({ data: null, error: null });
  mockFetch.mockResolvedValue(new Response(audio, { headers: { 'Content-Type': 'audio/mp4', 'Content-Length': String(VOICE_MAX_BYTES + 1) } }));
  expect(await readVoiceBinary({ account, body })).toEqual({ data: null, error: null });
  mockFetch.mockResolvedValue(new Response(audio, { headers: { 'Content-Type': 'audio/mp4', 'Content-Length': 'many' } }));
  expect(await readVoiceBinary({ account, body })).toEqual({ data: null, error: null });
});
it.each([
  ['an HTTP failure', () => mockFetch.mockResolvedValue(new Response('{}', { status: 403, headers: { 'Content-Type': 'application/json' } }))],
  ['a relay error marker', () => mockFetch.mockResolvedValue(new Response(audio, { headers: { 'Content-Type': 'audio/mp4', 'x-relay-error': 'true' } }))],
  ['a thrown transport', () => mockFetch.mockRejectedValue(new Error('PRIVATE_UPSTREAM_BODY'))],
])('turns %s into one opaque unavailable answer', async (_name, arrange) => {
  arrange(); const result = await readVoiceBinary({ account, body });
  expect(result).toEqual({ data: null, error: { message: 'MEDIA_UNAVAILABLE' } }); expect(JSON.stringify(result)).not.toContain('PRIVATE');
});
it('never reads without a https configuration, a public key or a session of the exact account', async () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://media-test.invalid';
  expect((await readVoiceBinary({ account, body })).error?.message).toBe('MEDIA_UNAVAILABLE'); process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://media-test.invalid';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'sb_secret_NEVER';
  expect((await readVoiceBinary({ account, body })).error?.message).toBe('MEDIA_UNAVAILABLE'); process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'sb_publishable_SYNTHETIC_TEST_ONLY';
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: MESSAGE }, access_token: 'X' } }, error: null });
  expect((await readVoiceBinary({ account, body })).error?.message).toBe('MEDIA_UNAVAILABLE');
  mockGetSession.mockResolvedValue({ data: { session: { user: { id: OWNER }, access_token: 'has space' } }, error: null });
  expect((await readVoiceBinary({ account, body })).error?.message).toBe('MEDIA_UNAVAILABLE');
  expect(mockFetch).not.toHaveBeenCalled();
});
it('withholds the bytes when the account changes before the answer arrives', async () => {
  mockFetch.mockImplementation(async () => { mockSession = { user: { id: OWNER }, accountRevision: 2 }; return new Response(audio, { headers: { 'Content-Type': 'audio/mp4' } }); });
  expect((await readVoiceBinary({ account, body })).error?.message).toBe('MEDIA_UNAVAILABLE');
  mockSession = { user: { id: OWNER }, accountRevision: 1 };
  const controller = new AbortController(); controller.abort();
  expect((await readVoiceBinary({ account, body, signal: controller.signal })).error?.message).toBe('MEDIA_UNAVAILABLE');
});
it('gives a slow download thirty seconds and then gives up without an answer', async () => {
  jest.useFakeTimers();
  mockFetch.mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => { init.signal?.addEventListener('abort', () => reject(new Error('aborted'))); }));
  const pending = readVoiceBinary({ account, body });
  await jest.advanceTimersByTimeAsync(29_000); let settled = false; void pending.then(() => { settled = true; }); await jest.advanceTimersByTimeAsync(100); expect(settled).toBe(false);
  await jest.advanceTimersByTimeAsync(1_500);
  expect((await pending).error?.message).toBe('MEDIA_UNAVAILABLE');
});

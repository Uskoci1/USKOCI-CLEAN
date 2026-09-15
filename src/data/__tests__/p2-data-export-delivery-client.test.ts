import type { Session } from '@supabase/supabase-js';
import { DATA_EXPORT_MAX_BYTES } from '../../contracts/dataExport';
import { inicijalizujSesiju, sesijaSada } from '../../store/sesija';
import { dataExportClientService as exports } from '../dataExportClientService';

const A = '11111111-2222-4333-8444-555555555555';
const B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const RECEIPT = '22222222-3333-4444-8555-666666666666';
const GENERATION = '33333333-4444-4555-8666-777777777777';
const command = { receiptId: RECEIPT, artifactGeneration: GENERATION };
const expiry = '2026-09-10T15:00:00.123456Z';
const sha256 = 'a'.repeat(64), md5 = 'b'.repeat(32);
const mockRpc = jest.fn(), mockGetSession = jest.fn(), mockInvoke = jest.fn(), mockFetch = jest.fn();
let mockAuthEvent: (event: string, session: Session | null) => void;

jest.mock('expo/fetch', () => ({ fetch: (...args: unknown[]) => mockFetch(...args) }));
jest.mock('../supabaseClient', () => ({ supabaseKlijent: () => ({
  rpc: mockRpc,
  auth: { getSession: mockGetSession, onAuthStateChange: (callback: typeof mockAuthEvent) => {
    mockAuthEvent = callback;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  } },
  functions: { invoke: mockInvoke },
}) }));
// Keep the actual account-incarnation state machine and receipt boundary.
jest.mock('../../store/povratniCilj', () => ({ povratniCilj: {
  captureSessionCleanup: () => () => Promise.resolve(), snapshot: () => Promise.resolve(null),
} }));
jest.mock('../../store/uloga', () => ({ postaviUlogu: jest.fn(), vezujUloguZaNalog: jest.fn(() => Promise.resolve()) }));

const session = (id = A): Session => ({ user: { id }, access_token: 'synthetic-owner-token',
  refresh_token: 'synthetic-refresh', expires_in: 3600, token_type: 'bearer' } as Session);
const auth = (value: Session | null = session()) => ({ data: { session: value }, error: null });
const answer = (data: unknown) => ({ data, error: null });
function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function flush() { for (let i = 0; i < 12; i += 1) await Promise.resolve(); }
function roundTrip() {
  const revision = sesijaSada().accountRevision;
  mockAuthEvent('SIGNED_IN', session(B)); mockAuthEvent('SIGNED_IN', session(A));
  expect(sesijaSada().user?.id).toBe(A);
  expect(sesijaSada().accountRevision).toBe(revision + 2);
}
function response(parts = [new Uint8Array([123]), new Uint8Array([125])]) {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'content-length': '2',
    'x-uskoci-export-receipt': RECEIPT, 'x-uskoci-export-generation': GENERATION,
    'x-uskoci-export-sha256': sha256, 'x-uskoci-export-md5': md5, 'x-uskoci-export-expires-at': expiry });
  let index = 0;
  const reader = { read: jest.fn(async () => index < parts.length
    ? { done: false, value: parts[index++] } : { done: true, value: undefined }),
  cancel: jest.fn(async () => undefined) };
  const body = { getReader: jest.fn(() => reader), cancel: jest.fn(async () => undefined) };
  return { status: 200, headers, body, reader, parts };
}
const descriptor = () => ({ artifactAvailable: true, artifactGeneration: GENERATION,
  artifactExpiresAt: expiry, byteLength: 2, sha256, md5 });
const status = () => ({ hasRequest: true, downloadAvailable: true, serverFulfillmentRequired: true,
  externalDsrChannelReady: false, fulfillment: descriptor(), request: {
    receiptId: RECEIPT, clientRequestId: 'export-request-001', status: 'READY', kind: 'ACCESS_EXPORT',
    source: 'IN_APP_AUTHENTICATED', requestedAt: '2026-09-10T12:00:00Z', updatedAt: '2026-09-10T13:00:00Z',
    completedAt: '2026-09-10T13:00:00Z', cancelledAt: null, failureCode: null,
  } });
const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL, originalAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

beforeEach(async () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-10T14:00:00Z'));
  mockRpc.mockReset(); mockInvoke.mockReset(); mockGetSession.mockReset(); mockFetch.mockReset();
  mockGetSession.mockResolvedValue(auth()); inicijalizujSesiju();
  mockAuthEvent('SIGNED_OUT', null); mockAuthEvent('SIGNED_IN', session()); await flush(); mockGetSession.mockClear();
  mockInvoke.mockResolvedValue(answer({ receiptId: RECEIPT, kind: 'PROCESSING' }));
  mockRpc.mockResolvedValue(answer(status())); mockFetch.mockResolvedValue(response());
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://synthetic-project.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-public-anon';
});
afterEach(() => {
  jest.clearAllTimers(); jest.useRealTimers();
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  else process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalAnon === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
});

describe('actual authenticated export preparation', () => {
  it.each(['READY', 'PROCESSING'] as const)('accepts only a bound %s receipt and sends no account data', async kind => {
    const receipt = { receiptId: RECEIPT, kind }; mockInvoke.mockResolvedValueOnce(answer(receipt));
    await expect(exports.prepareExport(RECEIPT)).resolves.toEqual({ ok: true, podatak: receipt });
    expect(mockInvoke.mock.calls).toEqual([['uskoci-data-export-worker', {
      body: { action: 'prepare', receiptId: RECEIPT }, headers: { Authorization: 'Bearer synthetic-owner-token' },
      signal: expect.any(AbortSignal),
    }]]);
    expect(mockRpc).not.toHaveBeenCalled(); expect(mockFetch).not.toHaveBeenCalled();
  });
  it.each(['POLICY_NOT_READY', 'BUSY', 'RETRY_REQUIRED', 'NOT_AVAILABLE'])('preserves actual %s without making a ready artifact', async code => {
    const receipt = { receiptId: RECEIPT, kind: 'NOT_READY', code }; mockInvoke.mockResolvedValueOnce(answer(receipt));
    await expect(exports.prepareExport(RECEIPT)).resolves.toEqual({ ok: true, podatak: receipt });
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it.each([null, {}, { receiptId: B, kind: 'READY' }, { receiptId: RECEIPT, kind: 'READY', code: 'BUSY' },
    { receiptId: RECEIPT, kind: 'NOT_READY' }, { receiptId: RECEIPT, kind: 'NOT_READY', code: 'PRIVATE_RAW_ERROR' },
    { receiptId: RECEIPT, kind: 'READY', objectPath: 'PRIVATE_BUCKET_PATH' }, { receiptId: RECEIPT, kind: 'AVAILABLE' }])
  ('rejects unconfirmed or malformed preparation %p', async raw => {
    mockInvoke.mockResolvedValueOnce(answer(raw));
    const result = await exports.prepareExport(RECEIPT);
    expect(result).toMatchObject({ ok: false, kod: 'DATA_EXPORT_INVALID_RESPONSE' });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_');
  });
  it('bounds hanging authentication and prevents a late invocation after timeout', async () => {
    const pendingAuth = deferred(); mockGetSession.mockReturnValueOnce(pendingAuth.promise);
    const pending = exports.prepareExport(RECEIPT);
    await jest.advanceTimersByTimeAsync(15_001);
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_PREPARE_UNCONFIRMED' });
    pendingAuth.resolve(auth()); await flush(); expect(mockInvoke).not.toHaveBeenCalled();
  });
  it('bounds a hanging worker without retry and ignores its late receipt', async () => {
    const worker = deferred(); mockInvoke.mockReturnValueOnce(worker.promise);
    const pending = exports.prepareExport(RECEIPT); await flush();
    const signal = mockInvoke.mock.calls[0][1].signal;
    await jest.advanceTimersByTimeAsync(15_001);
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_PREPARE_UNCONFIRMED' });
    expect(signal.aborted).toBe(true);
    worker.resolve(answer({ receiptId: RECEIPT, kind: 'READY' })); await flush();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
  it('does not admit a worker receipt after its transport signal has already timed out', async () => {
    const held = deferred(); mockInvoke.mockReturnValueOnce(held.promise);
    const pending = exports.prepareExport(RECEIPT); await flush();
    await jest.advanceTimersByTimeAsync(14_001);
    expect(mockInvoke.mock.calls[0][1].signal.aborted).toBe(true);
    held.resolve(answer({ receiptId: RECEIPT, kind: 'READY' }));
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_PREPARE_UNCONFIRMED' });
  });
  it.each(['auth', 'worker'])('rejects an A→B→A roundtrip during %s even when the owner ID is equal again', async stage => {
    const held = deferred();
    if (stage === 'auth') mockGetSession.mockReturnValueOnce(held.promise);
    else mockInvoke.mockReturnValueOnce(held.promise);
    const pending = exports.prepareExport(RECEIPT); await flush(); roundTrip();
    held.resolve(stage === 'auth' ? auth() : answer({ receiptId: RECEIPT, kind: 'READY' }));
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
    expect(mockInvoke).toHaveBeenCalledTimes(stage === 'auth' ? 0 : 1);
  });
  it('keeps transport details private and does not automatically retry an uncertain write', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'PRIVATE_ACCESS_TOKEN', context: 'PRIVATE_PATH' } });
    const result = await exports.prepareExport(RECEIPT);
    expect(result).toMatchObject({ ok: false, kod: 'DATA_EXPORT_PREPARE_UNCONFIRMED' });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_'); expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});

describe('actual authenticated byte delivery', () => {
  it('binds the generation in a POST body, uses header auth and joins exact streamed bytes', async () => {
    const wire = response(); mockFetch.mockResolvedValueOnce(wire);
    const result = await exports.downloadExport(command);
    expect(result).toEqual({ ok: true, podatak: { ...command, bytes: new Uint8Array([123, 125]), byteLength: 2, sha256, md5 } });
    expect(mockFetch.mock.calls).toEqual([['https://synthetic-project.supabase.co/functions/v1/uskoci-data-export-download', {
      method: 'POST', body: JSON.stringify(command), redirect: 'error', signal: expect.any(AbortSignal),
      headers: { apikey: 'synthetic-public-anon', Authorization: 'Bearer synthetic-owner-token', 'Content-Type': 'application/json' },
    }]]);
    expect(wire.parts.every(part => part.every(byte => byte === 0))).toBe(true);
    expect(mockInvoke).not.toHaveBeenCalled(); expect(mockRpc).not.toHaveBeenCalled();
  });
  it.each([
    ['x-uskoci-export-receipt', B], ['x-uskoci-export-generation', B], ['content-type', 'text/html'],
    ['content-length', '0'], ['content-length', '2.5'], ['content-length', '02'],
    ['content-length', String(DATA_EXPORT_MAX_BYTES + 1)], ['content-length', '999999999999999999999'],
    ['x-uskoci-export-sha256', 'a'.repeat(63)], ['x-uskoci-export-md5', 'g'.repeat(32)],
    ['x-uskoci-export-expires-at', '2026-09-10T13:59:59Z'], ['x-uskoci-export-expires-at', 'tomorrow'],
  ])('rejects invalid %s header %s before consuming private bytes', async (name, value) => {
    const wire = response(); wire.headers.set(name, value); mockFetch.mockResolvedValueOnce(wire);
    await expect(exports.downloadExport(command)).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_NOT_AVAILABLE' });
    expect(wire.body.getReader).not.toHaveBeenCalled(); expect(wire.body.cancel).toHaveBeenCalledTimes(1);
  });
  it('requires a real response body even with otherwise complete headers', async () => {
    mockFetch.mockResolvedValueOnce({ ...response(), body: null });
    await expect(exports.downloadExport(command)).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_NOT_AVAILABLE' });
  });
  it.each([401, 409, 500])('rejects HTTP %s without parsing or exposing its error body', async statusCode => {
    const wire = response(); wire.status = statusCode; mockFetch.mockResolvedValueOnce(wire);
    const result = await exports.downloadExport(command);
    expect(result).toMatchObject({ ok: false, kod: 'DATA_EXPORT_NOT_AVAILABLE' });
    expect(wire.body.getReader).not.toHaveBeenCalled(); expect(wire.body.cancel).toHaveBeenCalledTimes(1);
  });
  it.each([[new Uint8Array([123])], [new Uint8Array([123, 125, 10])]])('rejects truncated or oversized actual bytes and clears collected buffers', async parts => {
    const wire = response([parts]); mockFetch.mockResolvedValueOnce(wire);
    await expect(exports.downloadExport(command)).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_NOT_AVAILABLE' });
    expect(parts.every(byte => byte === 0)).toBe(true);
  });
  it('rejects expiry reached during streaming and clears already collected private chunks', async () => {
    const wire = response();
    wire.reader.read.mockImplementationOnce(async () => ({ done: false, value: wire.parts[0] }));
    wire.reader.read.mockImplementationOnce(async () => { jest.setSystemTime(new Date('2026-09-10T15:01:00Z'));
      return { done: true, value: undefined }; });
    mockFetch.mockResolvedValueOnce(wire);
    await expect(exports.downloadExport(command)).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_INTERRUPTED' });
    expect(wire.parts[0][0]).toBe(0);
  });
  it('never fetches after A→B→A during a pending getSession', async () => {
    const held = deferred(); mockGetSession.mockReturnValueOnce(held.promise);
    const pending = exports.downloadExport(command); roundTrip(); held.resolve(auth());
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it('cancels an obsolete fetch response before reading it after A→B→A', async () => {
    const held = deferred(); mockFetch.mockReturnValueOnce(held.promise);
    const pending = exports.downloadExport(command); await flush(); roundTrip();
    const wire = response(); held.resolve(wire);
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
    expect(wire.body.getReader).not.toHaveBeenCalled(); expect(wire.body.cancel).toHaveBeenCalledTimes(1);
  });
  it('bounds a hanging getSession at 60 seconds and prevents a late fetch', async () => {
    const held = deferred(); mockGetSession.mockReturnValueOnce(held.promise);
    const pending = exports.downloadExport(command); await jest.advanceTimersByTimeAsync(60_001);
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_INTERRUPTED' });
    held.resolve(auth()); await flush(); expect(mockFetch).not.toHaveBeenCalled();
  });
  it('bounds an abort-ignoring fetch, retires its eventual body and never retries', async () => {
    const held = deferred(); mockFetch.mockReturnValueOnce(held.promise);
    const pending = exports.downloadExport(command); await flush();
    const signal = mockFetch.mock.calls[0][1].signal;
    await jest.advanceTimersByTimeAsync(60_001);
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_INTERRUPTED' });
    expect(signal.aborted).toBe(true);
    const wire = response(); held.resolve(wire); await flush();
    expect(wire.body.getReader).not.toHaveBeenCalled(); expect(wire.body.cancel).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
  it.each(['account', 'timeout', 'abort'])('zeroes a private chunk delivered after %s retires its pending stream read', async retirement => {
    const held = deferred<{ done: boolean; value: Uint8Array<ArrayBuffer> }>();
    const wire = response(); wire.reader.read.mockReturnValueOnce(held.promise);
    mockFetch.mockResolvedValueOnce(wire);
    const controller = new AbortController(), pending = exports.downloadExport(command, controller.signal);
    await flush(); expect(wire.reader.read).toHaveBeenCalledTimes(1);
    if (retirement === 'account') roundTrip();
    else if (retirement === 'timeout') await jest.advanceTimersByTimeAsync(60_001);
    else controller.abort();
    const latePrivateBytes = new Uint8Array([123, 125]); held.resolve({ done: false, value: latePrivateBytes });
    await expect(pending).resolves.toMatchObject({ ok: false, kod: retirement === 'account' ? 'AUTH_ACCOUNT_CHANGED' : 'DATA_EXPORT_INTERRUPTED' });
    await flush(); expect(latePrivateBytes).toEqual(new Uint8Array(2));
  });
  it('does no auth or transport work for an already aborted explicit download', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(exports.downloadExport(command, controller.signal)).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_INTERRUPTED' });
    expect(mockGetSession).not.toHaveBeenCalled(); expect(mockFetch).not.toHaveBeenCalled();
  });
  it.each(['https://user:secret@example.test', 'https://example.test/private', 'https://example.test?token=secret', 'http://example.test'])
  ('rejects a credential-bearing or unapproved API origin %s without any request', async url => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = url;
    await expect(exports.downloadExport(command)).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_NOT_AVAILABLE' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
  it.each([null, session(B), { ...session(), access_token: '' }])('requires the same authenticated owner and an actual access token', async value => {
    mockGetSession.mockResolvedValueOnce(auth(value));
    await expect(exports.downloadExport(command)).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_NOT_AVAILABLE' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('artifact status and explicit revocation receipts', () => {
  it('admits a real READY descriptor without exposing extra ledger fields', async () => {
    const result = await exports.readStatus();
    expect(result).toMatchObject({ ok: true, podatak: { downloadAvailable: true, fulfillment: descriptor() } });
    expect(result.ok && result.podatak.request).not.toHaveProperty('source');
    expect(mockRpc.mock.calls).toEqual([['rpc_get_data_export_status', {}]]);
  });
  it('keeps a historical READY row without fulfillment unavailable for download', async () => {
    const raw: Record<string, unknown> = status(); delete raw.fulfillment;
    mockRpc.mockResolvedValueOnce(answer(raw));
    await expect(exports.readStatus()).resolves.toMatchObject({ ok: true, podatak: { downloadAvailable: false } });
  });
  it.each([
    { artifactAvailable: false }, { artifactGeneration: 'not-an-id' }, { artifactExpiresAt: 'tomorrow' },
    { byteLength: 0 }, { byteLength: 1.5 }, { byteLength: DATA_EXPORT_MAX_BYTES + 1 },
    { byteLength: '2' }, { sha256: 'A'.repeat(64) }, { md5: null }, { objectPath: 'PRIVATE_PATH' },
  ])('refuses malformed or unbounded fulfillment %p', async patch => {
    mockRpc.mockResolvedValueOnce(answer({ ...status(), fulfillment: { ...descriptor(), ...patch } }));
    const result = await exports.readStatus(); expect(result).toMatchObject({ ok: false, kod: 'DATA_EXPORT_INVALID_RESPONSE' });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_');
  });
  it.each([
    { downloadAvailable: true, fulfillment: null }, { downloadAvailable: false },
    { request: { ...status().request, status: 'PROCESSING', completedAt: null } },
    { hasRequest: false, request: null },
  ])('refuses contradictory artifact/ledger status %p', async patch => {
    mockRpc.mockResolvedValueOnce(answer({ ...status(), ...patch }));
    await expect(exports.readStatus()).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_INVALID_RESPONSE' });
  });
  it.each(['EXPIRED', 'CANCELLED'])('accepts only the actual %s revocation receipt', async requestStatus => {
    const receipt = { receiptId: RECEIPT, status: requestStatus, revoked: true, idempotentReplay: false };
    mockRpc.mockResolvedValueOnce(answer(receipt));
    await expect(exports.revokeExport(RECEIPT)).resolves.toEqual({ ok: true, podatak: receipt });
    expect(mockRpc.mock.calls).toEqual([['rpc_revoke_data_export_download', { p_receipt_id: RECEIPT }]]);
  });
  it.each([{ receiptId: B }, { revoked: false }, { status: 'READY' }, { idempotentReplay: undefined },
    { objectPath: 'PRIVATE_PATH' }])('rejects an unconfirmed or mismatched revoke %p', async patch => {
    mockRpc.mockResolvedValueOnce(answer({ receiptId: RECEIPT, status: 'EXPIRED', revoked: true, idempotentReplay: false, ...patch }));
    const result = await exports.revokeExport(RECEIPT); expect(result).toMatchObject({ ok: false, kod: 'DATA_EXPORT_INVALID_RESPONSE' });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_');
  });
  it('retires a pending revoke after A→B→A without replaying it', async () => {
    const held = deferred(); mockRpc.mockReturnValueOnce(held.promise);
    const pending = exports.revokeExport(RECEIPT); roundTrip();
    held.resolve(answer({ receiptId: RECEIPT, status: 'EXPIRED', revoked: true, idempotentReplay: false }));
    await expect(pending).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });
});

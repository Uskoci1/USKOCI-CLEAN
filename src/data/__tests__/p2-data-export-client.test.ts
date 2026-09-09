/**
 * P2 — data-export client contract. A recorded request is never presented as a
 * download; replay is reported as replay; server exception names become
 * product language.
 */

jest.mock('../supabaseClient', () => {
  const mockRpc = jest.fn();
  return {
    supabaseKonfigurisan: () => true,
    supabaseKlijent: () => ({ rpc: mockRpc }),
    __testMocks: { mockRpc },
  };
});

let mockAccount: { user: { id: string } | null; accountRevision: number } = { user: { id: 'account-a' }, accountRevision: 1 };
jest.mock('../../store/sesija', () => ({ sesijaSada: () => mockAccount }));
beforeEach(() => { mockAccount = { user: { id: 'account-a' }, accountRevision: 1 }; });
afterEach(() => jest.useRealTimers());

import { dataExportClientService } from '../dataExportClientService';

const { mockRpc } = (jest.requireMock('../supabaseClient') as { __testMocks: { mockRpc: jest.Mock } }).__testMocks;

function resetRpc(result: unknown) {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue(result);
}

const ID = '11111111-2222-4333-8444-555555555555';
const KEY = 'export-request-abcdef0123456789';
const request = (status: string, extra: Record<string, unknown> = {}) => ({
  receiptId: ID, clientRequestId: KEY, kind: 'ACCESS_EXPORT', source: 'IN_APP_AUTHENTICATED', status,
  requestedAt: '2026-09-08T10:00:00+00:00', updatedAt: '2026-09-08T10:00:00+00:00', cancelledAt: null, completedAt: null, failureCode: null, ...extra,
});

describe('P2 — readStatus', () => {
  it('reports no request honestly and never offers a download', async () => {
    resetRpc({ data: { hasRequest: false, request: null, downloadAvailable: false, serverFulfillmentRequired: true, externalDsrChannelReady: false }, error: null });
    const result = await dataExportClientService.readStatus();
    expect(mockRpc.mock.calls).toEqual([['rpc_get_data_export_status', {}]]);
    expect(result).toEqual({ ok: true, podatak: { hasRequest: false, request: null, downloadAvailable: false, serverFulfillmentRequired: true, externalDsrChannelReady: false } });
  });

  it('maps the latest request and pins downloadAvailable to false even if the server said otherwise', async () => {
    resetRpc({ data: { hasRequest: true, request: request('READY', { completedAt: '2026-09-08T11:00:00+00:00' }), downloadAvailable: true, serverFulfillmentRequired: true, externalDsrChannelReady: false }, error: null });
    const result = await dataExportClientService.readStatus();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.podatak.downloadAvailable).toBe(false);
    expect(result.podatak.request).toMatchObject({ receiptId: ID, status: 'READY', completedAt: '2026-09-08T11:00:00+00:00', cancelledAt: null });
  });

  it('fails closed on an unreadable request', async () => {
    resetRpc({ data: { hasRequest: true, request: { receiptId: ID, status: 'WEIRD' }, downloadAvailable: false, serverFulfillmentRequired: true, externalDsrChannelReady: false }, error: null });
    expect(await dataExportClientService.readStatus()).toMatchObject({ ok: false, kod: 'DATA_EXPORT_INVALID_RESPONSE' });
  });
});

describe('P2 — requestExport and cancelExport', () => {
  it('sends the stable request id and returns the receipt, reporting replay as replay', async () => {
    resetRpc({ data: { receiptId: ID, clientRequestId: KEY, status: 'REQUESTED', requestedAt: '2026-09-08T10:00:00+00:00', idempotentReplay: false, downloadAvailable: false, serverFulfillmentRequired: true }, error: null });
    const first = await dataExportClientService.requestExport(KEY);
    expect(mockRpc.mock.calls).toEqual([['rpc_request_data_export', { p_client_request_id: KEY }]]);
    expect(first).toMatchObject({ ok: true, podatak: { receiptId: ID, status: 'REQUESTED', idempotentReplay: false } });

    resetRpc({ data: { receiptId: ID, clientRequestId: KEY, status: 'REQUESTED', requestedAt: '2026-09-08T10:00:00+00:00', idempotentReplay: true, downloadAvailable: false, serverFulfillmentRequired: true }, error: null });
    expect(await dataExportClientService.requestExport(KEY)).toMatchObject({ ok: true, podatak: { idempotentReplay: true } });
  });

  it('translates an open request and a non-cancellable state into product language', async () => {
    resetRpc({ data: null, error: { code: '55000', message: 'DATA_EXPORT_REQUEST_ALREADY_OPEN' } });
    const open = await dataExportClientService.requestExport(KEY);
    expect(open).toMatchObject({ ok: false, kod: 'DATA_EXPORT_REQUEST_ALREADY_OPEN' });
    if (!open.ok) {
      expect(open.poruka).toContain('već u toku');
      expect(open.poruka).not.toContain('DATA_EXPORT');
    }
    resetRpc({ data: null, error: { code: '55000', message: 'DATA_EXPORT_REQUEST_NOT_CANCELLABLE' } });
    const blocked = await dataExportClientService.cancelExport(ID);
    expect(blocked).toMatchObject({ ok: false, kod: 'DATA_EXPORT_REQUEST_NOT_CANCELLABLE' });
    if (!blocked.ok) expect(blocked.poruka).toContain('ne može da se otkaže');
  });

  it('cancels with the receipt id and reports a replayed cancellation', async () => {
    resetRpc({ data: { receiptId: ID, status: 'CANCELLED', cancelledAt: '2026-09-08T12:00:00+00:00', idempotentReplay: true }, error: null });
    const result = await dataExportClientService.cancelExport(ID);
    expect(mockRpc.mock.calls).toEqual([['rpc_cancel_data_export', { p_receipt_id: ID }]]);
    expect(result).toEqual({ ok: true, podatak: { receiptId: ID, status: 'CANCELLED', cancelledAt: '2026-09-08T12:00:00+00:00', idempotentReplay: true } });
  });
});

const DATE = '2026-09-08T10:00:00+00:00';
const OTHER = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const receipt = () => ({ receiptId: ID, clientRequestId: KEY, status: 'REQUESTED', requestedAt: DATE,
  idempotentReplay: false, downloadAvailable: false, serverFulfillmentRequired: true });
const cancellation = () => ({ receiptId: ID, status: 'CANCELLED', cancelledAt: DATE, idempotentReplay: false });
const latest = () => ({ hasRequest: true, request: request('REQUESTED'), downloadAvailable: false,
  serverFulfillmentRequired: true, externalDsrChannelReady: false });
const commands = {
  status: () => dataExportClientService.readStatus(),
  request: () => dataExportClientService.requestExport(KEY),
  cancel: () => dataExportClientService.cancelExport(ID),
};
const results = { status: latest, request: receipt, cancel: cancellation };
const stages = ['status', 'request', 'cancel'] as const;

it.each(stages)('refuses signed-out %s before any transport call', async stage => {
  mockAccount = { user: null, accountRevision: 2 }; resetRpc({ data: results[stage](), error: null });
  await expect(commands[stage]()).resolves.toMatchObject({ ok: false, kod: 'AUTH_REQUIRED' });
  expect(mockRpc).not.toHaveBeenCalled();
});
it.each(stages)('discards an old-account %s response even after A→B→A', async stage => {
  let resolve!: (value: unknown) => void;
  mockRpc.mockReset(); mockRpc.mockReturnValue(new Promise(done => { resolve = done; }));
  const result = commands[stage]();
  mockAccount = { user: { id: 'account-b' }, accountRevision: 2 };
  mockAccount = { user: { id: 'account-a' }, accountRevision: 3 };
  resolve({ data: results[stage](), error: null });
  await expect(result).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
it.each(stages)('discards %s after logout, including a late transport failure', async stage => {
  let reject!: (value: Error) => void;
  mockRpc.mockReset(); mockRpc.mockReturnValue(new Promise((_done, fail) => { reject = fail; }));
  const result = commands[stage](); mockAccount = { user: null, accountRevision: 2 };
  reject(new Error('sensitive-token-url'));
  await expect(result).resolves.toMatchObject({ ok: false, kod: 'AUTH_ACCOUNT_CHANGED' });
});
it.each(stages)('accepts a same-account %s response across token refresh', async stage => {
  let resolve!: (value: unknown) => void;
  mockRpc.mockReset(); mockRpc.mockReturnValue(new Promise(done => { resolve = done; }));
  const result = commands[stage](); mockAccount = { user: { id: 'account-a' }, accountRevision: 1 };
  resolve({ data: results[stage](), error: null });
  await expect(result).resolves.toMatchObject({ ok: true });
});
it.each(stages)('bounds an unanswered %s without replaying the call or fabricating a receipt', async stage => {
  jest.useFakeTimers(); mockRpc.mockReset(); mockRpc.mockReturnValue(new Promise(() => {}));
  const result = commands[stage]();
  await jest.advanceTimersByTimeAsync(15_001);
  await expect(result).resolves.toMatchObject({ ok: false });
  expect(mockRpc).toHaveBeenCalledTimes(1);
});
it.each(stages)('sanitizes arbitrary %s provider errors, including prototype-property names', async stage => {
  for (const message of ['private-token=https://private', 'constructor', 'toString', '__proto__']) {
    resetRpc({ data: null, error: { message, code: 'private-code' } });
    const result = await commands[stage]();
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(message);
    expect(JSON.stringify(result)).not.toContain('private-code');
  }
});
it.each(stages)('does not infer successful %s from a missing or malformed transport error slot', async stage => {
  for (const value of [{ data: results[stage]() }, { data: results[stage](), error: false }, [], null]) {
    resetRpc(value);
    await expect(commands[stage]()).resolves.toMatchObject({ ok: false });
  }
});
it.each(['', 'short', 'x'.repeat(97), 'wrong key with spaces', '\t' + KEY])('validates a request key without a backend write: %s', key => {
  resetRpc(null);
  return expect(dataExportClientService.requestExport(key)).resolves.toMatchObject({ ok: false, kod: 'INVALID_CLIENT_REQUEST_ID' })
    .then(() => expect(mockRpc).not.toHaveBeenCalled());
});
it('normalizes only SQL btrim spaces and retains the same retry key', async () => {
  resetRpc({ data: receipt(), error: null });
  await expect(dataExportClientService.requestExport(' ' + KEY + ' ')).resolves.toMatchObject({ ok: true });
  expect(mockRpc.mock.calls).toEqual([['rpc_request_data_export', { p_client_request_id: KEY }]]);
});
it.each(['', 'receipt-not-a-uuid'])('rejects an invalid cancellation id locally: %s', id => {
  resetRpc(null);
  return expect(dataExportClientService.cancelExport(id)).resolves.toMatchObject({ ok: false, kod: 'INVALID_RECEIPT_ID' })
    .then(() => expect(mockRpc).not.toHaveBeenCalled());
});
it.each([
  { receiptId: 'invalid' }, { clientRequestId: KEY + '-different' }, { clientRequestId: undefined },
  { status: 'READY' }, { status: 'UNKNOWN' }, { requestedAt: '' }, { requestedAt: 'private' },
  { idempotentReplay: undefined }, { idempotentReplay: 'false' }, { downloadAvailable: undefined },
  { serverFulfillmentRequired: false },
])('refuses an incomplete or uncorrelated creation receipt: %p', async patch => {
  resetRpc({ data: { ...receipt(), ...patch }, error: null });
  await expect(dataExportClientService.requestExport(KEY)).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_INVALID_RESPONSE' });
});
it.each(['REQUESTED', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED', 'EXPIRED'])('retains a truthful same-key replay of status %s', async status => {
  resetRpc({ data: { ...receipt(), idempotentReplay: true, status }, error: null });
  await expect(dataExportClientService.requestExport(KEY)).resolves.toMatchObject({ ok: true, podatak: { idempotentReplay: true, status } });
});
it.each([
  { receiptId: OTHER }, { receiptId: undefined }, { status: 'REQUESTED' }, { cancelledAt: '' },
  { cancelledAt: null }, { idempotentReplay: undefined }, { idempotentReplay: 1 },
])('refuses an incomplete or foreign cancellation receipt: %p', async patch => {
  resetRpc({ data: { ...cancellation(), ...patch }, error: null });
  await expect(dataExportClientService.cancelExport(ID)).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_INVALID_RESPONSE' });
});
it.each([
  { hasRequest: 'true' }, { hasRequest: false }, { request: null }, { request: [] },
  { downloadAvailable: 'true' }, { serverFulfillmentRequired: undefined }, { externalDsrChannelReady: undefined },
])('rejects contradictory status or capability fields rather than treating them as no request: %p', async patch => {
  resetRpc({ data: { ...latest(), ...patch }, error: null });
  await expect(dataExportClientService.readStatus()).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_INVALID_RESPONSE' });
});
it.each([
  { kind: 'OTHER' }, { source: undefined }, { receiptId: 'not-uuid' }, { clientRequestId: '' },
  { requestedAt: undefined }, { updatedAt: 'yesterday' }, { cancelledAt: undefined }, { completedAt: undefined },
  { cancelledAt: DATE }, { completedAt: DATE }, { failureCode: 1 }, { failureCode: '' },
  { status: 'CANCELLED' }, { status: 'READY' }, { status: 'FAILED' }, { status: 'EXPIRED' },
])('rejects unreadable dates, states and source of a recorded request: %p', async patch => {
  resetRpc({ data: { ...latest(), request: request('REQUESTED', patch) }, error: null });
  await expect(dataExportClientService.readStatus()).resolves.toMatchObject({ ok: false, kod: 'DATA_EXPORT_INVALID_RESPONSE' });
});
it.each(['REQUESTED', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED', 'EXPIRED'])('projects the admitted lifecycle %s without inventing a download', async status => {
  resetRpc({ data: { ...latest(), request: request(status, {
    cancelledAt: status === 'CANCELLED' ? DATE : null,
    completedAt: ['READY', 'FAILED', 'EXPIRED'].includes(status) ? DATE : null,
  }), downloadAvailable: true }, error: null });
  await expect(dataExportClientService.readStatus()).resolves.toMatchObject({ ok: true, podatak: { downloadAvailable: false, request: { status } } });
});

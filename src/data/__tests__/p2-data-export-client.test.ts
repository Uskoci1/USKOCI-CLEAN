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
    expect(mockRpc.mock.calls).toEqual([['rpc_get_data_export_status']]);
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
    resetRpc({ data: { receiptId: ID, clientRequestId: KEY, status: 'REQUESTED', requestedAt: 'x', idempotentReplay: false, downloadAvailable: false, serverFulfillmentRequired: true }, error: null });
    const first = await dataExportClientService.requestExport(KEY);
    expect(mockRpc.mock.calls).toEqual([['rpc_request_data_export', { p_client_request_id: KEY }]]);
    expect(first).toMatchObject({ ok: true, podatak: { receiptId: ID, status: 'REQUESTED', idempotentReplay: false } });

    resetRpc({ data: { receiptId: ID, clientRequestId: KEY, status: 'REQUESTED', requestedAt: 'x', idempotentReplay: true }, error: null });
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

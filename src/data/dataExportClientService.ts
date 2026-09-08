import type { DataExportCancellation, DataExportReceipt, DataExportRequest, DataExportRequestStatus, DataExportStatus } from '../contracts/dataExport';
import type { Ishod } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

function fail(kod: string, poruka: string): Ishod<never> {
  return { ok: false, kod, poruka };
}

const STATUSES = new Set<DataExportRequestStatus>(['REQUESTED', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED', 'EXPIRED']);

// Server exception names → product language. The user never sees a code.
const EXPORT_COPY: Record<string, string> = {
  DATA_EXPORT_REQUEST_ALREADY_OPEN: 'Zahtev za izvoz Vaših podataka je već u toku.',
  DATA_EXPORT_REQUEST_NOT_CANCELLABLE: 'Ovaj zahtev više ne može da se otkaže.',
  DATA_EXPORT_REQUEST_NOT_FOUND: 'Zahtev nije pronađen.',
  INVALID_CLIENT_REQUEST_ID: 'Zahtev trenutno nije mogao da se zabeleži. Pokušajte ponovo.',
  INVALID_RECEIPT_ID: 'Zahtev nije pronađen.',
  AUTH_REQUIRED: 'Prijavite se da biste zatražili izvoz podataka.',
};

function exportFailure(error: any, fallback: string): Ishod<never> {
  const name = typeof error?.message === 'string' ? error.message : '';
  return fail(name || error?.code || fallback, EXPORT_COPY[name] ?? 'Radnja trenutno nije mogla da se završi. Pokušajte ponovo.');
}

function mapStatusValue(raw: unknown): DataExportRequestStatus | null {
  return typeof raw === 'string' && STATUSES.has(raw as DataExportRequestStatus) ? (raw as DataExportRequestStatus) : null;
}

function mapRequest(raw: any): DataExportRequest | null {
  const status = mapStatusValue(raw?.status);
  if (!status || typeof raw?.receiptId !== 'string' || typeof raw?.clientRequestId !== 'string') return null;
  return {
    receiptId: raw.receiptId,
    clientRequestId: raw.clientRequestId,
    status,
    requestedAt: String(raw.requestedAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    cancelledAt: typeof raw.cancelledAt === 'string' ? raw.cancelledAt : null,
    completedAt: typeof raw.completedAt === 'string' ? raw.completedAt : null,
    failureCode: typeof raw.failureCode === 'string' ? raw.failureCode : null,
  };
}

/**
 * P2 — the only client owner of data-export requests. A recorded request is
 * never presented as a download; `downloadAvailable` is pinned to false
 * regardless of what a future server projection says, until a delivery unit
 * exists. Requests carry one stable request id so a retry replays the receipt.
 */
export const dataExportClientService = {
  async readStatus(): Promise<Ishod<DataExportStatus>> {
    const { data, error } = await supabase.rpc('rpc_get_data_export_status');
    if (error) return exportFailure(error, 'DATA_EXPORT_STATUS_FAILED');
    if (!data || typeof data.hasRequest !== 'boolean') return fail('DATA_EXPORT_INVALID_RESPONSE', 'Server nije vratio stanje zahteva za izvoz.');
    const request = data.hasRequest ? mapRequest(data.request) : null;
    if (data.hasRequest && !request) return fail('DATA_EXPORT_INVALID_RESPONSE', 'Server nije vratio čitljiv zahtev za izvoz.');
    return {
      ok: true,
      podatak: {
        hasRequest: Boolean(request),
        request,
        downloadAvailable: false,
        serverFulfillmentRequired: true,
        externalDsrChannelReady: data.externalDsrChannelReady === true,
      },
    };
  },

  async requestExport(clientRequestId: string): Promise<Ishod<DataExportReceipt>> {
    const { data, error } = await supabase.rpc('rpc_request_data_export', { p_client_request_id: clientRequestId });
    if (error) return exportFailure(error, 'DATA_EXPORT_REQUEST_FAILED');
    const status = mapStatusValue(data?.status);
    if (!status || typeof data?.receiptId !== 'string') return fail('DATA_EXPORT_INVALID_RESPONSE', 'Server nije potvrdio zahtev za izvoz.');
    return {
      ok: true,
      podatak: {
        receiptId: data.receiptId,
        clientRequestId: String(data.clientRequestId ?? clientRequestId),
        status,
        requestedAt: String(data.requestedAt ?? ''),
        idempotentReplay: data.idempotentReplay === true,
      },
    };
  },

  async cancelExport(receiptId: string): Promise<Ishod<DataExportCancellation>> {
    const { data, error } = await supabase.rpc('rpc_cancel_data_export', { p_receipt_id: receiptId });
    if (error) return exportFailure(error, 'DATA_EXPORT_CANCEL_FAILED');
    if (data?.status !== 'CANCELLED' || typeof data?.receiptId !== 'string') return fail('DATA_EXPORT_INVALID_RESPONSE', 'Server nije potvrdio otkazivanje.');
    return {
      ok: true,
      podatak: { receiptId: data.receiptId, status: 'CANCELLED', cancelledAt: String(data.cancelledAt ?? ''), idempotentReplay: data.idempotentReplay === true },
    };
  },
};

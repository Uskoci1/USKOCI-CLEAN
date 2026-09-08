import type { DataExportCancellation, DataExportReceipt, DataExportRequest, DataExportRequestStatus, DataExportStatus } from '../contracts/dataExport';
import type { Ishod } from './ports';
import { failure, readReceipt, record, sameId, timestamp, uuid } from './serverReceipt';

const STATUSES: ReadonlySet<string> = new Set(['REQUESTED', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED', 'EXPIRED']);
const TERMINAL: ReadonlySet<string> = new Set(['READY', 'FAILED', 'EXPIRED']);
const INVALID = 'DATA_EXPORT_INVALID_RESPONSE';
const EXPORT_COPY: Readonly<Record<string, string>> = {
  DATA_EXPORT_REQUEST_ALREADY_OPEN: 'Zahtev za izvoz Vaših podataka je već u toku.',
  DATA_EXPORT_REQUEST_NOT_CANCELLABLE: 'Ovaj zahtev više ne može da se otkaže.',
  DATA_EXPORT_REQUEST_NOT_FOUND: 'Zahtev nije pronađen.',
  INVALID_CLIENT_REQUEST_ID: 'Zahtev trenutno nije mogao da se zabeleži. Pokušajte ponovo.',
  INVALID_RECEIPT_ID: 'Zahtev nije pronađen.',
  AUTH_REQUIRED: 'Prijavite se da biste zatražili izvoz podataka.',
};

function statusValue(value: unknown): value is DataExportRequestStatus {
  return typeof value === 'string' && STATUSES.has(value);
}
function requestKey(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 16 && value.length <= 96 && /^[A-Za-z0-9_-]+$/.test(value);
}
function nullableTimestamp(value: unknown): value is string | null { return value === null || timestamp(value); }
function failureCode(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && Array.from(value).length >= 3 && Array.from(value).length <= 64);
}
function mapRequest(raw: unknown): DataExportRequest | null {
  const value = record(raw);
  if (!value || !uuid(value.receiptId) || !requestKey(value.clientRequestId) || !statusValue(value.status) ||
      value.kind !== 'ACCESS_EXPORT' || value.source !== 'IN_APP_AUTHENTICATED' ||
      !timestamp(value.requestedAt) || !timestamp(value.updatedAt) ||
      !nullableTimestamp(value.cancelledAt) || !nullableTimestamp(value.completedAt) || !failureCode(value.failureCode)) return null;
  // Mirror the admitted SQL constraints; do not infer missing lifecycle dates.
  if ((value.status === 'CANCELLED') !== (value.cancelledAt !== null) ||
      TERMINAL.has(value.status) !== (value.completedAt !== null)) return null;
  return {
    receiptId: value.receiptId, clientRequestId: value.clientRequestId, status: value.status,
    requestedAt: value.requestedAt, updatedAt: value.updatedAt,
    cancelledAt: value.cancelledAt, completedAt: value.completedAt, failureCode: value.failureCode,
  };
}
function intakeOnly(value: Record<string, unknown>): boolean {
  // A future server download flag cannot activate an unimplemented delivery client.
  return typeof value.downloadAvailable === 'boolean' && value.serverFulfillmentRequired === true;
}

async function exportReceipt<T>(options: Parameters<typeof readReceipt<T>>[0]): Promise<Ishod<T>> {
  const result = await readReceipt(options);
  if (!result.ok && result.kod === 'AUTH_ACCOUNT_CHANGED') {
    return failure(result.kod, 'Nalog je promenjen. Ponovo otvorite stanje izvoza podataka.');
  }
  if (!result.ok && result.kod === 'AUTH_REQUIRED') return failure(result.kod, EXPORT_COPY.AUTH_REQUIRED);
  return result;
}

/**
 * The existing account-owned receipt boundary bounds network waits and discards
 * stale responses, including A→B→A. No automatic write retry or synthetic receipt.
 * This unit accepts an export request; it does not generate or deliver the export.
 */
export const dataExportClientService = {
  readStatus(): Promise<Ishod<DataExportStatus>> {
    return exportReceipt({
      rpc: 'rpc_get_data_export_status', args: {}, errors: EXPORT_COPY,
      fallback: 'DATA_EXPORT_STATUS_FAILED', invalid: INVALID,
      decode(raw): DataExportStatus | null {
        const value = record(raw);
        if (!value || typeof value.hasRequest !== 'boolean' || !intakeOnly(value) ||
            typeof value.externalDsrChannelReady !== 'boolean') return null;
        const request = value.hasRequest ? mapRequest(value.request) : null;
        if ((value.hasRequest && !request) || (!value.hasRequest && value.request !== null)) return null;
        return { hasRequest: value.hasRequest, request, downloadAvailable: false,
          serverFulfillmentRequired: true, externalDsrChannelReady: value.externalDsrChannelReady };
      },
    });
  },

  requestExport(clientRequestId: string): Promise<Ishod<DataExportReceipt>> {
    // Match SQL btrim(text)'s space normalization, not a freshly generated retry key.
    const key = typeof clientRequestId === 'string' ? clientRequestId.replace(/^ +| +$/g, '') : '';
    if (!requestKey(key)) return Promise.resolve(failure('INVALID_CLIENT_REQUEST_ID', EXPORT_COPY.INVALID_CLIENT_REQUEST_ID));
    return exportReceipt({
      rpc: 'rpc_request_data_export', args: { p_client_request_id: key }, errors: EXPORT_COPY,
      fallback: 'DATA_EXPORT_REQUEST_FAILED', invalid: INVALID, write: true,
      decode(raw): DataExportReceipt | null {
        const value = record(raw);
        if (!value || !uuid(value.receiptId) || value.clientRequestId !== key || !statusValue(value.status) ||
            !timestamp(value.requestedAt) || typeof value.idempotentReplay !== 'boolean' || !intakeOnly(value)) return null;
        if (!value.idempotentReplay && value.status !== 'REQUESTED') return null;
        return { receiptId: value.receiptId, clientRequestId: key, status: value.status,
          requestedAt: value.requestedAt, idempotentReplay: value.idempotentReplay };
      },
    });
  },

  cancelExport(receiptId: string): Promise<Ishod<DataExportCancellation>> {
    if (!uuid(receiptId)) return Promise.resolve(failure('INVALID_RECEIPT_ID', EXPORT_COPY.INVALID_RECEIPT_ID));
    return exportReceipt({
      rpc: 'rpc_cancel_data_export', args: { p_receipt_id: receiptId }, errors: EXPORT_COPY,
      fallback: 'DATA_EXPORT_CANCEL_FAILED', invalid: INVALID, write: true,
      decode(raw): DataExportCancellation | null {
        const value = record(raw);
        if (!value || !sameId(value.receiptId, receiptId) || value.status !== 'CANCELLED' ||
            !timestamp(value.cancelledAt) || typeof value.idempotentReplay !== 'boolean') return null;
        return { receiptId: value.receiptId, status: 'CANCELLED', cancelledAt: value.cancelledAt,
          idempotentReplay: value.idempotentReplay };
      },
    });
  },
};

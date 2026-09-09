/** P2 — data-export request ledger as the server projects it. */

export type DataExportRequestStatus = 'REQUESTED' | 'PROCESSING' | 'READY' | 'FAILED' | 'CANCELLED' | 'EXPIRED';

export type DataExportRequest = {
  receiptId: string;
  clientRequestId: string;
  status: DataExportRequestStatus;
  requestedAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  completedAt: string | null;
  failureCode: string | null;
};

/**
 * Honest by design: a recorded request is not an export artifact.
 * `downloadAvailable` is always false at this boundary and fulfilment is a
 * server act; the client never offers a download it cannot produce.
 */
export type DataExportStatus = {
  hasRequest: boolean;
  request: DataExportRequest | null;
  downloadAvailable: false;
  serverFulfillmentRequired: true;
  externalDsrChannelReady: boolean;
};

export type DataExportReceipt = {
  receiptId: string;
  clientRequestId: string;
  status: DataExportRequestStatus;
  requestedAt: string;
  idempotentReplay: boolean;
};

export type DataExportCancellation = {
  receiptId: string;
  status: 'CANCELLED';
  cancelledAt: string;
  idempotentReplay: boolean;
};

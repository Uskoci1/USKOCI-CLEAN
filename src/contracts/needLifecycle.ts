/** Requester-side terminal commands on a Zadatak, as the server receipts them. */

export type NeedCancellationReceipt = {
  needId: string;
  status: 'CANCELLED';
  revision: number;
  /** Prijave the server expired as a consequence; 0 on replay. */
  affectedResponses: number;
  idempotentReplay: boolean;
};

export type DraftDeletionReceipt = {
  needId: string;
  revision: number;
  deleted: true;
  idempotentReplay: boolean;
};

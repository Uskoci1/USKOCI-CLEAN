export type AgreementMessageCommand = Readonly<{
  accountId: string;
  agreementId: string;
  clientMessageId: string;
  body: string;
}>;

export type AgreementMessageErrorCode = 'AUTH_CONTEXT_CHANGED' | 'INVALID_MESSAGE' | 'READ_ONLY'
  | 'NOT_AVAILABLE' | 'CONFLICT' | 'UNAVAILABLE' | 'INVALID_RESPONSE';

export class AgreementMessageError extends Error {
  constructor(readonly code: AgreementMessageErrorCode) { super(code); this.name = 'AgreementMessageError'; }
}

export interface AgreementMessagePort {
  /** Retry the same immutable command. A transport failure does not prove absence. */
  send(command: AgreementMessageCommand): Promise<{ messageId: string }>;
}

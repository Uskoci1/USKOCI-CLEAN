import {
  AgreementMessageError, type AgreementMessageCommand, type AgreementMessageErrorCode, type AgreementMessagePort,
} from '../contracts/agreementMessages';
import { supabaseKlijent } from './supabaseClient';

type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key = /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,199}$/;
const exactUuid = (value: string) => value.length === 36 && uuid.test(value);
function wellFormedUnicode(value: string): boolean {
  for (const point of value) {
    const code = point.codePointAt(0)!;
    if (code >= 0xd800 && code <= 0xdfff) return false;
  }
  return true;
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const fail = (code: AgreementMessageErrorCode): never => { throw new AgreementMessageError(code); };

/** Capture before any await; neither a token switch nor an edited draft changes this intent. */
export function captureAgreementMessage(input: AgreementMessageCommand): AgreementMessageCommand {
  if (!input || typeof input.accountId !== 'string' || !exactUuid(input.accountId)) return fail('AUTH_CONTEXT_CHANGED');
  if (typeof input.agreementId !== 'string' || !exactUuid(input.agreementId)
    || typeof input.clientMessageId !== 'string' || !key.test(input.clientMessageId) || /\s/.test(input.clientMessageId)
    || typeof input.body !== 'string') return fail('INVALID_MESSAGE');
  const body = input.body.trim();
  // PostgreSQL char_length counts Unicode code points, not JavaScript UTF-16 units.
  if (!body || Array.from(body).length > 2000 || body.includes('\0') || !wellFormedUnicode(body)) return fail('INVALID_MESSAGE');
  return Object.freeze({ accountId: input.accountId, agreementId: input.agreementId,
    clientMessageId: input.clientMessageId, body });
}

export function createAgreementMessageService(rpc: Rpc): AgreementMessagePort {
  return {
    async send(input) {
      const command = captureAgreementMessage(input);
      let response;
      try {
        response = await rpc('rpc_send_agreement_message_v2', {
          p_expected_user_id: command.accountId, p_agreement_id: command.agreementId,
          p_client_message_id: command.clientMessageId, p_body: command.body,
        });
      } catch { return fail('UNAVAILABLE'); }
      if (!object(response)) return fail('INVALID_RESPONSE');
      if (response.error) {
        const error = object(response.error) ? response.error : {};
        if (error.code === '28000') return fail('AUTH_CONTEXT_CHANGED');
        if (error.code === '40001') return fail('CONFLICT');
        if (error.code === '42501' || error.code === 'P0002') return fail('NOT_AVAILABLE');
        if (error.message === 'CHAT_NOT_AVAILABLE') return fail('READ_ONLY');
        if (error.code === '22001' || error.code === '22023' || error.message === 'MESSAGE_REQUIRED') return fail('INVALID_MESSAGE');
        return fail('UNAVAILABLE');
      }
      if (typeof response.data !== 'string' || !exactUuid(response.data)) return fail('INVALID_RESPONSE');
      return { messageId: response.data };
    },
  };
}

// Inert until the accepted forward contract is live and the real screen is bound.
export const agreementMessageClientService = createAgreementMessageService(
  (name, args) => supabaseKlijent().rpc(name, args),
);

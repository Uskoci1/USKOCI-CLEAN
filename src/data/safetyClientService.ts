import type { Ishod } from './ports';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';
import { failure, readOwnedResult, record, sameId, timestamp, uuid, type ReceiptAccount } from './serverReceipt';
export const SAFETY_CATEGORIES = ['HARASSMENT', 'FRAUD', 'UNSAFE_WORK', 'DISCRIMINATION', 'OTHER'] as const;
export type SafetyCategory = typeof SAFETY_CATEGORIES[number];
export type AccountBlockState = { accountId: string; targetAccountId: string; blocked: boolean; revision: number; authoritative: true };
export type AccountBlockCommand = { targetAccountId: string; blocked: boolean; expectedRevision: number; clientRequestId: string };
export type AccountBlockReceipt = AccountBlockState & { clientRequestId: string; idempotentReplay: boolean };
export type SafetyReportCommand = { targetAccountId: string; needId: string | null; agreementId: string | null;
  category: SafetyCategory; reason: string; narrative: string; clientRequestId: string };
export type SafetyReportReceipt = { reportId: string; received: true; createdAt: string; clientRequestId: string; idempotentReplay: boolean; authoritative: true };
const errors: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavite se da biste nastavili.',
  BLOCK_INPUT_INVALID: 'Ponovo otvorite profil korisnika.',
  BLOCK_REVISION_CONFLICT: 'Izbor blokiranja je promenjen. Proverite aktuelno stanje.',
  TARGET_NOT_AVAILABLE: 'Korisnik trenutno nije dostupan.',
  REQUEST_ID_REUSED: 'Zahtev je već upotrebljen. Proverite potvrdu prethodne radnje.',
  SAFETY_REPORT_INPUT_INVALID: 'Proverite kategoriju i dužinu privatne prijave.',
  SAFETY_CONTEXT_NOT_AVAILABLE: 'Ovaj kontekst nije dostupan za prijavu.',
  REPORT_NOT_AVAILABLE: 'Privatna prijava nije dostupna ovom nalogu.',
  INTERACTION_BLOCKED: 'Ova komunikacija trenutno nije dostupna.',
};
const revision = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x < 2_147_483_647;
const text = (x: unknown, max: number, required: boolean): x is string => typeof x === 'string' && !x.includes('\0') &&
  (!required || x.trim().length > 0) && [...x.trim()].length <= max && [...x].every(c => { const n = c.codePointAt(0)!; return n < 0xd800 || n > 0xdfff; });
function scope(explicit?: ReceiptAccount): ReceiptAccount | null {
  const s = sesijaSada(); const a = explicit ?? (s.user ? { accountId: s.user.id, accountRevision: s.accountRevision } : null);
  return a && uuid(a.accountId) ? { ...a } : null;
}
function block(raw: unknown, accountId: string, target: string): AccountBlockState | null {
  const r = record(raw);
  if (!r || !sameId(r.accountId, accountId) || !sameId(r.targetAccountId, target) || typeof r.blocked !== 'boolean' ||
      !revision(r.revision) || r.authoritative !== true) return null;
  return { accountId, targetAccountId: target, blocked: r.blocked, revision: r.revision, authoritative: true };
}
function bad<T>(name: keyof typeof errors): Promise<Ishod<T>> { return Promise.resolve(failure(name, errors[name])); }
/** Private report and outgoing block choice only. No narrative readback to a target,
 * incoming-block disclosure, UI optimism, automatic retry, or Agreement recovery writer. */
export const safetyClientService = {
  readBlock(target: string, explicit?: ReceiptAccount): Promise<Ishod<AccountBlockState>> {
    const account = scope(explicit); if (!account) return bad('AUTH_REQUIRED');
    if (!uuid(target) || sameId(target, account.accountId)) return bad('BLOCK_INPUT_INVALID');
    return readOwnedResult({ account, request: () => supabaseKlijent().rpc('rpc_get_account_block', { p_target_account_id: target }),
      decode: raw => block(raw, account.accountId, target), errors, fallback: 'BLOCK_READ_UNAVAILABLE', invalid: 'BLOCK_INVALID_RECEIPT' });
  },
  setBlock(input: AccountBlockCommand, explicit?: ReceiptAccount): Promise<Ishod<AccountBlockReceipt>> {
    const account = scope(explicit); if (!account) return bad('AUTH_REQUIRED');
    if (!input || !uuid(input.targetAccountId) || sameId(input.targetAccountId, account.accountId) || !uuid(input.clientRequestId) ||
        typeof input.blocked !== 'boolean' || !revision(input.expectedRevision) || input.expectedRevision >= 2_147_483_646) return bad('BLOCK_INPUT_INVALID');
    const args = { p_target_account_id: input.targetAccountId, p_blocked: input.blocked, p_expected_revision: input.expectedRevision, p_client_request_id: input.clientRequestId };
    return readOwnedResult({ account, write: true, request: () => supabaseKlijent().rpc('rpc_set_account_block', args),
      errors, fallback: 'BLOCK_OUTCOME_UNKNOWN', invalid: 'BLOCK_INVALID_RECEIPT', decode: raw => {
        const r = record(raw), state = block(raw, account.accountId, args.p_target_account_id);
        if (!state || !r || !sameId(r.clientRequestId, args.p_client_request_id) || typeof r.idempotentReplay !== 'boolean' ||
            state.revision !== args.p_expected_revision + 1 || state.blocked !== args.p_blocked) return null;
        return { ...state, clientRequestId: args.p_client_request_id, idempotentReplay: r.idempotentReplay };
      } });
  },
  report(input: SafetyReportCommand, explicit?: ReceiptAccount): Promise<Ishod<SafetyReportReceipt>> {
    const account = scope(explicit); if (!account) return bad('AUTH_REQUIRED');
    if (!input || !uuid(input.targetAccountId) || sameId(input.targetAccountId, account.accountId) || !uuid(input.clientRequestId) ||
        (input.needId !== null && !uuid(input.needId)) || (input.agreementId !== null && !uuid(input.agreementId)) ||
        !SAFETY_CATEGORIES.includes(input.category) || !text(input.reason, 200, true) || !text(input.narrative, 2000, false)) return bad('SAFETY_REPORT_INPUT_INVALID');
    const args = { p_target_account_id: input.targetAccountId, p_need_id: input.needId, p_agreement_id: input.agreementId,
      p_category: input.category, p_reason: input.reason.trim(), p_narrative: input.narrative.trim(), p_client_request_id: input.clientRequestId };
    return readOwnedResult({ account, write: true, request: () => supabaseKlijent().rpc('rpc_submit_safety_report', args), errors,
      fallback: 'SAFETY_REPORT_OUTCOME_UNKNOWN', invalid: 'SAFETY_REPORT_INVALID_RECEIPT', decode: raw => {
        const r = record(raw);
        if (!r || !uuid(r.reportId) || r.received !== true || !timestamp(r.createdAt) || !sameId(r.clientRequestId, args.p_client_request_id) ||
            typeof r.idempotentReplay !== 'boolean' || r.authoritative !== true) return null;
        return { reportId: r.reportId, received: true, createdAt: r.createdAt, clientRequestId: args.p_client_request_id,
          idempotentReplay: r.idempotentReplay, authoritative: true };
      } });
  },
};

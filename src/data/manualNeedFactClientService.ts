import type { AiNeedV2Fact } from '../contracts/aiNeedV2';
import { NEED_FACT_V2_DEFINITIONS, isNeedFactV2Key, type NeedFactV2Key } from '../contracts/needFactsV2';
import { correctionFromText } from './aiNeedV2Ui';
import type { Ishod } from './ports';
import { sesijaSada } from '../store/sesija';
import { failure, readReceipt, record, sameId, uuid } from './serverReceipt';

export type ManualNeedFactReceipt = Readonly<{
  accountId: string;
  conversationId: string;
  clientRequestId: string;
  factId: string;
  factKey: NeedFactV2Key;
  authoritative: true;
  idempotentReplay: boolean;
}>;

export type ManualNeedFactCommand = Readonly<{
  conversationId: string;
  clientRequestId: string;
  key: NeedFactV2Key;
  value: unknown;
  displayValue: string;
}>;

const MANUAL_FACT_KEYS = new Set<NeedFactV2Key>([
  'need.title',
  'need.description',
  'need.category',
  'need.price_mode',
  'need.price_rsd',
  'need.schedule_kind',
  'need.starts_at',
  'need.ends_at',
  'need.people_needed',
  'need.required_skills',
  'need.required_tools',
  'need.required_vehicles',
  'need.required_licenses',
  'need.minimum_experience_years',
  'need.verified_identity_required',
  'need.critical_conditions',
]);

const ERRORS: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavite se da biste ručno uneli podatak.',
  CONVERSATION_NOT_FOUND: 'Priprema Zadatka nije pronađena.',
  CONVERSATION_NOT_EDITABLE: 'Ovaj Zadatak više ne može ručno da se menja.',
  V2_FACT_KEY_INVALID: 'Ovaj podatak nije podržan za ručni unos.',
  V2_FACT_VALUE_REQUIRED: 'Unesite vrednost.',
  V2_FACT_TYPE_INVALID: 'Vrednost nije u očekivanom formatu.',
  V2_FACT_DISPLAY_INVALID: 'Prikaz vrednosti nije ispravan.',
  MANUAL_FACT_USE_LOCATION_EDITOR: 'Lokaciju unesite kroz postojeći editor mesta.',
  MANUAL_FACT_USE_MEDIA_EDITOR: 'Fotografije dodajte kroz postojeći editor fotografija.',
  VERIFIED_IDENTITY_UNAVAILABLE: 'Provera identiteta nije dostupna. Nastavite bez tog uslova.',
  CLIENT_REQUEST_ID_INVALID: 'Zahtev nije ispravan. Ponovo otvorite ručni unos.',
  CLIENT_REQUEST_ID_REUSED_WITH_DIFFERENT_SNAPSHOT: 'Ovaj zahtev već pripada drugoj izmeni. Osvežite podatke pre ponovnog pokušaja.',
};

function safeValue(value: unknown, depth = 0): boolean {
  if (depth > 6) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 50 && value.every(item => safeValue(item, depth + 1));
  if (typeof value !== 'object') return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.length <= 50 && entries.every(([, item]) => safeValue(item, depth + 1));
}

export function canBootstrapManualNeedFact(key: NeedFactV2Key): boolean {
  return MANUAL_FACT_KEYS.has(key);
}

/** Reuse the canonical correction parser for a missing scalar/list fact.
 * Object/location/media facts keep their existing dedicated editors. */
export function manualNeedFactFromText(key: NeedFactV2Key, input: string):
  | { ok: true; value: unknown; displayValue: string }
  | { ok: false; message: string } {
  if (!MANUAL_FACT_KEYS.has(key)) return { ok: false, message: 'Ovaj podatak se unosi kroz poseban editor.' };
  const definition = NEED_FACT_V2_DEFINITIONS[key];
  const synthetic: AiNeedV2Fact = {
    id: key,
    key,
    value: '',
    displayValue: '',
    valueType: definition.valueType,
    privacyClass: definition.privacyClass,
    requiredForDraft: definition.requiredForDraft,
    status: 'CONFIRMED',
    source: 'EXPLICIT_USER_ANSWER',
    evidence: null,
  };
  return correctionFromText(synthetic, input);
}

export const manualNeedFactClientService = {
  save(command: ManualNeedFactCommand): Promise<Ishod<ManualNeedFactReceipt>> {
    const displayValue = typeof command?.displayValue === 'string' ? command.displayValue.trim() : '';
    if (!uuid(command?.conversationId) || !uuid(command?.clientRequestId) || !isNeedFactV2Key(command?.key)
      || !MANUAL_FACT_KEYS.has(command.key) || !displayValue || Array.from(displayValue).length > 1000
      || !safeValue(command.value) || JSON.stringify(command.value).length > 16_384) {
      return Promise.resolve(failure('MANUAL_FACT_INPUT_INVALID', 'Proverite ručno uneti podatak.'));
    }
    if (command.key === 'need.verified_identity_required' && command.value !== false) {
      return Promise.resolve(failure('VERIFIED_IDENTITY_UNAVAILABLE', ERRORS.VERIFIED_IDENTITY_UNAVAILABLE));
    }
    const state = sesijaSada();
    const accountId = state.user?.id;
    if (!accountId) return Promise.resolve(failure('AUTH_REQUIRED', ERRORS.AUTH_REQUIRED));
    return readReceipt({
      account: { accountId, accountRevision: state.accountRevision },
      rpc: 'rpc_set_manual_need_fact_v2',
      args: {
        p_conversation_id: command.conversationId,
        p_client_request_id: command.clientRequestId,
        p_fact_key: command.key,
        p_value: command.value,
        p_display_value: displayValue,
      },
      errors: ERRORS,
      fallback: 'MANUAL_FACT_SAVE_UNCONFIRMED',
      invalid: 'MANUAL_FACT_SAVE_INVALID_RESPONSE',
      write: true,
      decode(raw): ManualNeedFactReceipt | null {
        const value = record(raw);
        if (!value || !sameId(value.accountId, accountId) || !sameId(value.conversationId, command.conversationId)
          || !sameId(value.clientRequestId, command.clientRequestId) || !uuid(value.factId)
          || value.factKey !== command.key || value.authoritative !== true || typeof value.idempotentReplay !== 'boolean') return null;
        return {
          accountId: value.accountId,
          conversationId: value.conversationId,
          clientRequestId: value.clientRequestId,
          factId: value.factId,
          factKey: command.key,
          authoritative: true,
          idempotentReplay: value.idempotentReplay,
        };
      },
    });
  },
};

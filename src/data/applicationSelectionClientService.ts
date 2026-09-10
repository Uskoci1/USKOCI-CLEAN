import type { Ishod, IzborKomanda, Izvor, PodnesiPrijavuKomanda } from './ports';
import { calendarFailure } from './calendarErrors';
import { calendarInstant } from '../lib/calendarTime';
import { failure, positiveInteger, readOwnedResult, record, sameId, uuid } from './serverReceipt';
import { supabaseKlijent } from './supabaseClient';
import { sesijaSada } from '../store/sesija';

export const applicationSelectionErrors: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavite se da biste nastavili.',
  OWN_NEED: 'Ne možete da se prijavite na svoj Zadatak.',
  NOT_REQUESTER: 'Ove Prijave su dostupne Naručiocu Zadatka.',
  NEED_NOT_FOUND: 'Zadatak više nije dostupan.',
  NEED_NOT_OPEN: 'Zadatak više ne prima prijave i izbore.',
  RESPONSE_WINDOW_EXPIRED: 'Rok za prijave je istekao.',
  STALE_REVIEW_REQUIRED: 'Zadatak ili Prijava su promenjeni. Pregledajte aktuelne podatke pre novog izbora.',
  NEED_REVISION_MISMATCH: 'Zadatak je promenjen. Pregledajte aktuelne uslove pre nove prijave.',
  RESPONSE_NOT_SELECTABLE: 'Ova Prijava više nije dostupna za izbor.',
  RESPONSE_NOT_FOUND: 'Prijava više nije dostupna.',
  RESPONSE_ALREADY_SELECTED: 'Ova Prijava je već izabrana. Otvorite svoje Dogovore.',
  PROFILE_NOT_OWNED_BY_ACCOUNT: 'Ponovo otvorite svoj radni profil pre prijave.',
  NEED_FULL: 'Sva mesta na ovom Zadatku su popunjena.',
  NEED_REMAINING_CAPACITY_EXCEEDED: 'Broj ljudi premašuje preostala mesta na Zadatku.',
  INVALID_COVERED_SLOTS: 'Unesite ceo broj ljudi koje obezbeđujete.',
  INVALID_PRICE: 'Unesite ceo pozitivan iznos u RSD.',
  FIXED_PRICE_NOT_READY: 'Cena Zadatka trenutno nije spremna. Ponovo otvorite Zadatak.',
  FIXED_PRICE_MISMATCH: 'Cena Zadatka je promenjena. Pregledajte aktuelnu cenu pre nove Prijave.',
  INVALID_PROPOSED_INTERVAL: 'Kraj predloženog termina mora biti posle početka.',
  WORKER_PROFILE_NOT_READY: 'Radni profil još ne ispunjava uslove za ovu Prijavu.',
  WORKER_NOT_ELIGIBLE: 'Radni profil ili dostupnost ne ispunjavaju uslove Zadatka.',
  WORKER_NO_LONGER_ELIGIBLE: 'Radni profil ili dostupnost su promenjeni. Pregledajte Prijave ponovo.',
  TEAM_CAPACITY_EXCEEDED: 'Broj ljudi u Prijavi premašuje kapacitet radnog profila.',
  OVERFILL: 'Prijava pokriva više ljudi nego što je još potrebno.',
  CONNECTION_POLICY_NOT_READY: 'Povezivanje trenutno nije dostupno. Pokušajte kasnije.',
  IDEMPOTENCY_KEY_REUSED: 'Ovaj zahtev je već vezan za drugu ponudu. Proverite sačuvano stanje.',
  WORKER_CALENDAR_CONFLICT: 'Termin se preklapa sa potvrđenim Dogovorom. Osvežite kalendar i izaberite drugi termin.',
  CALENDAR_RECHECK_REQUIRED: 'Raspored se upravo promenio. Osvežite podatke pre ponovnog pokušaja.',
  AGREEMENT_CALENDAR_INTERVAL_INVALID: 'Proverite tačan početak i kraj predloženog termina.',
};
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const key = (value: string) => value.trim().length >= 8 && value.trim().length <= 200;
function interval(start: string | null, end: string | null) {
  if (start === null || end === null) return start === null && end === null;
  const from = calendarInstant(start), to = calendarInstant(end);
  return from !== null && to !== null && from < to;
}
const invalid = () => failure('APPLICATION_COMMAND_INVALID', 'Proverite cenu, broj ljudi i termin svoje ponude.');
/** Bounds the two composed screen reads, including legacy SDK readers. The
 * caller's existing focus/account/generation guard owns the result. A deadline
 * stops waiting; it does not claim cancellation of an already issued request. */
export async function boundedApplicationSelectionRead<T>(read: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([read, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('APPLICATION_SELECTION_READ_TIMEOUT')), 15_000);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
async function command<T>(rpc: string, args: Record<string, unknown>, decode: (raw: unknown) => T | null): Promise<Ishod<T>> {
  return readOwnedResult({ write: true, errors: applicationSelectionErrors,
    fallback: 'APPLICATION_SELECTION_UNCONFIRMED', invalid: 'APPLICATION_SELECTION_INVALID_RECEIPT', decode,
    request: async () => {
      const result = await supabaseKlijent().rpc(rpc, args);
      const calendar = calendarFailure(result.error);
      return calendar && !calendar.ok ? { data: null, error: { message: calendar.kod } } : result;
    },
  });
}

/** Sole canonical submit/select adapter. Explicit retries reuse the caller's
 * immutable request. Server still owns eligibility, calendar and atomic Agreement. */
export const applicationSelectionClientService: Pick<Izvor, 'podnesiPrijavu' | 'izaberiPrijavu'> = {
  podnesiPrijavu(k: PodnesiPrijavuKomanda) {
    if (!uuid(k.potrebaId) || !uuid(k.radnikProfilId) || !positiveInteger(k.potrebaRevizija) ||
        !positiveInteger(k.pokrivenaMesta) || !positiveInteger(k.cenaRsd) || !key(k.clientRequestId) ||
        !interval(k.predlozeniPocetak, k.predlozeniKraj) ||
        (k.napomena !== null && (typeof k.napomena !== 'string' || k.napomena.length > 4000))) return Promise.resolve(invalid());
    return command('rpc_submit_response', {
      p_need_id: k.potrebaId, p_need_revision: k.potrebaRevizija, p_worker_profile_id: k.radnikProfilId,
      p_covered_slots: k.pokrivenaMesta, p_price_rsd: k.cenaRsd,
      p_proposed_start_at: k.predlozeniPocetak, p_proposed_end_at: k.predlozeniKraj,
      p_scope_note: k.napomena, p_client_request_id: k.clientRequestId,
    }, raw => {
      const value = record(raw);
      if (!value || !uuid(value.responseId) || !sameId(value.applicationId, value.responseId) ||
          !positiveInteger(value.version) || value.needRevision !== k.potrebaRevizija || !hash(value.contentHash) ||
          !['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(String(value.status)) ||
          !['MY_PRICE', 'OFFERS'].includes(String(value.pricingMode)) || value.coveredSlots !== k.pokrivenaMesta ||
          value.snapshotSchema !== 'APPLICATION_V1_SELF_DECLARED' || value.authoritative !== true ||
          typeof value.idempotentReplay !== 'boolean') return null;
      return { prijavaId: value.responseId, verzija: value.version, hash: value.contentHash };
    });
  },
  izaberiPrijavu(k: IzborKomanda) {
    if (!uuid(k.potrebaId) || !uuid(k.prijavaId) || !positiveInteger(k.potrebaRevizija) ||
        !positiveInteger(k.prijavaVerzija) || !positiveInteger(k.mesta) || !hash(k.prijavaHash) || !key(k.clientRequestId)) {
      return Promise.resolve(failure('SELECTION_COMMAND_INVALID', 'Ponovo otvorite konkretnu Prijavu pre izbora.'));
    }
    return command('rpc_select_response', { p_need_id: k.potrebaId, p_need_revision: k.potrebaRevizija,
      p_response_id: k.prijavaId, p_response_version: k.prijavaVerzija, p_content_hash: k.prijavaHash,
      p_client_request_id: k.clientRequestId }, raw => uuid(raw) ? { dogovorId: raw } : null);
  },
};

/** Existing requester/participant SELECT policies remain the authority. A null
 * link means no visible matching Agreement; it never proves the selection absent. */
export function readSelectedAgreement(potrebaId: string, prijavaId: string): Promise<Ishod<{ dogovorId: string | null }>> {
  if (!uuid(potrebaId) || !uuid(prijavaId)) return Promise.resolve(failure('SELECTION_LINK_INVALID', 'Ponovo otvorite konkretnu Prijavu.'));
  const owner = sesijaSada();
  if (!owner.user?.id) return Promise.resolve(failure('AUTH_REQUIRED', 'Prijavite se da biste otvorili Dogovor.'));
  const account = { accountId: owner.user.id, accountRevision: owner.accountRevision };
  return readOwnedResult({ account, errors: {}, fallback: 'SELECTION_LINK_UNAVAILABLE', invalid: 'SELECTION_LINK_INVALID',
    request: () => supabaseKlijent().from('need_selections')
      .select('need_id,response_id,status,agreements(id,need_id,selected_response_id)')
      .eq('need_id', potrebaId).eq('response_id', prijavaId).eq('status', 'SELECTED')
      .eq('selected_by_account_id', account.accountId).maybeSingle(),
    decode(raw) {
      if (raw === null) return { dogovorId: null };
      const selection = record(raw);
      if (!selection || selection.status !== 'SELECTED' || !sameId(selection.need_id, potrebaId) || !sameId(selection.response_id, prijavaId)) return null;
      const linked = selection.agreements;
      if (linked === null || (Array.isArray(linked) && linked.length === 0)) return { dogovorId: null };
      if (Array.isArray(linked) && linked.length !== 1) return null;
      const agreement = record(Array.isArray(linked) ? linked[0] : linked);
      return agreement && uuid(agreement.id) && sameId(agreement.need_id, potrebaId) && sameId(agreement.selected_response_id, prijavaId)
        ? { dogovorId: agreement.id } : null;
    },
  });
}

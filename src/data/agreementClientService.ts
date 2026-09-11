import type { DogovorProjekcija, UcesnikProjekcija } from '../contracts/projections';
import type { Ishod, IzmenaKomanda, Izvor } from './ports';
import { calendarFailure } from './calendarErrors';
import { failure, positiveInteger, readOwnedResult, record, sameId, uuid, type ReceiptAccount } from './serverReceipt';
import { calendarInstant } from '../lib/calendarTime';
import { needScheduleText } from './needDetailPresentation';
import { supabaseKlijent } from './supabaseClient';
import { sesijaSada } from '../store/sesija';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type AgreementService = Pick<
  Izvor,
  'mojiDogovori' | 'dogovor' | 'posaljiPoruku' | 'predloziIzmenu' | 'odgovoriNaIzmenu' | 'prijaviProblem' | 'oznaciZavrsetak'
>;

function fail<T>(error: unknown, code: string, message: string): Ishod<T> {
  const calendar = calendarFailure(error);
  if (calendar) return calendar;
  const value = record(error);
  const name = typeof value?.message === 'string' ? value.message : undefined;
  const errorCode = typeof value?.code === 'string' ? value.code : undefined;
  return { ok: false, kod: name || errorCode || code, poruka: name || message };
}

function novac(iznos: number, valuta = 'RSD') {
  return {
    iznos,
    valuta,
    prikaz: `${iznos.toLocaleString('sr-Latn-RS')} ${valuta}`,
  };
}

function formatTime(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString('sr-Latn-RS') : 'Fleksibilno';
}

function mapAgreement(raw: any, uid: string): DogovorProjekcija {
  const requester = raw.requesterAccountId === uid;
  const myId = requester ? raw.requesterAccountId : raw.workerAccountId;
  const otherId = requester ? raw.workerAccountId : raw.requesterAccountId;
  const myName = requester ? raw.requesterName : raw.workerName;
  const otherName = requester ? raw.workerName : raw.requesterName;
  const terms = raw.terms ?? {};
  const total = Number(raw.requiredSlots ?? 1);
  const covered = Math.max(0, Math.min(total, Number(terms.covered_slots ?? 1)));

  const participants: UcesnikProjekcija[] = [
    {
      id: myId,
      ime: myName || 'Vi',
      inicijali: (myName || 'VI').slice(0, 2).toUpperCase(),
      uloga: requester ? 'narucilac' : 'uskocer',
      mesta: requester ? null : covered,
      viSte: true,
      telefon: null,
    },
    {
      id: otherId,
      ime: otherName || 'Druga strana',
      inicijali: (otherName || 'DS').slice(0, 2).toUpperCase(),
      uloga: requester ? 'uskocer' : 'narucilac',
      mesta: requester ? covered : null,
      viSte: false,
      telefon: raw.theirPhone ?? null,
    },
  ];

  const mode = raw.executionMode;
  const status = raw.status as DogovorProjekcija['stanje'];
  const amount = Number(terms.price_rsd ?? 0);
  const currency = String(terms.currency ?? 'RSD');

  return {
    id: raw.id,
    verzija: Number(raw.currentVersion),
    naslov: raw.title ?? '',
    stanje: status,
    cena: novac(amount, currency),
    // Parent task edits cannot silently change an already accepted Agreement.
    vremeTekst: acceptedSchedule(terms),
    putanjaTekst: [raw.approximateArea, raw.approximateCity].filter(Boolean).join(', '),
    pokrivenost: {
      ukupno: total,
      popunjeno: covered,
      preostalo: Math.max(0, total - covered),
      udeo: total > 0 ? covered / total : 0,
    },
    ucesnici: participants,
    rezim: mode === 'REMOTE' ? 'DALJINSKI' : mode === 'PICKUP_DELIVERY' ? 'PREUZIMANJE_DOSTAVA' : 'FIZICKI',
    kontakt: {
      mojTelefonPodeljen: Boolean(raw.myPhoneShared),
      njihovTelefon: raw.theirPhone ?? null,
      lokacijaPostoji: mode !== 'REMOTE',
      tacnaLokacija: null,
      emailNijeDeljen: true,
    },
    chatDostupan: raw.agreementStatus === 'CONFIRMED' || raw.agreementStatus === 'SUPERSEDED',
    rokPotvrdeIso: raw.requesterDeadlineAt ?? null,
    problemOtvoren: Boolean(raw.problemOpened),
    ocenaMoguca: status === 'COMPLETED',
    hronologija: [{ vremeTekst: formatTime(raw.createdAt), tekst: 'Dogovor kreiran' }],
  };
}

function acceptedSchedule(terms: Record<string, unknown>): string {
  const start = terms.proposed_start_at, end = terms.proposed_end_at;
  if (start == null && end == null) return 'Termin nije potvrđen';
  if ((start != null && (typeof start !== 'string' || calendarInstant(start) === null)) ||
    (end != null && (typeof end !== 'string' || calendarInstant(end) === null))) return 'Termin nije dostupan';
  // The workspace returns accepted instants but no accepted display timezone.
  // Keep both endpoints and their precision; never substitute the parent task's time.
  return needScheduleText({ kind: 'FIXED_WINDOW', startsAt: start as string | null ?? null, endsAt: end as string | null ?? null })
    + (start == null ? ' · početak nije potvrđen' : end == null ? ' · kraj nije potvrđen' : '');
}

async function userId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('AUTH_REQUIRED');
  return data.user.id;
}

export type AgreementProblemReceipt = {
  agreementId: string; problemOpenedAt: string; problemOpenedBy: string;
  idempotentReplay: boolean; noAutomaticFaultOrDebt: true; authoritative: true;
};
export type AgreementProblemSnapshot = {
  agreementId: string; agreementVersion: number;
} & ({ state: 'AVAILABLE'; report: { openedAt: string; openedBy: string; narrative: string } }
  | { state: 'ABSENT' | 'LEGACY_UNAVAILABLE'; report: null });
const problemErrors = {
  AUTH_REQUIRED: 'Prijavite se da biste nastavili.', NOT_PARTY: 'Nemate pristup ovom Dogovoru.',
  AGREEMENT_NOT_FOUND: 'Dogovor nije dostupan.', EXECUTION_NOT_FOUND: 'Stanje Dogovora nije dostupno.',
  AGREEMENT_NOT_REPORTABLE: 'Problem se može prijaviti samo dok je Dogovor aktivan.',
  EXECUTION_NOT_REPORTABLE: 'Dogovor je promenjen. Proverite njegovo stanje.',
  NARRATIVE_REQUIRED: 'Opišite problem.', NARRATIVE_TOO_LONG: 'Opis može imati najviše 4.000 znakova.',
};
const problemOptions = { errors: problemErrors, fallback: 'PROBLEM_REPORT_UNCONFIRMED', invalid: 'PROBLEM_REPORT_INVALID' };
const exactKeys = (row: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(row).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(row, key));

/** One existing P0E writer. Its narrative is shared in Agreement messages;
 * this is not a confidential abuse report or a separate moderation case. */
export const agreementProblemService = {
  async submit(agreementId: string, description: string, account?: ReceiptAccount): Promise<Ishod<AgreementProblemReceipt>> {
    const narrative = description.trim();
    if (!narrative) return failure('NARRATIVE_REQUIRED', problemErrors.NARRATIVE_REQUIRED);
    if (Array.from(narrative).length > 4000) return failure('NARRATIVE_TOO_LONG', problemErrors.NARRATIVE_TOO_LONG);
    if (!uuid(agreementId)) return failure('AGREEMENT_NOT_FOUND', problemErrors.AGREEMENT_NOT_FOUND);
    return readOwnedResult({ ...problemOptions, account, write: true,
      request: () => supabase.rpc('rpc_report_problem', { p_agreement_id: agreementId, p_narrative: narrative }),
      decode: raw => {
        const row = record(raw);
        if (!row || !exactKeys(row, ['agreementId', 'problemOpenedAt', 'problemOpenedBy', 'idempotentReplay', 'noAutomaticFaultOrDebt', 'authoritative']) ||
          !sameId(row.agreementId, agreementId) || !uuid(row.problemOpenedBy) ||
          typeof row.problemOpenedAt !== 'string' || calendarInstant(row.problemOpenedAt) === null ||
          typeof row.idempotentReplay !== 'boolean' || row.noAutomaticFaultOrDebt !== true || row.authoritative !== true) return null;
        return row as AgreementProblemReceipt;
      },
    });
  },
  read(agreementId: string, version: number, participantIds: readonly string[], account: ReceiptAccount): Promise<Ishod<AgreementProblemSnapshot>> {
    if (!uuid(agreementId) || !positiveInteger(version) || participantIds.length !== 2 ||
      !participantIds.every(uuid) || participantIds[0] === participantIds[1] || !participantIds.includes(account.accountId)) {
      return Promise.resolve(failure('PROBLEM_REPORT_INVALID', 'Prijava problema nije dostupna. Ponovo otvorite Dogovor.'));
    }
    return readOwnedResult({ ...problemOptions, account, fallback: 'PROBLEM_REPORT_READ_FAILED',
      // Existing participant RLS owns access; no raw account or private unrelated fields.
      request: () => supabase.from('agreement_execution')
        .select('agreement_id,agreement_version,problem_opened_at,problem_opened_by,problem_narrative')
        .eq('agreement_id', agreementId).maybeSingle(),
      decode: raw => {
        const row = record(raw);
        if (!row || !exactKeys(row, ['agreement_id', 'agreement_version', 'problem_opened_at', 'problem_opened_by', 'problem_narrative']) ||
          !sameId(row.agreement_id, agreementId) || row.agreement_version !== version) return null;
        const base = { agreementId, agreementVersion: version };
        if (row.problem_opened_at === null && row.problem_opened_by === null && row.problem_narrative === null) return { ...base, state: 'ABSENT', report: null };
        if (typeof row.problem_opened_at !== 'string' || calendarInstant(row.problem_opened_at) === null ||
          (row.problem_opened_by !== null && (typeof row.problem_opened_by !== 'string' || !participantIds.includes(row.problem_opened_by))) ||
          (row.problem_narrative !== null && (typeof row.problem_narrative !== 'string' || !row.problem_narrative.trim()))) return null;
        // Pre-20260830191500 reports stored only the timestamp; that migration
        // added nullable details without backfill. Pre-P0E text had no length cap.
        // Preserve the known open flag, but never invent details or return unbounded text.
        if (row.problem_opened_by === null || row.problem_narrative === null ||
          row.problem_narrative.length > 8000 || Array.from(row.problem_narrative).length > 4000) {
          return { ...base, state: 'LEGACY_UNAVAILABLE', report: null };
        }
        return { ...base, state: 'AVAILABLE', report: { openedAt: row.problem_opened_at, openedBy: row.problem_opened_by, narrative: row.problem_narrative } };
      },
    });
  },
};

export type AgreementChangeTerms = {
  priceRsd: number; currency: 'RSD'; scopeNote: string; startsAt: string | null; endsAt: string | null;
};
export type AgreementChangeProposal = {
  proposalId: string; agreementId: string; baseVersion: number; proposedBy: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED'; reason: string | null;
  createdAt: string; respondedBy: string | null; respondedAt: string | null;
} & ({ termsAvailable: true; terms: AgreementChangeTerms } | { termsAvailable: false; terms: null });
export type AgreementChangeSnapshot = {
  agreementId: string; agreementVersion: number;
  agreementStatus: 'CONFIRMED' | 'SUPERSEDED' | 'COMPLETED' | 'CANCELLED';
  requesterAccountId: string; workerAccountId: string;
  terms: AgreementChangeTerms; proposals: AgreementChangeProposal[];
};
export type AgreementChangeReceipt = {
  proposalId: string; accepted: boolean; agreementVersion: number; authoritative: true;
};
const changeErrors = {
  AUTH_REQUIRED: 'Prijavite se da biste nastavili.', NOT_PARTY: 'Nemate pristup ovom Dogovoru.',
  AGREEMENT_NOT_FOUND: 'Dogovor nije dostupan.', AGREEMENT_VERSION_NOT_FOUND: 'Verzija Dogovora nije dostupna.',
  AGREEMENT_NOT_ACTIVE: 'Dogovor više nije aktivan. Osvežite njegov status.',
  VERSION_REQUIRED: 'Ponovo učitajte važeću verziju Dogovora.', VERSION_CONFLICT: 'Dogovor je promenjen. Osvežite važeće uslove.',
  CHANGE_PATCH_REQUIRED: 'Izmenite bar jedno polje Dogovora.',
  CLIENT_REQUEST_ID_REQUIRED: 'Zahtev nije spreman. Ponovo otvorite izmenu.',
  CHANGE_REQUEST_ID_REUSED: 'Ovaj zahtev već pripada drugoj izmeni. Osvežite predloge.',
  UNSUPPORTED_CHANGE_FIELD: 'Predlog sadrži nepodržanu izmenu.', INVALID_PRICE: 'Unesite pozitivan ceo iznos u RSD.',
  CHANGE_SCOPE_INVALID: 'Proverite opis obima posla.', CHANGE_CURRENCY_INVALID: 'Valuta Dogovora mora biti RSD.',
  CHANGE_TERMS_INVALID: 'Uslovi predloga nisu dostupni za prihvatanje.',
  CHANGE_PROPOSAL_NOT_FOUND: 'Predlog izmene nije dostupan.', PROPOSER_CANNOT_RESPOND: 'Na predlog odgovara druga strana.',
  PROPOSAL_NOT_PENDING: 'Na ovaj predlog više nije moguće odgovoriti.', DECISION_REQUIRED: 'Izaberite odgovor na predlog.',
  AGREEMENT_CALENDAR_INTERVAL_INVALID: 'Proverite tačan početak i kraj dogovorenog termina.',
  WORKER_CALENDAR_CONFLICT: 'Termin se preklapa sa potvrđenim Dogovorom. Osvežite kalendar.',
  CALENDAR_RECHECK_REQUIRED: 'Raspored se upravo promenio. Osvežite podatke pre ponovnog pokušaja.',
};
const changeOptions = { errors: changeErrors, fallback: 'AGREEMENT_CHANGE_UNCONFIRMED', invalid: 'AGREEMENT_CHANGE_INVALID' };
const changeFields = ['cenaIznos', 'cenaValuta', 'pocetakIso', 'krajIso', 'obim'];
function changePatch(command: IzmenaKomanda): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (command.izmena.cenaIznos !== undefined) patch.price_rsd = command.izmena.cenaIznos;
  if (command.izmena.cenaValuta !== undefined) patch.currency = command.izmena.cenaValuta;
  if (command.izmena.pocetakIso !== undefined) patch.proposed_start_at = command.izmena.pocetakIso;
  if (command.izmena.krajIso !== undefined) patch.proposed_end_at = command.izmena.krajIso;
  if (command.izmena.obim !== undefined) patch.scope_note = command.izmena.obim;
  return patch;
}
// Legacy Izvor and the typed screen boundary share the same physical RPC adapters.
function proposeChange(command: IzmenaKomanda, patch: Record<string, unknown>) {
  return supabase.rpc('rpc_propose_agreement_change_v2', {
    p_agreement_id: command.dogovorId, p_expected_version: command.ocekivanaVerzija,
    p_patch: patch, p_reason: command.razlog ?? null, p_client_request_id: command.clientRequestId,
  });
}
function respondChange(proposalId: string, accept: boolean) {
  return supabase.rpc('rpc_respond_agreement_change', { p_proposal_id: proposalId, p_accept: accept });
}
function decodeChangeTerms(raw: unknown): AgreementChangeTerms | null {
  const terms = record(raw);
  if (!terms || !positiveInteger(terms.price_rsd) || typeof terms.scope_note !== 'string' ||
    (Object.prototype.hasOwnProperty.call(terms, 'currency') && terms.currency !== 'RSD')) return null;
  const start = terms.proposed_start_at ?? null, end = terms.proposed_end_at ?? null;
  if (start !== null || end !== null) {
    const s = calendarInstant(start), e = calendarInstant(end);
    if (s === null || e === null || s >= e) return null;
  }
  return { priceRsd: terms.price_rsd, currency: 'RSD', scopeNote: terms.scope_note,
    startsAt: start as string | null, endsAt: end as string | null };
}
type ChangeBase = Omit<AgreementChangeSnapshot, 'proposals'>;
function decodeChangeBase(raw: unknown, agreementId: string, accountId: string): ChangeBase | null {
  const row = record(raw), terms = decodeChangeTerms(row?.terms);
  if (!row || !sameId(row.id, agreementId) || !positiveInteger(row.currentVersion) || !terms ||
    !uuid(row.requesterAccountId) || !uuid(row.workerAccountId) || sameId(row.requesterAccountId, row.workerAccountId) ||
    (!sameId(row.requesterAccountId, accountId) && !sameId(row.workerAccountId, accountId)) ||
    !['CONFIRMED', 'SUPERSEDED', 'COMPLETED', 'CANCELLED'].includes(row.agreementStatus as string)) return null;
  return { agreementId: row.id, agreementVersion: row.currentVersion,
    agreementStatus: row.agreementStatus as ChangeBase['agreementStatus'],
    requesterAccountId: row.requesterAccountId, workerAccountId: row.workerAccountId, terms };
}
const proposalColumns = 'id,agreement_id,base_version,proposed_terms,reason,proposed_by_account_id,status,responded_by_account_id,responded_at,created_at';
function decodeChangeProposals(raw: unknown, base: ChangeBase): AgreementChangeProposal[] | null {
  if (!Array.isArray(raw)) return null;
  const ids = new Set<string>(), proposals: AgreementChangeProposal[] = [];
  const party = (id: unknown) => sameId(id, base.requesterAccountId) || sameId(id, base.workerAccountId);
  for (const item of raw) {
    const row = record(item);
    if (!row || !exactKeys(row, proposalColumns.split(',')) || !uuid(row.id) || ids.has(row.id.toLowerCase()) ||
      !sameId(row.agreement_id, base.agreementId) || !positiveInteger(row.base_version) || row.base_version > base.agreementVersion ||
      !party(row.proposed_by_account_id) || !['PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED'].includes(row.status as string) ||
      (row.reason !== null && (typeof row.reason !== 'string' || !row.reason.trim())) ||
      typeof row.created_at !== 'string' || calendarInstant(row.created_at) === null ||
      (row.responded_at !== null && (typeof row.responded_at !== 'string' || calendarInstant(row.responded_at) === null)) ||
      (row.responded_by_account_id !== null && (!party(row.responded_by_account_id) || sameId(row.responded_by_account_id, row.proposed_by_account_id as string))) ||
      !record(row.proposed_terms)) return null;
    if ((row.status === 'PENDING' && (row.responded_at !== null || row.responded_by_account_id !== null)) ||
      (row.status !== 'PENDING' && row.responded_at === null) ||
      (['ACCEPTED', 'REJECTED'].includes(row.status as string) && row.responded_by_account_id === null) ||
      (row.status === 'ACCEPTED' && row.base_version >= base.agreementVersion)) return null;
    ids.add(row.id.toLowerCase());
    const terms = decodeChangeTerms(row.proposed_terms);
    proposals.push({ proposalId: row.id, agreementId: row.agreement_id, baseVersion: row.base_version,
      proposedBy: row.proposed_by_account_id as string, status: row.status as AgreementChangeProposal['status'],
      reason: row.reason as string | null, createdAt: row.created_at,
      respondedBy: row.responded_by_account_id as string | null, respondedAt: row.responded_at as string | null,
      // Historical object-shaped terms were not fully typed. Keep their real
      // metadata available for a server-authorized rejection, never acceptance.
      ...(terms ? { termsAvailable: true as const, terms } : { termsAvailable: false as const, terms: null }) });
  }
  return proposals;
}
function changeAccount(account: ReceiptAccount): ReceiptAccount | null {
  return account && uuid(account.accountId) && Number.isSafeInteger(account.accountRevision) && account.accountRevision >= 0
    ? { accountId: account.accountId, accountRevision: account.accountRevision } : null;
}
async function changeResponse(request: PromiseLike<unknown>): Promise<unknown> {
  const response = await request, result = record(response), error = record(result?.error);
  return error?.code === '40001' || error?.code === '40P01'
    ? { data: null, error: { message: 'CALENDAR_RECHECK_REQUIRED' } } : response;
}

export const agreementChangeService = {
  async read(agreementId: string, account: ReceiptAccount): Promise<Ishod<AgreementChangeSnapshot>> {
    const owner = changeAccount(account);
    if (!uuid(agreementId) || !owner) return failure('AGREEMENT_CHANGE_INVALID', 'Dogovor nije dostupan. Ponovo ga otvorite.');
    const deadline = Date.now() + 15_000;
    const current = () => Date.now() < deadline && sesijaSada().user?.id === owner.accountId &&
      sesijaSada().accountRevision === owner.accountRevision;
    return readOwnedResult({ ...changeOptions, account: owner, fallback: 'AGREEMENT_CHANGE_READ_FAILED',
      request: async () => {
        const first = await supabase.rpc('rpc_get_agreement_workspace', { p_agreement_id: agreementId });
        if (!current()) throw new Error('READ_RETIRED');
        if (first.error !== null) return first;
        const base = decodeChangeBase(first.data, agreementId, owner.accountId);
        if (!base) return { data: null, error: null };
        const rows = await supabase.from('agreement_change_proposals').select(proposalColumns)
          .eq('agreement_id', agreementId).order('created_at', { ascending: false }).order('id', { ascending: false });
        if (!current()) throw new Error('READ_RETIRED');
        if (rows.error !== null) return rows;
        const proposals = decodeChangeProposals(rows.data, base);
        if (!proposals) return { data: null, error: null };
        const last = await supabase.rpc('rpc_get_agreement_workspace', { p_agreement_id: agreementId });
        if (!current()) throw new Error('READ_RETIRED');
        if (last.error !== null) return last;
        const after = decodeChangeBase(last.data, agreementId, owner.accountId);
        if (!after) return { data: null, error: null };
        if (JSON.stringify(base) !== JSON.stringify(after)) return { data: null, error: { message: 'VERSION_CONFLICT' } };
        return { data: { ...after, proposals }, error: null };
      },
      decode: raw => raw === null ? null : raw as AgreementChangeSnapshot,
    });
  },
  async propose(command: IzmenaKomanda, account: ReceiptAccount): Promise<Ishod<{ proposalId: string }>> {
    const owner = changeAccount(account), raw = record(command), delta = record(raw?.izmena);
    if (!owner || !raw || !uuid(raw.dogovorId) || !positiveInteger(raw.ocekivanaVerzija) || !delta ||
      Object.keys(raw).some(key => !['dogovorId', 'ocekivanaVerzija', 'izmena', 'razlog', 'clientRequestId'].includes(key)) ||
      Object.keys(delta).some(key => !changeFields.includes(key))) return failure('AGREEMENT_CHANGE_INVALID', 'Predlog izmene nije ispravan.');
    if (typeof raw.clientRequestId !== 'string' || !raw.clientRequestId.trim()) return failure('CLIENT_REQUEST_ID_REQUIRED', changeErrors.CLIENT_REQUEST_ID_REQUIRED);
    if (raw.razlog !== undefined && typeof raw.razlog !== 'string') return failure('AGREEMENT_CHANGE_INVALID', 'Proverite razlog izmene.');
    if (delta.cenaIznos !== undefined && !positiveInteger(delta.cenaIznos)) return failure('INVALID_PRICE', changeErrors.INVALID_PRICE);
    if (delta.cenaValuta !== undefined && delta.cenaValuta !== 'RSD') return failure('CHANGE_CURRENCY_INVALID', changeErrors.CHANGE_CURRENCY_INVALID);
    if (delta.obim !== undefined && typeof delta.obim !== 'string') return failure('CHANGE_SCOPE_INVALID', changeErrors.CHANGE_SCOPE_INVALID);
    const s = delta.pocetakIso === undefined ? undefined : calendarInstant(delta.pocetakIso);
    const e = delta.krajIso === undefined ? undefined : calendarInstant(delta.krajIso);
    if (s === null || e === null || (s !== undefined && e !== undefined && s >= e)) return failure('AGREEMENT_CALENDAR_INTERVAL_INVALID', changeErrors.AGREEMENT_CALENDAR_INTERVAL_INVALID);
    const frozen = { ...command, izmena: { ...command.izmena } }, patch = Object.freeze(changePatch(frozen));
    if (!Object.keys(patch).length) return failure('CHANGE_PATCH_REQUIRED', changeErrors.CHANGE_PATCH_REQUIRED);
    return readOwnedResult({ ...changeOptions, account: owner, write: true,
      request: () => changeResponse(proposeChange(frozen, patch)),
      decode: data => uuid(data) ? { proposalId: data } : null });
  },
  async respond(proposal: AgreementChangeProposal, accept: boolean, account: ReceiptAccount): Promise<Ishod<AgreementChangeReceipt>> {
    const owner = changeAccount(account);
    if (!owner || !proposal || !uuid(proposal.proposalId) || !uuid(proposal.agreementId) || !uuid(proposal.proposedBy) ||
      !positiveInteger(proposal.baseVersion) || typeof accept !== 'boolean' ||
      !['PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED'].includes(proposal.status)) return failure('AGREEMENT_CHANGE_INVALID', 'Predlog nije dostupan. Osvežite Dogovor.');
    if (sameId(proposal.proposedBy, owner.accountId)) return failure('PROPOSER_CANNOT_RESPOND', changeErrors.PROPOSER_CANNOT_RESPOND);
    if (proposal.status !== 'PENDING' && !(accept && proposal.status === 'ACCEPTED') && !(!accept && proposal.status === 'REJECTED'))
      return failure('PROPOSAL_NOT_PENDING', changeErrors.PROPOSAL_NOT_PENDING);
    if (accept && (!proposal.termsAvailable || !proposal.terms || !positiveInteger(proposal.baseVersion + 1)))
      return failure('CHANGE_TERMS_INVALID', changeErrors.CHANGE_TERMS_INVALID);
    const proposalId = proposal.proposalId, expectedVersion = proposal.baseVersion + (accept ? 1 : 0);
    return readOwnedResult({ ...changeOptions, account: owner, write: true,
      request: () => changeResponse(respondChange(proposalId, accept)),
      decode: raw => {
        const row = record(raw);
        return row && exactKeys(row, ['proposalId', 'accepted', 'agreementVersion', 'authoritative']) &&
          sameId(row.proposalId, proposalId) && row.accepted === accept && row.agreementVersion === expectedVersion && row.authoritative === true
          ? row as AgreementChangeReceipt : null;
      } });
  },
};

/**
 * Canonical production client boundary for Agreement operations migrated so far.
 * Backend authority remains in canonical Agreement RPCs; this service preserves
 * the existing Izvor request, validation, mapping and error semantics exactly.
 */
export const agreementClientService: AgreementService = {
  async mojiDogovori() {
    const uid = await userId();
    const { data, error } = await supabase.rpc('rpc_list_my_agreements');
    if (error) throw new Error(error.message || 'AGREEMENT_LIST_FAILED');
    if (!Array.isArray(data)) throw new Error('AGREEMENT_LIST_INVALID_PROJECTION');
    return data.map((row) => mapAgreement(row, uid));
  },

  async dogovor(id) {
    const uid = await userId();
    const { data, error } = await supabase.rpc('rpc_get_agreement_workspace', {
      p_agreement_id: id,
    });
    if (error) throw new Error(error.message || 'AGREEMENT_READ_FAILED');
    if (!data) return null;
    return mapAgreement(data, uid);
  },

  async posaljiPoruku(dogovorId, telo) {
    const body = telo.trim();
    if (!body) return { ok: false, kod: 'MESSAGE_REQUIRED', poruka: 'Unesite poruku.' };
    const { data, error } = await supabase.rpc('rpc_send_agreement_message', {
      p_agreement_id: dogovorId,
      p_body: body,
    });
    if (error || !data) return fail(error, 'MESSAGE_SEND_FAILED', 'Poruka nije poslata.');
    return { ok: true, podatak: { porukaId: data } };
  },

  async predloziIzmenu(k: IzmenaKomanda) {
    const patch = changePatch(k);

    if (!Object.keys(patch).length) {
      return { ok: false, kod: 'CHANGE_PATCH_REQUIRED', poruka: 'Izmenite bar jedno polje Dogovora.' };
    }

    const { data, error } = await proposeChange(k, patch);
    if (error || !data) return fail(error, 'CHANGE_PROPOSAL_FAILED', 'Predlog izmene nije sačuvan.');
    return { ok: true, podatak: { predlogId: data } };
  },

  async odgovoriNaIzmenu(predlogId, prihvatam) {
    const { error } = await respondChange(predlogId, prihvatam);
    if (error) return fail(error, 'CHANGE_RESPONSE_FAILED', 'Odgovor na izmenu nije sačuvan.');
    return { ok: true, podatak: null };
  },

  async prijaviProblem(dogovorId, opis) {
    const result = await agreementProblemService.submit(dogovorId, opis);
    return result.ok ? { ok: true, podatak: null } : result;
  },

  async oznaciZavrsetak(dogovorId) {
    const { data, error } = await supabase.rpc('rpc_mark_work_done', {
      p_agreement_id: dogovorId,
    });
    if (error || !data) return fail(error, 'COMPLETION_FAILED', 'Završetak nije mogao da se označi.');
    return { ok: true, podatak: { rokPotvrdeIso: data } };
  },
};

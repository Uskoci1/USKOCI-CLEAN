import { legacyRpcFailure } from './legacyRpcFailure';
import type { DogovorProjekcija, UcesnikProjekcija } from '../contracts/projections';
import type { Ishod, IzmenaKomanda, Izvor } from './ports';
import { calendarFailure } from './calendarErrors';
import { failure, positiveInteger, readOwnedResult, record, sameId, uuid, type ReceiptAccount } from './serverReceipt';
import { calendarInstant } from '../lib/calendarTime';
import { needScheduleText } from './needDetailPresentation';
import { supabaseKlijent } from './supabaseClient';

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
  return legacyRpcFailure(error, code, message);
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

/** Selective admission from saved M05 commit60a3ce68, with source113 action
 * snapshot and bounds. PR101 safe errors and legacy message refusal stay intact. */
export type AgreementChangeTerms = {
  priceRsd: number; currency: 'RSD'; scopeNote: string | null; startsAt: string | null; endsAt: string | null;
};
export type AgreementChangeProposal = {
  proposalId: string; agreementId: string; baseVersion: number; proposedBy: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED' | 'WITHDRAWN'; reason: string | null;
  createdAt: string; respondedBy: string | null; respondedAt: string | null;
} & ({ termsAvailable: true; terms: AgreementChangeTerms } | { termsAvailable: false; terms: null });
export type AgreementChangeSnapshot = {
  agreementId: string; agreementVersion: number;
  agreementStatus: 'CONFIRMED' | 'SUPERSEDED' | 'COMPLETED' | 'CANCELLED';
  requesterAccountId: string; workerAccountId: string;
  terms: AgreementChangeTerms | null; proposals: AgreementChangeProposal[];
  actions: AgreementActionState;
};
export type AgreementChangeReceipt = {
  proposalId: string; accepted: boolean; agreementVersion: number; authoritative: true;
};
export type AgreementActionState = {
  agreementId: string; agreementVersion: number; accountId: string; authoritative: true;
  canProposeChange: boolean; canRespondChange: boolean; canWithdrawChange: boolean;
  canMarkWorkDone: boolean; canConfirmCompletion: boolean; canCancel: boolean;
};
const actionKeys = ['canProposeChange', 'canRespondChange', 'canWithdrawChange',
  'canMarkWorkDone', 'canConfirmCompletion', 'canCancel'] as const;
const changeErrors = {
  AGREEMENT_CAPABILITIES_NOT_READY: 'Radnje Dogovora još nisu spremne. Osvežite prikaz kasnije.',
  AGREEMENT_CHANGE_AFTER_WORK_DONE: 'Rad je označen kao završen. Uslovi se više ne mogu menjati.',
  AGREEMENT_CHANGE_PENDING: 'Najpre odgovorite na postojeći predlog izmene.',
  AGREEMENT_NOT_FOUND_OR_FORBIDDEN: 'Dogovor nije dostupan.',
  NOT_PROPOSER: 'Samo autor može da povuče ovaj predlog.',
  CHANGE_INPUT_TOO_LARGE: 'Predlog prelazi dozvoljenu dužinu.',
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
  if (!terms || !positiveInteger(terms.price_rsd) ||
    (terms.scope_note != null && (typeof terms.scope_note !== 'string' || Array.from(terms.scope_note).length > 4000)) ||
    (Object.prototype.hasOwnProperty.call(terms, 'currency') && terms.currency !== 'RSD')) return null;
  const start = terms.proposed_start_at ?? null, end = terms.proposed_end_at ?? null;
  if (start !== null || end !== null) {
    const s = calendarInstant(start), e = calendarInstant(end);
    if ((s === undefined) !== (e === undefined) || s === null || e === null || s >= e) return null;
  }
  return { priceRsd: terms.price_rsd, currency: 'RSD', scopeNote: terms.scope_note as string | null ?? null,
    startsAt: start as string | null, endsAt: end as string | null };
}
/** The workspace owns both pending rows and capability truth. One bounded
 * snapshot replaces the saved branch's unbounded history read and triple query.
 * Malformed historic terms are unavailable, never normalized into new terms. */
function decodeChangeWorkspace(raw: unknown, agreementId: string, accountId: string): AgreementChangeSnapshot | null {
  const row = record(raw), actions = record(row?.actionState);
  if (!row || !sameId(row.id, agreementId) || !positiveInteger(row.currentVersion) ||
    !uuid(row.requesterAccountId) || !uuid(row.workerAccountId) || sameId(row.requesterAccountId, row.workerAccountId) ||
    (!sameId(row.requesterAccountId, accountId) && !sameId(row.workerAccountId, accountId)) ||
    !['CONFIRMED', 'SUPERSEDED', 'COMPLETED', 'CANCELLED'].includes(row.agreementStatus as string) ||
    !actions || actions.authoritative !== true || !sameId(actions.agreementId, agreementId) ||
    actions.agreementVersion !== row.currentVersion || !sameId(actions.accountId, accountId) ||
    actionKeys.some(key => typeof actions[key] !== 'boolean') || !Array.isArray(actions.pendingChanges) ||
    actions.pendingChanges.length > 1) return null;
  const proposals: AgreementChangeProposal[] = [];
  for (const item of actions.pendingChanges) {
    const r = record(item);
    if (!r || !uuid(r.id) || !positiveInteger(r.baseVersion) || r.baseVersion > row.currentVersion ||
      (!sameId(r.proposedByAccountId, row.requesterAccountId) && !sameId(r.proposedByAccountId, row.workerAccountId)) ||
      typeof r.createdAt !== 'string' || calendarInstant(r.createdAt) === null || !record(r.proposedTerms) ||
      (r.reason !== null && (typeof r.reason !== 'string' || Array.from(r.reason).length > 4000))) return null;
    const terms = decodeChangeTerms(r.proposedTerms);
    proposals.push({ proposalId: r.id, agreementId, baseVersion: r.baseVersion, proposedBy: r.proposedByAccountId as string,
      status: 'PENDING', reason: r.reason as string | null, createdAt: r.createdAt, respondedBy: null, respondedAt: null,
      ...(terms ? { termsAvailable: true as const, terms } : { termsAvailable: false as const, terms: null }) });
  }
  return { agreementId, agreementVersion: row.currentVersion,
    agreementStatus: row.agreementStatus as AgreementChangeSnapshot['agreementStatus'],
    requesterAccountId: row.requesterAccountId, workerAccountId: row.workerAccountId,
    terms: decodeChangeTerms(row.terms), proposals,
    actions: { agreementId, agreementVersion: row.currentVersion, accountId, authoritative: true,
      canProposeChange: actions.canProposeChange as boolean, canRespondChange: actions.canRespondChange as boolean,
      canWithdrawChange: actions.canWithdrawChange as boolean, canMarkWorkDone: actions.canMarkWorkDone as boolean,
      canConfirmCompletion: actions.canConfirmCompletion as boolean, canCancel: actions.canCancel as boolean } };
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
    return readOwnedResult({ ...changeOptions, account: owner, fallback: 'AGREEMENT_CHANGE_READ_FAILED',
      request: async () => {
        const result = await supabase.rpc('rpc_get_agreement_workspace', { p_agreement_id: agreementId });
        if (result.error === null && record(result.data) && !record(record(result.data)?.actionState)) {
          return { data: null, error: { message: 'AGREEMENT_CAPABILITIES_NOT_READY' } };
        }
        return result;
      },
      decode: raw => decodeChangeWorkspace(raw, agreementId, owner.accountId),
    });
  },
  async propose(command: IzmenaKomanda, account: ReceiptAccount): Promise<Ishod<{ proposalId: string }>> {
    const owner = changeAccount(account), raw = record(command), delta = record(raw?.izmena);
    if (!owner || !raw || !uuid(raw.dogovorId) || !positiveInteger(raw.ocekivanaVerzija) || !delta ||
      Object.keys(raw).some(key => !['dogovorId', 'ocekivanaVerzija', 'izmena', 'razlog', 'clientRequestId'].includes(key)) ||
      Object.keys(delta).some(key => !changeFields.includes(key))) return failure('AGREEMENT_CHANGE_INVALID', 'Predlog izmene nije ispravan.');
    if (typeof raw.clientRequestId !== 'string' || !raw.clientRequestId.trim()) return failure('CLIENT_REQUEST_ID_REQUIRED', changeErrors.CLIENT_REQUEST_ID_REQUIRED);
    if (Array.from(raw.clientRequestId).length > 200 || (typeof raw.razlog === 'string' && Array.from(raw.razlog).length > 4000)) return failure('CHANGE_INPUT_TOO_LARGE', changeErrors.CHANGE_INPUT_TOO_LARGE);
    if (raw.razlog !== undefined && typeof raw.razlog !== 'string') return failure('AGREEMENT_CHANGE_INVALID', 'Proverite razlog izmene.');
    if (delta.cenaIznos !== undefined && !positiveInteger(delta.cenaIznos)) return failure('INVALID_PRICE', changeErrors.INVALID_PRICE);
    if (delta.cenaValuta !== undefined && delta.cenaValuta !== 'RSD') return failure('CHANGE_CURRENCY_INVALID', changeErrors.CHANGE_CURRENCY_INVALID);
    if (typeof delta.obim === 'string' && Array.from(delta.obim).length > 4000) return failure('CHANGE_INPUT_TOO_LARGE', changeErrors.CHANGE_INPUT_TOO_LARGE);
    if (delta.obim !== undefined && typeof delta.obim !== 'string') return failure('CHANGE_SCOPE_INVALID', changeErrors.CHANGE_SCOPE_INVALID);
    const s = delta.pocetakIso === undefined ? undefined : calendarInstant(delta.pocetakIso);
    const e = delta.krajIso === undefined ? undefined : calendarInstant(delta.krajIso);
    if ((s === undefined) !== (e === undefined) || s === null || e === null || (s !== undefined && e !== undefined && s >= e)) return failure('AGREEMENT_CALENDAR_INTERVAL_INVALID', changeErrors.AGREEMENT_CALENDAR_INTERVAL_INVALID);
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
      !['PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'WITHDRAWN'].includes(proposal.status)) return failure('AGREEMENT_CHANGE_INVALID', 'Predlog nije dostupan. Osvežite Dogovor.');
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
  withdraw(proposalId: string, account: ReceiptAccount): Promise<Ishod<{
    proposalId: string; status: 'WITHDRAWN'; idempotentReplay: boolean; authoritative: true;
  }>> {
    const owner = changeAccount(account);
    if (!owner || !uuid(proposalId)) return Promise.resolve(failure('AGREEMENT_CHANGE_INVALID', 'Predlog nije dostupan.'));
    return readOwnedResult({ ...changeOptions, account: owner, write: true,
      request: () => changeResponse(supabase.rpc('rpc_withdraw_agreement_change', { p_proposal_id: proposalId })),
      decode: raw => {
        const row = record(raw);
        return row && exactKeys(row, ['proposalId', 'status', 'idempotentReplay', 'authoritative']) &&
          sameId(row.proposalId, proposalId) && row.status === 'WITHDRAWN' &&
          typeof row.idempotentReplay === 'boolean' && row.authoritative === true
          ? { proposalId: row.proposalId, status: 'WITHDRAWN', idempotentReplay: row.idempotentReplay, authoritative: true } : null;
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
    if (error) throw new Error('AGREEMENT_LIST_FAILED');
    if (!Array.isArray(data)) throw new Error('AGREEMENT_LIST_INVALID_PROJECTION');
    return data.map((row) => mapAgreement(row, uid));
  },

  async dogovor(id) {
    const uid = await userId();
    const { data, error } = await supabase.rpc('rpc_get_agreement_workspace', {
      p_agreement_id: id,
    });
    if (error) throw new Error('AGREEMENT_READ_FAILED');
    if (!data) return null;
    return mapAgreement(data, uid);
  },

  async posaljiPoruku(_dogovorId, telo) {
    if (!telo.trim()) return { ok: false, kod: 'MESSAGE_REQUIRED', poruka: 'Unesite poruku.' };
    return { ok: false, kod: 'MESSAGE_RETRY_KEY_REQUIRED',
      poruka: 'Otvorite Poruke u Dogovoru i pošaljite poruku iz tog prikaza.' };
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

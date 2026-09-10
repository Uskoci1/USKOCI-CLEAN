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
    const patch: Record<string, unknown> = {};
    if (k.izmena.cenaIznos !== undefined) patch.price_rsd = k.izmena.cenaIznos;
    if (k.izmena.cenaValuta !== undefined) patch.currency = k.izmena.cenaValuta;
    if (k.izmena.pocetakIso !== undefined) patch.proposed_start_at = k.izmena.pocetakIso;
    if (k.izmena.krajIso !== undefined) patch.proposed_end_at = k.izmena.krajIso;
    if (k.izmena.obim !== undefined) patch.scope_note = k.izmena.obim;

    if (!Object.keys(patch).length) {
      return { ok: false, kod: 'CHANGE_PATCH_REQUIRED', poruka: 'Izmenite bar jedno polje Dogovora.' };
    }

    const { data, error } = await supabase.rpc('rpc_propose_agreement_change_v2', {
      p_agreement_id: k.dogovorId,
      p_expected_version: k.ocekivanaVerzija,
      p_patch: patch,
      p_reason: k.razlog ?? null,
      p_client_request_id: k.clientRequestId,
    });
    if (error || !data) return fail(error, 'CHANGE_PROPOSAL_FAILED', 'Predlog izmene nije sačuvan.');
    return { ok: true, podatak: { predlogId: data } };
  },

  async odgovoriNaIzmenu(predlogId, prihvatam) {
    const { error } = await supabase.rpc('rpc_respond_agreement_change', {
      p_proposal_id: predlogId,
      p_accept: prihvatam,
    });
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

import type { DogovorProjekcija, UcesnikProjekcija } from '../contracts/projections';
import type { Ishod, IzmenaKomanda, Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type AgreementOverrides = Partial<Pick<
  Izvor,
  'mojiDogovori' | 'dogovor' | 'posaljiPoruku' | 'predloziIzmenu' | 'odgovoriNaIzmenu'
>>;

function fail<T>(error: any, code: string, message: string): Ishod<T> {
  return { ok: false, kod: error?.message || error?.code || code, poruka: error?.message || message };
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
      mesta: null,
      viSte: true,
      telefon: null,
    },
    {
      id: otherId,
      ime: otherName || 'Druga strana',
      inicijali: (otherName || 'DS').slice(0, 2).toUpperCase(),
      uloga: requester ? 'uskocer' : 'narucilac',
      mesta: covered,
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
    vremeTekst: formatTime(raw.startsAt ?? terms.proposed_start_at),
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

async function userId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('AUTH_REQUIRED');
  return data.user.id;
}

export const agreementProductionOverrides: AgreementOverrides = {
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
};

import type { DogovorProjekcija, UcesnikProjekcija } from '../contracts/projections';
import type { Izvor } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type AgreementReadService = Pick<Izvor, 'mojiDogovori' | 'dogovor'>;

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

/**
 * Canonical production client boundary for Agreement read operations.
 * This intentionally preserves the exact active behavior previously owned by
 * agreementProductionOverrides. Backend authority remains in the canonical
 * Agreement RPC projections; this service only maps them to the Izvor contract.
 */
export const agreementClientService: AgreementReadService = {
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
};

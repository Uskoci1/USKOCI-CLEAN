import type { MojaPrijavaProjekcija, StanjeMojePrijave } from '../contracts/projections';
import type { Ishod, Izvor, PovuciPrijavuKomanda } from './ports';
import { supabaseKlijent } from './supabaseClient';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type ApplicationLifecycleService = Pick<Izvor, 'mojePrijave' | 'povuciPrijavu'>;

function fail<T>(error: any, code: string, message: string): Ishod<T> {
  return {
    ok: false,
    kod: error?.message || error?.code || code,
    poruka: error?.message || message,
  };
}

function formatTime(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleString('sr-Latn-RS') : 'Fleksibilno';
}

function formatLocation(area: string | null | undefined, city: string | null | undefined) {
  return [area, city].filter(Boolean).join(', ') || 'Lokacija nije navedena';
}

function mapApplication(raw: any): MojaPrijavaProjekcija {
  const state = String(raw?.state ?? '') as StanjeMojePrijave;
  const allowed: StanjeMojePrijave[] = [
    'SUBMITTED',
    'VIEWED',
    'SHORTLISTED',
    'STALE_REVIEW_REQUIRED',
    'WITHDRAWN',
    'SELECTED',
    'CLOSED',
  ];
  if (!allowed.includes(state)) {
    throw new Error(`MY_APPLICATIONS_INVALID_STATE:${state}`);
  }

  const amount = Number(raw?.priceRsd ?? 0);
  const currentNeedRevision = Number(raw?.needRevision ?? 0);
  const submittedNeedRevision = Number(raw?.submittedNeedRevision ?? 0);
  const version = Number(raw?.version ?? 0);
  const coveredSlots = Number(raw?.coveredSlots ?? 0);

  if (!raw?.applicationId || !raw?.needId || currentNeedRevision < 1 || submittedNeedRevision < 1 || version < 1 || coveredSlots < 1 || amount <= 0) {
    throw new Error('MY_APPLICATIONS_INVALID_PROJECTION');
  }

  return {
    prijavaId: String(raw.applicationId),
    potrebaId: String(raw.needId),
    potrebaRevizija: currentNeedRevision,
    prijavaRevizija: submittedNeedRevision,
    prijavaVerzija: version,
    stanje: state,
    naslov: String(raw?.title ?? 'Zadatak'),
    opis: String(raw?.description ?? ''),
    cena: {
      iznos: amount,
      valuta: 'RSD',
      prikaz: `${amount.toLocaleString('sr-Latn-RS')} RSD`,
    },
    pokrivaMesta: coveredSlots,
    napomena: String(raw?.scopeNote ?? ''),
    podrucjeTekst: formatLocation(raw?.approximateArea, raw?.approximateCity),
    vremeTekst: formatTime(raw?.startsAt),
    dogovorId: raw?.agreementId ? String(raw.agreementId) : null,
    promenjenaPotreba: raw?.requiresStaleReview === true,
    mozePovuci: raw?.canWithdraw === true,
    traziPaznju: raw?.attentionRequired === true,
  };
}

export const applicationClientService: ApplicationLifecycleService = {
  async mojePrijave() {
    const { data, error } = await supabase.rpc('rpc_list_my_applications');
    if (error) throw new Error(error.message || 'MY_APPLICATIONS_READ_FAILED');
    if (!Array.isArray(data)) throw new Error('MY_APPLICATIONS_INVALID_PROJECTION');
    return data.map(mapApplication);
  },

  async povuciPrijavu(k: PovuciPrijavuKomanda): Promise<Ishod<{ stanje: 'WITHDRAWN'; verzija: number }>> {
    const { data, error } = await supabase.rpc('rpc_withdraw_response', {
      p_response_id: k.prijavaId,
      p_need_revision: k.potrebaRevizija,
      p_response_version: k.prijavaVerzija,
      p_client_request_id: k.clientRequestId,
      p_reason: k.razlog ?? null,
    });
    if (error) return fail(error, 'WITHDRAW_RESPONSE_FAILED', 'Prijava nije mogla da se povuče.');
    if (String(data?.status ?? '') !== 'WITHDRAWN') {
      return { ok: false, kod: 'WITHDRAW_RESPONSE_INVALID_RESULT', poruka: 'Server nije potvrdio povlačenje Prijave.' };
    }
    return {
      ok: true,
      podatak: {
        stanje: 'WITHDRAWN',
        verzija: Number(data?.version ?? k.prijavaVerzija),
      },
    };
  },
};
